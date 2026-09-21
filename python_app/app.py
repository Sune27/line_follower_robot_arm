"""
==============================================================================
APP.PY – MÁY CHỦ PYTHON ĐIỀU KHIỂN ROBOT QUA SERIAL COM3 & WEBSOCKET
==============================================================================
Tính năng:
  1. Đọc động cấu hình từ firmware/config.py (SSID, Mật khẩu, Số client, Kênh phát)
  2. Giám sát trạng thái kết nối phần cứng ESP32 qua COM3 (Tự động phát hiện cắm/rút cáp)
  3. Cầu nối thời gian thực WebSocket ↔ Serial UART hai chiều
  4. Phục vụ Web giao diện tại http://localhost:5000
==============================================================================
"""

import sys
import os
import json
import time
import asyncio
import threading
import importlib.util
import http.server
import socketserver
from pathlib import Path

# Cấu hình UTF-8 an toàn cho console Windows
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

try:
    from aiohttp import web
except ImportError:
    print("[Error] Thu vien 'aiohttp' chua duoc cai dat. Chay: pip install aiohttp")
    sys.exit(1)

# ==============================================================================
# CẤU HÌNH HỆ THỐNG
# ==============================================================================
SERIAL_PORT = "COM3"
SERIAL_BAUD = 115200
WS_HOST     = "0.0.0.0"
WS_PORT     = 8765
HTTP_PORT   = 5000

BASE_DIR        = Path(__file__).resolve().parent.parent
WEB_DIR         = BASE_DIR / "web"
FIRMWARE_CONFIG = BASE_DIR / "firmware" / "config.py"


def read_firmware_config():
    """
    Đọc trực tiếp file firmware/config.py để lấy thông số cấu hình chuẩn mới nhất
    """
    config_data = {
        "ssid": "WIFI ESP32",
        "password": "",
        "max_clients": 4,
        "channel": 6,
        "open_network": True
    }
    if FIRMWARE_CONFIG.exists():
        try:
            content = FIRMWARE_CONFIG.read_text(encoding="utf-8")
            for line in content.splitlines():
                line = line.strip()
                if line.startswith("WIFI_SSID"):
                    val = line.split("=")[1].split("#")[0].strip().strip('"').strip("'")
                    config_data["ssid"] = val
                elif line.startswith("WIFI_PASSWORD"):
                    val = line.split("=")[1].split("#")[0].strip().strip('"').strip("'")
                    config_data["password"] = val
                    config_data["open_network"] = (len(val) < 8)
                elif line.startswith("WIFI_MAX_CLIENTS"):
                    val = line.split("=")[1].split("#")[0].strip()
                    config_data["max_clients"] = int(val)
                elif line.startswith("WIFI_CHANNEL"):
                    val = line.split("=")[1].split("#")[0].strip()
                    config_data["channel"] = int(val)
        except Exception as e:
            print(f"[Config] Loi doc file firmware/config.py: {e}")
    return config_data


# ==============================================================================
# CLASS SERIAL_BRIDGE – QUẢN LÝ KẾT NỐI VÀ TỰ ĐỘNG PHỤC HỒI COM3
# ==============================================================================
class SerialBridge:
    def __init__(self, port="COM3", baudrate=115200, on_status_callback=None, on_hw_change_callback=None):
        self.port = port
        self.baudrate = baudrate
        self.on_status_callback = on_status_callback
        self.on_hw_change_callback = on_hw_change_callback
        self.ser = None
        self.connected = False
        self.running = True
        self._lock = threading.RLock()

    def is_connected(self):
        with self._lock:
            return self.connected and self.ser is not None and self.ser.is_open

    def try_connect(self):
        """Thử kết nối cổng COM3 an toàn không gây deadlock"""
        connected_now = False
        with self._lock:
            if self.ser and self.ser.is_open:
                return True
            try:
                self.ser = serial.Serial(self.port, self.baudrate, timeout=0.8)
                self.connected = True
                connected_now = True
            except Exception:
                if self.connected:
                    print(f"[Serial] [DISCONNECT] ESP32 da bi rut khoi cong {self.port}")
                    self.connected = False
                    if self.on_hw_change_callback:
                        self.on_hw_change_callback(False)
                self.ser = None
                return False

        # Thực hiện gọi callback và gửi lệnh khởi đầu ngoài lock
        if connected_now:
            time.sleep(0.4)
            print(f"[Serial] [OK] Da ket noi thanh cong voi ESP32 qua {self.port}")
            if self.on_hw_change_callback:
                self.on_hw_change_callback(True)
            self.send_command("CMD:WIFI_STATUS")
            return True
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
                    self._mark_disconnected()
            return False

    def _mark_disconnected(self):
        with self._lock:
            if self.connected:
                self.connected = False
                print(f"[Serial] [DISCONNECT] Mat ket noi voi {self.port}")
                if self.on_hw_change_callback:
                    self.on_hw_change_callback(False)
            if self.ser:
                try: self.ser.close()
                except Exception: pass
                self.ser = None

    def supervisor_loop(self):
        """Vòng lặp đọc dữ liệu và tự động phát hiện cắm/rút cáp USB"""
        while self.running:
            if not self.is_connected():
                self.try_connect()
                time.sleep(1.5)
                continue

            try:
                line = None
                with self._lock:
                    if self.ser and self.ser.is_open and self.ser.in_waiting > 0:
                        line = self.ser.readline().decode('utf-8', errors='ignore').strip()

                if line:
                    if line.startswith("RESP:"):
                        json_str = line[5:].strip()
                        try:
                            data = json.loads(json_str)
                            print(f"[Serial] [RX <- ESP32] active={data.get('active')}, ip={data.get('ip')}, clients={data.get('clients')}")
                            if self.on_status_callback:
                                self.on_status_callback(data)
                        except json.JSONDecodeError:
                            pass
                    else:
                        print(f"[ESP32 Log] {line}")
                else:
                    time.sleep(0.02)
            except Exception as e:
                self._mark_disconnected()
                time.sleep(1.0)

    def close(self):
        self.running = False
        self._mark_disconnected()


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
            on_status_callback=self._handle_serial_status,
            on_hw_change_callback=self._handle_hw_change
        )

    def _handle_hw_change(self, is_connected):
        """Khi phần cứng cắm hoặc rút cáp USB -> báo ngay cho Web"""
        if self.loop and self.connected_clients:
            msg = json.dumps({
                "event": "hardware_status",
                "connected": is_connected,
                "port": SERIAL_PORT,
                "message": "ESP32 đã kết nối (Cổng COM3)" if is_connected else "ESP32 chưa được cắm vào máy tính (Cổng COM3)"
            })
            asyncio.run_coroutine_threadsafe(self._broadcast(msg), self.loop)

    def _handle_serial_status(self, data):
        """Khi nhận JSON trạng thái từ ESP32 -> đẩy lên Web"""
        if self.loop and self.connected_clients:
            msg_str = json.dumps(data)
            asyncio.run_coroutine_threadsafe(self._broadcast(msg_str), self.loop)

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
            print(f"[WebSocket] [RX <- Web] {cmd}")

            if cmd == "wifi_toggle":
                self.serial_bridge.send_command("CMD:WIFI_TOGGLE")
            elif cmd == "wifi_on":
                self.serial_bridge.send_command("CMD:WIFI_ON")
            elif cmd == "wifi_off":
                self.serial_bridge.send_command("CMD:WIFI_OFF")
            elif cmd == "wifi_status":
                curr_hw = self.serial_bridge.is_connected()
                reply = json.dumps({
                    "event": "hardware_status",
                    "connected": curr_hw,
                    "port": SERIAL_PORT,
                    "message": "ESP32 đã kết nối (Cổng COM3)" if curr_hw else "ESP32 chưa được cắm vào máy tính (Cổng COM3)"
                })
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)
                if curr_hw:
                    self.serial_bridge.send_command("CMD:WIFI_STATUS")
            elif cmd == "get_config":
                cfg = read_firmware_config()
                reply = json.dumps({"event": "firmware_config", "config": cfg})
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)
            elif cmd == "login_success":
                print(f"[System] [LOGIN] Nguoi dung '{msg.get('user', 'Admin')}' da dang nhap. Kich hoat ket noi ESP32...")
                if not self.serial_bridge.is_connected():
                    self.serial_bridge.try_connect()
                curr_hw = self.serial_bridge.is_connected()
                reply = json.dumps({
                    "event": "hardware_status",
                    "connected": curr_hw,
                    "port": SERIAL_PORT,
                    "message": "ESP32 đã kết nối (Cổng COM3)" if curr_hw else "ESP32 chưa được cắm vào máy tính (Cổng COM3)"
                })
                if hasattr(client, 'send_str'):
                    await client.send_str(reply)
                else:
                    await client.send(reply)
            elif cmd == "logout_and_stop":
                print("[System] [LOGOUT] Nhan tin hieu Dang xuat tu Web. Dang giai phong COM3 va tu dong dung Python App...")
                self.serial_bridge.close()
                self.loop.call_later(0.5, lambda: os._exit(0))
        except json.JSONDecodeError:
            pass

    async def aiohttp_ws_handler(self, request):
        """Xử lý WebSocket qua AioHTTP tại đường dẫn /ws (hỗ trợ 100% Cloudflare Tunnel)"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        client_addr = request.remote
        print(f"[WebSocket AioHTTP] [Client Connected] {client_addr}")
        self.connected_clients.add(ws)

        is_hw = self.serial_bridge.is_connected()
        await ws.send_str(json.dumps({
            "event": "hardware_status",
            "connected": is_hw,
            "port": SERIAL_PORT,
            "message": "ESP32 đã kết nối (Cổng COM3)" if is_hw else "ESP32 chưa được cắm vào máy tính (Cổng COM3)"
        }))
        cfg = read_firmware_config()
        await ws.send_str(json.dumps({"event": "firmware_config", "config": cfg}))
        if is_hw:
            self.serial_bridge.send_command("CMD:WIFI_STATUS")

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
        """Xử lý kết nối Standalone WebSocket tại cổng 8765 (Fallback)"""
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WebSocket 8765] [Client Connected] {client_addr}")

        is_hw = self.serial_bridge.is_connected()
        await websocket.send(json.dumps({
            "event": "hardware_status",
            "connected": is_hw,
            "port": SERIAL_PORT,
            "message": "ESP32 đã kết nối (Cổng COM3)" if is_hw else "ESP32 chưa được cắm vào máy tính (Cổng COM3)"
        }))
        cfg = read_firmware_config()
        await websocket.send(json.dumps({"event": "firmware_config", "config": cfg}))
        if is_hw:
            self.serial_bridge.send_command("CMD:WIFI_STATUS")

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
        """Khởi động máy chủ tích hợp (Web + WebSocket chung cổng 5000 & Cloudflare Tunnel ready)"""
        print("\n" + "="*60)
        print("   HE THONG DIEU KHIEN XE DO LINE & CANH TAY ROBOT")
        print("="*60)

        # 1. Đọc và in cấu hình firmware
        cfg = read_firmware_config()
        print(f"[Config Firmware] SSID: '{cfg['ssid']}', Mat khau: {'(Mang mo)' if cfg['open_network'] else cfg['password']}, Kenh: {cfg['channel']}, Toi da: {cfg['max_clients']}")

        # 2. Khởi động luồng giám sát Serial COM3
        serial_thread = threading.Thread(target=self.serial_bridge.supervisor_loop, daemon=True)
        serial_thread.start()

        # 3. Khởi động máy chủ AioHTTP (Cổng 5000) và Standalone WebSocket (Cổng 8765)
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
            print(f"[HTTP Server] [OK] Giao dien Web & WebSocket san sang tai: http://localhost:{HTTP_PORT}")

            # B. Standalone WebSocket Server (Cổng 8765 fallback)
            await websockets.serve(self.ws_handler, WS_HOST, WS_PORT)
            print(f"[WebSocket] [OK] WebSocket Server dang lang nghe tai: ws://localhost:{WS_PORT}")
            print("="*60)
            print("HUONG DAN:")
            print(f"   1. Local: Mo http://localhost:{HTTP_PORT}")
            print(f"   2. Global: Chay '.\\cloudflared.exe tunnel --url http://localhost:{HTTP_PORT}'")
            print("   3. Dang nhap tai khoan: sune / 24021197 de dieu khien!\n")

            await asyncio.Future()

        try:
            self.loop.run_until_complete(start_servers())
        except KeyboardInterrupt:
            print("\n[System] Dang dung may chu...")
        finally:
            self.serial_bridge.close()
            print("[System] Da dung toan bo an toan.")


if __name__ == "__main__":
    server = RobotControllerServer()
    server.run()
