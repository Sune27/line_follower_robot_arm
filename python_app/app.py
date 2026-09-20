"""
==============================================================================
APP.PY – MÁY CHỦ PYTHON ĐIỀU KHIỂN ROBOT QUA SERIAL COM3 & WEBSOCKET
==============================================================================
Kiến trúc:
  1. Serial Bridge : Giao tiếp 2 chiều với ESP32 qua cổng COM3 (Baudrate 115200)
  2. WebSocket Srv : Cung cấp API thời gian thực hai chiều cho Web (Cổng 8765)
  3. HTTP Server   : Phục vụ giao diện Web (HTML, CSS, JS) tại http://localhost:5000
==============================================================================
"""

import sys
import io
import os
import json
import time
import asyncio
import threading
import http.server
import socketserver
from pathlib import Path

# Cấu hình an toàn mã hóa UTF-8 cho console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import serial
except ImportError:
    print("[Error] Thu vien 'pyserial' chua duoc cai dat. Chay: pip install pyserial")
    sys.exit(1)

try:
    import websockets
except ImportError:
    print("[Error] Thu vien 'websockets' chua duoc cai dat. Chay: pip install websockets")
    sys.exit(1)

# ==============================================================================
# THÔNG SỐ CẤU HÌNH HỆ THỐNG
# ==============================================================================
SERIAL_PORT = "COM3"
SERIAL_BAUD = 115200
WS_HOST     = "0.0.0.0"
WS_PORT     = 8765
HTTP_PORT   = 5000

BASE_DIR    = Path(__file__).resolve().parent.parent
WEB_DIR     = BASE_DIR / "web"


# ==============================================================================
# CLASS SERIAL_BRIDGE – QUẢN LÝ KẾT NỐI VỚI ESP32 QUA COM3
# ==============================================================================
class SerialBridge:
    def __init__(self, port="COM3", baudrate=115200, on_status_callback=None):
        self.port = port
        self.baudrate = baudrate
        self.on_status_callback = on_status_callback
        self.ser = None
        self.running = False
        self._lock = threading.Lock()

    def connect(self):
        """Mở kết nối tới cổng Serial COM3"""
        try:
            self.ser = serial.Serial(self.port, self.baudrate, timeout=1)
            self.running = True
            time.sleep(1.0)
            print(f"[Serial] [OK] Da ket noi thanh cong toi {self.port} ({self.baudrate} baud)")
            self.send_command("CMD:WIFI_STATUS")
            return True
        except Exception as e:
            print(f"[Serial] [ERR] Khong the mo cong {self.port}: {e}")
            self.ser = None
            return False

    def send_command(self, cmd_str):
        """Gửi chuỗi lệnh xuống ESP32"""
        with self._lock:
            if self.ser and self.ser.is_open:
                try:
                    payload = (cmd_str.strip() + "\n").encode('utf-8')
                    self.ser.write(payload)
                    self.ser.flush()
                    print(f"[Serial] [TX -> ESP32] {cmd_str.strip()}")
                    return True
                except Exception as e:
                    print(f"[Serial] [ERR] Loi gui lenh: {e}")
            else:
                print(f"[Serial] [WARN] Cong {self.port} chua mo, khong the gui lenh.")
            return False

    def listen_loop(self):
        """Vòng lặp chạy trong thread riêng để đọc dữ liệu liên tục từ ESP32"""
        while self.running:
            if not self.ser or not self.ser.is_open:
                time.sleep(1.0)
                continue
            try:
                if self.ser.in_waiting > 0:
                    raw_line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                    if not raw_line:
                        continue
                    
                    if raw_line.startswith("RESP:"):
                        json_str = raw_line[5:].strip()
                        try:
                            data = json.loads(json_str)
                            print(f"[Serial] [RX <- ESP32] active={data.get('active')}, ip={data.get('ip')}, clients={data.get('clients')}")
                            if self.on_status_callback:
                                self.on_status_callback(data)
                        except json.JSONDecodeError:
                            print(f"[Serial] [WARN] Loi giai ma JSON: {json_str}")
                    else:
                        print(f"[ESP32 Log] {raw_line}")
                else:
                    time.sleep(0.02)
            except Exception as e:
                print(f"[Serial] [ERR] Loi doc cong: {e}")
                time.sleep(1.0)

    def close(self):
        self.running = False
        if self.ser and self.ser.is_open:
            self.ser.close()
            print(f"[Serial] Da dong cong {self.port}")


# ==============================================================================
# CLASS ROBOT_CONTROLLER_SERVER – MÁY CHỦ WEBSOCKET & HTTP
# ==============================================================================
class RobotControllerServer:
    def __init__(self):
        self.connected_clients = set()
        self.loop = None
        self.serial_bridge = SerialBridge(
            port=SERIAL_PORT,
            baudrate=SERIAL_BAUD,
            on_status_callback=self._handle_serial_status
        )

    def _handle_serial_status(self, data):
        """Khi nhận được JSON trạng thái từ Serial, chuyển tiếp lên tất cả WebSocket clients"""
        if self.loop and self.connected_clients:
            msg_str = json.dumps(data)
            asyncio.run_coroutine_threadsafe(self._broadcast(msg_str), self.loop)

    async def _broadcast(self, message):
        """Gửi message tới tất cả các trình duyệt Web đang mở"""
        if not self.connected_clients:
            return
        dead_clients = set()
        for client in list(self.connected_clients):
            try:
                await client.send(message)
            except Exception:
                dead_clients.add(client)
        self.connected_clients -= dead_clients

    async def ws_handler(self, websocket):
        """Xử lý từng kết nối WebSocket từ trình duyệt Web"""
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WebSocket] [Client Connected] {client_addr}")

        # Gửi lệnh lấy trạng thái mới nhất ngay khi có client kết nối
        self.serial_bridge.send_command("CMD:WIFI_STATUS")

        try:
            async for raw_message in websocket:
                try:
                    msg = json.loads(raw_message)
                    cmd = msg.get("cmd")
                    print(f"[WebSocket] [RX <- Web] {cmd}")

                    if cmd == "wifi_toggle":
                        self.serial_bridge.send_command("CMD:WIFI_TOGGLE")
                    elif cmd == "wifi_on":
                        self.serial_bridge.send_command("CMD:WIFI_ON")
                    elif cmd == "wifi_off":
                        self.serial_bridge.send_command("CMD:WIFI_OFF")
                    elif cmd == "wifi_status":
                        self.serial_bridge.send_command("CMD:WIFI_STATUS")
                    else:
                        print(f"[WebSocket] [WARN] Lenh khong xac dinh: {cmd}")

                except json.JSONDecodeError:
                    print(f"[WebSocket] [WARN] Nhan du lieu khong phai JSON: {raw_message}")

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.connected_clients:
                self.connected_clients.remove(websocket)
            print(f"[WebSocket] [Client Disconnected] {client_addr}")

    def start_http_server(self):
        """Khởi động HTTP server phục vụ file web tại http://localhost:5000"""
        class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(WEB_DIR), **kwargs)

            def do_GET(self):
                if self.path == "/" or self.path == "":
                    self.path = "/templates/index.html"
                return super().do_GET()

            def log_message(self, format, *args):
                pass

        try:
            socketserver.TCPServer.allow_reuse_address = True
            with socketserver.TCPServer(("", HTTP_PORT), CustomHTTPHandler) as httpd:
                print(f"[HTTP Server] [OK] Giao dien Web san sang tai: http://localhost:{HTTP_PORT}")
                httpd.serve_forever()
        except Exception as e:
            print(f"[HTTP Server] [ERR] Loi khoi dong HTTP: {e}")

    def run(self):
        """Chạy toàn bộ hệ thống"""
        print("\n" + "="*60)
        print("   HE THONG DIEU KHIEN XE DO LINE & CANH TAY ROBOT")
        print("="*60)

        # 1. Kết nối Serial COM3
        self.serial_bridge.connect()
        serial_thread = threading.Thread(target=self.serial_bridge.listen_loop, daemon=True)
        serial_thread.start()

        # 2. Khởi động HTTP Web Server
        http_thread = threading.Thread(target=self.start_http_server, daemon=True)
        http_thread.start()

        # 3. Khởi động WebSocket Server
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        async def start_ws():
            async with websockets.serve(self.ws_handler, WS_HOST, WS_PORT):
                print(f"[WebSocket] [OK] WebSocket Server dang lang nghe tai: ws://localhost:{WS_PORT}")
                print("="*60)
                print("HUONG DAN:")
                print(f"   1. Mo trinh duyet vao: http://localhost:{HTTP_PORT}")
                print("   2. Dang nhap tai khoan: sune / 24021197")
                print("   3. Vao tab Wi-Fi va bam Nut Nguon de dieu khien ESP32 that!")
                print("   4. Nhan Ctrl + C tai cua so nay de dung he thong.\n")
                await asyncio.Future()

        try:
            self.loop.run_until_complete(start_ws())
        except KeyboardInterrupt:
            print("\n[System] Dang dung may chu...")
        finally:
            self.serial_bridge.close()
            print("[System] Da dung toan bo an toan.")


if __name__ == "__main__":
    server = RobotControllerServer()
    server.run()
