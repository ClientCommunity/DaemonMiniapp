"""Production entry point for the Telegram bot application.

Some deployment platforms are configured to start ``app.py``.  Keep the bot
implementation in ``bot.py`` and execute it as a script here so imports resolve
from this repository directory, including the existing ``database.py`` module.
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path


APP_DIR = Path(__file__).resolve().parent

if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))


if __name__ == "__main__":
    runpy.run_path(str(APP_DIR / "bot.py"), run_name="__main__")
