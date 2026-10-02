"""Production entry point for the Telegram bot application.

Some deployment platforms are configured to start ``app.py``.  Keep the bot
implementation in ``bot.py`` and execute it as a script here so imports resolve
from this repository directory, including the existing ``database.py`` module.
"""
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try: sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception: pass

if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))

# Lightweight zero-dependency .env file loader
env_file = APP_DIR / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k and k not in os.environ:
                    os.environ[k] = v
    except Exception:
        pass


if __name__ == "__main__":
    runpy.run_path(str(APP_DIR / "bot.py"), run_name="__main__")
