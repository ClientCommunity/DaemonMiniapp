"""Session file download Blueprint (Single session and Bulk ZIP archive).

Guarantees secure downloads:
Only the purchasing user or authorized administrator may download sessions.
"""
from __future__ import annotations

import io
import logging
import os
import zipfile
from flask import Blueprint, jsonify, request, send_file

from config import SESSIONS_DIR, MASTER_ADMIN_IDS
from database import connect
from services.auth_service import get_current_user_id

logger = logging.getLogger("api.downloads")
downloads_bp = Blueprint("downloads", __name__)


@downloads_bp.route("/api/session/download/<phone>", methods=["GET"])
def download_session(phone: str):
    """Download a single purchased .session file."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    clean_phone = phone.replace("+", "").replace(" ", "").strip()

    with connect() as conn:
        order = conn.execute(
            "SELECT 1 FROM orders WHERE user_id = ? AND phone LIKE ?",
            (uid, f"%{clean_phone}%")
        ).fetchone()

        if not order and uid not in MASTER_ADMIN_IDS:
            return jsonify({"error": "Unauthorized access to this session."}), 403

        stock_row = conn.execute("SELECT session_file, twofa FROM stock WHERE phone = ?", (clean_phone,)).fetchone()

    from config import BASE_DIR
    from pathlib import Path

    raw_file = (stock_row["session_file"] or "").strip() if stock_row else ""
    possible_paths = [
        SESSIONS_DIR / f"{clean_phone}.session",
    ]
    if raw_file:
        possible_paths.extend([
            SESSIONS_DIR / os.path.basename(raw_file),
            BASE_DIR / raw_file,
            SESSIONS_DIR / raw_file,
            Path(raw_file),
        ])

    sess_path = None
    for p in possible_paths:
        if p and p.is_file():
            sess_path = p
            break

    if not sess_path or not sess_path.exists():
        # If physical file does not exist on disk, generate or provide text fallback
        return jsonify({"error": "Session file not found on disk or expired."}), 404

    return send_file(
        str(sess_path),
        as_attachment=True,
        download_name=f"{clean_phone}.session",
        mimetype="application/octet-stream",
    )


@downloads_bp.route("/api/session/download_zip/<order_id>", methods=["GET"])
def download_bulk_zip(order_id: str):
    """Download in-memory .zip archive containing all sessions in a bulk purchase."""
    uid = get_current_user_id(request)
    if not uid:
        return jsonify({"error": "Unauthorized"}), 401

    clean_oid = order_id.strip()

    with connect() as conn:
        order = conn.execute(
            "SELECT phone, country, year, price FROM orders WHERE user_id = ? AND (id = ? OR phone LIKE ? OR server = 'Server 2')",
            (uid, clean_oid if clean_oid.isdigit() else -1, f"%{clean_oid}%")
        ).fetchone()

        if not order and uid not in MASTER_ADMIN_IDS:
            return jsonify({"error": "Order not found or unauthorized."}), 403

    phones_raw = order["phone"] if order else ""
    phone_list = [p.strip().replace("+", "") for p in phones_raw.split(",") if p.strip()]

    if not phone_list:
        return jsonify({"error": "No sessions attached to this order."}), 404

    # Build ZIP archive in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        summary_lines = ["Phone Number | 2FA Password", "-------------------------"]

        for ph in phone_list:
            file_name = f"{ph}.session"
            file_path = SESSIONS_DIR / file_name

            if file_path.is_file():
                zf.write(file_path, arcname=file_name)
            else:
                # Include metadata placeholder
                zf.writestr(file_name, f"Telethon Session Placeholder for +{ph}\n".encode("utf-8"))

            with connect() as conn:
                s_row = conn.execute("SELECT twofa FROM stock WHERE phone = ?", (ph,)).fetchone()
                twofa = s_row["twofa"] if s_row and s_row["twofa"] else "None"
                summary_lines.append(f"+{ph} | {twofa}")

        zf.writestr("accounts.txt", "\n".join(summary_lines).encode("utf-8"))

    zip_buffer.seek(0)
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name=f"accounts_{clean_oid}.zip",
        mimetype="application/zip",
    )
