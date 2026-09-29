"""Database primitives and migrations for automatic payments.

All timestamps are UTC ISO-8601 strings.  Each operation opens a short-lived
connection, which keeps the scanner independent from Telethon's legacy cursor.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

DB_PATH = Path(os.getenv("BOT_DATABASE", "otp_bot_final.db"))


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


@contextmanager
def transaction(immediate: bool = False) -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()


def migrate() -> None:
    with transaction() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS service_servers (
          server_no INTEGER PRIMARY KEY CHECK(server_no IN (3,4)), service_enabled INTEGER NOT NULL DEFAULT 0,
          display_name TEXT NOT NULL DEFAULT '',
          api_enabled INTEGER NOT NULL DEFAULT 0, api_url TEXT NOT NULL DEFAULT '', api_key TEXT NOT NULL DEFAULT '',
          percent_markup REAL NOT NULL DEFAULT 0, fixed_markup REAL NOT NULL DEFAULT 0,
          priority INTEGER NOT NULL DEFAULT 100, minimum_price REAL NOT NULL DEFAULT 0,
          maximum_price REAL NOT NULL DEFAULT 0, retry_count INTEGER NOT NULL DEFAULT 2,
          timeout_seconds REAL NOT NULL DEFAULT 10, last_health TEXT, last_health_at TEXT,
          requests INTEGER NOT NULL DEFAULT 0, successes INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO service_servers(server_no) VALUES (3),(4);
        CREATE TABLE IF NOT EXISTS server3_servers (
          code TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
          in_stock INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS server3_services (
          service_code TEXT NOT NULL, server_code TEXT NOT NULL,
          name TEXT NOT NULL DEFAULT '', keywords TEXT NOT NULL DEFAULT '', provider_price REAL NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1, in_stock INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL, PRIMARY KEY(service_code,server_code)
        );
        CREATE INDEX IF NOT EXISTS server3_visible_services
          ON server3_services(enabled,in_stock,service_code,provider_price);
        CREATE TABLE IF NOT EXISTS server3_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT, provider_order_id TEXT UNIQUE,
          user_id INTEGER NOT NULL, service_code TEXT NOT NULL, server_code TEXT NOT NULL,
          phone TEXT, provider_price REAL NOT NULL, charged_price INTEGER NOT NULL,
          status TEXT NOT NULL, sms_code TEXT, refunded INTEGER NOT NULL DEFAULT 0,
          expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT
        );
        CREATE TABLE IF NOT EXISTS server4_operators (
          code TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS server4_countries (
          operator_code TEXT NOT NULL, country_code TEXT NOT NULL, name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1, in_stock INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
          PRIMARY KEY(operator_code,country_code)
        );
        CREATE TABLE IF NOT EXISTS server4_services (
          operator_code TEXT NOT NULL, service_code TEXT NOT NULL, name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1, in_stock INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
          PRIMARY KEY(operator_code,service_code)
        );
        CREATE TABLE IF NOT EXISTS server4_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT, provider_order_id TEXT UNIQUE, user_id INTEGER NOT NULL,
          operator_code TEXT NOT NULL, country_code TEXT NOT NULL, service_code TEXT NOT NULL,
          phone TEXT, provider_price REAL NOT NULL, charged_price INTEGER NOT NULL,
          status TEXT NOT NULL, sms_code TEXT, refunded INTEGER NOT NULL DEFAULT 0,
          expires_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS server4_stock (
          operator_code TEXT NOT NULL, country_code TEXT NOT NULL, service_code TEXT NOT NULL,
          min_price REAL NOT NULL, available_count INTEGER NOT NULL, updated_at TEXT NOT NULL,
          PRIMARY KEY(operator_code,country_code,service_code)
        );
        CREATE TABLE IF NOT EXISTS smm_providers (
          id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, api_url TEXT NOT NULL,
          api_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, currency TEXT NOT NULL DEFAULT 'USD',
          balance REAL NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 100,
          auto_sync INTEGER NOT NULL DEFAULT 1, auto_order INTEGER NOT NULL DEFAULT 1,
          auto_retry INTEGER NOT NULL DEFAULT 1, success_rate REAL NOT NULL DEFAULT 100,
          average_speed REAL NOT NULL DEFAULT 0, percent_markup REAL NOT NULL DEFAULT 40,
          fixed_markup REAL NOT NULL DEFAULT 0, exchange_rate REAL NOT NULL DEFAULT 83,
          minimum_profit REAL NOT NULL DEFAULT 0, maximum_profit REAL NOT NULL DEFAULT 0,
          round_to REAL NOT NULL DEFAULT 1, last_sync TEXT, last_error TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS smm_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL REFERENCES smm_providers(id) ON DELETE CASCADE,
          remote_name TEXT NOT NULL, display_name TEXT NOT NULL, visible INTEGER NOT NULL DEFAULT 1,
          sort_position INTEGER NOT NULL DEFAULT 100, percent_markup REAL, fixed_markup REAL,
          UNIQUE(provider_id,remote_name)
        );
        CREATE TABLE IF NOT EXISTS smm_services (
          id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER NOT NULL REFERENCES smm_providers(id) ON DELETE CASCADE,
          category_id INTEGER NOT NULL REFERENCES smm_categories(id) ON DELETE CASCADE,
          remote_service_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
          service_type TEXT NOT NULL DEFAULT 'Default', rate REAL NOT NULL, minimum INTEGER NOT NULL,
          maximum INTEGER NOT NULL, average_time TEXT NOT NULL DEFAULT '', refill INTEGER NOT NULL DEFAULT 0,
          cancellable INTEGER NOT NULL DEFAULT 0, dripfeed INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1, visible INTEGER NOT NULL DEFAULT 1,
          featured INTEGER NOT NULL DEFAULT 0, popular INTEGER NOT NULL DEFAULT 0,
          trending INTEGER NOT NULL DEFAULT 0, emoji TEXT NOT NULL DEFAULT '🟢',
          sort_position INTEGER NOT NULL DEFAULT 100, custom_markup INTEGER NOT NULL DEFAULT 0,
          markup_type TEXT, markup_value REAL, minimum_profit REAL, maximum_profit REAL,
          tags TEXT NOT NULL DEFAULT '', order_count INTEGER NOT NULL DEFAULT 0,
          provider_updated_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(provider_id,remote_service_id)
        );
        CREATE INDEX IF NOT EXISTS smm_service_search ON smm_services(enabled,visible,name,rate);
        CREATE INDEX IF NOT EXISTS smm_category_browse ON smm_categories(visible,display_name,provider_id);
        CREATE INDEX IF NOT EXISTS smm_service_category ON smm_services(category_id,enabled,visible,name);
        CREATE TABLE IF NOT EXISTS smm_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, username TEXT,
          service_id INTEGER NOT NULL REFERENCES smm_services(id), provider_id INTEGER NOT NULL REFERENCES smm_providers(id),
          provider_order_id TEXT, quantity INTEGER NOT NULL, link TEXT NOT NULL, charge REAL NOT NULL,
          provider_cost REAL NOT NULL, profit REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
          start_count INTEGER, current_count INTEGER, remains INTEGER, refill_status TEXT,
          cancel_status TEXT, reason TEXT, retry_count INTEGER NOT NULL DEFAULT 0,
          refunded INTEGER NOT NULL DEFAULT 0, client_request_id TEXT, provider_payload TEXT,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS smm_order_status ON smm_orders(status,updated_at);
        CREATE TABLE IF NOT EXISTS smm_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT, provider_id INTEGER, order_id INTEGER,
          admin_id INTEGER, action TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'info',
          detail TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS smm_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
        INSERT OR IGNORE INTO smm_settings(key,value) VALUES
          ('enabled','0'),('maintenance','0'),('selection_mode','lowest_price'),
          ('sync_interval','300'),('search_limit','500'),('services_per_page','10'),
          ('orders_per_page','10'),('default_currency','INR'),('low_balance','10');
        """)
        columns = {row[1] for row in conn.execute("PRAGMA table_info(server3_services)")}
        if "keywords" not in columns:
            conn.execute("ALTER TABLE server3_services ADD COLUMN keywords TEXT NOT NULL DEFAULT ''")
        for table in ("server4_countries", "server4_services"):
            columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
            if "in_stock" not in columns:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN in_stock INTEGER NOT NULL DEFAULT 0")
        for table in ("server3_orders", "server4_orders"):
            columns = {row[1] for row in conn.execute(f"PRAGMA table_info({table})")}
            if "refunded" not in columns:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN refunded INTEGER NOT NULL DEFAULT 0")
            if "expires_at" not in columns:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN expires_at TEXT")
        smm_provider_columns = {row[1] for row in conn.execute("PRAGMA table_info(smm_providers)")}
        if "deleted_at" not in smm_provider_columns:
            conn.execute("ALTER TABLE smm_providers ADD COLUMN deleted_at TEXT")
        smm_service_columns = {row[1] for row in conn.execute("PRAGMA table_info(smm_services)")}
        if "deleted_at" not in smm_service_columns:
            conn.execute("ALTER TABLE smm_services ADD COLUMN deleted_at TEXT")
        smm_order_columns = {row[1] for row in conn.execute("PRAGMA table_info(smm_orders)")}
        if "client_request_id" not in smm_order_columns:
            conn.execute("ALTER TABLE smm_orders ADD COLUMN client_request_id TEXT")
        if "provider_payload" not in smm_order_columns:
            conn.execute("ALTER TABLE smm_orders ADD COLUMN provider_payload TEXT")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS smm_order_request ON smm_orders(client_request_id) WHERE client_request_id IS NOT NULL")
        server_columns = {row[1] for row in conn.execute("PRAGMA table_info(service_servers)")}
        if "display_name" not in server_columns:
            conn.execute("ALTER TABLE service_servers ADD COLUMN display_name TEXT NOT NULL DEFAULT ''")
        conn.execute("UPDATE service_servers SET display_name=CASE server_no WHEN 3 THEN 'Fast OTP' WHEN 4 THEN 'Fresh Numbers' END WHERE display_name='' OR display_name IS NULL")
