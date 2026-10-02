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
import socket
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

        # Cấu hình Wi-Fi TCP Socket Bridge (khi xe chạy pin không cắm dây USB)
        self.esp32_ip = "10.161.134.159"
        self.esp32_tcp_port = 8888
        self.tcp_sock = None
        self.tcp_lock = threading.Lock()
        self.active_channel = "DISCONNECTED"

        # Cơ chế Khóa Độc Quyền (Exclusive Controller Lock): Chỉ duy nhất 1 người được lái/điều khiển
        self.active_controller_client = None
        self.active_controller_user = None

    def is_controller_alive(self):
        """Kiểm tra xem client đang giữ quyền điều khiển có còn kết nối không"""
        if self.active_controller_client is None:
            return False
        if self.active_controller_client not in self.connected_clients:
            return False
        if hasattr(self.active_controller_client, 'closed') and self.active_controller_client.closed:
            return False
        if hasattr(self.active_controller_client, 'open') and not self.active_controller_client.open:
            return False
        return True

    def send_serial(self, cmd_str):
        """Gửi lệnh chuỗi xuống ESP32 (Tự động định tuyến qua USB Serial hoặc Wi-Fi TCP Socket)"""
        if not cmd_str.endswith('\n'):
            cmd_str += '\n'
        payload = cmd_str.encode('utf-8')
        sent = False

        # 1. Thử gửi qua Serial USB nếu đang cắm cáp
        with self.ser_lock:
            if self.ser and self.ser.is_open:
                try:
                    self.ser.write(payload)
                    self.ser.flush()
                    sent = True
                    if not cmd_str.startswith("CMD:SPEED:"):
                        print(f"[Serial TX] -> {cmd_str.strip()}")
                except Exception as e:
                    print(f"[Serial Error] Không thể gửi lệnh: {e}")

        # 2. Nếu không có USB Serial, tự động chuyển tiếp qua Wi-Fi TCP Socket
        if not sent:
            with self.tcp_lock:
                if self.tcp_sock:
                    try:
                        self.tcp_sock.sendall(payload)
                        sent = True
                        if not cmd_str.startswith("CMD:SPEED:"):
                            print(f"[Wi-Fi TCP TX] -> {cmd_str.strip()}")
                    except Exception as e:
                        print(f"[Wi-Fi TCP Error] Lỗi gửi socket: {e}")
                        try: self.tcp_sock.close()
                        except: pass
                        self.tcp_sock = None

        if not sent and not cmd_str.startswith("CMD:SPEED:"):
            print(f"[Bridge Warn] Chưa kết nối ESP32 (cả USB lẫn Wi-Fi TCP), không thể gửi: {cmd_str.strip()}")

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
            if cmd != "set_motor_speed":
                print(f"[WebSocket] [RX] {cmd}")

            # 1. Yêu cầu cấp quyền điều khiển độc quyền (Login Handshake)
            if cmd == "request_login":
                user = msg.get('user', 'Người dùng')
                # Kiểm tra xem có ai đang chiếm quyền điều khiển không (cho phép cùng user đổi thiết bị/refresh)
                if not self.is_controller_alive() or self.active_controller_client == client or self.active_controller_user == user:
                    # CẤP QUYỀN THÀNH CÔNG
                    self.active_controller_client = client
                    self.active_controller_user = user
                    print(f"[Security] [LOGIN GRANTED] Đã cấp quyền độc quyền cho '{user}'.")

                    resp = json.dumps({
                        "event": "login_response",
                        "success": True,
                        "user": user,
                        "message": "Cấp quyền điều khiển độc quyền thành công"
                    })
                    if hasattr(client, 'send_str'): await client.send_str(resp)
                    else: await client.send(resp)

                    # Gửi trạng thái Wi-Fi cho người vừa đăng nhập
                    reply_wifi = json.dumps(self.wifi_state)
                    if hasattr(client, 'send_str'): await client.send_str(reply_wifi)
                    else: await client.send(reply_wifi)

                    # Phát sóng trạng thái bận cho các máy khác đang ở màn hình đăng nhập
                    await self._broadcast(json.dumps({
                        "event": "controller_status",
                        "is_locked": True,
                        "active_user": user
                    }))
                else:
                    # TỪ CHỐI DO ĐANG CÓ NGƯỜI ĐIỀU KHIỂN
                    print(f"[Security] [LOGIN REJECTED] Từ chối '{user}' do '{self.active_controller_user}' đang giữ quyền!")
                    resp = json.dumps({
                        "event": "login_response",
                        "success": False,
                        "message": f"❌ Hệ thống đang bận: '{self.active_controller_user}' đang điều khiển xe trên thiết bị khác! Vui lòng chờ người đó đăng xuất."
                    })
                    if hasattr(client, 'send_str'): await client.send_str(resp)
                    else: await client.send(resp)

            elif cmd == "login_success":
                # Tương thích ngược: tự động nâng cấp client thành controller nếu đang rảnh
                user = msg.get('user', 'Admin')
                if not self.is_controller_alive() or self.active_controller_user == user:
                    self.active_controller_client = client
                    self.active_controller_user = user
                reply = json.dumps(self.wifi_state)
                if hasattr(client, 'send_str'): await client.send_str(reply)
                else: await client.send(reply)

            elif cmd in ("logout_and_stop", "logout"):
                # Giải phóng phiên điều khiển độc quyền
                if client == self.active_controller_client or not self.is_controller_alive():
                    old_user = self.active_controller_user or "Người dùng"
                    self.active_controller_client = None
                    self.active_controller_user = None
                    self.send_serial("CMD:STOP_STREAM")
                    print(f"[Security] [LOGOUT] '{old_user}' đã đăng xuất. Phiên điều khiển đã được giải phóng.")
                    await self._broadcast(json.dumps({
                        "event": "controller_status",
                        "is_locked": False,
                        "active_user": None
                    }))

            elif cmd == "get_wifi_status":
                print("[Server] 📡 Nhận yêu cầu get_wifi_status từ Web -> Gửi CMD:GET_WIFI_STATUS xuống ESP32")
                self.send_serial("CMD:GET_WIFI_STATUS")
                reply = json.dumps(self.wifi_state)
                if hasattr(client, 'send_str'): await client.send_str(reply)
                else: await client.send(reply)

            # Các lệnh điều khiển phần cứng: BẮT BUỘC phải là người đang giữ quyền điều khiển
            elif cmd in ("ultrasonic_measure_once", "ultrasonic_start_stream", "ultrasonic_stop_stream"):
                if self.is_controller_alive() and client != self.active_controller_client:
                    print(f"[Security Block] Chặn lệnh '{cmd}' từ thiết bị không được ủy quyền!")
                    reject_msg = json.dumps({
                        "event": "command_rejected",
                        "message": "❌ Bạn không có quyền điều khiển thiết bị này do đang có người khác làm chủ phiên!"
                    })
                    if hasattr(client, 'send_str'): await client.send_str(reject_msg)
                    else: await client.send(reject_msg)
                    return

                if cmd == "ultrasonic_measure_once":
                    print("[Server] 🎯 Nhận lệnh từ Web: ĐO 1 LẦN -> Gửi CMD:MEASURE_ONCE xuống ESP32")
                    self.send_serial("CMD:MEASURE_ONCE")
                elif cmd == "ultrasonic_start_stream":
                    print("[Server] ▶ Nhận lệnh từ Web: BẮT ĐẦU ĐO LIÊN TỤC -> Gửi CMD:START_STREAM xuống ESP32")
                    self.send_serial("CMD:START_STREAM")
                elif cmd == "ultrasonic_stop_stream":
                    print("[Server] ⏸ Nhận lệnh từ Web: DỪNG ĐO LIÊN TỤC -> Gửi CMD:STOP_STREAM xuống ESP32")
                    self.send_serial("CMD:STOP_STREAM")

            elif cmd == "tcrt_start_stream":
                self.send_serial("CMD:START_TCRT_STREAM")

            elif cmd == "tcrt_stop_stream":
                self.send_serial("CMD:STOP_TCRT_STREAM")

            elif cmd == "set_motor_speed":
                speed = int(msg.get("speed", 0))
                left = int(msg.get("left", speed))
                right = int(msg.get("right", speed))
                is_running = bool(msg.get("is_running", speed > 0 or left > 0 or right > 0))
                if is_running and (speed > 0 or left > 0 or right > 0):
                    self.send_serial(f"CMD:SPEED:{speed},{left},{right}")
                else:
                    self.send_serial("CMD:MOTOR_STOP")
                await self._broadcast(json.dumps({
                    "event": "motor_telemetry",
                    "speed": speed,
                    "speed_left": left,
                    "speed_right": right,
                    "is_running": is_running
                }))

            elif cmd == "toggle_motor_power":
                state = bool(msg.get("state", False))
                speed = int(msg.get("speed", 0)) if state else 0
                print(f"[Server] 🏎️ Bật/Tắt động cơ: state={state}, speed={speed}%")
                if state and speed > 0:
                    self.send_serial(f"CMD:SPEED:{speed},{speed},{speed}")
                else:
                    self.send_serial("CMD:MOTOR_STOP")
                await self._broadcast(json.dumps({
                    "event": "motor_telemetry",
                    "speed": speed,
                    "speed_left": speed,
                    "speed_right": speed,
                    "is_running": state
                }))
        except json.JSONDecodeError:
            pass

    def process_esp32_line(self, line):
        """Xử lý và giải mã dòng tin nhận được từ ESP32 (dùng chung cho cả USB Serial và Wi-Fi TCP)"""
        if not line:
            return

        # Chỉ in các sự kiện hệ thống quan trọng
        if any(tag in line for tag in ("[FAILSAFE", "[FAILSAFE RECOVERED]", "[ESP32] KHOI DONG", "[CMD_ACK]")):
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
                print(f"[Bridge] Lỗi giải mã WIFI_STATUS: {e}")

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
                print(f"[Bridge] Lỗi giải mã EMERGENCY: {e}")

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
                print(f"[Bridge] Lỗi giải mã EMERGENCY_RESOLVED: {e}")

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
                # Đẩy toàn bộ telemetry lên tất cả client Web
                if self.loop and self.connected_clients:
                    telem_str = json.dumps(telem)
                    asyncio.run_coroutine_threadsafe(self._broadcast(telem_str), self.loop)
            except Exception as e:
                print(f"[Bridge] Lỗi giải mã JSON telemetry: {e}")

        # 5. Xử lý trực tiếp dữ liệu TCRT5000 (nhận dạng dòng Digital (DO) / TCRT)
        elif "Digital (DO):" in line or "TCRT:" in line:
            try:
                is_black = False
                raw = 0
                volt = 0.0

                if "Digital (DO):" in line:
                    is_black = ("HIGH" in line)
                    raw = 1 if is_black else 0
                    import re
                    m_volt = re.search(r'\(([\d\.]+)V\)', line)
                    volt = float(m_volt.group(1)) if m_volt else (3.3 if is_black else 0.0)
                elif "TCRT:" in line:
                    parts = line.split(":")
                    if len(parts) >= 3:
                        raw_l = int(parts[1])
                        is_black = (raw_l == 1)
                        raw = raw_l
                        volt = 3.3 if is_black else 0.0

                tcrt_telem = {
                    "event": "telemetry",
                    "tcrt5000": {
                        "left": {
                            "pin": 19,
                            "raw": raw,
                            "is_black": is_black,
                            "text": "DEN" if is_black else "TRANG",
                            "voltage": volt
                        },
                        "right": {
                            "pin": 21,
                            "raw": 0,
                            "is_black": False,
                            "text": "TRANG",
                            "voltage": 0.0
                        }
                    },
                    "mode": "tcrt_streaming"
                }
                if self.loop and self.connected_clients:
                    asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(tcrt_telem)), self.loop)
            except Exception:
                pass
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
            self.esp32_ip = ip_val
            if self.loop and self.connected_clients:
                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)
        elif "KHÔNG TÌM THẤY BẤT CỨ MẠNG WI-FI NÀO" in line or "Mất kết nối Wi-Fi" in line:
            self.wifi_state["connected"] = False
            self.wifi_state["ssid"] = "—"
            self.wifi_state["ip"] = "—"
            if self.loop and self.connected_clients:
                asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps(self.wifi_state)), self.loop)

    def serial_listener_loop(self):
        """Kênh 1: Lắng nghe USB Serial từ ESP32 khi cắm cáp vào máy tính"""
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
                        self.active_channel = "SERIAL"
                        print(f"[Serial Bridge] ✅ Đã kết nối lắng nghe ESP32 qua USB tại {SERIAL_PORT}")
                    except Exception:
                        ser = None
                        with self.ser_lock:
                            self.ser = None
                        time.sleep(2)
                        continue

                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    self.process_esp32_line(line)
                else:
                    time.sleep(0.02)
            except Exception:
                with self.ser_lock:
                    if ser:
                        try: ser.close()
                        except Exception: pass
                        ser = None
                    self.ser = None
                time.sleep(2)

    def wifi_tcp_bridge_loop(self):
        """Kênh 2: Lắng nghe Wi-Fi TCP Socket từ ESP32 khi chạy pin không dây"""
        while self.running:
            # Nếu đang có cổng USB Serial thì ưu tiên USB, tạm dừng TCP
            with self.ser_lock:
                if self.ser and self.ser.is_open:
                    time.sleep(2)
                    continue

            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2.5)
            try:
                sock.connect((self.esp32_ip, self.esp32_tcp_port))
                sock.settimeout(1.0)
                with self.tcp_lock:
                    self.tcp_sock = sock
                self.active_channel = "WIFI_TCP"
                print(f"[Wi-Fi TCP Bridge] ✅ ĐÃ KẾT NỐI TỚI ESP32 KHÔNG DÂY TẠI {self.esp32_ip}:{self.esp32_tcp_port}")

                # Yêu cầu cập nhật trạng thái ban đầu
                self.send_serial("CMD:GET_WIFI_STATUS\n")

                buf = ""
                while self.running:
                    # Nếu cắm lại cáp USB, chuyển lại ưu tiên USB
                    with self.ser_lock:
                        if self.ser and self.ser.is_open:
                            break

                    try:
                        chunk = sock.recv(1024)
                        if not chunk:
                            print("[Wi-Fi TCP Bridge] ESP32 đã ngắt kết nối.")
                            break
                        buf += chunk.decode('utf-8', errors='replace')
                        while '\n' in buf:
                            line, buf = buf.split('\n', 1)
                            self.process_esp32_line(line.strip())
                    except socket.timeout:
                        continue
                    except Exception as e:
                        break
            except (socket.timeout, ConnectionRefusedError, OSError):
                time.sleep(2)
            finally:
                with self.tcp_lock:
                    if self.tcp_sock:
                        try: self.tcp_sock.close()
                        except: pass
                        self.tcp_sock = None
                time.sleep(2)

    def udp_beacon_listener(self):
        """Kênh 3: Tự động phát hiện IP của ESP32 qua UDP Broadcast nếu router cấp IP động"""
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(('0.0.0.0', 8889))
            sock.settimeout(3.0)
            while self.running:
                try:
                    data, addr = sock.recvfrom(512)
                    msg = data.decode('utf-8', errors='ignore').strip()
                    if msg.startswith("ROBOT_BEACON:"):
                        parts = msg.split(":")
                        if len(parts) >= 2:
                            new_ip = parts[1]
                            if new_ip != self.esp32_ip:
                                print(f"[Auto-Discovery] 📡 Phát hiện ESP32 tại địa chỉ IP mới: {new_ip}")
                                self.esp32_ip = new_ip
                except socket.timeout:
                    continue
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            try: sock.close()
            except: pass

    async def aiohttp_ws_handler(self, request):
        """Xử lý WebSocket qua AioHTTP tại đường dẫn /ws (hỗ trợ 100% Cloudflare Tunnel / Ngrok)"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        client_addr = request.remote
        print(f"[WebSocket AioHTTP] [Client Connected] {client_addr}")
        self.connected_clients.add(ws)

        # Gửi ngay trạng thái Wi-Fi & trạng thái phiên điều khiển cho client vừa kết nối
        await ws.send_str(json.dumps(self.wifi_state))
        await ws.send_str(json.dumps({
            "event": "controller_status",
            "is_locked": self.is_controller_alive(),
            "active_user": self.active_controller_user if self.is_controller_alive() else None
        }))

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
            # Nếu người giữ quyền điều khiển thoát kết nối, tự động giải phóng phiên
            if ws == self.active_controller_client:
                old_user = self.active_controller_user or "Người dùng"
                self.active_controller_client = None
                self.active_controller_user = None
                self.send_serial("CMD:STOP_STREAM")
                print(f"[Security] Người điều khiển '{old_user}' đã ngắt kết nối. Đã giải phóng quyền điều khiển cho người tiếp theo!")
                if self.loop and self.connected_clients:
                    asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps({
                        "event": "controller_status",
                        "is_locked": False,
                        "active_user": None
                    })), self.loop)
        return ws

    async def ws_handler(self, websocket):
        """Xử lý kết nối Standalone WebSocket tại cổng 8765 (Dự phòng)"""
        self.connected_clients.add(websocket)
        client_addr = websocket.remote_address
        print(f"[WebSocket 8765] [Client Connected] {client_addr}")

        # Gửi ngay trạng thái Wi-Fi & trạng thái khóa phiên hiện tại
        await websocket.send(json.dumps(self.wifi_state))
        await websocket.send(json.dumps({
            "event": "controller_status",
            "is_locked": self.is_controller_alive(),
            "active_user": self.active_controller_user if self.is_controller_alive() else None
        }))

        try:
            async for raw_message in websocket:
                await self._process_command(websocket, raw_message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            if websocket in self.connected_clients:
                self.connected_clients.remove(websocket)
            print(f"[WebSocket 8765] [Client Disconnected] {client_addr}")
            if websocket == self.active_controller_client:
                old_user = self.active_controller_user or "Người dùng"
                self.active_controller_client = None
                self.active_controller_user = None
                self.send_serial("CMD:STOP_STREAM")
                print(f"[Security] Người điều khiển '{old_user}' đã ngắt kết nối 8765. Đã giải phóng quyền điều khiển!")
                if self.loop and self.connected_clients:
                    asyncio.run_coroutine_threadsafe(self._broadcast(json.dumps({
                        "event": "controller_status",
                        "is_locked": False,
                        "active_user": None
                    })), self.loop)

    def run(self):
        """Khởi động máy chủ tích hợp"""
        print("\n" + "="*60)
        print("   HỆ THỐNG MÁY CHỦ XE DÒ LINE & CÁNH TAY ROBOT")
        print("="*60)

        # Khởi động các luồng giao tiếp với ESP32 (cả USB Serial và Wi-Fi TCP song song)
        threading.Thread(target=self.serial_listener_loop, daemon=True).start()
        threading.Thread(target=self.wifi_tcp_bridge_loop, daemon=True).start()
        threading.Thread(target=self.udp_beacon_listener, daemon=True).start()

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
