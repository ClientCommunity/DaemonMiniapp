"""Server 5 (SMM Panel) rendering, search, pagination, and formatting helpers."""
from __future__ import annotations

import html
import re
import sys
import unicodedata
from typing import Any

from bot_helpers.ui_helpers import p_btn
from database import connect as managed_connect
from server5 import service_rows as smm_service_rows, quote as smm_quote

SMM_BRANDS = ("telegram", "instagram", "whatsapp", "youtube", "snapchat")


def get_bot_module():
    return sys.modules.get("bot")


def normalize_smm_target(value: Any) -> str:
    """Keep provider-specific targets intact while removing copy controls."""
    target = html.unescape(unicodedata.normalize("NFKC", str(value or ""))).strip()
    target = "".join(ch for ch in target if unicodedata.category(ch) not in ("Cf", "Cc", "Cs"))
    anchor = re.search(r'<a\s+[^>]*href=["\']([^"\']+)["\']', target, re.IGNORECASE)
    if anchor:
        target = anchor.group(1).strip()
    target = re.sub(r'</?a(?:\s+[^>]*)?>', '', target, flags=re.IGNORECASE).strip()
    if not target:
        raise ValueError("empty target")
    if len(target) > 2000:
        raise ValueError("target too long")
    return target


def user_server_discount(uid: int, server_no: int) -> int:
    with managed_connect() as conn:
        row = conn.execute("SELECT discount_percent FROM user_server_discounts WHERE user_id=? AND server_no=?", (uid, server_no)).fetchone()
        if row:
            return max(0, min(100, int(row[0] or 0)))
        if server_no == 1:
            legacy = conn.execute("SELECT discount FROM users WHERE user_id=?", (uid,)).fetchone()
            return max(0, min(100, int(legacy[0] or 0))) if legacy else 0
    return 0


def apply_server_discount(uid: int, server_no: int, amount: float | int) -> float | int:
    discount = user_server_discount(uid, server_no)
    amt = float(amount)
    if discount <= 0:
        return int(amt) if float(amt).is_integer() else round(amt, 6)
    discounted = max(1 if server_no != 5 else 0.01, amt * (100 - discount) / 100)
    return int(round(discounted)) if server_no != 5 else round(discounted, 6)


def discount_label(uid: int, server_no: int) -> str:
    discount = user_server_discount(uid, server_no)
    return f"\n🎁 <b>Discount:</b> {discount}% applied" if discount else ""


def format_smm_money(value: Any) -> str:
    """Keep micro-priced SMM rates visible without noisy trailing zeroes."""
    amount = float(value)
    return f"{amount:.2f}" if abs(amount) >= 1 else f"{amount:.6f}".rstrip("0").rstrip(".")


async def render_smm_services(e, uid: int, page: int = 1, query: str = "", sort: str = "price_low", category_name: str = "", back_target: str | None = None):
    bot_mod = get_bot_module()
    smm_search_results = getattr(bot_mod, "smm_search_results", {})
    rows = smm_service_rows(query=query, category_name=category_name or None, limit=500)
    items = []
    for row in rows:
        try:
            q = smm_quote(row['id'], 1000, enforce_limits=False)
        except Exception:
            continue
        items.append((row, q))
    keys = {
        "price_low": lambda x: x[1].charge,
        "price_high": lambda x: -x[1].charge,
        "az": lambda x: x[0]['name'].casefold(),
        "popular": lambda x: -x[0]['order_count']
    }
    items.sort(key=keys.get(sort, keys['price_low']))
    limit = 10
    pages = max(1, (len(items) + limit - 1) // limit)
    page = max(1, min(page, pages))
    buttons = []
    for row, q in items[(page - 1) * limit:page * limit]:
        buttons.append([p_btn(f"{row['emoji']} {row['name']} | ₹{format_smm_money(q.charge)}/1K", f"smm_view|{row['id']}", style="success")])
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Prev", f"smm_page|{page-1}|{sort}"))
    nav.append(p_btn("🔃 Sort", f"smm_sort|{page}"))
    if page < pages:
        nav.append(p_btn("Next ▶", f"smm_page|{page+1}|{sort}"))
    if nav:
        buttons.append(nav)
    buttons.extend([[p_btn("🔍 Search Again", "smm_search", style="primary"), p_btn("📦 My Orders", "smm_orders|1")]])
    resolved_back = back_target or smm_search_results.get(uid, {}).get("back_target") or "smm_cats|1"
    buttons.append([p_btn("Back", resolved_back), p_btn("🏠 Home", "menu_buy")])
    caption = (
        f"🔎 <b>{'Search Results' if query else 'Available Services'}</b>\n\n"
        f"Query : <code>{html.escape(query or category_name or 'All services')}</code>\nResults Found : <b>{len(items)}</b>\n"
        f"Sort : <b>{sort.replace('_',' ').title()}</b>\nShowing : <b>{(page-1)*limit+1 if items else 0}–{min(page*limit,len(items))} of {len(items)}</b>\n\nSelect a service below."
    )
    smm_search_results[uid] = {"query": query, "sort": sort, "category_name": category_name, "back_target": resolved_back}
    return await e.edit(caption, buttons=buttons)


async def render_smm_categories(e, page: int = 1, brand: str = ""):
    limit = 10
    offset = (max(1, page) - 1) * limit
    pattern = f"%{brand.casefold()}%"
    with managed_connect() as conn:
        rows = conn.execute("""SELECT MIN(id) id,display_name,COUNT(*) provider_count FROM smm_categories
          WHERE visible=1 AND LOWER(display_name) LIKE ? GROUP BY LOWER(display_name),display_name
          ORDER BY LOWER(display_name) LIMIT ? OFFSET ?""", (pattern, limit + 1, offset)).fetchall()
    buttons = [[p_btn("🔍 Search Categories & Services", "smm_search", style="success")]]
    buttons.append([p_btn(name.title(), f"smm_brand|{name}|1", style="danger") for name in SMM_BRANDS[:3]])
    buttons.append([p_btn(name.title(), f"smm_brand|{name}|1", style="danger") for name in SMM_BRANDS[3:]])
    suffix = f"|{brand}" if brand else ""
    buttons += [[p_btn(r['display_name'], f"smm_cat|{r['id']}|1|{page}{suffix}", style="primary")] for r in rows[:limit]]
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Previous", f"smm_cats|{page-1}{suffix}"))
    if len(rows) > limit:
        nav.append(p_btn("Next ▶", f"smm_cats|{page+1}{suffix}"))
    if nav:
        buttons.append(nav)
    buttons.append([p_btn("📦 My Orders", "smm_orders|1"), p_btn("Back", "menu_buy")])
    caption = f"📂 <b>{html.escape(brand.title())+' ' if brand else ''}Categories</b>\n\nSorted A → Z · Page {page}\nSelect a category to view its services."
    await e.edit(caption, buttons=buttons)


async def render_smm_search(e, uid: int, query: str, page: int = 1):
    bot_mod = get_bot_module()
    smm_search_results = getattr(bot_mod, "smm_search_results", {})
    limit = 8
    offset = (max(1, page) - 1) * limit
    pattern = f"%{query.casefold()}%"
    with managed_connect() as conn:
        categories = conn.execute("""SELECT MIN(id) id,display_name FROM smm_categories WHERE visible=1
          AND LOWER(display_name) LIKE ? GROUP BY LOWER(display_name),display_name ORDER BY LOWER(display_name) LIMIT 20""", (pattern,)).fetchall()
        services = conn.execute("""SELECT s.id,s.name,s.emoji FROM smm_services s JOIN smm_categories c ON c.id=s.category_id
          JOIN smm_providers p ON p.id=s.provider_id WHERE s.enabled=1 AND s.visible=1 AND c.visible=1 AND p.enabled=1
          AND (LOWER(s.name) LIKE ? OR s.remote_service_id=?) ORDER BY LOWER(s.name) LIMIT ? OFFSET ?""", (pattern, query, limit + 1, offset)).fetchall()
    buttons = []
    if page == 1:
        buttons += [[p_btn(f"📂 {r['display_name']}", f"smm_cat|{r['id']}|1|search|{page}", style="primary")] for r in categories]
    buttons += [[p_btn(f"{r['emoji']} {r['name']}", f"smm_view|{r['id']}", style="success")] for r in services[:limit]]
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Previous", f"smm_searchpage|{page-1}"))
    if len(services) > limit:
        nav.append(p_btn("Next ▶", f"smm_searchpage|{page+1}"))
    if nav:
        buttons.append(nav)
    buttons += [[p_btn("🔍 Search Again", "smm_search"), p_btn("Back", "smm_cats|1")]]
    smm_search_results[uid] = {"query": query, "search_page": page, "back_target": f"smm_searchpage|{page}"}
    await e.edit(f"🔎 <b>Search Results</b>\n\nQuery: <code>{html.escape(query)}</code>\nCategories: {len(categories)}\nServices on this page: {len(services[:limit])}\nPage: {page}\n\nChoose a category or service.", buttons=buttons)


async def render_admin_smm_orders(e, page: int = 1):
    limit = 10
    page = max(1, int(page))
    offset = (page - 1) * limit
    with managed_connect() as conn:
        rows = conn.execute("""SELECT o.id,o.user_id,o.charge,o.profit,o.status,o.refunded,o.created_at,s.name service_name,p.name provider_name
          FROM smm_orders o JOIN smm_services s ON s.id=o.service_id JOIN smm_providers p ON p.id=o.provider_id
          ORDER BY o.id DESC LIMIT ? OFFSET ?""", (limit + 1, offset)).fetchall()
    lines = []
    for r in rows[:limit]:
        lines.append(f"#{r['id']} · user {r['user_id']} · {r['status']} · ₹{format_smm_money(r['charge'])} · profit ₹{format_smm_money(r['profit'])} · {'refunded' if r['refunded'] else 'paid'} · {r['created_at']} · {r['service_name'][:45]}")
    buttons = []
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Prev", f"adm_smm_orders|{page-1}"))
    if len(rows) > limit:
        nav.append(p_btn("Next ▶", f"adm_smm_orders|{page+1}"))
    if nav:
        buttons.append(nav)
    buttons.append([p_btn("Back", "adm_server5")])
    text = f"<b>Orders</b> · Page {page}\n\n" + html.escape('\n'.join(lines) or 'No records.')
    await e.edit(text[:3900], buttons=buttons)


async def render_admin_smm_categories(e, page: int = 1, query: str = ""):
    limit = 12
    offset = (max(1, page) - 1) * limit
    pattern = f"%{query.casefold()}%"
    with managed_connect() as conn:
        rows = conn.execute("""SELECT c.id,c.display_name,c.visible,p.name provider_name,
          (SELECT COUNT(*) FROM smm_services s WHERE s.category_id=c.id AND s.deleted_at IS NULL) service_count
          FROM smm_categories c JOIN smm_providers p ON p.id=c.provider_id
          WHERE p.deleted_at IS NULL AND LOWER(c.display_name) LIKE ? ORDER BY LOWER(c.display_name),p.priority LIMIT ? OFFSET ?""", (pattern, limit + 1, offset)).fetchall()
    buttons = [[p_btn("🔍 Search", "adm_smm_catsearch", style="success")]]
    buttons += [[p_btn(f"{'✅' if r['visible'] else '❌'} {r['display_name']} · {r['service_count']}", f"adm_smm_cat|{r['id']}|1")] for r in rows[:limit]]
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Previous", f"adm_smm_catpage|{page-1}"))
    if len(rows) > limit:
        nav.append(p_btn("Next ▶", f"adm_smm_catpage|{page+1}"))
    if nav:
        buttons.append(nav)
    buttons.append([p_btn("Choose Provider / Sync", "adm_smm_syncproviders")])
    buttons.append([p_btn("Back", "adm_server5")])
    await e.edit(f"📂 <b>Categories Management</b>\n\nResults: {offset+len(rows[:limit])} · Page {page}", buttons=buttons)


async def render_admin_smm_services(e, category_id: int, page: int = 1):
    limit = 12
    offset = (max(1, page) - 1) * limit
    with managed_connect() as conn:
        cat = conn.execute("SELECT display_name FROM smm_categories WHERE id=?", (category_id,)).fetchone()
        rows = conn.execute("SELECT id,name,enabled,visible FROM smm_services WHERE category_id=? AND deleted_at IS NULL ORDER BY LOWER(name) LIMIT ? OFFSET ?", (category_id, limit + 1, offset)).fetchall()
    if not cat:
        return await e.edit("Category no longer exists.", buttons=[[p_btn("Back", "adm_smm_categories")]])
    buttons = [[p_btn(f"{'✅' if r['enabled'] and r['visible'] else '❌'} {r['name']}", f"adm_smm_service|{r['id']}|{category_id}")] for r in rows[:limit]]
    nav = []
    if page > 1:
        nav.append(p_btn("◀ Previous", f"adm_smm_cat|{category_id}|{page-1}"))
    if len(rows) > limit:
        nav.append(p_btn("Next ▶", f"adm_smm_cat|{category_id}|{page+1}"))
    if nav:
        buttons.append(nav)
    buttons.append([p_btn("Back", "adm_smm_categories")])
    await e.edit(f"🛒 <b>{html.escape(cat['display_name'])} Services</b>\n\nSorted A → Z", buttons=buttons)
