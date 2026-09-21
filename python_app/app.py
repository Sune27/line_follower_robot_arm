"""
==============================================================================
APP.PY – MÁY CHỦ PYTHON WEBSOCKET & HTTP CHO ROBOT CAR & ARM
==============================================================================
Tính năng:
  1. Phục vụ giao diện Web tại http://localhost:5000 (và qua Ngrok / Cloudflare Tunnel)
  2. WebSocket Server tại /ws (cổng 5000) và cổng 8765 (dự phòng)
  3. Quản lý phiên đăng nhập và định tuyến các gói tin điều khiển
==============================================================================
"""

import sys
import os
import json
import asyncio
from pathlib import Path

# Cấu hình UTF-8 an toàn cho console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import websockets
except ImportError:
    print("[Error] Thư viện 'websockets' chưa được cài đặt. Chạy: pip install websockets")
    sys.exit(1)

try:
    from aiohttp import web
except ImportError:
    print("[Error] Thư viện 'aiohttp' chưa được cài đặt. Chạy: pip install aiohttp")
    sys.exit(1)

# ==============================================================================
# CẤU HÌNH CỔNG
# ==============================================================================
HTTP_PORT   = 5000
WS_HOST     = "0.0.0.0"
WS_PORT     = 8765

BASE_DIR    = Path(__file__).resolve().parent.parent
WEB_DIR     = BASE_DIR / "web"


class RobotControllerServer:
    def __init__(self):
        self.connected_clients = set()
        self.loop = None

    async def _broadcast(self, message):
        if not self.connected_clients:
            return
        dead_clients = set()
        for client in list(self.connected_clients):
            try:
                if hasattr(client, 'send_str'):
                    await client.send_str(message)
                else:
                    await client.send(message)
            except Exception:
                dead_clients.add(client)
        self.connected_clients -= dead_clients

    async def _process_command(self, client, raw_message):
        try:
            msg = json.loads(raw_message)
            cmd = msg.get("cmd")
            print(f"[WebSocket] [RX] {cmd}")

            if cmd == "login_success":
                user = msg.get('user', 'Admin')
                print(f"[System] [LOGIN] Người dùng '{user}' đã đăng nhập thành công.")
            elif cmd == "logout_and_stop":
                print("[System] [LOGOUT] Nhận tín hiệu Đăng xuất từ Web. Đang tự động dừng Python App...")
                self.loop.call_later(0.5, lambda: os._exit(0))
        except json.JSONDecodeError:
            pass

    async def aiohttp_ws_handler(self, request):
        """Xử lý WebSocket qua AioHTTP tại đường dẫn /ws (hỗ trợ 100% Cloudflare Tunnel / Ngrok)"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        client_addr = request.remote
        print(f"[WebSocket AioHTTP] [Client Connected] {client_addr}")
        self.connected_clients.add(ws)

        try:
            async for raw_msg in ws:
                if raw_msg.type == web.WSMsgType.TEXT:
                    await self._process_command(ws, raw_msg.data)
                elif raw_msg.type in (web.WSMsgType.CLOSE, web.WSMsgType.ERROR):
                    break
        finally:
            if ws in self.connected_clients:
                self.connected_clients.remove(ws)
            print(f"[WebSocket AioHTTP] [Client Disconnected] {client_addr}")
        return ws

    async def ws_handler(self, websocket):
        """Xử lý kết nối Standalone WebSocket tại cổng 8765 (Dự phòng)"""
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WebSocket 8765] [Client Connected] {client_addr}")

        try:
            async for raw_message in websocket:
                await self._process_command(websocket, raw_message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.connected_clients:
                self.connected_clients.remove(websocket)
            print(f"[WebSocket 8765] [Client Disconnected] {client_addr}")

    def run(self):
        """Khởi động máy chủ tích hợp"""
        print("\n" + "="*60)
        print("   HỆ THỐNG MÁY CHỦ XE DÒ LINE & CÁNH TAY ROBOT")
        print("="*60)

        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        async def start_servers():
            # A. AioHTTP Server (Phục vụ Web HTML/CSS/JS và WebSocket /ws chung cổng 5000)
            app = web.Application()

            async def index_handler(req):
                return web.FileResponse(WEB_DIR / "templates" / "index.html", headers={
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'ngrok-skip-browser-warning': 'true'
                })

            app.router.add_get('/', index_handler)
            app.router.add_get('/templates/index.html', index_handler)
            app.router.add_static('/static', WEB_DIR / 'static')
            app.router.add_get('/ws', self.aiohttp_ws_handler)

            runner = web.AppRunner(app)
            await runner.setup()
            site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
            await site.start()
            print(f"[HTTP Server] [OK] Giao diện Web & WebSocket sẵn sàng tại: http://localhost:{HTTP_PORT}")

            # B. Standalone WebSocket Server (Cổng 8765 fallback)
            await websockets.serve(self.ws_handler, WS_HOST, WS_PORT)
            print(f"[WebSocket] [OK] Standalone WebSocket đang lắng nghe tại: ws://localhost:{WS_PORT}")
            print("="*60)
            print("HƯỚNG DẪN:")
            print(f"   1. Local: Mở http://localhost:{HTTP_PORT}")
            print("   2. Global: Chạy file chay_ngrok_global.bat để mở link toàn cầu")
            print("   3. Đăng nhập tài khoản: sune / 24021197 để vào Bảng điều khiển!\n")

            await asyncio.Future()

        try:
            self.loop.run_until_complete(start_servers())
        except KeyboardInterrupt:
            print("\n[System] Đang dừng máy chủ...")
        finally:
            print("[System] Đã dừng toàn bộ an toàn.")


if __name__ == "__main__":
    server = RobotControllerServer()
    server.run()
