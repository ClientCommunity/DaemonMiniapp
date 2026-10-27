"""Deposit & Payment gateway (UPI & FamPay) callback queries handler."""
from __future__ import annotations

import html
from datetime import datetime, timezone
from bot_helpers import p_btn


async def handle_deposit_callback(e, uid: int, data: str) -> bool:
    """Handle all customer deposit and payment callback events. Returns True if handled, False otherwise."""
    is_dep = (
        data in ("menu_deposit", "fampay_start")
        or data.startswith((
            "fampay_gateway|",
            "fampay_check|",
            "fampay_regen|",
            "fampay_cancel|",
            "fampay_review|",
            "fampay_review_cancel|",
            "fampay_review_submit|",
            "dep_upi",
            "depm_",
            "kp_",
            "check_upi_",
        ))
    )
    if not is_dep:
        return False

    import bot
    bot_client = getattr(e, "client", None) or bot.bot
    cur = bot.cur
    db = bot.db
    manual_dep_state = bot.manual_dep_state
    deposit_input = bot.deposit_input
    fampay_deposit_state = bot.fampay_deposit_state
    fampay_gateway_selection = bot.fampay_gateway_selection
    fampay_check_locks = bot.fampay_check_locks
    fampay_error_cooldowns = bot.fampay_error_cooldowns
    fampay_review_state = bot.fampay_review_state
    callback_message_id = bot.callback_message_id
    cleanup_deposit_media = bot.cleanup_deposit_media
    build_deposit_menu_buttons = bot.build_deposit_menu_buttons
    is_method_on = bot.is_method_on
    fampay_setting = bot.fampay_setting
    check_fampay_order = bot.check_fampay_order
    create_fampay_checkout = bot.create_fampay_checkout
    FamPayError = bot.FamPayError
    send_admin_error = bot.send_admin_error
    log_primary_deposit = bot.log_primary_deposit
    ADMIN_IDS = bot.ADMIN_IDS
    init_upi_keypad = bot.init_upi_keypad
    manual_deposit_init = bot.manual_deposit_init
    keypad_logic = bot.keypad_logic
    verify_upi_payment = bot.verify_upi_payment

    if data == "menu_deposit":
        manual_dep_state.pop(uid, None)
        deposit_input.pop(uid, None)
        fampay_deposit_state.discard(uid)
        current_msg_id = callback_message_id(e)
        deleted_msg_ids = await cleanup_deposit_media(uid)
        msg = "💳 <b>Select Payment Method:</b>\n\n🟢 Choose Automatic for instant credit.\n⏳ Choose Manual for other methods."
        btns = build_deposit_menu_buttons()
        if current_msg_id and current_msg_id in deleted_msg_ids:
            await bot_client.send_message(uid, msg, buttons=btns)
        else:
            try:
                await e.edit(msg, buttons=btns)
            except Exception:
                await bot_client.send_message(uid, msg, buttons=btns)
        return True

    elif data == "fampay_start":
        if not is_method_on("fampay_status"):
            await e.answer("Automatic deposits are currently disabled.", alert=True)
            return True
        gateways = cur.execute("SELECT id,name,min_deposit,max_deposit FROM fampay_gateways WHERE enabled=1 ORDER BY id").fetchall()
        if gateways:
            buttons = [[p_btn(f"Gateway {i+1}: {row[1]}", f"fampay_gateway|{row[0]}", style="success")] for i, row in enumerate(gateways)] + [[p_btn("Cancel", "menu_deposit", style="danger")]]
            await e.edit("⚡ <b>Automatic UPI Deposit</b>\n\nChoose a payment gateway:", buttons=buttons)
        else:
            minimum = int(fampay_setting("fampay_min_dep", "50"))
            maximum = int(fampay_setting("fampay_max_dep", "50000"))
            fampay_gateway_selection.pop(uid, None)
            fampay_deposit_state.add(uid)
            await e.edit(f"⚡ <b>FamPay Automatic Deposit</b>\n\nSend an amount from ₹{minimum} to ₹{maximum}.", buttons=[[p_btn("Cancel", "menu_deposit", style="danger")]])
        return True

    elif data.startswith("fampay_gateway|"):
        gateway_id = int(data.split("|", 1)[1])
        row = cur.execute("SELECT name,min_deposit,max_deposit FROM fampay_gateways WHERE id=? AND enabled=1", (gateway_id,)).fetchone()
        if not row:
            await e.answer("This gateway is unavailable.", alert=True)
            return True
        fampay_gateway_selection[uid] = gateway_id
        fampay_deposit_state.add(uid)
        await e.edit(f"⚡ <b>{html.escape(row[0])}</b>\n\nSend an amount from ₹{row[1]} to ₹{row[2]}.", buttons=[[p_btn("Cancel", "menu_deposit", style="danger")]])
        return True

    elif data.startswith("fampay_check|"):
        reference = data.split("|", 1)[1]
        await e.answer("Checking payment…", alert=False)
        try:
            status, result = await check_fampay_order(reference, uid, user_initiated=True)
            if status == "credited" and result:
                fampay_check_locks.pop(reference, None)
                fampay_error_cooldowns.pop(reference, None)
                try:
                    await e.delete()
                except Exception:
                    pass
                await bot_client.send_message(uid, f"✅ <b>Payment Successful!</b>\n\nAmount: ₹{result['amount']}\nReference: <code>{reference}</code>\nYour balance was updated exactly once.", buttons=[[p_btn("Back", "menu_main", style="primary")]])
                await log_primary_deposit(uid, result["amount"], "FamPay Automatic")
            elif status == "credited":
                await e.answer("This payment was already credited.", alert=True)
            elif status == "expired":
                row = cur.execute("SELECT check_count,review_status FROM fampay_orders WHERE reference=? AND user_id=?", (reference, uid)).fetchone()
                buttons = [[p_btn("I Paid — Submit Review", f"fampay_review|{reference}", style="primary")]] if row and row[0] > 0 and not row[1] else []
                buttons.append([p_btn("Generate New Deposit", "fampay_start", style="success")])
                await e.edit(f"⌛ <b>Deposit expired</b>\n\nReference: <code>{reference}</code>\nNo payment was found and no balance was credited.\n\nIf you paid this request, submit proof for administrator review.", buttons=buttons)
            else:
                await e.answer("Payment not found yet. Pay the exact amount, then press Check again before expiry.", alert=True)
        except FamPayError as exc:
            await send_admin_error("FamPay payment check failed", f"Reference: {reference}\nUser: {uid}\n{exc}")
            await e.answer("Payment verification is temporarily unavailable. Admin was notified.", alert=True)
        return True

    elif data.startswith("fampay_regen|"):
        reference = data.split("|", 1)[1]
        row = cur.execute("SELECT amount,status FROM fampay_orders WHERE reference=? AND user_id=?", (reference, uid)).fetchone()
        if not row:
            await e.answer("Deposit request not found.", alert=True)
            return True
        if row[1] == "success":
            await e.answer("This payment was already credited.", alert=True)
            return True
        try:
            await e.delete()
            await create_fampay_checkout(uid, row[0], reference)
        except Exception as exc:
            await send_admin_error("FamPay QR regeneration failed", str(exc))
            await bot_client.send_message(uid, "Automatic deposit QR could not be generated. Admin was notified.")
        return True

    elif data.startswith("fampay_cancel|"):
        reference = data.split("|", 1)[1]
        changed = cur.execute("UPDATE fampay_orders SET status='cancelled',updated_at=? WHERE reference=? AND user_id=? AND status='pending'", (datetime.now(timezone.utc).isoformat(), reference, uid)).rowcount
        db.commit()
        if not changed:
            await e.answer("This deposit is already closed.", alert=True)
            return True
        fampay_check_locks.pop(reference, None)
        fampay_error_cooldowns.pop(reference, None)
        try:
            await e.delete()
        except Exception:
            pass
        await bot_client.send_message(uid, "❌ Deposit cancelled. The QR was deleted and no balance was credited.", buttons=[[p_btn("New Deposit", "menu_deposit", style="primary")]])
        return True

    elif data.startswith("fampay_review|"):
        reference = data.split("|", 1)[1]
        row = cur.execute("SELECT status,check_count,review_status FROM fampay_orders WHERE reference=? AND user_id=?", (reference, uid)).fetchone()
        if not row:
            await e.answer("Deposit request not found.", alert=True)
            return True
        if row[0] == "success":
            await e.answer("This payment was already credited.", alert=True)
            return True
        if row[0] != "expired" or row[1] < 1:
            await e.answer("Review is available only for an expired request that you checked before expiry.", alert=True)
            return True
        if row[2] in ("pending", "approved", "rejected"):
            await e.answer(f"Review status: {row[2]}.", alert=True)
            return True
        fampay_review_state[uid] = {"reference": reference, "step": "screenshot"}
        await e.edit(f"🧾 <b>Payment Review</b>\n\nReference: <code>{reference}</code>\n\nSend the payment-success screenshot now.", buttons=[[p_btn("Cancel Review", f"fampay_review_cancel|{reference}", style="danger")]])
        return True

    elif data.startswith("fampay_review_cancel|"):
        reference = data.split("|", 1)[1]
        fampay_review_state.pop(uid, None)
        cur.execute("UPDATE fampay_orders SET review_status=NULL,review_screenshot_msg_id=NULL,review_utr=NULL WHERE reference=? AND user_id=? AND review_status='draft'", (reference, uid))
        db.commit()
        await e.edit("Review submission cancelled.", buttons=[[p_btn("Back", "menu_deposit")]])
        return True

    elif data.startswith("fampay_review_submit|"):
        reference = data.split("|", 1)[1]
        row = cur.execute("""SELECT amount,status,check_count,review_status,review_screenshot_msg_id,review_utr
          FROM fampay_orders WHERE reference=? AND user_id=?""", (reference, uid)).fetchone()
        if not row or row[1] != "expired" or row[2] < 1 or row[3] != "draft" or not row[4] or not row[5]:
            await e.answer("Review information is incomplete or already submitted.", alert=True)
            return True
        cur.execute("UPDATE fampay_orders SET review_status='pending',updated_at=? WHERE reference=? AND user_id=? AND review_status='draft'", (datetime.now(timezone.utc).isoformat(), reference, uid))
        db.commit()
        fampay_review_state.pop(uid, None)
        try:
            for aid in ADMIN_IDS:
                try:
                    await bot_client.forward_messages(aid, row[4], uid)
                    await bot_client.send_message(aid, f"🧾 <b>FamPay Deposit Review</b>\n\nUser: <code>{uid}</code>\nReference: <code>{reference}</code>\nExpected amount: <b>₹{row[0]}</b>\nUTR / TXN: <code>{html.escape(row[5])}</code>\n\nApprove only after confirming the screenshot and transaction.", buttons=[[p_btn("✅ Approve", f"fampay_review_action|approve|{reference}", style="success"), p_btn("❌ Reject", f"fampay_review_action|reject|{reference}", style="danger")]])
                except Exception:
                    pass
        except Exception as exc:
            cur.execute("UPDATE fampay_orders SET review_status='draft' WHERE reference=? AND review_status='pending'", (reference,))
            db.commit()
            await send_admin_error("FamPay review delivery failed", str(exc))
            await e.answer("Could not submit review. Admin was notified; please try again.", alert=True)
            return True
        await e.edit("✅ <b>Review submitted</b>\n\nAn administrator will verify your screenshot and transaction ID. Balance is credited only after approval.", buttons=[[p_btn("Back", "menu_main")]])
        return True

    elif data.startswith("dep_upi"):
        if not is_method_on("upi_status"):
            await e.answer("UPI deposits are currently disabled.", alert=True)
            return True
        await init_upi_keypad(e)
        return True

    elif data.startswith("depm_"):
        await manual_deposit_init(e, data.replace("depm_", ""))
        return True

    elif data.startswith("kp_"):
        await keypad_logic(e)
        return True

    elif data.startswith("check_upi_"):
        await verify_upi_payment(e, data.replace("check_upi_", ""))
        return True

    return False
