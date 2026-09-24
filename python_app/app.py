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
        self.ser = None
        self.ser_lock = threading.Lock()

    def send_serial(self, cmd_str):
        """Gửi lệnh chuỗi xuống ESP32 qua cổng Serial an toàn đa luồng"""
        with self.ser_lock:
            if self.ser and self.ser.is_open:
                try:
                    if not cmd_str.endswith('\n'):
                        cmd_str += '\n'
                    self.ser.write(cmd_str.encode('utf-8'))
                    self.ser.flush()
                    print(f"[Serial TX] -> {cmd_str.strip()}")
                except Exception as e:
                    print(f"[Serial Error] Không thể gửi lệnh: {e}")
            else:
                print(f"[Serial Warn] Chưa kết nối ESP32, không thể gửi: {cmd_str.strip()}")

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
                print("[Server] 📡 Nhận yêu cầu get_wifi_status từ Web -> Gửi CMD:GET_WIFI_STATUS xuống ESP32")
                self.send_serial("CMD:GET_WIFI_STATUS")
                reply = json.dumps(self.wifi_state)
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)

            elif cmd == "ultrasonic_measure_once":
                print("[Server] 🎯 Nhận lệnh từ Web: ĐO 1 LẦN -> Gửi CMD:MEASURE_ONCE xuống ESP32")
                self.send_serial("CMD:MEASURE_ONCE")

            elif cmd == "ultrasonic_start_stream":
                print("[Server] ▶ Nhận lệnh từ Web: BẮT ĐẦU ĐO LIÊN TỤC -> Gửi CMD:START_STREAM xuống ESP32")
                self.send_serial("CMD:START_STREAM")

            elif cmd == "ultrasonic_stop_stream":
                print("[Server] ⏸ Nhận lệnh từ Web: DỪNG ĐO LIÊN TỤC -> Gửi CMD:STOP_STREAM xuống ESP32")
                self.send_serial("CMD:STOP_STREAM")

            elif cmd == "logout_and_stop" or cmd == "logout":
                # Đưa cảm biến về nghỉ khi logout
                self.send_serial("CMD:STOP_STREAM")
                print("[System] [LOGOUT] Người dùng đã đăng xuất trên Web. Server vẫn tiếp tục hoạt động để sẵn sàng cho lần đăng nhập tiếp theo.")
        except json.JSONDecodeError:
            pass

    def serial_listener_loop(self):
        """Lắng nghe dòng Serial in từ ESP32 để bắt các sự kiện Wi-Fi và Telemetry cảm biến theo thời gian thực"""
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
                        ser.dtr = False
                        ser.rts = False
                        with self.ser_lock:
                            self.ser = ser
                        print(f"[Serial Monitor] Đã kết nối lắng nghe ESP32 tại {SERIAL_PORT}")
                    except Exception:
                        ser = None
                        with self.ser_lock:
                            self.ser = None
                        time.sleep(2)
                        continue

                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    # In log các dòng thông tin đo từ ESP32
                    if "[DO 1 LAN]:" in line or "[STREAM]:" in line or "[CMD_ACK]" in line or "[FAILSAFE" in line:
                        print(f"[ESP32] {line}")

                    # 1. Nhận gói tin trạng thái Wi-Fi từ lệnh GET_WIFI_STATUS
                    if "WIFI_STATUS:" in line:
                        try:
                            idx = line.find("WIFI_STATUS:")
                            json_str = line[idx + 12:].strip()
                            wifi_info = json.loads(json_str)
                            self.wifi_state = {
                                "event": "wifi_status",
                                "connected": wifi_info.get("connected", False),
                                "ssid": wifi_info.get("ssid", "—"),
                                "ip": wifi_info.get("ip", "—"),
                                "emergency_mode": wifi_info.get("emergency_mode", False),
                                "security": "WPA2-PSK"
                            }
                            print(f"[WiFi Status Broadcast] Wi-Fi: {self.wifi_state['ssid']} | IP: {self.wifi_state['ip']}")
                            if self.loop and self.connected_clients:
                                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                        except Exception as e:
                            print(f"[Serial] Lỗi giải mã WIFI_STATUS: {e}")

                    # 2. Nhận gói tin CẢNH BÁO KHẨN CẤP khi mất Wi-Fi
                    elif "EMERGENCY:" in line:
                        try:
                            idx = line.find("EMERGENCY:")
                            json_str = line[idx + 10:].strip()
                            em_data = json.loads(json_str)
                            print(f"[🚨 CẢNH BÁO KHẨN CẤP] {em_data.get('msg')}")
                            self.wifi_state["connected"] = False
                            self.wifi_state["emergency_mode"] = True
                            if self.loop and self.connected_clients:
                                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(em_data)), self.loop)
                                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                        except Exception as e:
                            print(f"[Serial] Lỗi giải mã EMERGENCY: {e}")

                    # 3. Nhận gói tin KHÔI PHỤC KẾT NỐI KHẨN CẤP THÀNH CÔNG
                    elif "EMERGENCY_RESOLVED:" in line:
                        try:
                            idx = line.find("EMERGENCY_RESOLVED:")
                            json_str = line[idx + 19:].strip()
                            res_data = json.loads(json_str)
                            print(f"[🎉 KHÔI PHỤC KHẨN CẤP] {res_data.get('msg')}")
                            self.wifi_state["connected"] = True
                            self.wifi_state["emergency_mode"] = False
                            wifi_res = res_data.get("wifi", {})
                            if wifi_res.get("ssid"): self.wifi_state["ssid"] = wifi_res.get("ssid")
                            if wifi_res.get("ip"): self.wifi_state["ip"] = wifi_res.get("ip")
                            if self.loop and self.connected_clients:
                                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(res_data)), self.loop)
                                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
                        except Exception as e:
                            print(f"[Serial] Lỗi giải mã EMERGENCY_RESOLVED: {e}")

                    # 4. Kiểm tra dòng TELEMETRY (khoảng cách + wifi)
                    elif "TELEMETRY:" in line:
                        try:
                            idx = line.find("TELEMETRY:")
                            json_str = line[idx + 10:].strip()
                            telem = json.loads(json_str)
                            wifi = telem.get("wifi")
                            if wifi:
                                self.wifi_state = {
                                    "event": "wifi_status",
                                    "connected": wifi.get("connected", False),
                                    "ssid": wifi.get("ssid", "—"),
                                    "ip": wifi.get("ip", "—"),
                                    "security": "WPA2-PSK"
                                }
                            # Log kết quả cự ly đo được
                            dist_val = telem.get("sensor", {}).get("distance_cm")
                            obst_val = telem.get("sensor", {}).get("obstacle_detected")

                            # Đẩy toàn bộ telemetry (gồm cự ly cảm biến) lên tất cả client Web
                            if self.loop and self.connected_clients:
                                telem_str = json.dumps(telem)
                                asyncio.run_coroutine_threadsafe(self._broadcast(telem_str), self.loop)
                        except Exception as e:
                            print(f"[Serial] Lỗi giải mã JSON telemetry: {e}")
                    elif line.startswith("HEARTBEAT:"):
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
                with self.ser_lock:
                    if ser:
                        try: ser.close()
                        except Exception: pass
                        ser = None
                    self.ser = None
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

            async def favicon_handler(req):
                return web.FileResponse(WEB_DIR / "static" / "favicon.svg", headers={
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'public, max-age=86400'
                })

            app.router.add_get('/', index_handler)
            app.router.add_get('/templates/index.html', index_handler)
            app.router.add_get('/favicon.ico', favicon_handler)
            app.router.add_get('/favicon.svg', favicon_handler)
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
