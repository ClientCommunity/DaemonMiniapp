"""API Blueprints aggregation module for DeamonOTPBot backend."""
from __future__ import annotations

from flask import Flask

from api.auth import auth_bp
from api.store import store_bp
from api.orders import orders_bp
from api.payments import payments_bp
from api.transfers import transfers_bp
from api.reseller import reseller_bp
from api.downloads import downloads_bp
from api.history import history_bp
from api.admin import admin_bp


def register_blueprints(app: Flask) -> None:
    """Register all REST API blueprints onto the main Flask application."""
    app.register_blueprint(auth_bp)
    app.register_blueprint(store_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(transfers_bp)
    app.register_blueprint(reseller_bp)
    app.register_blueprint(downloads_bp)
    app.register_blueprint(history_bp)
    app.register_blueprint(admin_bp)
