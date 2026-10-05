"""Database primitives, migrations, and transactional helper functions for DeamonOTPBot.

All timestamps are UTC ISO-8601 strings. Short-lived connections with WAL mode and
busy timeouts ensure high-concurrency safety between Telegram bot handlers, Flask webapp,
and provider background workers.
"""
from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator, Optional

logger = logging.getLogger("database")

# Database path resolution: respect BOT_DATABASE env var if set, else otp_bot_final.db next to this file
_env_db = os.getenv("BOT_DATABASE")
DB_PATH = Path(_env_db) if _env_db else (Path(__file__).resolve().parent / "otp_bot_final.db")

MASTER_ADMIN_IDS = {7507183871, 1928631932}
ADMIN_PERMISSIONS = {
    "p_add_stock",
    "p_manage_stock",
    "p_stats",
    "p_bal",
    "p_settings",
}


def utcnow() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    """Open and configure a SQLite connection with WAL mode and busy timeout."""
    conn = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    return conn


@contextmanager
def transaction(immediate: bool = False) -> Iterator[sqlite3.Connection]:
    """Provide a transactional scope for atomic operations.
    
    If immediate=True, acquires an immediate write lock via BEGIN IMMEDIATE to prevent
    race conditions or deadlocks during concurrent multi-step updates.
    """
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
    """Run comprehensive, idempotent database migrations.
    
    Ensures all core tables, columns, constraints, and indexes required by bot.py,
    webapp.py, and Mini App specifications exist without altering or losing existing data.
    """
    with transaction(immediate=True) as conn:
        # 1. Base Core Tables
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            balance INTEGER DEFAULT 0,
            sales_balance INTEGER DEFAULT 0,
            referred_by INTEGER,
            total_deposited INTEGER DEFAULT 0,
            joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            banned INTEGER DEFAULT 0,
            discount INTEGER DEFAULT 0,
            terms_accepted INTEGER DEFAULT 0,
            pref_curr TEXT DEFAULT 'INR',
            promo_balance INTEGER DEFAULT 0,
            reseller_token TEXT
        );

        CREATE TABLE IF NOT EXISTS user_server_discounts (
            user_id INTEGER NOT NULL,
            server_no INTEGER NOT NULL CHECK(server_no BETWEEN 1 AND 5),
            discount_percent INTEGER NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, server_no)
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS fampay_gateways (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            upi_id TEXT NOT NULL,
            payment_name TEXT NOT NULL DEFAULT 'Payment',
            min_deposit INTEGER NOT NULL DEFAULT 1,
            max_deposit INTEGER NOT NULL DEFAULT 50000,
            gmail TEXT NOT NULL DEFAULT '',
            app_password TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS fampay_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            transaction_id TEXT UNIQUE,
            qr_msg_id INTEGER DEFAULT 0,
            last_response TEXT,
            last_checked_at TEXT,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            check_count INTEGER NOT NULL DEFAULT 0,
            review_status TEXT,
            review_screenshot_msg_id INTEGER,
            review_utr TEXT,
            reviewed_by INTEGER,
            reviewed_at TEXT,
            gateway_id INTEGER REFERENCES fampay_gateways(id)
        );
        CREATE INDEX IF NOT EXISTS fampay_pending_expiry ON fampay_orders(status, expires_at);

        CREATE TABLE IF NOT EXISTS upi_orders (
            order_id TEXT PRIMARY KEY,
            user_id INTEGER,
            amount INTEGER,
            status TEXT,
            qr_msg_id INTEGER,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            country TEXT,
            year INTEGER,
            price INTEGER,
            phone TEXT,
            otp TEXT,
            server TEXT DEFAULT 'Local',
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            promo_deducted INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            method_name TEXT,
            status TEXT DEFAULT 'pending',
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);

        CREATE TABLE IF NOT EXISTS custom_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            caption TEXT,
            qr_file_id TEXT
        );

        CREATE TABLE IF NOT EXISTS admins (
            user_id INTEGER PRIMARY KEY,
            p_add_stock INTEGER DEFAULT 0,
            p_manage_stock INTEGER DEFAULT 0,
            p_stats INTEGER DEFAULT 0,
            p_bal INTEGER DEFAULT 0,
            p_settings INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS api_credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_id INTEGER NOT NULL,
            api_hash TEXT NOT NULL,
            label TEXT DEFAULT 'API',
            active INTEGER DEFAULT 1,
            added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS custom_countries (
            code TEXT PRIMARY KEY,
            name TEXT,
            flag TEXT
        );

        CREATE TABLE IF NOT EXISTS lzt_settings (
            country TEXT PRIMARY KEY,
            markup_percent INTEGER DEFAULT 20
        );

        CREATE TABLE IF NOT EXISTS sell_prices (
            country_code TEXT,
            year TEXT,
            price_good INTEGER DEFAULT 20,
            price_spam INTEGER DEFAULT 5,
            PRIMARY KEY(country_code, year)
        );

        CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount INTEGER,
            method TEXT,
            details TEXT,
            status TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS referral_rewards (
            referred_user_id INTEGER PRIMARY KEY,
            referrer_id INTEGER NOT NULL,
            reward INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS blacklisted_phones (
            phone TEXT PRIMARY KEY,
            removed_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS promo_codes (
            code TEXT PRIMARY KEY,
            value INTEGER,
            max_uses INTEGER DEFAULT 1,
            used_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS promo_logs (
            code TEXT,
            user_id INTEGER,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS giveaways (
            id TEXT PRIMARY KEY,
            prize_name TEXT,
            ticket_price INTEGER,
            min_participants INTEGER,
            winners_count INTEGER,
            status TEXT DEFAULT 'open',
            created_by INTEGER,
            message_id INTEGER DEFAULT NULL,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS giveaway_tickets (
            giveaway_id TEXT,
            user_id INTEGER,
            tickets INTEGER DEFAULT 0,
            PRIMARY KEY(giveaway_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS balance_transfers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            recipient_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_transfers_sender ON balance_transfers(sender_id);
        CREATE INDEX IF NOT EXISTS idx_transfers_recipient ON balance_transfers(recipient_id);

        CREATE TABLE IF NOT EXISTS reseller_links (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            margin_percent INTEGER NOT NULL DEFAULT 15,
            product_type TEXT DEFAULT 'all',
            target_id TEXT DEFAULT '',
            base_price REAL DEFAULT 0,
            margin_inr REAL DEFAULT 15,
            total_sales INTEGER DEFAULT 0,
            total_earned REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reseller_earnings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reseller_id INTEGER NOT NULL,
            customer_id INTEGER NOT NULL,
            token TEXT,
            amount INTEGER NOT NULL,
            commission INTEGER NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Managed Service Providers (Servers 3, 4, 5)
        CREATE TABLE IF NOT EXISTS service_servers (
            server_no INTEGER PRIMARY KEY CHECK(server_no IN (3,4)),
            service_enabled INTEGER NOT NULL DEFAULT 0,
            display_name TEXT NOT NULL DEFAULT '',
            api_enabled INTEGER NOT NULL DEFAULT 0,
            api_url TEXT NOT NULL DEFAULT '',
            api_key TEXT NOT NULL DEFAULT '',
            percent_markup REAL NOT NULL DEFAULT 0,
            fixed_markup REAL NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 100,
            minimum_price REAL NOT NULL DEFAULT 0,
            maximum_price REAL NOT NULL DEFAULT 0,
            retry_count INTEGER NOT NULL DEFAULT 2,
            timeout_seconds REAL NOT NULL DEFAULT 10,
            last_health TEXT,
            last_health_at TEXT,
            requests INTEGER NOT NULL DEFAULT 0,
            successes INTEGER NOT NULL DEFAULT 0,
            failures INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO service_servers(server_no) VALUES (3),(4);

        CREATE TABLE IF NOT EXISTS server3_servers (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            in_stock INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server3_services (
            service_code TEXT NOT NULL,
            server_code TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT '',
            keywords TEXT NOT NULL DEFAULT '',
            provider_price REAL NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            in_stock INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(service_code,server_code)
        );
        CREATE INDEX IF NOT EXISTS server3_visible_services
            ON server3_services(enabled,in_stock,service_code,provider_price);

        CREATE TABLE IF NOT EXISTS server3_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_order_id TEXT UNIQUE,
            user_id INTEGER NOT NULL,
            service_code TEXT NOT NULL,
            server_code TEXT NOT NULL,
            phone TEXT,
            provider_price REAL NOT NULL,
            charged_price INTEGER NOT NULL,
            status TEXT NOT NULL,
            sms_code TEXT,
            refunded INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS server4_operators (
            code TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server4_countries (
            operator_code TEXT NOT NULL,
            country_code TEXT NOT NULL,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            in_stock INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(operator_code,country_code)
        );

        CREATE TABLE IF NOT EXISTS server4_services (
            operator_code TEXT NOT NULL,
            service_code TEXT NOT NULL,
            name TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            in_stock INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(operator_code,service_code)
        );

        CREATE TABLE IF NOT EXISTS server4_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_order_id TEXT UNIQUE,
            user_id INTEGER NOT NULL,
            operator_code TEXT NOT NULL,
            country_code TEXT NOT NULL,
            service_code TEXT NOT NULL,
            phone TEXT,
            provider_price REAL NOT NULL,
            charged_price INTEGER NOT NULL,
            status TEXT NOT NULL,
            sms_code TEXT,
            refunded INTEGER NOT NULL DEFAULT 0,
            expires_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server4_stock (
            operator_code TEXT NOT NULL,
            country_code TEXT NOT NULL,
            service_code TEXT NOT NULL,
            min_price REAL NOT NULL,
            available_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY(operator_code,country_code,service_code)
        );

        CREATE TABLE IF NOT EXISTS smm_providers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            api_url TEXT NOT NULL,
            api_key TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            currency TEXT NOT NULL DEFAULT 'USD',
            balance REAL NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 100,
            auto_sync INTEGER NOT NULL DEFAULT 1,
            auto_order INTEGER NOT NULL DEFAULT 1,
            auto_retry INTEGER NOT NULL DEFAULT 1,
            success_rate REAL NOT NULL DEFAULT 100,
            average_speed REAL NOT NULL DEFAULT 0,
            percent_markup REAL NOT NULL DEFAULT 40,
            fixed_markup REAL NOT NULL DEFAULT 0,
            exchange_rate REAL NOT NULL DEFAULT 83,
            minimum_profit REAL NOT NULL DEFAULT 0,
            maximum_profit REAL NOT NULL DEFAULT 0,
            round_to REAL NOT NULL DEFAULT 1,
            last_sync TEXT,
            last_error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS smm_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL REFERENCES smm_providers(id) ON DELETE CASCADE,
            remote_name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            visible INTEGER NOT NULL DEFAULT 1,
            sort_position INTEGER NOT NULL DEFAULT 100,
            percent_markup REAL,
            fixed_markup REAL,
            UNIQUE(provider_id,remote_name)
        );

        CREATE TABLE IF NOT EXISTS smm_services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER NOT NULL REFERENCES smm_providers(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES smm_categories(id) ON DELETE CASCADE,
            remote_service_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            service_type TEXT NOT NULL DEFAULT 'Default',
            rate REAL NOT NULL,
            minimum INTEGER NOT NULL,
            maximum INTEGER NOT NULL,
            average_time TEXT NOT NULL DEFAULT '',
            refill INTEGER NOT NULL DEFAULT 0,
            cancellable INTEGER NOT NULL DEFAULT 0,
            dripfeed INTEGER NOT NULL DEFAULT 0,
            enabled INTEGER NOT NULL DEFAULT 1,
            visible INTEGER NOT NULL DEFAULT 1,
            featured INTEGER NOT NULL DEFAULT 0,
            popular INTEGER NOT NULL DEFAULT 0,
            trending INTEGER NOT NULL DEFAULT 0,
            emoji TEXT NOT NULL DEFAULT '🟢',
            sort_position INTEGER NOT NULL DEFAULT 100,
            custom_markup INTEGER NOT NULL DEFAULT 0,
            markup_type TEXT,
            markup_value REAL,
            minimum_profit REAL,
            maximum_profit REAL,
            tags TEXT NOT NULL DEFAULT '',
            order_count INTEGER NOT NULL DEFAULT 0,
            provider_updated_at TEXT NOT NULL,
            deleted_at TEXT,
            UNIQUE(provider_id,remote_service_id)
        );
        CREATE INDEX IF NOT EXISTS smm_service_search ON smm_services(enabled,visible,name,rate);
        CREATE INDEX IF NOT EXISTS smm_category_browse ON smm_categories(visible,display_name,provider_id);
        CREATE INDEX IF NOT EXISTS smm_service_category ON smm_services(category_id,enabled,visible,name);

        CREATE TABLE IF NOT EXISTS smm_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            service_id INTEGER NOT NULL REFERENCES smm_services(id),
            provider_id INTEGER NOT NULL REFERENCES smm_providers(id),
            provider_order_id TEXT,
            quantity INTEGER NOT NULL,
            link TEXT NOT NULL,
            charge REAL NOT NULL,
            provider_cost REAL NOT NULL,
            profit REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            start_count INTEGER,
            current_count INTEGER,
            remains INTEGER,
            refill_status TEXT,
            cancel_status TEXT,
            reason TEXT,
            retry_count INTEGER NOT NULL DEFAULT 0,
            refunded INTEGER NOT NULL DEFAULT 0,
            client_request_id TEXT,
            provider_payload TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS smm_order_status ON smm_orders(status,updated_at);

        CREATE TABLE IF NOT EXISTS smm_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider_id INTEGER,
            order_id INTEGER,
            admin_id INTEGER,
            action TEXT NOT NULL,
            level TEXT NOT NULL DEFAULT 'info',
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS smm_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        INSERT OR IGNORE INTO smm_settings(key,value) VALUES
            ('enabled','0'),('maintenance','0'),('selection_mode','lowest_price'),
            ('sync_interval','300'),('search_limit','500'),('services_per_page','10'),
            ('orders_per_page','10'),('default_currency','INR'),('low_balance','10');
        """)

        # 2. Dynamic column migrations: users table & orders table
        user_columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
        if "promo_balance" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN promo_balance INTEGER DEFAULT 0")
        if "reseller_token" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN reseller_token TEXT")
        if "pref_curr" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN pref_curr TEXT DEFAULT 'INR'")
        if "sales_balance" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN sales_balance INTEGER DEFAULT 0")

        order_columns = {row[1] for row in conn.execute("PRAGMA table_info(orders)")}
        if "promo_deducted" not in order_columns:
            conn.execute("ALTER TABLE orders ADD COLUMN promo_deducted INTEGER DEFAULT 0")

        # 3. Dynamic schema migration: stock table with CHECK(quality_tier IN ('good', 'cheap'))
        stock_sql_row = conn.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock'").fetchone()
        if not stock_sql_row:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS stock (
                    phone TEXT PRIMARY KEY,
                    session_file TEXT,
                    country_name TEXT,
                    country_icon TEXT DEFAULT '🌍',
                    account_year INTEGER,
                    category TEXT DEFAULT 'Good',
                    price INTEGER,
                    available INTEGER DEFAULT 1,
                    twofa TEXT DEFAULT 'None',
                    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    seller_id INTEGER DEFAULT NULL,
                    quality_tier TEXT DEFAULT 'good' CHECK(quality_tier IN ('good', 'cheap'))
                )
            """)
        elif "quality_tier IN ('good', 'cheap')" not in stock_sql_row[0]:
            # Migrate existing stock table to enforce CHECK constraint without data loss
            conn.execute("""
                CREATE TABLE IF NOT EXISTS stock_new (
                    phone TEXT PRIMARY KEY,
                    session_file TEXT,
                    country_name TEXT,
                    country_icon TEXT DEFAULT '🌍',
                    account_year INTEGER,
                    category TEXT DEFAULT 'Good',
                    price INTEGER,
                    available INTEGER DEFAULT 1,
                    twofa TEXT DEFAULT 'None',
                    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    seller_id INTEGER DEFAULT NULL,
                    quality_tier TEXT DEFAULT 'good' CHECK(quality_tier IN ('good', 'cheap'))
                )
            """)
            conn.execute("""
                INSERT OR IGNORE INTO stock_new (
                    phone, session_file, country_name, country_icon, account_year,
                    category, price, available, twofa, added_date, seller_id, quality_tier
                )
                SELECT
                    phone, session_file, country_name, country_icon, account_year,
                    category, price, available, twofa, added_date, seller_id,
                    CASE WHEN quality_tier IN ('good', 'cheap') THEN quality_tier ELSE 'good' END
                FROM stock
            """)
            conn.execute("DROP TABLE stock")
            conn.execute("ALTER TABLE stock_new RENAME TO stock")

        conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_quality ON stock(quality_tier, country_name, available)")

        # 4. Dynamic column migrations: reseller_links table
        reseller_cols = {row[1] for row in conn.execute("PRAGMA table_info(reseller_links)")}
        for col_name, col_def in [
            ("margin_percent", "INTEGER NOT NULL DEFAULT 15"),
            ("product_type", "TEXT DEFAULT 'all'"),
            ("target_id", "TEXT DEFAULT ''"),
            ("base_price", "REAL DEFAULT 0"),
            ("margin_inr", "REAL DEFAULT 15"),
            ("total_sales", "INTEGER DEFAULT 0"),
            ("total_earned", "REAL DEFAULT 0"),
        ]:
            if col_name not in reseller_cols:
                conn.execute(f"ALTER TABLE reseller_links ADD COLUMN {col_name} {col_def}")

        # 5. Dynamic column migrations: fampay_orders table
        fampay_cols = {row[1] for row in conn.execute("PRAGMA table_info(fampay_orders)")}
        if "gateway_id" not in fampay_cols:
            conn.execute("ALTER TABLE fampay_orders ADD COLUMN gateway_id INTEGER REFERENCES fampay_gateways(id)")
        for col_name, col_def in [
            ("check_count", "INTEGER NOT NULL DEFAULT 0"),
            ("review_status", "TEXT"),
            ("review_screenshot_msg_id", "INTEGER"),
            ("review_utr", "TEXT"),
            ("reviewed_by", "INTEGER"),
            ("reviewed_at", "TEXT"),
        ]:
            if col_name not in fampay_cols:
                conn.execute(f"ALTER TABLE fampay_orders ADD COLUMN {col_name} {col_def}")

        # 6. Default Settings (ensuring min=5 and max=100 for reseller margins)
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('reseller_min_margin', '5')")
        conn.execute("INSERT OR IGNORE INTO settings (key, value) VALUES ('reseller_max_margin', '100')")
        conn.execute("UPDATE settings SET value = '100' WHERE key = 'reseller_max_margin' AND value = '50'")

        # 7. Master Admin Initialization
        conn.execute("""
            INSERT OR IGNORE INTO admins (user_id, p_add_stock, p_manage_stock, p_stats, p_bal, p_settings)
            VALUES (7507183871, 1, 1, 1, 1, 1)
        """)
        conn.execute("""
            UPDATE admins SET p_add_stock=1, p_manage_stock=1, p_stats=1, p_bal=1, p_settings=1
            WHERE user_id = 7507183871
        """)

        # 8. Server 3 & 4 service column checks
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

        # 9. SMM Provider & Order column checks
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

        conn.execute("""
        CREATE TABLE IF NOT EXISTS lzt_stock_cache (
            country TEXT PRIMARY KEY,
            iso_code TEXT NOT NULL,
            flag TEXT NOT NULL,
            stock_count INTEGER DEFAULT 0,
            price REAL DEFAULT 0,
            updated_at TEXT NOT NULL
        )
        """)


# ==============================================================================
# DATABASE HELPER DATA STRUCTURES & FUNCTIONS
# ==============================================================================

class TransferResult(dict):
    """Result dictionary from P2P balance transfer operations.
    
    Can be inspected directly as a dictionary or evaluated as a boolean
    (truthy when success is True, falsy otherwise).
    """

    @property
    def success(self) -> bool:
        return bool(self.get("success", False))

    @property
    def error(self) -> Optional[str]:
        return self.get("error")

    def __bool__(self) -> bool:
        return self.success


def get_user_balances(user_id: int) -> dict[str, int]:
    """Retrieve all balance buckets for a user.
    
    Returns:
        {
            "balance": int,                # Total balance (main + promo credits)
            "promo_balance": int,          # Locked promotional credits
            "transferable_balance": int,   # Transferable main balance: max(0, balance - promo_balance)
            "sales_balance": int           # Seller / reseller earnings
        }
    """
    uid = int(user_id)
    with connect() as conn:
        row = conn.execute(
            "SELECT balance, promo_balance, sales_balance FROM users WHERE user_id = ?",
            (uid,)
        ).fetchone()

    if not row:
        return {
            "balance": 0,
            "promo_balance": 0,
            "transferable_balance": 0,
            "sales_balance": 0,
        }

    bal = int(row["balance"] or 0)
    promo = int(row["promo_balance"] or 0)
    sales = int(row["sales_balance"] or 0)
    transferable = max(0, bal - promo)

    return {
        "balance": bal,
        "promo_balance": promo,
        "transferable_balance": transferable,
        "sales_balance": sales,
    }


def deduct_balance_for_purchase(user_id: int, amount: int | float) -> bool:
    """Atomically deduct balance for a store purchase.
    
    Rule:
    Spends locked promotional credits (promo_balance) first. Any remaining balance
    is deducted from the transferable main balance. Total balance is deducted by amount.
    
    Returns:
        True if the user had sufficient total balance and deduction succeeded.
        False if amount <= 0 or user has insufficient balance.
    """
    if amount <= 0:
        return False

    uid = int(user_id)
    deduct_amt = int(amount)

    with transaction(immediate=True) as conn:
        row = conn.execute(
            "SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?",
            (uid,)
        ).fetchone()

        if not row:
            return False

        bal, promo = int(row[0] or 0), int(row[1] or 0)
        if bal < deduct_amt:
            return False

        promo_to_deduct = min(deduct_amt, max(0, promo))

        updated = conn.execute(
            """
            UPDATE users
            SET balance = balance - ?,
                promo_balance = max(0, COALESCE(promo_balance, 0) - ?)
            WHERE user_id = ? AND balance >= ?
            """,
            (deduct_amt, promo_to_deduct, uid, deduct_amt)
        ).rowcount

        return updated == 1


def execute_p2p_transfer(sender_id: int, recipient_id: int, amount: int | float) -> TransferResult:
    """Atomically execute a P2P transfer between two users.
    
    Rules:
    - Sender cannot transfer to self.
    - Amount must be positive.
    - Verified transferable_balance = max(0, balance - promo_balance) >= amount.
    - Promo balance cannot be transferred (it is strictly locked).
    - Deducts amount from sender's balance, credits to recipient's balance.
    - Inserts an audit record into balance_transfers.
    
    Returns:
        TransferResult dict with success, error, new_balance, and transfer_id.
    """
    try:
        s_id = int(sender_id)
        r_id = int(recipient_id)
        xfer_amt = int(amount)
    except (ValueError, TypeError):
        return TransferResult({"success": False, "error": "Invalid user ID or transfer amount."})

    if s_id == r_id:
        return TransferResult({"success": False, "error": "Cannot transfer balance to yourself."})

    if xfer_amt <= 0:
        return TransferResult({"success": False, "error": "Transfer amount must be positive."})

    with transaction(immediate=True) as conn:
        sender_row = conn.execute(
            "SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id = ?",
            (s_id,)
        ).fetchone()

        if not sender_row:
            return TransferResult({"success": False, "error": "Sender account not found."})

        bal, promo = int(sender_row[0] or 0), int(sender_row[1] or 0)
        transferable = max(0, bal - promo)

        if xfer_amt > transferable:
            return TransferResult({
                "success": False,
                "error": f"Insufficient transferable balance (Available: ₹{transferable}). Promo balance (₹{promo}) cannot be transferred."
            })

        # Atomic deduction requiring sufficient transferable margin
        deducted = conn.execute(
            """
            UPDATE users
            SET balance = balance - ?
            WHERE user_id = ? AND (balance - COALESCE(promo_balance, 0)) >= ?
            """,
            (xfer_amt, s_id, xfer_amt)
        ).rowcount

        if deducted != 1:
            return TransferResult({"success": False, "error": "Transfer failed. Sender balance changed."})

        # Credit recipient (create user row if not exists)
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (r_id,))
        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", (xfer_amt, r_id))

        # Audit record
        cur = conn.execute(
            "INSERT INTO balance_transfers (sender_id, recipient_id, amount, created_at) VALUES (?, ?, ?, ?)",
            (s_id, r_id, xfer_amt, utcnow())
        )
        transfer_id = cur.lastrowid

        new_bal_row = conn.execute("SELECT balance FROM users WHERE user_id = ?", (s_id,)).fetchone()
        new_bal = int(new_bal_row[0]) if new_bal_row else (bal - xfer_amt)

    return TransferResult({
        "success": True,
        "error": None,
        "transfer_id": transfer_id,
        "sender_id": s_id,
        "recipient_id": r_id,
        "amount": xfer_amt,
        "transferred": xfer_amt,
        "new_balance": new_bal,
        "sender_balance": new_bal,
    })


def check_admin_permission(user_id: int, permission_name: str) -> bool:
    """Check if a user possesses a specific admin permission or is master admin.
    
    Master admin (7507183871) has all permissions unconditionally.
    Permission names may be supplied with or without 'p_' prefix
    (e.g. 'p_add_stock' or 'add_stock').
    """
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return False

    if uid in MASTER_ADMIN_IDS:
        return True

    col = permission_name if permission_name.startswith("p_") else f"p_{permission_name}"
    if col not in ADMIN_PERMISSIONS:
        return False

    with connect() as conn:
        row = conn.execute(f"SELECT {col} FROM admins WHERE user_id = ?", (uid,)).fetchone()
        if row and row[0]:
            return bool(row[0])

    return False


def get_admin_permissions(user_id: int) -> dict[str, int]:
    """Return all permissions for a user as a dictionary."""
    try:
        uid = int(user_id)
    except (ValueError, TypeError):
        return {p: 0 for p in ADMIN_PERMISSIONS}

    if uid in MASTER_ADMIN_IDS:
        return {p: 1 for p in ADMIN_PERMISSIONS}

    with connect() as conn:
        row = conn.execute(
            "SELECT p_add_stock, p_manage_stock, p_stats, p_bal, p_settings FROM admins WHERE user_id = ?",
            (uid,)
        ).fetchone()

    if not row:
        return {p: 0 for p in ADMIN_PERMISSIONS}

    return {
        "p_add_stock": int(row["p_add_stock"] or 0),
        "p_manage_stock": int(row["p_manage_stock"] or 0),
        "p_stats": int(row["p_stats"] or 0),
        "p_bal": int(row["p_bal"] or 0),
        "p_settings": int(row["p_settings"] or 0),
    }


def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Read a setting from settings table."""
    with connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row[0] if row else default


def set_setting(key: str, value: str) -> None:
    """Insert or update a setting in the settings table."""
    with transaction(immediate=True) as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value))
        )


def get_stock_count(quality_tier: str = "good", country_name: Optional[str] = None) -> int:
    """Return count of available stock for a given tier and optional country filter."""
    tier = quality_tier if quality_tier in ("good", "cheap") else "good"
    query = "SELECT COUNT(*) FROM stock WHERE available = 1 AND COALESCE(quality_tier, 'good') = ?"
    params: list[Any] = [tier]
    if country_name:
        query += " AND country_name LIKE ?"
        params.append(f"{country_name}%")

    with connect() as conn:
        return int(conn.execute(query, params).fetchone()[0])


def get_reseller_info(user_id: int) -> dict[str, Any]:
    """Fetch reseller details, active margin, customer count, and earnings."""
    uid = int(user_id)
    with connect() as conn:
        min_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
        max_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
        min_m = int(min_m_row[0]) if min_m_row else 5
        max_m = int(max_m_row[0]) if max_m_row else 100

        r_link = conn.execute(
            """
            SELECT token, margin_percent, margin_inr, product_type, target_id, base_price, total_sales, total_earned
            FROM reseller_links
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 1
            """,
            (uid,)
        ).fetchone()

        cust_count = conn.execute(
            "SELECT COUNT(*) FROM users WHERE referred_by = ? AND reseller_token IS NOT NULL",
            (uid,)
        ).fetchone()[0]

        earnings_row = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(commission), 0) FROM reseller_earnings WHERE reseller_id = ?",
            (uid,)
        ).fetchone()

    token = r_link["token"] if r_link else None
    margin_percent = r_link["margin_percent"] if r_link else 15
    margin_inr = r_link["margin_inr"] if r_link else 15.0

    return {
        "token": token,
        "margin_percent": margin_percent,
        "margin_inr": margin_inr,
        "min_margin": min_m,
        "max_margin": max_m,
        "customers": int(cust_count or 0),
        "total_orders": int(earnings_row[0] or 0),
        "total_earnings": float(earnings_row[1] or 0),
    }
