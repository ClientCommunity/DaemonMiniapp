"""Persistent conversation state manager for DeamonOTPBot.

Replaces volatile Python memory dictionaries with SQLite-backed persistent state
dictionaries (user_conversations table). Retains 100% transparent dictionary & set
semantics, in-place dictionary modification tracking (TrackedDict), tuple serialization
fidelity, and automatic TTL expiration.
"""
from __future__ import annotations

import json
import logging
import time
from collections.abc import MutableMapping
from typing import Any, Iterator, Optional

logger = logging.getLogger(__name__)

_table_ensured = False


def _ensure_conversations_table() -> None:
    """Ensure the user_conversations table and index exist."""
    global _table_ensured
    if _table_ensured:
        return
    try:
        from database import managed_connect
        with managed_connect() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS user_conversations (
                    namespace TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    state_data TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (namespace, user_id)
                );
                CREATE INDEX IF NOT EXISTS idx_user_conv_exp ON user_conversations(expires_at);
            """)
        _table_ensured = True
    except Exception as exc:
        logger.debug("Table check warning: %s", exc)


def serialize_state(val: Any) -> str:
    """Serialize Python state object to JSON while preserving tuple semantics."""
    def _transform(obj: Any) -> Any:
        if isinstance(obj, tuple):
            return {"__py_tuple__": True, "items": [_transform(x) for x in obj]}
        if isinstance(obj, dict):
            return {str(k): _transform(v) for k, v in obj.items()}
        if isinstance(obj, (list, set)):
            return [_transform(x) for x in obj]
        return obj

    return json.dumps(_transform(val))


def deserialize_state(raw: str) -> Any:
    """Deserialize JSON back to Python object, restoring tuples."""
    def _untransform(obj: Any) -> Any:
        if isinstance(obj, dict):
            if obj.get("__py_tuple__") is True and "items" in obj:
                return tuple(_untransform(x) for x in obj["items"])
            return {k: _untransform(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_untransform(x) for x in obj]
        return obj

    return _untransform(json.loads(raw))


class TrackedDict(dict):
    """Dictionary proxy that propagates in-place modifications back to the persistence layer."""

    def __init__(self, initial: Optional[dict] = None, on_change: Any = None):
        super().__init__()
        self._on_change = on_change
        if initial:
            for k, v in initial.items():
                super().__setitem__(k, self._wrap(v))

    def _wrap(self, val: Any) -> Any:
        if isinstance(val, dict) and not isinstance(val, TrackedDict):
            return TrackedDict(val, on_change=self._notify)
        return val

    def _notify(self, *args: Any) -> None:
        if self._on_change:
            self._on_change(self._to_plain(self))

    @classmethod
    def _to_plain(cls, d: Any) -> Any:
        if isinstance(d, dict):
            return {k: cls._to_plain(v) for k, v in d.items()}
        return d

    def __setitem__(self, key: Any, value: Any) -> None:
        super().__setitem__(key, self._wrap(value))
        self._notify()

    def __delitem__(self, key: Any) -> None:
        super().__delitem__(key)
        self._notify()

    def update(self, *args: Any, **kwargs: Any) -> None:
        super().update(*args, **kwargs)
        for k in list(self.keys()):
            super().__setitem__(k, self._wrap(super().__getitem__(k)))
        self._notify()

    def pop(self, key: Any, *args: Any) -> Any:
        val = super().pop(key, *args)
        self._notify()
        return val

    def popitem(self) -> Any:
        val = super().popitem()
        self._notify()
        return val

    def clear(self) -> None:
        super().clear()
        self._notify()

    def setdefault(self, key: Any, default: Any = None) -> Any:
        if key not in self:
            val = super().setdefault(key, self._wrap(default))
            self._notify()
            return val
        return super().__getitem__(key)


class PersistentState(MutableMapping):
    """SQLite-backed conversation state mapping with TTL and transparent dictionary semantics.

    Supports dict and set interfaces, and survives process reboots and service restarts.
    """

    def __init__(self, namespace: str, ttl: int = 1800):
        self.namespace = namespace
        self.ttl = ttl
        _ensure_conversations_table()

    def _save(self, key: Any, value: Any, custom_ttl: Optional[int] = None) -> None:
        _ensure_conversations_table()
        expires_at = time.time() + (custom_ttl if custom_ttl is not None else self.ttl)
        raw_json = serialize_state(value)
        from database import managed_connect
        with managed_connect() as conn:
            conn.execute(
                """INSERT INTO user_conversations (namespace, user_id, state_data, expires_at, updated_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                   ON CONFLICT(namespace, user_id) DO UPDATE SET
                       state_data=excluded.state_data,
                       expires_at=excluded.expires_at,
                       updated_at=CURRENT_TIMESTAMP""",
                (self.namespace, str(key), raw_json, expires_at),
            )

    def __getitem__(self, key: Any) -> Any:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            row = conn.execute(
                "SELECT state_data, expires_at FROM user_conversations WHERE namespace=? AND user_id=?",
                (self.namespace, str(key)),
            ).fetchone()
            if not row:
                raise KeyError(key)
            if row["expires_at"] <= time.time():
                conn.execute(
                    "DELETE FROM user_conversations WHERE namespace=? AND user_id=?",
                    (self.namespace, str(key)),
                )
                raise KeyError(key)

            val = deserialize_state(row["state_data"])
            if isinstance(val, dict):
                return TrackedDict(val, on_change=lambda updated: self._save(key, updated))
            return val

    def __setitem__(self, key: Any, value: Any) -> None:
        self._save(key, value)

    def __delitem__(self, key: Any) -> None:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            cur = conn.execute(
                "DELETE FROM user_conversations WHERE namespace=? AND user_id=?",
                (self.namespace, str(key)),
            )
            if cur.rowcount == 0:
                raise KeyError(key)

    def __contains__(self, key: Any) -> bool:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            row = conn.execute(
                "SELECT expires_at FROM user_conversations WHERE namespace=? AND user_id=?",
                (self.namespace, str(key)),
            ).fetchone()
            if not row:
                return False
            if row["expires_at"] <= time.time():
                conn.execute(
                    "DELETE FROM user_conversations WHERE namespace=? AND user_id=?",
                    (self.namespace, str(key)),
                )
                return False
            return True

    def get(self, key: Any, default: Any = None) -> Any:
        try:
            return self[key]
        except KeyError:
            return default

    def pop(self, key: Any, *args: Any) -> Any:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            row = conn.execute(
                "SELECT state_data, expires_at FROM user_conversations WHERE namespace=? AND user_id=?",
                (self.namespace, str(key)),
            ).fetchone()
            if row:
                conn.execute(
                    "DELETE FROM user_conversations WHERE namespace=? AND user_id=?",
                    (self.namespace, str(key)),
                )
                if row["expires_at"] > time.time():
                    return deserialize_state(row["state_data"])
            if args:
                return args[0]
            raise KeyError(key)

    def clear(self) -> None:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            conn.execute("DELETE FROM user_conversations WHERE namespace=?", (self.namespace,))

    def __len__(self) -> int:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) FROM user_conversations WHERE namespace=? AND expires_at > ?",
                (self.namespace, time.time()),
            ).fetchone()
            return row[0] if row else 0

    def __iter__(self) -> Iterator[Any]:
        _ensure_conversations_table()
        from database import managed_connect
        with managed_connect() as conn:
            rows = conn.execute(
                "SELECT user_id FROM user_conversations WHERE namespace=? AND expires_at > ?",
                (self.namespace, time.time()),
            ).fetchall()
            for r in rows:
                raw_k = r["user_id"]
                try:
                    yield int(raw_k)
                except ValueError:
                    yield raw_k

    def copy(self) -> dict[Any, Any]:
        """Return a plain Python dictionary of all active, non-expired items."""
        return {k: self[k] for k in list(self)}

    # Set compatibility interface (for states previously declared as set())
    def add(self, key: Any) -> None:
        self[key] = True

    def discard(self, key: Any) -> None:
        self.pop(key, None)

    def remove(self, key: Any) -> None:
        del self[key]

    def __repr__(self) -> str:
        return f"<PersistentState namespace={self.namespace!r} ttl={self.ttl} active_keys={len(self)}>"
