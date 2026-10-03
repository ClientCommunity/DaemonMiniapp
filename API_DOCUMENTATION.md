# DeamonOTPBot — Exhaustive Backend API Specification & Frontend Integration Manual

**Document Version:** 1.0.0  
**Target Environment:** Production / Telegram Mini App Ecosystem  
**Backend Framework:** Python 3.10+ / Flask Modular Blueprints  
**Network Gateway:** Go 1.22+ Reverse Proxy (`:8080` → `:5073`)  
**Database Engine:** SQLite 3 (WAL Mode, Immediate Transaction Locks, Dynamic Schema Migrations)  
**Security Standard:** HMAC-SHA256 Telegram Signature Validation & `X-Proxy-Secret` Injected Token Guard  

---

## 1. Executive Overview & System Architecture

DeamonOTPBot is an enterprise-grade Telegram Mini App and bot platform designed to facilitate secure, high-concurrency virtual account acquisitions, Telegram session downloads, SMS/OTP activations, and SMM growth services.

The platform employs a hardened **Two-Tier Micro-Gateway Architecture**:
1. **Edge Gateway (Go Reverse Proxy)**: Runs as an ultra-fast, memory-efficient proxy process listening on port `:8080`. It handles client connection multiplexing, token-bucket rate limiting per IP, global CORS preflight evaluation, and memory metrics monitoring while forwarding sanitized HTTP traffic to the backend over a persistent connection pool. It injects a shared security token `X-Proxy-Secret: deamon_proxy_secret_2026`.
2. **Core API Server (Flask Modular Blueprints)**: Runs on port `:5073`, binding to `127.0.0.1` or internal networks. It enforces strict request validation, verifies the injected `X-Proxy-Secret` header, verifies Telegram WebApp HMAC authentication data, executes transactional business logic in SQLite (with WAL journal mode and immediate write locks), and coordinates provider dispatching with **zero upstream vendor leakage**.

```
[ Client / Telegram WebApp ]
             │
             │ HTTPS / WSS
             ▼
┌────────────────────────────────────────────────────────┐
│         Edge Gateway (Go Reverse Proxy :8080)          │
│  - Token-Bucket Rate Limiter (10 rps / 30 burst)       │
│  - Preflight OPTIONS Short-Circuit                     │
│  - Global CORS Injection                               │
│  - Memory / Health Monitoring (:8080/health)           │
│  - Injects: X-Proxy-Secret, X-Real-IP, X-Forwarded-For │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP Loopback (:5073)
                           ▼
┌────────────────────────────────────────────────────────┐
│           Core API Server (Flask App :5073)            │
│  - Before-Request: X-Proxy-Secret Gatekeeper           │
│  - Telegram HMAC-SHA256 Auth Middleware                │
│  - Dual-Balance Financial Engine (Promo vs Main)       │
│  - Vendor Masking Layer (Servers 1 - 5)                │
│  - Atomic Database Operations (WAL Mode SQLite)        │
└──────────────────────────┬─────────────────────────────┘
                           │ Persistent Connections
                           ▼
┌────────────────────────────────────────────────────────┐
│             SQLite Engine (WAL + Immediate)            │
│  - Atomic user wallets (balance, promo_balance)        │
│  - Audit logs (transfers, deposits, orders)            │
│  - RBAC permissions & provider state caching           │
└────────────────────────────────────────────────────────┘
```

---

## 2. Reverse Proxy & Security Authentication Specification

### 2.1 Go Reverse Proxy Gateway

- **Source Code**: `reverse proxyGo/main.go`
- **Public Ingress**: Port `8080` (or configured via `PORT` environment variable)
- **Internal Target**: `http://localhost:5073` (or configured via `TARGET_URL`)
- **Shared Secret**: `deamon_proxy_secret_2026` (or configured via `PROXY_SECRET`)

#### Proxy Request Header Transformation:
When a client requests `http://gateway:8080/api/...`, the proxy:
1. Rewrites `Host` to `targetURL.Host`.
2. Extracts real client IP (inspecting `X-Forwarded-For`, `X-Real-IP`, or remote socket) and sets:
   - `X-Real-IP: <client-ip>`
   - `X-Forwarded-For: <prior-chain>, <client-ip>`
   - `X-Forwarded-Proto: https`
3. Injects the shared proxy secret:
   - `X-Proxy-Secret: deamon_proxy_secret_2026`

#### Public Endpoints on Proxy:
- `GET /health` and `GET /healthz`: Publicly returns gateway health and real-time RAM metrics (allocated MB, RSS MB, cgroup container limit, and usage percentage) without forwarding to backend.

---

### 2.2 Backend Proxy Secret Verification Middleware

In `app.py`, `app.before_request` enforces:
1. **OPTIONS Requests**: Returns HTTP `204 No Content` with CORS headers immediately.
2. **Public Health Checks**: Paths `/health`, `/api/health`, and `/webhook/health` are exempt.
3. **Secret Verification**:
   - If `X-Proxy-Secret` is present, it must be contained in `config.ACCEPTED_PROXY_SECRETS`. Any mismatch returns `403 Forbidden` (`{"error": "Forbidden", "detail": "Invalid X-Proxy-Secret header"}`).
   - If `config.REQUIRE_PROXY_SECRET` is enabled, missing `X-Proxy-Secret` returns `403 Forbidden`.

---

### 2.3 Telegram WebApp Authentication (`HMAC-SHA256`)

Clients authenticate by transmitting their raw `initData` query string generated by the Telegram WebApp client:
- Header: `X-Telegram-Init-Data: <raw_query_string>`
- Fallback Query Parameter: `?initData=<raw_query_string>`
- Development Fallback: In development mode, `X-User-Id: <user_id>` is supported.

#### Verification Algorithm:
1. Parse query string into key-value pairs; extract the `hash` parameter.
2. Sort remaining keys alphabetically and format as `"key=value\n"`.
3. Compute `secret_key = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)`.
4. Compute `calculated_hash = HMAC_SHA256(key=secret_key, data=data_check_string).hexdigest()`.
5. If `calculated_hash == hash`, signature is valid; extract JSON payload in `user`.

---

### 2.4 The Dual-Balance Engine & Invariants

Each user account maintains two balance records in the SQLite database:
1. `balance`: Total aggregate funds available for store purchases.
2. `promo_balance`: Non-transferable promotional credits (rewards, bonuses, admin gifts).

#### Strict Financial Invariants:
1. **Transferable Balance Rule**:
   $$\text{Transferable Balance} = \max(0, \text{balance} - \text{promo\_balance})$$
2. **P2P Transfer Isolation**:
   Under no circumstances can `promo_balance` be sent to another user via `/api/transfer`. Only `transferable_balance` can be transferred.
3. **Purchase Deduction Priority**:
   Store orders spend `promo_balance` first before deducting from the main transferable balance, preserving the user's transferable cash for P2P transfers.

---

## 3. Exhaustive REST API Reference

Every endpoint detailed below returns valid JSON responses with appropriate HTTP status codes.

---

### 3.1 Authentication & User Session

#### `POST /api/auth`
Authenticates the Telegram Mini App session, creates user records if first visit, and returns wallet balances.

- **Headers**:
  - `X-Telegram-Init-Data: <query_string>` (or `X-User-Id: <id>`)
  - `X-Proxy-Secret: deamon_proxy_secret_2026`
- **Request Body**: None (or `{}`)
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "user": {
      "id": 99887711,
      "username": "johndoe",
      "first_name": "John",
      "balance": 200,
      "promo_balance": 50,
      "transferable_balance": 150,
      "sales_balance": 0,
      "total_deposited": 0,
      "pref_curr": "INR",
      "banned": 0,
      "discount": 0,
      "terms_accepted": 1,
      "reseller_token": "tok_99887711_3f8a"
    }
  }
  ```
- **Error 401 Unauthorized**:
  ```json
  { "success": false, "error": "Invalid or expired Telegram WebApp session." }
  ```

---

#### `GET /api/auth/me`
Retrieves current profile and live wallet balances for an active session.

- **Headers**:
  - `X-Telegram-Init-Data: <query_string>` or `X-User-Id: <id>`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "user": {
      "id": 99887711,
      "username": "johndoe",
      "first_name": "John",
      "balance": 200,
      "promo_balance": 50,
      "transferable_balance": 150,
      "sales_balance": 0,
      "pref_curr": "INR"
    }
  }
  ```
- **Error 401 Unauthorized**:
  ```json
  { "success": false, "error": "Unauthorized" }
  ```

---

#### `POST /api/profile/currency`
Updates the user's preferred currency presentation (`INR` or `USDT`).

- **Headers**:
  - `X-User-Id: <id>`
  - `Content-Type: application/json`
- **Request JSON Schema**:
  ```json
  {
    "curr": "INR"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "curr": "USDT"
  }
  ```
- **Error 400 Bad Request**:
  ```json
  { "success": false, "error": "Invalid currency selection. Supported: INR, USDT." }
  ```

---

### 3.2 Store Catalogues (Servers 1 - 5)

All catalogue responses are sanitized to ensure zero internal vendor leaks (names such as LZT, DGOTP, Tempora, etc. are stripped and mapped to clean server designations).

#### `GET /api/store/servers`
Returns high-level metadata for all 5 servers.

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "servers": [
      { "id": 1, "name": "Global 2FA Accounts", "subtitle": "Instant 2FA Telegram sessions", "icon": "🌐", "available": true },
      { "id": 2, "name": "Fresh Session Accounts", "subtitle": "Good & Cheap quality tiers", "icon": "📱", "available": true },
      { "id": 3, "name": "Instant Virtual OTP", "subtitle": "Fast virtual SMS activations", "icon": "⚡", "available": true },
      { "id": 4, "name": "Fresh Carrier Numbers", "subtitle": "Real carrier virtual numbers", "icon": "📶", "available": true },
      { "id": 5, "name": "SMM Hub", "subtitle": "Social media boost & growth", "icon": "🚀", "available": true }
    ]
  }
  ```

---

#### `GET /api/store/server1` (Alias: `/api/server1/stock`)
Lists available Server 1 Global 2FA Accounts grouped by country.

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "items": [
      {
        "id": "IN",
        "country": "India",
        "code": "IN",
        "flag": "🇮🇳",
        "price": 85,
        "stock": 14,
        "twofa": true
      },
      {
        "id": "RU",
        "country": "Russia",
        "code": "RU",
        "flag": "🇷🇺",
        "price": 75,
        "stock": 28,
        "twofa": true
      }
    ]
  }
  ```

---

#### `GET /api/store/server2` (Alias: `/api/server2/stock`)
Lists Server 2 Telegram sessions categorized by quality tier (`good` vs `cheap`).

- **Query Parameters**:
  - `tier`: `good` (default) or `cheap`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "tier": "good",
    "good_count": 18,
    "cheap_count": 32,
    "items": [
      {
        "country": "India",
        "flag": "🇮🇳",
        "year": 2024,
        "price": 70,
        "stock": 8,
        "tier": "good",
        "subtitle": "🟢 Good Quality Session"
      }
    ]
  }
  ```

---

#### `GET /api/store/server3` (Alias: `/api/server3/stock`)
Lists Server 3 virtual numbers for instant SMS OTP.

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "items": [
      { "id": "tg", "name": "Telegram", "country": "Telegram", "icon": "✈️", "price": 45, "stock": 999, "subtitle": "Instant Virtual OTP" },
      { "id": "wa", "name": "WhatsApp", "country": "WhatsApp", "icon": "💬", "price": 50, "stock": 999, "subtitle": "Instant Virtual OTP" },
      { "id": "go", "name": "Google / Gmail", "country": "Google / Gmail", "icon": "🔍", "price": 35, "stock": 999, "subtitle": "Instant Virtual OTP" }
    ]
  }
  ```

---

#### `GET /api/store/server4` (Alias: `/api/server4/stock`)
Lists Server 4 real carrier virtual numbers.

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "items": [
      { "id": "tg", "name": "Telegram", "country": "Telegram", "icon": "✈️", "price": 55, "stock": 999, "subtitle": "Fresh Carrier Number" },
      { "id": "wa", "name": "WhatsApp", "country": "WhatsApp", "icon": "💬", "price": 60, "stock": 999, "subtitle": "Fresh Carrier Number" }
    ]
  }
  ```

---

#### `GET /api/store/server5` (Alias: `/api/server5/stock`)
Lists Server 5 SMM growth services.

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "items": [
      {
        "id": 1,
        "name": "Telegram Channel Members (High Quality)",
        "country": "Telegram",
        "category": "Telegram",
        "icon": "🚀",
        "price": 95,
        "min_qty": 100,
        "max_qty": 10000,
        "stock": 9999,
        "subtitle": "Rate per 1,000"
      }
    ]
  }
  ```

---

### 3.3 Orders & OTP Polling

#### `POST /api/buy`
Initiates purchase with atomic dual-balance deduction.

- **Headers**:
  - `X-User-Id: <id>`
  - `Content-Type: application/json`
- **Request Body Sample**:
  ```json
  {
    "server": 2,
    "item": {
      "country": "India",
      "price": 70,
      "year": 2024
    },
    "qty": 1,
    "tier": "good",
    "format": "session"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "order_id": 9942,
    "phone": "+919876543210",
    "price": 70,
    "server": "Server 2",
    "status": "waiting",
    "twofa": "none",
    "new_balance": 130,
    "new_promo_balance": 0
  }
  ```
- **Error 400 Bad Request**:
  ```json
  {
    "success": false,
    "error": "Insufficient balance. Required: ₹70, Available: ₹40."
  }
  ```

---

#### `GET /api/otp/status`
Polls live OTP arrival for an active number.

- **Query Parameters**:
  - `phone`: Phone number with country code (e.g. `+919876543210`)
  - `order_id`: Order ID fallback
- **Response 200 OK (Pending)**:
  ```json
  {
    "success": true,
    "order_id": 9942,
    "phone": "+919876543210",
    "status": "waiting",
    "otp": null,
    "time_left": 1140
  }
  ```
- **Response 200 OK (Delivered)**:
  ```json
  {
    "success": true,
    "order_id": 9942,
    "phone": "+919876543210",
    "status": "delivered",
    "otp": "48192",
    "time_left": 0
  }
  ```

---

#### `POST /api/otp/cancel`
Cancels pending number activation and triggers immediate, atomic wallet refund.

- **Headers**:
  - `X-User-Id: <id>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "phone": "+919876543210"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "status": "cancelled",
    "refunded_amount": 70,
    "new_balance": 200
  }
  ```
- **Error 400 Bad Request**:
  ```json
  {
    "success": false,
    "error": "Order cannot be cancelled; OTP has already been received."
  }
  ```

---

### 3.4 P2P Balance Transfers

#### `POST /api/transfer`
Executes peer-to-peer balance transfers between users. Enforces strict promotional balance locking.

- **Headers**:
  - `X-User-Id: <sender_id>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "recipient": "99887722",
    "amount": 50
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "transfer_id": 81,
    "sender_id": 99887711,
    "recipient_id": 99887722,
    "amount": 50,
    "new_balance": 150
  }
  ```
- **Error 400 (Promo Lock Violation)**:
  ```json
  {
    "success": false,
    "error": "Insufficient transferable balance (Available: ₹150). Promo balance (₹50) cannot be transferred."
  }
  ```

---

### 3.5 Deposits & Payment Processing

#### `POST /api/deposit/fampay`
Generates an instant, dynamic UPI checkout QR for FamPay.

- **Headers**: `X-User-Id: <id>`
- **Request Body**:
  ```json
  { "amount": 250 }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "reference": "FP_99887711_1727954400_a1b2",
    "amount": 250,
    "upi_uri": "upi://pay?pa=fam-example@upi&pn=DeamonOTP&am=250&tr=FP_99887711_1727954400_a1b2",
    "qr_url": "https://quickchart.io/qr?text=upi%3A%2F%2Fpay%3Fpa%3Dfam-example...",
    "status": "pending"
  }
  ```

---

#### `GET /api/deposit/fampay/check`
Polls payment status for a FamPay transaction reference.

- **Query Parameters**: `ref=FP_99887711_1727954400_a1b2`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "reference": "FP_99887711_1727954400_a1b2",
    "amount": 250,
    "status": "pending"
  }
  ```

---

#### `GET /api/deposit/manual/methods`
Lists available manual payment options (manual UPI, Crypto USDT, etc.).

- **Response 200 OK**:
  ```json
  {
    "success": true,
    "methods": [
      {
        "id": 1,
        "name": "UPI Direct (Instant)",
        "address": "merchant@okaxis",
        "qr_image": "/assets/upi_qr.png",
        "instructions": "Transfer funds via Google Pay, PhonePe, or Paytm and submit the 12-digit UTR."
      },
      {
        "id": 2,
        "name": "USDT (TRC20)",
        "address": "TYx123Abc456Def789Ghi",
        "qr_image": "/assets/usdt_qr.png",
        "instructions": "Send exact USDT amount and submit the TXID hash."
      }
    ]
  }
  ```

---

#### `POST /api/deposit/manual/submit`
Submits manual payment proof (UTR / transaction hash) for admin manual verification.

- **Headers**: `X-User-Id: <id>`
- **Request Body**:
  ```json
  {
    "method_id": 1,
    "utr": "428919203941",
    "amount": 500
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "deposit_id": 194,
    "status": "pending",
    "message": "Deposit reference submitted successfully."
  }
  ```

---

### 3.6 Reseller Engine

#### `GET /api/reseller`
Retrieves reseller referral metrics, earnings, and current margin percent.

- **Headers**: `X-User-Id: <id>`
- **Response 200 OK**:
  ```json
  {
    "token": "tok_99887711_8f1a",
    "link": "https://t.me/DeamonOTPBot?start=reseller_tok_99887711_8f1a",
    "margin": 20,
    "margin_percent": 20,
    "min_margin": 5,
    "max_margin": 100,
    "customers": 14,
    "total_orders": 48,
    "total_earnings": 560.0
  }
  ```

---

#### `POST /api/reseller/create`
Initializes or resets a reseller referral token with a custom margin.

- **Headers**: `X-User-Id: <id>`
- **Request Body**: `{ "margin": 25 }`
- **Response 200 OK**: Reseller metrics object as above.

---

#### `POST /api/reseller/set_margin`
Updates the profit markup percentage within administrator bounds (5% to 100%).

- **Headers**: `X-User-Id: <id>`
- **Request Body**: `{ "margin": 30 }`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "margin": 30,
    "message": "Reseller margin set to 30%"
  }
  ```
- **Error 400 Bad Request**:
  ```json
  {
    "success": false,
    "error": "Margin must be between 5% and 100%."
  }
  ```

---

### 3.7 Session Downloads & Archive Generation

#### `GET /api/session/download/<phone>`
Downloads a single `.session` file for a purchased Server 2 account. Access is restricted to the buyer and authorized admins.

- **Headers**: `X-User-Id: <id>`
- **Response 200 OK**:
  - `Content-Type: application/octet-stream`
  - `Content-Disposition: attachment; filename="919876543210.session"`
  - Body: Binary Telethon session data.
- **Error 403 Forbidden**: If the caller is not the purchasing user.
- **Error 404 Not Found**: If session file is not found on disk.

---

#### `GET /api/session/download_zip/<order_id>`
Generates and downloads a `.zip` archive containing all `.session` files and an `accounts.txt` summary file (with phone numbers and 2FA passwords) for bulk purchases.

- **Headers**: `X-User-Id: <id>`
- **Response 200 OK**:
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="accounts_9942.zip"`
  - Contents:
    - `accounts.txt`
    - `919876500001.session`
    - `919876500002.session`

---

### 3.8 Unified History Timeline

#### `GET /api/history`
Returns a chronologically merged transaction timeline combining orders, deposits, and P2P transfers.

- **Headers**: `X-User-Id: <id>`
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "items": [
      {
        "type": "order",
        "title": "🛒 India (Server 2)",
        "amount": "-₹70",
        "date": "2026-10-03 14:10:00",
        "details": "Number: +919876543210 · OTP: None",
        "download_url": "/api/session/download/919876543210"
      },
      {
        "type": "deposit",
        "title": "💳 FamPay Dynamic UPI",
        "amount": "+₹250",
        "date": "2026-10-03 12:00:00",
        "details": "Status: Success",
        "download_url": null
      },
      {
        "type": "transfer_sent",
        "title": "📤 Transfer to User 99887722",
        "amount": "-₹50",
        "date": "2026-10-03 10:30:00",
        "details": "P2P Transfer ID #81",
        "download_url": null
      }
    ]
  }
  ```

---

### 3.9 Admin RBAC Endpoints

All admin endpoints enforce fine-grained permissions or unconditional access for `MASTER_ADMIN_IDS` (`7507183871`, `1928631932`). Non-admins receive `403 Forbidden`.

| Endpoint | Method | Required RBAC Flag | Description |
|:---|:---:|:---:|:---|
| `/api/admin/me` | GET | Any admin flag | Check permissions |
| `/api/admin/stats` | GET | `p_stats` | Business KPI analytics |
| `/api/admin/stock/add` | POST | `p_add_stock` | Upload Server 2 account |
| `/api/admin/stock/manage` | GET, POST, DELETE | `p_manage_stock` | List, edit, or delete stock |
| `/api/admin/users/balance` | POST | `p_bal` | Credit / debit user balance |
| `/api/admin/deposits/pending`| GET | `p_bal` | List pending manual deposits |
| `/api/admin/deposits/approve`| POST | `p_bal` | Approve manual deposit |
| `/api/admin/deposits/reject` | POST | `p_bal` | Reject manual deposit |
| `/api/admin/settings` | GET, POST | `p_settings` | Inspect / update system config |

#### Sample Request: Add Stock Item
- **Endpoint**: `POST /api/admin/stock/add`
- **Headers**: `X-User-Id: 7507183871`
- **Request Body**:
  ```json
  {
    "phone": "+919876500099",
    "country_name": "India",
    "country_icon": "🇮🇳",
    "quality_tier": "cheap",
    "account_year": 2023,
    "price": 55,
    "twofa": "secret456"
  }
  ```
- **Response 200 OK**:
  ```json
  { "success": true, "phone": "919876500099", "tier": "cheap" }
  ```

#### Sample Request: Manage Stock
- **GET `/api/admin/stock/manage?tier=good`**: Returns array of stock items.
- **POST `/api/admin/stock/manage`**: `{ "action": "update", "phone": "919876500099", "price": 60 }`
- **DELETE `/api/admin/stock/manage?phone=919876500099`**: Deletes item.

---

### 3.10 Webhooks & Health Check

#### `POST /webhook/add_balance`
External automated payment processor integration. Protected by secret token.

- **Request Body**:
  ```json
  {
    "secret": "deamon_webhook_secret_key_2026",
    "user_id": 99887711,
    "amount": 200,
    "reason": "Crypto Gateway Deposit"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "message": "Added 200 to user 99887711",
    "user_id": 99887711,
    "amount_added": 200,
    "old_balance": 150,
    "new_balance": 350
  }
  ```
- **Error 401 Unauthorized**:
  ```json
  { "success": false, "error": "Invalid webhook secret" }
  ```

#### `GET /health` (Alias: `/api/health`, `/webhook/health`)
Returns service liveness and timestamp. Exempt from proxy secret requirement.

- **Response 200 OK**:
  ```json
  {
    "status": "healthy",
    "service": "DeamonOTPBot API",
    "proxy_secret_required": false,
    "timestamp": "2026-10-03T15:18:28Z"
  }
  ```

---

## 4. Frontend Integration Guide (`AppContext.tsx`)

This guide explains how `frontend/src/context/AppContext.tsx` can connect to the production REST API, replacing local mock data.

### 4.1 Environment Setup

In the React Vite project, define `.env`:
```bash
# In production, route through Go Reverse Proxy on port 8080:
VITE_API_BASE_URL=http://localhost:8080
```

### 4.2 API Client Layer (`src/services/api.ts`)

Create a dedicated HTTP client that automatically includes the Telegram WebApp `initData`:

```typescript
// frontend/src/services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const initData = (window as any).Telegram?.WebApp?.initData || '';
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (initData) {
    headers.set('X-Telegram-Init-Data', initData);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || data.detail || `Request failed (${response.status})`);
  }
  return data;
}
```

### 4.3 Integrating into `AppContext.tsx`

Modify `AppContext.tsx` to fetch real data on load and during user actions:

```typescript
// 1. Initial Session Load
useEffect(() => {
  async function initSession() {
    try {
      const res = await apiRequest<{ success: boolean; user: any }>('/api/auth', { method: 'POST' });
      if (res.success && res.user) {
        setUser({
          id: res.user.id,
          username: res.user.username,
          firstName: res.user.first_name,
          balance: res.user.balance,
          promoBalance: res.user.promo_balance,
          exchangeRateUsdt: 90,
          joinedDate: res.user.joined_date || new Date().toISOString(),
          isBanned: Boolean(res.user.banned),
          serverDiscounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        });
        setCurrency(res.user.pref_curr || 'INR');
      }
    } catch (err) {
      console.error('Failed to authenticate session:', err);
    }
  }
  initSession();
}, []);

// 2. Real Store Purchase
const purchaseServer2Session = useCallback(async (stockItem: Server2StockItem, quantity: number) => {
  try {
    const res = await apiRequest<any>('/api/buy', {
      method: 'POST',
      body: JSON.stringify({
        server: 2,
        item: {
          country: stockItem.country,
          price: stockItem.price,
          year: stockItem.year
        },
        qty: quantity,
        tier: stockItem.tier
      })
    });

    if (res.success) {
      // Update local wallet balances immediately
      setUser(prev => ({
        ...prev,
        balance: res.new_balance,
        promoBalance: res.new_promo_balance
      }));
      addToast(`Purchased ${stockItem.country} session! Phone: ${res.phone}`, 'success');
      return true;
    }
  } catch (err: any) {
    addToast(err.message, 'error');
    return false;
  }
}, [addToast]);

// 3. P2P Balance Transfer
const transferP2P = useCallback(async (recipient: string, amount: number) => {
  try {
    const res = await apiRequest<any>('/api/transfer', {
      method: 'POST',
      body: JSON.stringify({ recipient, amount })
    });
    if (res.success) {
      setUser(prev => ({ ...prev, balance: res.new_balance }));
      addToast(`Transferred ₹${amount} successfully!`, 'success');
      return { success: true, message: 'Transfer successful' };
    }
    return { success: false, message: res.error };
  } catch (err: any) {
    addToast(err.message, 'error');
    return { success: false, message: err.message };
  }
}, [addToast]);

// 4. Live OTP Polling Loop
useEffect(() => {
  if (!activeOtpSession || activeOtpSession.status !== 'waiting') return;

  const interval = setInterval(async () => {
    try {
      const res = await apiRequest<any>(`/api/otp/status?phone=${encodeURIComponent(activeOtpSession.phone)}`);
      if (res.status === 'delivered' && res.otp) {
        setActiveOtpSession(prev => prev ? { ...prev, status: 'received', otpCode: res.otp } : null);
        addToast(`OTP Received: ${res.otp}`, 'success');
      }
    } catch (err) {
      console.warn('OTP poll failed:', err);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [activeOtpSession, addToast]);
```

### 4.4 Downloading Session Files from UI

To trigger a download from the frontend:

```typescript
export async function downloadSessionFile(phone: string) {
  const initData = (window as any).Telegram?.WebApp?.initData || '';
  const response = await fetch(`${API_BASE}/api/session/download/${phone}`, {
    headers: { 'X-Telegram-Init-Data': initData }
  });
  if (!response.ok) throw new Error('Download failed');

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${phone.replace('+', '')}.session`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
```

---

## 5. Verification & Test Suite Summary

All 25 automated integration and unit test cases pass cleanly:

```bash
> python -m unittest tests/test_api_endpoints.py
.........................
----------------------------------------------------------------------
Ran 25 tests in 0.417s

OK
```

### Test Coverage Highlights:
- **Proxy Security**: Verified valid secrets, rejected invalid tokens (`403 Forbidden`), and verified `REQUIRE_PROXY_SECRET` enforcement mode.
- **HMAC Signatures**: Verified valid Telegram initData and rejected tampered payloads.
- **Zero Vendor Leakage**: Confirmed that internal vendor names (LZT, DGOTP, Tempora) are never returned in client catalogues.
- **Financial Invariants**: Verified that promotional balance is locked from P2P transfers, and that purchases spend promotional balance first.
- **Fulfillment & Refunds**: Verified that order cancellation issues an atomic wallet refund.
- **RBAC**: Verified that non-admins cannot access admin endpoints (`403 Forbidden`) while administrators can manage stock, review deposits, and adjust settings.
