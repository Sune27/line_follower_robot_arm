"""
==============================================================================
APP.PY – MÁY CHỦ PYTHON WEBSOCKET & HTTP CHO ROBOT CAR & ARM
==============================================================================
Tính năng:
  1. Phục vụ giao diện Web tại http://localhost:5000 (và qua Ngrok / Cloudflare Tunnel)
  2. WebSocket Server tại /ws (cổng 5000) và cổng 8765 (dự phòng)
  3. Cập nhật trạng thái Wi-Fi real-time từ ESP32 qua Serial/Heartbeat và đẩy ngay lên Web
  4. Quản lý phiên đăng nhập và định tuyến các gói tin điều khiển
==============================================================================
"""

import sys
import os
import json
import time
import asyncio
import threading
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
SERIAL_PORT = "COM3"
SERIAL_BAUD = 115200

BASE_DIR    = Path(__file__).resolve().parent.parent
WEB_DIR     = BASE_DIR / "web"


class RobotControllerServer:
    def __init__(self):
        self.connected_clients = set()
        self.loop = None
        # Trạng thái Wi-Fi của ESP32 lưu trữ tại server
        self.wifi_state = {
            "event": "wifi_status",
            "connected": False,
            "ssid": "—",
            "ip": "—",
            "security": "WPA2-PSK"
        }
        self.running = True

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
                # Gửi ngay trạng thái Wi-Fi hiện tại cho client
                reply = json.dumps(self.wifi_state)
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)

            elif cmd == "get_wifi_status":
                reply = json.dumps(self.wifi_state)
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)

            elif cmd == "logout_and_stop":
                print("[System] [LOGOUT] Nhận tín hiệu Đăng xuất từ Web. Đang tự động dừng Python App...")
                self.running = False
                self.loop.call_later(0.5, lambda: os._exit(0))
        except json.JSONDecodeError:
            pass

    def serial_listener_loop(self):
        """Lắng nghe dòng Serial in từ ESP32 để bắt các sự kiện Wi-Fi theo thời gian thực"""
        try:
            import serial
        except ImportError:
            return

        ser = None
        while self.running:
            try:
                if ser is None:
                    try:
                        ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
                        print(f"[Serial Monitor] Đã kết nối lắng nghe ESP32 tại {SERIAL_PORT}")
                    except Exception:
                        ser = None
                        time.sleep(2)
                        continue

                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    # Kiểm tra xem có phải dòng HEARTBEAT hoặc kết quả scan/connect không
                    if line.startswith("HEARTBEAT:"):
                        try:
                            hb = json.loads(line[10:])
                            self.wifi_state = {
                                "event": "wifi_status",
                                "connected": hb.get("connected", False),
                                "ssid": hb.get("ssid", "—"),
                                "ip": hb.get("ip", "—"),
                                "security": "WPA2-PSK"
                            }
                            # Đẩy real-time lên tất cả client web đang mở
                            if self.loop and self.connected_clients:
                                msg_str = json.dumps(self.wifi_state)
                                asyncio.run_coroutine_threadsafe(self._broadcast(msg_str), self.loop)
                        except Exception:
                            pass
                    elif "🎉 KẾT NỐI THÀNH CÔNG TỚI:" in line:
                        ssid_name = line.split(":")[-1].strip().strip("'")
                        self.wifi_state["connected"] = True
                        self.wifi_state["ssid"] = ssid_name
                        if self.loop and self.connected_clients:
                            asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                    elif "Địa chỉ IP của ESP32:" in line:
                        ip_val = line.split(":")[-1].strip()
                        self.wifi_state["ip"] = ip_val
                        if self.loop and self.connected_clients:
                            asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                    elif "KHÔNG TÌM THẤY BẤT CỨ MẠNG WI-FI NÀO" in line or "Mất kết nối Wi-Fi" in line:
                        self.wifi_state["connected"] = False
                        self.wifi_state["ssid"] = "—"
                        self.wifi_state["ip"] = "—"
                        if self.loop and self.connected_clients:
                            asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                else:
                    time.sleep(0.05)
            except Exception:
                if ser:
                    try: ser.close()
                    except Exception: pass
                    ser = None
                time.sleep(2)

    async def aiohttp_ws_handler(self, request):
        """Xử lý WebSocket qua AioHTTP tại đường dẫn /ws (hỗ trợ 100% Cloudflare Tunnel / Ngrok)"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        client_addr = request.remote
        print(f"[WebSocket AioHTTP] [Client Connected] {client_addr}")
        self.connected_clients.add(ws)

        # Gửi ngay trạng thái Wi-Fi hiện tại cho client vừa kết nối
        await ws.send_str(json.dumps(self.wifi_state))

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

        # Gửi ngay trạng thái Wi-Fi hiện tại
        await websocket.send(json.dumps(self.wifi_state))

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

        # Khởi động luồng giám sát Serial thời gian thực từ ESP32
        t = threading.Thread(target=self.serial_listener_loop, daemon=True)
        t.start()

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
            self.running = False
            print("[System] Đã dừng toàn bộ an toàn.")


if __name__ == "__main__":
    server = RobotControllerServer()
    server.run()
