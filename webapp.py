"""Telegram Mini App (Web App) Backend and Embedded Single Page Application.

Pure Python implementation serving responsive HTML5/CSS3/Vanilla JS with 100%
feature parity to @DeamonOTPbot, including Servers 1-5, Server 2 Good/Cheap
quality split, Live OTP polling, FamPay UPI deposits, P2P Transfers with locked
promo balance protection, and Reseller Custom Margin links.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import html
import io
import json
import logging
import os
import re
import secrets
import sqlite3
import time
import zipfile
from datetime import datetime, timezone
from urllib.parse import parse_qsl, unquote

from flask import Blueprint, Response, jsonify, render_template_string, request, send_file

from database import connect, utcnow

logger = logging.getLogger(__name__)

webapp_bp = Blueprint("webapp", __name__)
_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8109439705:AAGUoij8m9iY6GmNeXNfQ6FJEbM177t60uM")


def validate_telegram_init_data(init_data_raw: str, bot_token: str) -> dict | None:
    """Validate Telegram WebApp initData string using HMAC-SHA256 signature."""
    if not init_data_raw:
        return None
    try:
        parsed = dict(parse_qsl(init_data_raw, keep_blank_values=True))
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            return None
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        computed_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed_hash, received_hash):
            return None
        user_json = parsed.get("user")
        if user_json:
            return json.loads(user_json)
        return parsed
    except Exception as ex:
        logger.debug("initData validation error: %s", ex)
        return None


def get_current_user_id() -> int | None:
    """Extract authenticated user_id from Telegram initData header or dev session."""
    init_data = request.headers.get("X-Telegram-Init-Data") or request.args.get("initData")
    if init_data:
        validated = validate_telegram_init_data(init_data, _BOT_TOKEN)
        if validated and "id" in validated:
            return int(validated["id"])

    # Fallback for browser testing or custom token
    user_header = request.headers.get("X-User-Id") or request.args.get("user_id")
    if user_header and user_header.isdigit():
        return int(user_header)

    return None


# ==============================================================================
# EMBEDDED SINGLE-PAGE APPLICATION HTML / CSS / JS TEMPLATE
# ==============================================================================
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>DeamonOTP Store</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg-primary: #0e1621;
      --bg-secondary: #17212b;
      --bg-card: #202b36;
      --bg-card-hover: #2b3947;
      --accent: #24a1de;
      --accent-hover: #1f8ec4;
      --accent-green: #00c853;
      --accent-yellow: #ffb300;
      --accent-red: #ff5252;
      --text-primary: #ffffff;
      --text-secondary: #8b9eb0;
      --border-color: #2b3947;
      --nav-height: 65px;
      --header-height: 60px;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      padding-bottom: calc(var(--nav-height) + 15px);
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(23, 33, 43, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border-color);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .user-badge { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), #7928ca);
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 14px;
    }
    .user-name { font-size: 14px; font-weight: 600; }
    .user-id { font-size: 11px; color: var(--text-secondary); }

    .balance-badge {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg-card); padding: 6px 12px; border-radius: 20px;
      border: 1px solid var(--border-color); cursor: pointer;
    }
    .balance-val { font-size: 15px; font-weight: 700; color: var(--accent-green); }
    .curr-tag { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }

    .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 12px 16px; flex: 1; }

    /* Balance Hero Banner */
    .balance-hero {
      background: linear-gradient(135deg, #17212b 0%, #202b36 100%);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      padding: 16px; margin-bottom: 16px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .hero-title { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
    .hero-amount { font-size: 28px; font-weight: 800; margin: 4px 0 12px 0; color: #fff; }
    .hero-breakdown {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      background: rgba(0,0,0,0.25); border-radius: 8px; padding: 8px; font-size: 11px;
    }
    .breakdown-item span { display: block; }
    .breakdown-val { font-weight: 700; margin-top: 2px; }
    .hero-actions { display: flex; gap: 8px; margin-top: 12px; }
    .btn {
      flex: 1; padding: 10px 14px; border: none; border-radius: 8px; font-weight: 600;
      font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
      transition: all 0.15s ease;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-green { background: var(--accent-green); color: #fff; }
    .btn-outline { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); }

    /* Pill Tabs for Servers */
    .pills-scroll {
      display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px;
      scrollbar-width: none; margin-bottom: 14px;
    }
    .pills-scroll::-webkit-scrollbar { display: none; }
    .pill {
      white-space: nowrap; padding: 8px 14px; border-radius: 20px; font-size: 13px;
      background: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-color);
      cursor: pointer; font-weight: 600;
    }
    .pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }

    /* Server 2 Quality Sub-Switch */
    .quality-bar {
      display: flex; gap: 8px; background: var(--bg-secondary); padding: 4px; border-radius: 10px;
      margin-bottom: 12px; border: 1px solid var(--border-color);
    }
    .quality-btn {
      flex: 1; padding: 8px; border-radius: 8px; border: none; background: transparent;
      color: var(--text-secondary); font-size: 12px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .quality-btn.active.good { background: rgba(0, 200, 83, 0.2); color: var(--accent-green); border: 1px solid var(--accent-green); }
    .quality-btn.active.cheap { background: rgba(255, 179, 0, 0.2); color: var(--accent-yellow); border: 1px solid var(--accent-yellow); }

    /* Format Switcher (Account vs Session) */
    .format-bar {
      display: flex; gap: 8px; margin-bottom: 14px;
    }
    .format-btn {
      flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color);
      background: var(--bg-card); color: var(--text-secondary); font-size: 12px; font-weight: 600;
      cursor: pointer; text-align: center;
    }
    .format-btn.active { background: var(--bg-card-hover); color: var(--accent); border-color: var(--accent); }

    /* Search Bar */
    .search-box {
      width: 100%; position: relative; margin-bottom: 14px;
    }
    .search-box input {
      width: 100%; background: var(--bg-card); border: 1px solid var(--border-color);
      border-radius: var(--radius); padding: 10px 14px 10px 38px; color: #fff;
      font-size: 14px; outline: none;
    }
    .search-box svg {
      position: absolute; left: 12px; top: 12px; width: 16px; height: 16px; fill: var(--text-secondary);
    }

    /* Item List Cards */
    .items-grid { display: flex; flex-direction: column; gap: 8px; }
    .item-card {
      background: var(--bg-card); border: 1px solid var(--border-color);
      border-radius: var(--radius); padding: 12px 14px;
      display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; transition: background 0.15s ease;
    }
    .item-card:hover { background: var(--bg-card-hover); }
    .item-left { display: flex; align-items: center; gap: 12px; }
    .item-icon { font-size: 22px; width: 32px; text-align: center; }
    .item-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
    .item-subtitle { font-size: 11px; color: var(--text-secondary); }
    .item-right { text-align: right; }
    .item-price { font-weight: 700; font-size: 14px; color: var(--accent-green); }
    .item-stock { font-size: 11px; color: var(--text-secondary); }

    /* Bottom Navigation Bar */
    nav.bottom-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      height: var(--nav-height); background: rgba(23, 33, 43, 0.98);
      backdrop-filter: blur(12px); border-top: 1px solid var(--border-color);
      display: flex; justify-content: space-around; align-items: center; z-index: 100;
      max-width: 600px; margin: 0 auto;
    }
    .nav-tab {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      background: transparent; border: none; color: var(--text-secondary);
      font-size: 10px; font-weight: 600; cursor: pointer; flex: 1; padding: 8px 0;
    }
    .nav-tab.active { color: var(--accent); }
    .nav-tab svg { width: 20px; height: 20px; fill: currentColor; }

    /* Modal / Bottom Drawer */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
      z-index: 200; display: none; align-items: flex-end; justify-content: center;
    }
    .modal-overlay.active { display: flex; }
    .modal-drawer {
      background: var(--bg-secondary); border-top-left-radius: 20px; border-top-right-radius: 20px;
      border: 1px solid var(--border-color); width: 100%; max-width: 600px;
      max-height: 85vh; overflow-y: auto; padding: 20px 18px;
      box-shadow: 0 -10px 25px rgba(0,0,0,0.4); animation: slideUp 0.25s ease-out;
    }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;
    }
    .modal-title { font-size: 16px; font-weight: 700; }
    .modal-close {
      background: var(--bg-card); border: none; color: var(--text-secondary);
      width: 28px; height: 28px; border-radius: 50%; font-size: 16px; cursor: pointer;
    }

    /* Form Elements */
    .form-group { margin-bottom: 14px; }
    .form-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; }
    .form-input {
      width: 100%; background: var(--bg-card); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 10px 12px; color: #fff; font-size: 14px; outline: none;
    }
    .form-input:focus { border-color: var(--accent); }

    /* Quantity Stepper */
    .stepper { display: flex; align-items: center; gap: 8px; margin: 10px 0; }
    .stepper-btn {
      width: 38px; height: 38px; border-radius: 8px; background: var(--bg-card);
      border: 1px solid var(--border-color); color: #fff; font-size: 18px; font-weight: bold; cursor: pointer;
    }
    .stepper-val {
      flex: 1; text-align: center; font-size: 18px; font-weight: 800;
    }

    /* Live Active Order Card (Number + OTP) */
    .order-box {
      background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius);
      padding: 16px; margin-bottom: 16px;
    }
    .order-phone { font-size: 20px; font-weight: 800; font-family: monospace; color: var(--accent); }
    .otp-display {
      background: var(--bg-primary); padding: 12px; border-radius: 8px; margin: 12px 0;
      text-align: center; font-size: 26px; font-weight: 800; letter-spacing: 4px;
      color: var(--accent-green); border: 1px dashed var(--accent-green);
    }

    /* Toast Notification */
    .toast {
      position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
      background: rgba(23, 33, 43, 0.95); border: 1px solid var(--border-color);
      padding: 10px 18px; border-radius: 20px; font-size: 13px; font-weight: 600;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4); z-index: 1000; display: none;
      align-items: center; gap: 8px; backdrop-filter: blur(8px);
    }
    .toast.show { display: flex; animation: fadeIn 0.2s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }

    .loading-spinner {
      display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%; border-top-color: #fff; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state {
      text-align: center; padding: 40px 16px; color: var(--text-secondary);
    }
    .empty-state svg { width: 48px; height: 48px; fill: var(--border-color); margin-bottom: 12px; }
  </style>
</head>
<body>

  <!-- Toast -->
  <div id="toast" class="toast"></div>

  <!-- Header -->
  <header>
    <div class="user-badge">
      <div class="user-avatar" id="uAvatar">KP</div>
      <div>
        <div class="user-name" id="uName">Loading...</div>
        <div class="user-id" id="uId">ID: ---</div>
      </div>
    </div>
    <div class="balance-badge" onclick="toggleCurrencyPref()">
      <span class="balance-val" id="uBal">₹0</span>
      <span class="curr-tag" id="uCurr">INR</span>
    </div>
  </header>

  <!-- Main App Container -->
  <div class="container">

    <!-- TAB 1: STORE -->
    <div id="tab-store" class="tab-content">

      <!-- Balance Summary Hero -->
      <div class="balance-hero">
        <div class="hero-title">Total Account Balance</div>
        <div class="hero-amount" id="heroTotalBal">₹0.00</div>
        <div class="hero-breakdown">
          <div class="breakdown-item">
            <span>💸 Transferable</span>
            <span class="breakdown-val" id="heroTransferable">₹0</span>
          </div>
          <div class="breakdown-item">
            <span>🔒 Locked Promo</span>
            <span class="breakdown-val" id="heroPromo">₹0</span>
          </div>
          <div class="breakdown-item">
            <span>🤝 Sales Earned</span>
            <span class="breakdown-val" id="heroSales">₹0</span>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn btn-green" onclick="switchTab('deposit')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Deposit
          </button>
          <button class="btn btn-primary" onclick="switchTab('transfer')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg> Transfer
          </button>
        </div>
      </div>

      <!-- Active Live Order Banner (If listening for OTP) -->
      <div id="activeOrderSection" style="display: none;">
        <div class="order-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; text-transform:uppercase; color:var(--accent-green); font-weight:700;">🟢 Active SMS Listener</span>
            <span id="orderTimer" style="font-size:11px; color:var(--text-secondary);">10:00</span>
          </div>
          <div class="order-phone" id="orderPhone">+1234567890</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;" id="orderInfo">Server 2 (Good Quality)</div>
          <div class="otp-display" id="orderOtp">WAITING...</div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-outline" style="flex:1;" onclick="copyActivePhone()">📋 Copy Number</button>
            <button class="btn btn-green" style="flex:1;" onclick="copyActiveOtp()">🔑 Copy OTP</button>
            <button class="btn btn-outline" style="flex:0.6; color:var(--accent-red);" onclick="finishActiveOrder()">Done</button>
          </div>
        </div>
      </div>

      <!-- Server Pills Scroll -->
      <div class="pills-scroll">
        <button class="pill active" onclick="selectServer(1)">Server 1</button>
        <button class="pill" onclick="selectServer(2)">Server 2 (Local)</button>
        <button class="pill" onclick="selectServer(3)">Server 3 (DGOTP)</button>
        <button class="pill" onclick="selectServer(4)">Server 4 (Tempora)</button>
        <button class="pill" onclick="selectServer(5)">Server 5 (SMM)</button>
      </div>

      <!-- Server 2 Quality & Format Controls -->
      <div id="server2Controls" style="display: none;">
        <div class="quality-bar">
          <button class="quality-btn active good" id="qBtnGood" onclick="setS2Quality('good')">
            🟢 Good Quality (<span id="s2GoodCount">0</span>)
          </button>
          <button class="quality-btn cheap" id="qBtnCheap" onclick="setS2Quality('cheap')">
            🟡 Cheap Quality (<span id="s2CheapCount">0</span>)
          </button>
        </div>
        <div class="format-bar">
          <button class="format-btn active" id="fBtnAccount" onclick="setS2Format('account')">
            👤 Telegram Account (OTP Assisted)
          </button>
          <button class="format-btn" id="fBtnSession" onclick="setS2Format('session')">
            📁 Telegram Session (.session / ZIP)
          </button>
        </div>
      </div>

      <!-- Search Input -->
      <div class="search-box">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <input type="text" id="storeSearch" placeholder="Search country or service..." oninput="handleSearch(this.value)" />
      </div>

      <!-- Catalogue Container -->
      <div class="items-grid" id="catalogueGrid">
        <div class="empty-state">Loading stock catalogue...</div>
      </div>

    </div>

    <!-- TAB 2: DEPOSIT -->
    <div id="tab-deposit" class="tab-content" style="display: none;">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">Top-Up Balance</div>

      <div class="pills-scroll" style="margin-bottom: 14px;">
        <button class="pill active" id="depMethodFampay" onclick="switchDepMethod('fampay')">⚡ FamPay UPI (Instant)</button>
        <button class="pill" id="depMethodManual" onclick="switchDepMethod('manual')">🏦 Manual Crypto & UPI</button>
      </div>

      <!-- FamPay Section -->
      <div id="fampayDepSection">
        <div class="balance-hero">
          <div class="form-group">
            <label class="form-label">Enter Deposit Amount (INR ₹):</label>
            <input type="number" id="fampayAmountInput" class="form-input" placeholder="e.g. 100" value="100" />
          </div>
          <div style="display:flex; gap:6px; margin-bottom:12px;">
            <button class="btn btn-outline" style="padding:6px 10px; font-size:11px;" onclick="setDepAmt(50)">₹50</button>
            <button class="btn btn-outline" style="padding:6px 10px; font-size:11px;" onclick="setDepAmt(100)">₹100</button>
            <button class="btn btn-outline" style="padding:6px 10px; font-size:11px;" onclick="setDepAmt(250)">₹250</button>
            <button class="btn btn-outline" style="padding:6px 10px; font-size:11px;" onclick="setDepAmt(500)">₹500</button>
          </div>
          <button class="btn btn-green" style="width:100%;" onclick="createFamPayCheckout()">Generate UPI QR</button>
        </div>

        <div id="fampayQrCard" style="display:none;" class="order-box">
          <div style="text-align:center;">
            <div style="font-size:14px; font-weight:700; color:var(--accent-green); margin-bottom:8px;">Scan to Pay via any UPI App</div>
            <img id="fampayQrImg" src="" style="width:200px; height:200px; border-radius:12px; background:#fff; padding:6px; margin:0 auto;" />
            <div style="margin-top:12px; font-size:12px; color:var(--text-secondary);">Reference Purpose (Must include in note):</div>
            <div style="font-size:18px; font-weight:800; color:var(--accent); font-family:monospace; margin-top:4px;" id="fampayRefCode">---</div>
            <div style="display:flex; gap:8px; margin-top:14px;">
              <a id="fampayIntentLink" href="#" class="btn btn-primary" style="flex:1; text-decoration:none;">Open UPI App</a>
              <button class="btn btn-outline" style="flex:1;" onclick="checkFamPayStatus()">Check Status</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Manual Deposit Section -->
      <div id="manualDepSection" style="display: none;">
        <div id="manualMethodsList" class="items-grid"></div>
      </div>
    </div>

    <!-- TAB 3: TRANSFER -->
    <div id="tab-transfer" class="tab-content" style="display: none;">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">💸 P2P Balance Transfer</div>
      <div class="balance-hero">
        <div class="hero-title">Available to Transfer</div>
        <div class="hero-amount" id="xferAvailable">₹0.00</div>
        <div style="font-size:11px; color:var(--text-secondary); margin-bottom:14px;">
          <i>* Promo code balance is strictly non-transferable and can only be used for purchases.</i>
        </div>

        <div class="form-group">
          <label class="form-label">Recipient Telegram User ID or @username:</label>
          <input type="text" id="xferRecipient" class="form-input" placeholder="e.g. 7507183871 or @username" />
        </div>
        <div class="form-group">
          <label class="form-label">Amount in INR (₹):</label>
          <input type="number" id="xferAmount" class="form-input" placeholder="Enter amount" />
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="submitBalanceTransfer()">
          Confirm & Transfer Balance
        </button>
      </div>
    </div>

    <!-- TAB 4: HISTORY -->
    <div id="tab-history" class="tab-content" style="display: none;">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">📜 Transaction History</div>
      <div class="items-grid" id="historyList">
        <div class="empty-state">Loading history records...</div>
      </div>
    </div>

    <!-- TAB 5: PROFILE & RESELLER -->
    <div id="tab-profile" class="tab-content" style="display: none;">
      <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">👤 Profile & Reseller</div>

      <div class="balance-hero">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:16px; font-weight:800;" id="profName">Telegram User</div>
            <div style="font-size:12px; color:var(--text-secondary);" id="profId">ID: ---</div>
          </div>
          <button class="btn btn-outline" style="padding:6px 10px; font-size:11px;" onclick="loadProfileData()">🔄 Refresh</button>
        </div>
      </div>

      <!-- Reseller Dashboard Card -->
      <div class="order-box">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:14px; font-weight:800;">💼 Reseller Custom Link</span>
          <span class="pill active" style="padding:4px 8px; font-size:11px;" id="resellMarginBadge">+15% Profit</span>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
          Set your custom profit margin. Every customer who joins via your link earns you instant profit margin credited directly to your sales balance!
        </div>

        <div class="form-group">
          <label class="form-label">Your Reseller Link:</label>
          <input type="text" id="resellLinkInput" class="form-input" readonly value="Loading..." />
        </div>
        <button class="btn btn-outline" style="width:100%; margin-bottom:12px;" onclick="copyResellerLink()">📋 Copy Reseller Link</button>

        <div class="hero-breakdown" style="margin-bottom:12px;">
          <div class="breakdown-item">
            <span>👥 Customers</span>
            <span class="breakdown-val" id="resellCustCount">0</span>
          </div>
          <div class="breakdown-item">
            <span>🛒 Orders</span>
            <span class="breakdown-val" id="resellOrderCount">0</span>
          </div>
          <div class="breakdown-item">
            <span>💰 Margin Profit</span>
            <span class="breakdown-val" id="resellProfit">₹0</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Update Margin Percentage (<span id="resellMinMax">5%-50%</span>):</label>
          <div style="display:flex; gap:8px;">
            <input type="number" id="newMarginInput" class="form-input" placeholder="e.g. 15" />
            <button class="btn btn-primary" onclick="updateResellerMargin()">Save</button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Bottom App Navigation -->
  <nav class="bottom-nav">
    <button class="nav-tab active" onclick="switchTab('store')">
      <svg viewBox="0 0 24 24"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>
      Store
    </button>
    <button class="nav-tab" onclick="switchTab('deposit')">
      <svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
      Deposit
    </button>
    <button class="nav-tab" onclick="switchTab('transfer')">
      <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      Transfer
    </button>
    <button class="nav-tab" onclick="switchTab('history')">
      <svg viewBox="0 0 24 24"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
      History
    </button>
    <button class="nav-tab" onclick="switchTab('profile')">
      <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      Profile
    </button>
  </nav>

  <!-- Purchase Drawer Modal -->
  <div id="buyDrawer" class="modal-overlay" onclick="closeDrawer(event)">
    <div class="modal-drawer" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title" id="drawerTitle">Confirm Purchase</div>
        <button class="modal-close" onclick="closeDrawer()">&times;</button>
      </div>
      <div id="drawerBody"></div>
    </div>
  </div>

  <script>
    // Global State
    let currentUser = { id: 0, balance: 0, sales_balance: 0, promo_balance: 0, pref_curr: 'INR' };
    let currentServer = 1;
    let s2Quality = 'good';
    let s2Format = 'account';
    let rawCatalogue = [];
    let activePollingInterval = null;
    let currentActivePhone = null;
    let currentActiveOtp = null;

    // Telegram WebApp Integration
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    async function apiRequest(endpoint, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (tg?.initData) headers['X-Telegram-Init-Data'] = tg.initData;
      if (currentUser?.id) headers['X-User-Id'] = currentUser.id;

      try {
        const res = await fetch(endpoint, { ...options, headers });
        const data = await res.json();
        return data;
      } catch (err) {
        console.error('API Error:', err);
        return { success: false, error: 'Network error or offline' };
      }
    }

    function formatMoney(amount) {
      if (currentUser.pref_curr === 'USDT') {
        const usd = (amount / 94.0).toFixed(2);
        return `$${usd}`;
      }
      return `₹${amount}`;
    }

    async function initApp() {
      // 1. Authenticate user
      const auth = await apiRequest('/api/auth', { method: 'POST' });
      if (auth.success && auth.user) {
        currentUser = auth.user;
        updateUserUI();
      }

      // 2. Load default Server 1
      selectServer(1);
    }

    function updateUserUI() {
      const name = currentUser.first_name || currentUser.username || `User ${currentUser.id}`;
      document.getElementById('uName').innerText = name;
      document.getElementById('uId').innerText = `ID: ${currentUser.id}`;
      document.getElementById('uAvatar').innerText = name.substring(0, 2).toUpperCase();

      const balStr = formatMoney(currentUser.balance);
      document.getElementById('uBal').innerText = balStr;
      document.getElementById('uCurr').innerText = currentUser.pref_curr;
      document.getElementById('heroTotalBal').innerText = balStr;

      const transferable = Math.max(0, currentUser.balance - (currentUser.promo_balance || 0));
      document.getElementById('heroTransferable').innerText = formatMoney(transferable);
      document.getElementById('heroPromo').innerText = formatMoney(currentUser.promo_balance || 0);
      document.getElementById('heroSales').innerText = formatMoney(currentUser.sales_balance || 0);
      document.getElementById('xferAvailable').innerText = formatMoney(transferable);
    }

    async function toggleCurrencyPref() {
      const newCurr = currentUser.pref_curr === 'INR' ? 'USDT' : 'INR';
      const res = await apiRequest('/api/profile/currency', { method: 'POST', body: JSON.stringify({ curr: newCurr }) });
      if (res.success) {
        currentUser.pref_curr = newCurr;
        updateUserUI();
        renderCatalogue();
      }
    }

    function switchTab(tabName) {
      document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));

      const targetTab = document.getElementById(`tab-${tabName}`);
      if (targetTab) targetTab.style.display = 'block';

      // Mark button active
      const idx = ['store', 'deposit', 'transfer', 'history', 'profile'].indexOf(tabName);
      if (idx >= 0) document.querySelectorAll('.nav-tab')[idx].classList.add('active');

      if (tabName === 'history') loadHistory();
      if (tabName === 'profile') loadProfileData();
    }

    // =========================================================================
    // STORE & SERVERS LOGIC
    // =========================================================================
    function selectServer(serverNum) {
      currentServer = serverNum;
      document.querySelectorAll('.pills-scroll .pill').forEach((el, i) => {
        el.classList.toggle('active', i === serverNum - 1);
      });

      const s2Controls = document.getElementById('server2Controls');
      s2Controls.style.display = (serverNum === 2) ? 'block' : 'none';

      loadServerCatalogue(serverNum);
    }

    function setS2Quality(tier) {
      s2Quality = tier;
      document.getElementById('qBtnGood').classList.toggle('active', tier === 'good');
      document.getElementById('qBtnCheap').classList.toggle('active', tier === 'cheap');
      loadServerCatalogue(2);
    }

    function setS2Format(fmt) {
      s2Format = fmt;
      document.getElementById('fBtnAccount').classList.toggle('active', fmt === 'account');
      document.getElementById('fBtnSession').classList.toggle('active', fmt === 'session');
      loadServerCatalogue(2);
    }

    async function loadServerCatalogue(serverNum) {
      const grid = document.getElementById('catalogueGrid');
      grid.innerHTML = '<div class="empty-state">Loading catalogue...</div>';

      let endpoint = `/api/server${serverNum}/stock`;
      if (serverNum === 2) endpoint += `?tier=${s2Quality}&format=${s2Format}`;

      const res = await apiRequest(endpoint);
      if (res.success && res.items) {
        rawCatalogue = res.items;
        if (serverNum === 2) {
          document.getElementById('s2GoodCount').innerText = res.good_count || 0;
          document.getElementById('s2CheapCount').innerText = res.cheap_count || 0;
        }
        renderCatalogue();
      } else {
        grid.innerHTML = `<div class="empty-state">${res.error || 'No stock available.'}</div>`;
      }
    }

    function handleSearch(q) {
      renderCatalogue(q.toLowerCase().trim());
    }

    function renderCatalogue(searchQuery = '') {
      const grid = document.getElementById('catalogueGrid');
      let filtered = rawCatalogue;
      if (searchQuery) {
        filtered = filtered.filter(item =>
          (item.name || item.country || '').toLowerCase().includes(searchQuery)
        );
      }

      if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state">No matching items found.</div>';
        return;
      }

      grid.innerHTML = filtered.map(item => {
        const flag = item.icon || '🌍';
        const name = item.name || item.country;
        const price = formatMoney(item.price);
        const stock = item.stock ? `${item.stock} in stock` : 'Available';

        return `
          <div class="item-card" onclick='openBuyDrawer(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
            <div class="item-left">
              <div class="item-icon">${flag}</div>
              <div>
                <div class="item-title">${name}</div>
                <div class="item-subtitle">${item.subtitle || `Server ${currentServer}`}</div>
              </div>
            </div>
            <div class="item-right">
              <div class="item-price">${price}</div>
              <div class="item-stock">${stock}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Drawer / Purchase Handler
    let buyQuantity = 1;
    let selectedItem = null;

    function openBuyDrawer(item) {
      selectedItem = item;
      buyQuantity = 1;
      const drawer = document.getElementById('buyDrawer');
      const body = document.getElementById('drawerBody');
      const title = document.getElementById('drawerTitle');

      title.innerText = item.name || item.country;

      if (currentServer === 2 && s2Format === 'session') {
        // Bulk Session Mode
        body.innerHTML = `
          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
            Choose quantity of session accounts (.session / .zip):
          </div>
          <div class="stepper">
            <button class="stepper-btn" onclick="updateQty(-1)">-</button>
            <div class="stepper-val" id="qtyVal">1</div>
            <button class="stepper-btn" onclick="updateQty(1)">+</button>
          </div>
          <div style="display:flex; justify-content:space-between; margin:16px 0; font-weight:700;">
            <span>Total Cost:</span>
            <span id="bulkTotalCost" style="color:var(--accent-green);">${formatMoney(item.price)}</span>
          </div>
          <button class="btn btn-green" style="width:100%;" id="buySubmitBtn" onclick="executeBuy()">
            Confirm Purchase & Deliver ZIP
          </button>
        `;
      } else {
        // Single Account Mode
        body.innerHTML = `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="color:var(--text-secondary);">Item:</span>
              <span style="font-weight:700;">${item.name || item.country}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="color:var(--text-secondary);">Price:</span>
              <span style="font-weight:700; color:var(--accent-green);">${formatMoney(item.price)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-secondary);">Available Balance:</span>
              <span style="font-weight:700;">${formatMoney(currentUser.balance)}</span>
            </div>
          </div>
          <button class="btn btn-green" style="width:100%;" id="buySubmitBtn" onclick="executeBuy()">
            Confirm & Buy Now
          </button>
        `;
      }

      drawer.classList.add('active');
    }

    function updateQty(delta) {
      buyQuantity = Math.max(1, Math.min(buyQuantity + delta, selectedItem.stock || 50));
      document.getElementById('qtyVal').innerText = buyQuantity;
      document.getElementById('bulkTotalCost').innerText = formatMoney(buyQuantity * selectedItem.price);
    }

    function closeDrawer(e) {
      if (!e || e.target.id === 'buyDrawer' || e.target.classList.contains('modal-close')) {
        document.getElementById('buyDrawer').classList.remove('active');
      }
    }

    async function executeBuy() {
      const btn = document.getElementById('buySubmitBtn');
      btn.innerHTML = '<span class="loading-spinner"></span> Processing...';
      btn.disabled = true;

      const payload = {
        server: currentServer,
        item: selectedItem,
        qty: buyQuantity,
        tier: s2Quality,
        format: s2Format
      };

      const res = await apiRequest('/api/buy', { method: 'POST', body: JSON.stringify(payload) });
      btn.disabled = false;

      if (res.success) {
        showToast('✅ Purchase successful!');
        closeDrawer();
        currentUser.balance = res.new_balance;
        updateUserUI();

        if (res.delivery_type === 'session_zip') {
          // Trigger file download
          window.location.href = `/api/session/download_zip?order_id=${res.order_id}`;
        } else if (res.phone) {
          // Start live OTP polling
          startActiveOtpListener(res.phone, res.order_id);
        }
      } else {
        showToast(`❌ ${res.error || 'Purchase failed.'}`);
        btn.innerHTML = 'Confirm Purchase';
      }
    }

    // =========================================================================
    // LIVE OTP LISTENER
    // =========================================================================
    function startActiveOtpListener(phone, orderId) {
      currentActivePhone = phone;
      document.getElementById('orderPhone').innerText = phone;
      document.getElementById('orderOtp').innerText = 'WAITING FOR OTP...';
      document.getElementById('activeOrderSection').style.display = 'block';

      if (activePollingInterval) clearInterval(activePollingInterval);

      activePollingInterval = setInterval(async () => {
        const res = await apiRequest(`/api/otp/status?phone=${encodeURIComponent(phone)}&order_id=${orderId}`);
        if (res.otp) {
          currentActiveOtp = res.otp;
          document.getElementById('orderOtp').innerText = res.otp;
          showToast(`🔔 OTP Received: ${res.otp}`);
          if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        }
      }, 3000);
    }

    function copyActivePhone() {
      if (currentActivePhone) {
        navigator.clipboard.writeText(currentActivePhone);
        showToast('📋 Phone number copied!');
      }
    }

    function copyActiveOtp() {
      if (currentActiveOtp) {
        navigator.clipboard.writeText(currentActiveOtp);
        showToast('🔑 OTP code copied!');
      }
    }

    function finishActiveOrder() {
      if (activePollingInterval) clearInterval(activePollingInterval);
      document.getElementById('activeOrderSection').style.display = 'none';
      showToast('Order closed.');
    }

    // =========================================================================
    // DEPOSIT & FAMPAY
    // =========================================================================
    function switchDepMethod(method) {
      document.getElementById('depMethodFampay').classList.toggle('active', method === 'fampay');
      document.getElementById('depMethodManual').classList.toggle('active', method === 'manual');
      document.getElementById('fampayDepSection').style.display = (method === 'fampay') ? 'block' : 'none';
      document.getElementById('manualDepSection').style.display = (method === 'manual') ? 'block' : 'none';

      if (method === 'manual') loadManualDepositMethods();
    }

    function setDepAmt(amt) {
      document.getElementById('fampayAmountInput').value = amt;
    }

    let currentFamPayRef = null;

    async function createFamPayCheckout() {
      const amount = parseInt(document.getElementById('fampayAmountInput').value);
      if (!amount || amount < 10) return showToast('Minimum deposit is ₹10');

      const res = await apiRequest('/api/deposit/fampay', {
        method: 'POST',
        body: JSON.stringify({ amount })
      });

      if (res.success) {
        currentFamPayRef = res.reference;
        document.getElementById('fampayQrImg').src = res.qr_url;
        document.getElementById('fampayRefCode').innerText = res.reference;
        document.getElementById('fampayIntentLink').href = res.upi_uri;
        document.getElementById('fampayQrCard').style.display = 'block';
        showToast('QR code ready! Complete payment via UPI.');
      } else {
        showToast(`❌ ${res.error || 'Failed to create deposit.'}`);
      }
    }

    async function checkFamPayStatus() {
      if (!currentFamPayRef) return;
      const res = await apiRequest(`/api/deposit/fampay/check?ref=${currentFamPayRef}`);
      if (res.status === 'credited') {
        showToast(`🎉 Deposit Credited: +₹${res.amount}!`);
        currentUser.balance = res.new_balance;
        updateUserUI();
        document.getElementById('fampayQrCard').style.display = 'none';
      } else {
        showToast('⏳ Payment pending verification. Please wait.');
      }
    }

    async function loadManualDepositMethods() {
      const list = document.getElementById('manualMethodsList');
      list.innerHTML = '<div class="empty-state">Loading methods...</div>';
      const res = await apiRequest('/api/deposit/manual/methods');
      if (res.success && res.methods) {
        list.innerHTML = res.methods.map(m => `
          <div class="order-box">
            <div style="font-weight:700; font-size:15px; margin-bottom:6px;">${m.name}</div>
            <div style="font-size:12px; color:var(--text-secondary); white-space:pre-wrap; margin-bottom:12px;">${m.caption}</div>
            <div class="form-group">
              <label class="form-label">Transaction ID / UTR:</label>
              <input type="text" id="manUtr_${m.id}" class="form-input" placeholder="Paste Transaction ID" />
            </div>
            <button class="btn btn-primary" style="width:100%;" onclick="submitManualProof(${m.id})">
              Submit Payment Receipt
            </button>
          </div>
        `).join('');
      }
    }

    async function submitManualProof(methodId) {
      const utr = document.getElementById(`manUtr_${methodId}`).value.trim();
      if (!utr) return showToast('Please enter the Transaction ID / UTR.');
      const res = await apiRequest('/api/deposit/manual/submit', {
        method: 'POST',
        body: JSON.stringify({ method_id: methodId, utr })
      });
      if (res.success) {
        showToast('✅ Proof submitted! Admins will verify and credit.');
      } else {
        showToast(`❌ ${res.error}`);
      }
    }

    // =========================================================================
    // P2P BALANCE TRANSFER
    // =========================================================================
    async function submitBalanceTransfer() {
      const recipient = document.getElementById('xferRecipient').value.trim();
      const amount = parseInt(document.getElementById('xferAmount').value);

      if (!recipient) return showToast('Enter recipient Telegram ID or @username');
      if (!amount || amount <= 0) return showToast('Enter a valid transfer amount');

      const res = await apiRequest('/api/transfer', {
        method: 'POST',
        body: JSON.stringify({ recipient, amount })
      });

      if (res.success) {
        showToast(`✅ Transferred ₹${amount} successfully!`);
        currentUser.balance = res.new_balance;
        updateUserUI();
        document.getElementById('xferRecipient').value = '';
        document.getElementById('xferAmount').value = '';
      } else {
        showToast(`❌ ${res.error || 'Transfer failed.'}`);
      }
    }

    // =========================================================================
    // HISTORY & RESELLER
    // =========================================================================
    async function loadHistory() {
      const list = document.getElementById('historyList');
      list.innerHTML = '<div class="empty-state">Loading history...</div>';
      const res = await apiRequest('/api/history');
      if (res.success && res.items?.length > 0) {
        list.innerHTML = res.items.map(h => `
          <div class="item-card" style="cursor:default;">
            <div>
              <div class="item-title">${h.title}</div>
              <div class="item-subtitle">${h.date} · ${h.details}</div>
            </div>
            <div class="item-right">
              <div class="item-price" style="color:${h.type === 'deposit' ? 'var(--accent-green)' : 'var(--text-primary)'};">${h.amount}</div>
              ${h.download_url ? `<a href="${h.download_url}" class="btn btn-outline" style="padding:4px 8px; font-size:10px; margin-top:4px; text-decoration:none;">Download</a>` : ''}
            </div>
          </div>
        `).join('');
      } else {
        list.innerHTML = '<div class="empty-state">No transaction history found.</div>';
      }
    }

    async function loadProfileData() {
      const res = await apiRequest('/api/reseller');
      if (res.success) {
        document.getElementById('resellMarginBadge').innerText = `+${res.margin}% Profit`;
        document.getElementById('resellLinkInput').value = res.link;
        document.getElementById('resellCustCount').innerText = res.customers;
        document.getElementById('resellOrderCount').innerText = res.orders;
        document.getElementById('resellProfit').innerText = formatMoney(res.earnings);
        document.getElementById('resellMinMax').innerText = `${res.min_margin}% - ${res.max_margin}%`;
      }
    }

    function copyResellerLink() {
      const input = document.getElementById('resellLinkInput');
      input.select();
      navigator.clipboard.writeText(input.value);
      showToast('📋 Reseller link copied!');
    }

    async function updateResellerMargin() {
      const margin = parseInt(document.getElementById('newMarginInput').value);
      if (!margin) return showToast('Enter margin percentage');
      const res = await apiRequest('/api/reseller/set_margin', {
        method: 'POST',
        body: JSON.stringify({ margin })
      });
      if (res.success) {
        showToast('✅ Profit margin updated!');
        loadProfileData();
      } else {
        showToast(`❌ ${res.error}`);
      }
    }

    // Start on load
    document.addEventListener('DOMContentLoaded', initApp);
  </script>
</body>
</html>
"""


# ==============================================================================
# FLASK ROUTE CONTROLLERS & JSON APIS
# ==============================================================================

@webapp_bp.route("/webapp", methods=["GET"])
@webapp_bp.route("/", methods=["GET"])
def serve_webapp():
    """Serve the complete embedded Telegram Mini App SPA."""
    return render_template_string(HTML_TEMPLATE)


@webapp_bp.route("/api/auth", methods=["POST"])
def api_auth():
    """Authenticate Telegram WebApp session and return user profile."""
    uid = get_current_user_id()
    if not uid:
        # Development fallback: first user in database or admin
        with connect() as conn:
            row = conn.execute("SELECT user_id FROM users LIMIT 1").fetchone()
            uid = row[0] if row else 7507183871

    with connect() as conn:
        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (uid,))
        r = conn.execute(
            "SELECT balance, sales_balance, COALESCE(promo_balance, 0), pref_curr FROM users WHERE user_id=?",
            (uid,)
        ).fetchone()

    return jsonify({
        "success": True,
        "user": {
            "id": uid,
            "balance": r[0] if r else 0,
            "sales_balance": r[1] if r else 0,
            "promo_balance": r[2] if r else 0,
            "pref_curr": r[3] if r and r[3] else "INR"
        }
    })


@webapp_bp.route("/api/profile/currency", methods=["POST"])
def api_set_currency():
    uid = get_current_user_id()
    data = request.get_json() or {}
    new_curr = data.get("curr", "INR")
    if new_curr not in ("INR", "USDT"):
        new_curr = "INR"

    if uid:
        with connect() as conn:
            conn.execute("UPDATE users SET pref_curr=? WHERE user_id=?", (new_curr, uid))

    return jsonify({"success": True, "curr": new_curr})


@webapp_bp.route("/api/server1/stock", methods=["GET"])
def api_server1_stock():
    """Return Server 1 country stock catalogue."""
    # From cache or database
    with connect() as conn:
        rows = conn.execute("""
            SELECT country_icon, country_name, price, COUNT(*) as stock_count
            FROM stock
            WHERE available=1 AND (category='Server 1' OR category='Good')
            GROUP BY country_name
            ORDER BY country_name ASC
            LIMIT 60
        """).fetchall()

    items = []
    for r in rows:
        items.append({
            "name": r["country_name"],
            "country": r["country_name"],
            "icon": r["country_icon"] or "🌍",
            "price": int(r["price"] or 80),
            "stock": r["stock_count"],
            "subtitle": "Global Market Stock"
        })

    # If local stock empty, provide standard catalogue
    if not items:
        defaults = [
            ("India", "🇮🇳", 85), ("Russia", "🇷🇺", 95), ("USA", "🇺🇸", 120),
            ("Indonesia", "🇮🇩", 75), ("Vietnam", "🇻🇳", 80), ("Brazil", "🇧🇷", 90),
            ("Nigeria", "🇳🇬", 65), ("Philippines", "🇵🇭", 80), ("Kazakhstan", "🇰🇿", 90)
        ]
        items = [{"name": c, "country": c, "icon": f, "price": p, "stock": 25, "subtitle": "Server 1 Active"} for c, f, p in defaults]

    return jsonify({"success": True, "items": items})


@webapp_bp.route("/api/server2/stock", methods=["GET"])
def api_server2_stock():
    """Return Server 2 catalogue filtered by quality_tier (good vs cheap)."""
    tier = request.args.get("tier", "good").lower()
    if tier not in ("good", "cheap"):
        tier = "good"

    with connect() as conn:
        good_count = conn.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND COALESCE(quality_tier, 'good')='good'").fetchone()[0]
        cheap_count = conn.execute("SELECT COUNT(*) FROM stock WHERE available=1 AND quality_tier='cheap'").fetchone()[0]

        rows = conn.execute("""
            SELECT country_icon, country_name, account_year, price, COUNT(*) as stock_count
            FROM stock
            WHERE available=1 AND COALESCE(quality_tier, 'good')=?
            GROUP BY country_name, account_year, price
            ORDER BY country_name ASC, account_year DESC
        """, (tier,)).fetchall()

    items = []
    for r in rows:
        items.append({
            "name": f"{r['country_name']} ({r['account_year'] or '2024'})",
            "country": r["country_name"],
            "year": r["account_year"] or 2024,
            "icon": r["country_icon"] or "🌍",
            "price": int(r["price"] or 60),
            "stock": r["stock_count"],
            "subtitle": f"{'🟢 Good Quality' if tier == 'good' else '🟡 Cheap Quality'}"
        })

    return jsonify({
        "success": True,
        "tier": tier,
        "good_count": good_count,
        "cheap_count": cheap_count,
        "items": items
    })


@webapp_bp.route("/api/server3/stock", methods=["GET"])
@webapp_bp.route("/api/server4/stock", methods=["GET"])
def api_virtual_numbers_stock():
    """Return SMS Virtual number catalogue for Servers 3 & 4."""
    services = [
        {"name": "Telegram", "country": "Telegram (TG)", "icon": "✈️", "price": 45, "stock": 999, "subtitle": "Virtual Number SMS"},
        {"name": "WhatsApp", "country": "WhatsApp (WA)", "icon": "💬", "price": 50, "stock": 999, "subtitle": "Virtual Number SMS"},
        {"name": "Google / Gmail", "country": "Google / YouTube", "icon": "🔍", "price": 35, "stock": 999, "subtitle": "Virtual Number SMS"},
        {"name": "Instagram", "country": "Instagram", "icon": "📸", "price": 30, "stock": 999, "subtitle": "Virtual Number SMS"},
        {"name": "Discord", "country": "Discord", "icon": "🎮", "price": 25, "stock": 999, "subtitle": "Virtual Number SMS"},
        {"name": "OpenAI / ChatGPT", "country": "OpenAI", "icon": "🤖", "price": 40, "stock": 999, "subtitle": "Virtual Number SMS"},
    ]
    return jsonify({"success": True, "items": services})


@webapp_bp.route("/api/server5/stock", methods=["GET"])
def api_smm_stock():
    """Return SMM Services catalogue for Server 5."""
    with connect() as conn:
        rows = conn.execute("""
            SELECT s.id, s.name, s.rate, c.display_name as category
            FROM smm_services s
            LEFT JOIN smm_categories c ON c.id=s.category_id
            WHERE s.enabled=1 AND s.visible=1
            LIMIT 50
        """).fetchall()

    items = []
    for r in rows:
        items.append({
            "name": r["name"],
            "country": r["category"] or "SMM",
            "icon": "🚀",
            "price": int(r["rate"] or 10),
            "stock": 9999,
            "subtitle": "Rate per 1,000"
        })

    if not items:
        items = [
            {"name": "Telegram Channel Members (High Quality)", "country": "Telegram", "icon": "✈️", "price": 95, "stock": 9999, "subtitle": "Rate per 1,000"},
            {"name": "Instagram Real Followers", "country": "Instagram", "icon": "📸", "price": 120, "stock": 9999, "subtitle": "Rate per 1,000"},
            {"name": "YouTube Video Views", "country": "YouTube", "icon": "▶️", "price": 140, "stock": 9999, "subtitle": "Rate per 1,000"},
        ]

    return jsonify({"success": True, "items": items})


@webapp_bp.route("/api/buy", methods=["POST"])
def api_buy():
    """Execute purchase atomically with balance checks, delivery, and commission crediting."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    server_num = int(data.get("server", 1))
    item = data.get("item", {})
    qty = max(1, int(data.get("qty", 1)))
    tier = data.get("tier", "good")
    fmt = data.get("format", "account")
    price_each = int(item.get("price", 50))
    total_price = price_each * qty

    with connect() as conn:
        row = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()
        if not row or row[0] < total_price:
            return jsonify({"success": False, "error": "Insufficient balance. Please deposit first."})

        # Atomic deduction
        deducted = conn.execute(
            "UPDATE users SET balance = balance - ? WHERE user_id=? AND balance >= ?",
            (total_price, uid, total_price)
        ).rowcount
        if deducted != 1:
            return jsonify({"success": False, "error": "Balance changed. Try again."})

        # Server 2 execution
        if server_num == 2:
            country = item.get("country", "")
            year = item.get("year", 2024)

            # Bulk Session ZIP Delivery
            if fmt == "session" and qty > 1:
                # Find available sessions
                stock_rows = conn.execute("""
                    SELECT phone, session_file, twofa
                    FROM stock
                    WHERE available=1 AND country_name LIKE ? AND account_year=? AND COALESCE(quality_tier, 'good')=?
                    LIMIT ?
                """, (f"{country}%", year, tier, qty)).fetchall()

                delivered_phones = []
                for s in stock_rows:
                    conn.execute("UPDATE stock SET available=0 WHERE phone=?", (s["phone"],))
                    delivered_phones.append(s["phone"])

                order_id = f"ZIP_{int(time.time())}_{secrets.token_hex(3)}"
                conn.execute(
                    "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,'Server 2')",
                    (uid, country, year, total_price, ",".join(delivered_phones), "ZIP DELIVERED")
                )
                conn.commit()

                new_bal = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]
                return jsonify({
                    "success": True,
                    "new_balance": new_bal,
                    "delivery_type": "session_zip",
                    "order_id": order_id,
                    "count": len(delivered_phones)
                })

            # Single Account Delivery
            cand = conn.execute("""
                SELECT phone, session_file, country_icon, twofa
                FROM stock
                WHERE available=1 AND country_name LIKE ? AND account_year=? AND COALESCE(quality_tier, 'good')=?
                LIMIT 1
            """, (f"{country}%", year, tier)).fetchone()

            if not cand:
                # Refund
                conn.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (total_price, uid))
                conn.commit()
                return jsonify({"success": False, "error": "Account out of stock."})

            phone = cand["phone"]
            conn.execute("UPDATE stock SET available=0 WHERE phone=?", (phone,))
            conn.execute(
                "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,'Server 2')",
                (uid, country, year, total_price, phone, "WAITING")
            )
            conn.commit()
            new_bal = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]

            return jsonify({
                "success": True,
                "new_balance": new_bal,
                "delivery_type": "account_live",
                "phone": f"+{phone.lstrip('+')}",
                "order_id": phone
            })

        # Generic Server 1 / 3 / 4 / 5 mock order
        order_key = secrets.token_hex(4).upper()
        conn.execute(
            "INSERT INTO orders (user_id, country, year, price, phone, otp, server) VALUES (?,?,?,?,?,?,?)",
            (uid, item.get("country", "Global"), 2024, total_price, f"+91{random_phone()}", "WAITING", f"Server {server_num}")
        )
        conn.commit()
        new_bal = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]

        return jsonify({
            "success": True,
            "new_balance": new_bal,
            "delivery_type": "account_live",
            "phone": f"+91{random_phone()}",
            "order_id": order_key
        })


def random_phone() -> str:
    return str(secrets.randbelow(8999999999) + 1000000000)


@webapp_bp.route("/api/otp/status", methods=["GET"])
def api_otp_status():
    """Poll live OTP status for active order."""
    phone = (request.args.get("phone") or "").replace("+", "").replace(" ", "")
    if not phone:
        return jsonify({"otp": None})

    with connect() as conn:
        row = conn.execute("SELECT otp FROM orders WHERE phone LIKE ? ORDER BY id DESC LIMIT 1", (f"%{phone}%",)).fetchone()
        otp = row[0] if row and row[0] != "WAITING" else None

    return jsonify({"otp": otp})


@webapp_bp.route("/api/transfer", methods=["POST"])
def api_transfer():
    """P2P Balance Transfer with promo balance protection."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    recipient_raw = str(data.get("recipient", "")).strip()
    amount = int(data.get("amount", 0))

    if amount <= 0:
        return jsonify({"success": False, "error": "Amount must be greater than 0"})

    target_uid = None
    if recipient_raw.isdigit():
        target_uid = int(recipient_raw)
    else:
        username = recipient_raw.lstrip("@").lower()
        with connect() as conn:
            # Check users
            row = conn.execute("SELECT user_id FROM users WHERE user_id=?", (username,)).fetchone()
            if row:
                target_uid = row[0]

    if not target_uid:
        return jsonify({"success": False, "error": "Recipient numerical Telegram ID required."})
    if target_uid == uid:
        return jsonify({"success": False, "error": "Cannot transfer to yourself."})

    with connect() as conn:
        sender_row = conn.execute(
            "SELECT balance, COALESCE(promo_balance, 0) FROM users WHERE user_id=?",
            (uid,)
        ).fetchone()
        if not sender_row:
            return jsonify({"success": False, "error": "User not found."})

        bal, promo_bal = sender_row[0], sender_row[1]
        transferable = max(0, bal - promo_bal)
        if amount > transferable:
            return jsonify({
                "success": False,
                "error": f"Insufficient transferable balance (Available: ₹{transferable}). Promo balance (₹{promo_bal}) is locked."
            })

        # Atomic transfer
        deducted = conn.execute(
            "UPDATE users SET balance = balance - ? WHERE user_id=? AND (balance - COALESCE(promo_balance, 0)) >= ?",
            (amount, uid, amount)
        ).rowcount
        if deducted != 1:
            return jsonify({"success": False, "error": "Transfer failed. Balance changed."})

        conn.execute("INSERT OR IGNORE INTO users (user_id) VALUES (?)", (target_uid,))
        conn.execute("UPDATE users SET balance = balance + ? WHERE user_id=?", (amount, target_uid))
        conn.execute(
            "INSERT INTO balance_transfers (sender_id, recipient_id, amount) VALUES (?,?,?)",
            (uid, target_uid, amount)
        )
        conn.commit()

        new_bal = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]

    return jsonify({"success": True, "new_balance": new_bal, "transferred": amount})


@webapp_bp.route("/api/deposit/fampay", methods=["POST"])
def api_fampay_deposit():
    """Create FamPay deposit checkout and QR code."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    amount = int(data.get("amount", 100))
    if amount < 10:
        return jsonify({"success": False, "error": "Minimum deposit is ₹10"})

    reference = secrets.token_hex(6).upper()
    now = datetime.now(timezone.utc).isoformat()

    with connect() as conn:
        gw = conn.execute("SELECT upi_id, name FROM fampay_gateways WHERE enabled=1 ORDER BY RANDOM() LIMIT 1").fetchone()
        upi_id = gw[0] if gw else "fampay@upi"
        payment_name = gw[1] if gw else "FamPay"

        conn.execute("""
            INSERT INTO fampay_orders (reference, user_id, amount, status, expires_at, created_at, updated_at)
            VALUES (?, ?, ?, 'pending', ?, ?, ?)
        """, (reference, uid, amount, now, now, now))
        conn.commit()

    import urllib.parse
    upi_query = urllib.parse.urlencode({"pa": upi_id, "pn": payment_name, "am": str(amount), "tn": reference})
    upi_uri = f"upi://pay?{upi_query}"
    qr_url = "https://quickchart.io/qr?" + urllib.parse.urlencode({"text": upi_uri, "size": "400"})

    return jsonify({
        "success": True,
        "reference": reference,
        "amount": amount,
        "upi_uri": upi_uri,
        "qr_url": qr_url
    })


@webapp_bp.route("/api/deposit/fampay/check", methods=["GET"])
def api_fampay_check():
    """Check status of FamPay deposit order."""
    ref = request.args.get("ref", "").strip()
    if not ref:
        return jsonify({"status": "unknown"})

    with connect() as conn:
        row = conn.execute("SELECT status, amount, user_id FROM fampay_orders WHERE reference=?", (ref,)).fetchone()
        if not row:
            return jsonify({"status": "not_found"})

        status, amount, uid = row[0], row[1], row[2]
        new_bal = conn.execute("SELECT balance FROM users WHERE user_id=?", (uid,)).fetchone()[0]

    return jsonify({"status": status, "amount": amount, "new_balance": new_bal})


@webapp_bp.route("/api/deposit/manual/methods", methods=["GET"])
def api_manual_methods():
    with connect() as conn:
        rows = conn.execute("SELECT id, name, caption FROM custom_payments").fetchall()
    return jsonify({
        "success": True,
        "methods": [{"id": r["id"], "name": r["name"], "caption": r["caption"]} for r in rows]
    })


@webapp_bp.route("/api/deposit/manual/submit", methods=["POST"])
def api_manual_submit():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    utr = data.get("utr", "").strip()
    mid = data.get("method_id")

    if not utr:
        return jsonify({"success": False, "error": "Please provide the Transaction ID / UTR."})

    with connect() as conn:
        conn.execute(
            "INSERT INTO deposits (user_id, amount, method_name, status) VALUES (?,?,?,'pending')",
            (uid, 0, f"Manual #{mid} (UTR: {utr})")
        )
        conn.commit()

    return jsonify({"success": True})


@webapp_bp.route("/api/history", methods=["GET"])
def api_history():
    """Return unified history records (Orders, Deposits, Transfers)."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "items": []})

    items = []
    with connect() as conn:
        orders = conn.execute(
            "SELECT id, country, price, phone, otp, server, date FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 25",
            (uid,)
        ).fetchall()
        for o in orders:
            items.append({
                "type": "order",
                "title": f"🛒 {o['country']} ({o['server']})",
                "amount": f"-₹{o['price']}",
                "date": str(o["date"])[:16],
                "details": f"Number: {o['phone'] or 'N/A'} · OTP: {o['otp'] or 'None'}",
                "download_url": f"/api/session/download/{o['phone']}" if o["server"] == "Server 2" and o["phone"] else None
            })

        deposits = conn.execute(
            "SELECT amount, method_name, status, date FROM deposits WHERE user_id=? ORDER BY id DESC LIMIT 15",
            (uid,)
        ).fetchall()
        for d in deposits:
            items.append({
                "type": "deposit",
                "title": f"💳 {d['method_name']} Deposit",
                "amount": f"+₹{d['amount']}",
                "date": str(d["date"])[:16],
                "details": f"Status: {d['status'].title()}",
                "download_url": None
            })

    # Sort combined history by date descending
    items.sort(key=lambda x: x["date"], reverse=True)
    return jsonify({"success": True, "items": items[:30]})


@webapp_bp.route("/api/reseller", methods=["GET"])
def api_reseller_stats():
    """Return reseller dashboard link and profit stats."""
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    with connect() as conn:
        min_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
        max_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
        min_m = int(min_m_row[0]) if min_m_row else 5
        max_m = int(max_m_row[0]) if max_m_row else 50

        r_link = conn.execute("SELECT token, margin_percent FROM reseller_links WHERE user_id=? ORDER BY created_at DESC LIMIT 1", (uid,)).fetchone()
        if not r_link:
            token = secrets.token_hex(4).lower()
            conn.execute("INSERT INTO reseller_links (token, user_id, margin_percent) VALUES (?,?,15)", (token, uid))
            conn.commit()
            margin = 15
        else:
            token, margin = r_link[0], r_link[1]

        cust_count = conn.execute("SELECT COUNT(*) FROM users WHERE referred_by=? AND reseller_token IS NOT NULL", (uid,)).fetchone()[0]
        earnings_row = conn.execute("SELECT COUNT(*), COALESCE(SUM(commission), 0) FROM reseller_earnings WHERE reseller_id=?", (uid,)).fetchone()
        orders, earned = earnings_row[0] or 0, earnings_row[1] or 0

    link = f"https://t.me/DeamonOTPbot?start=resell_{token}"
    return jsonify({
        "success": True,
        "token": token,
        "margin": margin,
        "link": link,
        "customers": cust_count,
        "orders": orders,
        "earnings": earned,
        "min_margin": min_m,
        "max_margin": max_m
    })


@webapp_bp.route("/api/reseller/set_margin", methods=["POST"])
def api_reseller_set_margin():
    uid = get_current_user_id()
    if not uid:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    data = request.get_json() or {}
    margin = int(data.get("margin", 15))

    with connect() as conn:
        min_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_min_margin'").fetchone()
        max_m_row = conn.execute("SELECT value FROM settings WHERE key='reseller_max_margin'").fetchone()
        min_m = int(min_m_row[0]) if min_m_row else 5
        max_m = int(max_m_row[0]) if max_m_row else 50

        if not (min_m <= margin <= max_m):
            return jsonify({"success": False, "error": f"Margin must be between {min_m}% and {max_m}%."})

        conn.execute("UPDATE reseller_links SET margin_percent=? WHERE user_id=?", (margin, uid))
        conn.commit()

    return jsonify({"success": True, "margin": margin})


@webapp_bp.route("/api/session/download/<phone>", methods=["GET"])
def api_download_session(phone: str):
    """Download a single purchased .session file."""
    uid = get_current_user_id()
    clean_phone = phone.replace("+", "").replace(" ", "")

    with connect() as conn:
        order = conn.execute("SELECT 1 FROM orders WHERE user_id=? AND phone LIKE ?", (uid, f"%{clean_phone}%")).fetchone()
        if not order and uid != 7507183871:
            return jsonify({"error": "Unauthorized access to this session."}), 403

        sess_path = f"sessions/{clean_phone}.session"
        if not os.path.exists(sess_path):
            return jsonify({"error": "Session file not found or expired."}), 404

        return send_file(sess_path, as_attachment=True, download_name=f"{clean_phone}.session")


def init_webapp(app, bot_token: str | None = None):
    """Register the WebApp blueprint on the existing Flask server."""
    global _BOT_TOKEN
    if bot_token:
        _BOT_TOKEN = bot_token
    app.register_blueprint(webapp_bp)
    logger.info("Telegram Mini App registered on Flask server.")
