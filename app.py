"""Production entry point and orchestrator for DeamonOTPBot backend.

Initializes the modular Flask REST API with:
- Reverse proxy security middleware (X-Proxy-Secret verification)
- CORS header injection & OPTIONS preflight support
- JSON error handlers (400, 401, 403, 404, 405, 500)
- REST API Blueprints (auth, store, orders, payments, transfers, reseller, downloads, history, admin)
- Webhook backward compatibility (/webhook/add_balance, /webhook/health)
- Telethon bot launcher in background thread when run as main
"""
from __future__ import annotations

import logging
import os
import sys
import threading
from pathlib import Path

from flask import Flask, jsonify, request

import config
from api import register_blueprints
from database import connect, migrate, utcnow

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("deamon.app")


def create_app() -> Flask:
    """Flask application factory."""
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    # 1. Reverse Proxy & Security Middleware
    @app.before_request
    def security_and_preflight_middleware():
        # Handle CORS preflight OPTIONS immediately
        if request.method == "OPTIONS":
            return "", 204

        # Always exempt public health checks
        if request.path in ("/health", "/api/health", "/webhook/health"):
            return None

        # Check X-Proxy-Secret
        proxy_header = request.headers.get("X-Proxy-Secret", "").strip()
        if proxy_header:
            if proxy_header not in config.ACCEPTED_PROXY_SECRETS:
                logger.warning(
                    "Request rejected: Invalid X-Proxy-Secret '%s' from IP %s",
                    proxy_header[:8] + "...",
                    request.remote_addr,
                )
                return jsonify({
                    "error": "Forbidden",
                    "detail": "Invalid X-Proxy-Secret header"
                }), 403
        elif config.REQUIRE_PROXY_SECRET:
            logger.warning(
                "Request rejected: Missing X-Proxy-Secret from IP %s for %s",
                request.remote_addr,
                request.path,
            )
            return jsonify({
                "error": "Forbidden",
                "detail": "Missing X-Proxy-Secret header"
            }), 403

        return None

    # 2. Global CORS Headers
    @app.after_request
    def apply_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    # 3. Standard JSON Error Handlers
    @app.errorhandler(400)
    def bad_request(error):
        msg = getattr(error, "description", "Bad Request")
        return jsonify({"success": False, "error": msg}), 400

    @app.errorhandler(401)
    def unauthorized(error):
        msg = getattr(error, "description", "Unauthorized")
        return jsonify({"success": False, "error": msg}), 401

    @app.errorhandler(403)
    def forbidden(error):
        msg = getattr(error, "description", "Forbidden")
        return jsonify({"success": False, "error": msg}), 403

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"success": False, "error": "Endpoint not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({"success": False, "error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(error):
        logger.error("Internal Server Error: %s", error)
        return jsonify({"success": False, "error": "Internal server error"}), 500

    # 4. Core Root and Health Endpoints
    @app.route("/health", methods=["GET"])
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "DeamonOTPBot API",
            "proxy_secret_required": config.REQUIRE_PROXY_SECRET,
            "timestamp": utcnow(),
        }), 200

    # 5. Legacy Webhook Backward Compatibility
    @app.route("/webhook/add_balance", methods=["POST"])
    def webhook_add_balance():
        """Add balance to user wallet via existing secret-authenticated webhook."""
        data = request.get_json(silent=True) or {}
        if data.get("secret") != config.WEBHOOK_SECRET:
            return jsonify({"success": False, "error": "Invalid webhook secret"}), 401

        user_id = data.get("user_id")
        amount = data.get("amount")
        reason = data.get("reason", "Webhook deposit")

        if not user_id or not amount:
            return jsonify({"success": False, "error": "Missing user_id or amount"}), 400

        try:
            amt = int(amount)
            uid = int(user_id)
            if amt <= 0:
                return jsonify({"success": False, "error": "Amount must be positive"}), 400
        except (ValueError, TypeError):
            return jsonify({"success": False, "error": "Invalid user_id or amount format"}), 400

        with connect() as conn:
            conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
            old_row = conn.execute("SELECT balance FROM users WHERE user_id = ?", (uid,)).fetchone()
            old_balance = int(old_row[0] or 0) if old_row else 0

            conn.execute(
                "UPDATE users SET balance = balance + ?, total_deposited = total_deposited + ? WHERE user_id = ?",
                (amt, amt, uid),
            )
            conn.execute("""
                INSERT INTO deposits (user_id, amount, method_name, status)
                VALUES (?, ?, ?, 'success')
            """, (uid, amt, f"Webhook API ({reason})"))

            new_balance = old_balance + amt

        return jsonify({
            "success": True,
            "message": f"Added {amt} to user {uid}",
            "user_id": uid,
            "amount_added": amt,
            "old_balance": old_balance,
            "new_balance": new_balance,
        }), 200

    @app.route("/webhook/health", methods=["GET"])
    def webhook_health():
        return jsonify({"status": "healthy", "timestamp": utcnow()}), 200

    # 6. Register All Modular REST Blueprints
    register_blueprints(app)

    return app


def start_bot_background():
    """Launch the Telegram bot in a separate background thread."""
    os.environ["DISABLE_BOT_WEBHOOK"] = "1"
    import runpy

    bot_script = config.BASE_DIR / "bot.py"
    if not bot_script.exists():
        logger.warning("bot.py not found at %s; skipping bot launch.", bot_script)
        return

    try:
        logger.info("Starting Telethon Telegram Bot in background thread...")
        runpy.run_path(str(bot_script), run_name="__main__")
    except Exception as exc:
        logger.error("Telegram bot thread encountered an error: %s", exc)


app = create_app()

if __name__ == "__main__":
    # 1. Run migrations to ensure all database structures are prepared
    migrate()
    logger.info("Database schema checked and migrated successfully.")

    # 2. Optionally start the Telegram Bot in background
    spawn_bot = os.getenv("SPAWN_BOT", "1").lower() not in ("0", "false", "no")
    if spawn_bot and config.BOT_TOKEN:
        bot_thread = threading.Thread(target=start_bot_background, daemon=True, name="TelegramBotThread")
        bot_thread.start()
        logger.info("Telegram Bot thread spawned in background.")

    # 3. Start Flask REST API server
    logger.info(
        "DeamonOTPBot Flask REST server running on http://%s:%s",
        config.FLASK_HOST,
        config.FLASK_PORT,
    )
    app.run(
        host=config.FLASK_HOST,
        port=config.FLASK_PORT,
        debug=False,
        use_reloader=False,
    )
