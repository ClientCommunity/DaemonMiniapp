"""Modular telethon callback handlers for DeamonOTPBot."""
from bot_handlers.server1_callbacks import handle_server1_callback
from bot_handlers.server2_callbacks import handle_server2_callback
from bot_handlers.server3_callbacks import handle_server3_callback
from bot_handlers.server4_callbacks import handle_server4_callback
from bot_handlers.server5_callbacks import handle_server5_callback
from bot_handlers.deposit_callbacks import handle_deposit_callback
from bot_handlers.admin_callbacks import handle_admin_callback
from bot_handlers.user_callbacks import handle_user_callbacks
from bot_handlers.text_handlers import handle_text_input


async def handle_server_callbacks(e, uid: int, data: str) -> bool:
    """Route callback to the appropriate server handler (1-5)."""
    if await handle_server5_callback(e, uid, data):
        return True
    if await handle_server4_callback(e, uid, data):
        return True
    if await handle_server3_callback(e, uid, data):
        return True
    if await handle_server1_callback(e, uid, data):
        return True
    if await handle_server2_callback(e, uid, data):
        return True
    return False
