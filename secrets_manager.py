"""Authenticated local secret storage helpers for provider API credentials."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time


def _key() -> bytes:
    configured = os.getenv("PAYMENT_ENCRYPTION_KEY", "")
    if configured:
        return hashlib.sha256(configured.encode()).digest()
    path = os.getenv("PAYMENT_KEY_FILE", ".payment_encryption.key")
    try:
        stored = open(path, "rb").read().strip()
        if len(stored) >= 32:
            return hashlib.sha256(stored).digest()
    except FileNotFoundError:
        pass
    generated = secrets.token_urlsafe(48).encode()
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.write(fd, generated)
        os.close(fd)
    except FileExistsError:
        pass
    for _ in range(20):
        stored = open(path, "rb").read().strip()
        if len(stored) >= 32:
            return hashlib.sha256(stored).digest()
        time.sleep(0.05)
    raise RuntimeError("secret key file is empty or invalid")


def _crypt(data: bytes, nonce: bytes) -> bytes:
    stream = bytearray()
    counter = 0
    while len(stream) < len(data):
        stream.extend(hmac.new(_key(), nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest())
        counter += 1
    return bytes(a ^ b for a, b in zip(data, stream))


def encrypt_secret(value: str) -> str:
    nonce = secrets.token_bytes(16)
    cipher = _crypt(value.encode(), nonce)
    tag = hmac.new(_key(), nonce + cipher, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(nonce + tag + cipher).decode()


def decrypt_secret(value: str) -> str:
    packed = base64.urlsafe_b64decode(value)
    nonce, tag, cipher = packed[:16], packed[16:48], packed[48:]
    if not hmac.compare_digest(tag, hmac.new(_key(), nonce + cipher, hashlib.sha256).digest()):
        raise ValueError("invalid encrypted credential")
    return _crypt(cipher, nonce).decode()
