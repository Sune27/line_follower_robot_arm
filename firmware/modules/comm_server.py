# ==============================================================================
# COMM_SERVER.PY – MODULE TRUYỀN THÔNG & GIÁM SÁT MẠNG ROBOT (OOP)
# ==============================================================================
# Đóng gói toàn bộ các tác vụ mạng:
# - Khởi tạo TCP Socket Server (Port 8888) non-blocking.
# - Tiếp nhận kết nối và nhận lệnh từ Python Server / Web.
# - Phát sóng Telemetry và phản hồi lệnh ra cả USB Serial lẫn Wi-Fi TCP Socket.
# - Phát gói tin UDP Beacon (Port 8889) để Server tự động tìm kiếm IP của xe.
# - Giám sát kết nối Wi-Fi Failsafe trong nền (kèm đèn LED chỉ báo).
# ==============================================================================

import sys
import time
import ujson
try:
    import uselect
except ImportError:
    import select as uselect
try:
    import usocket as socket
except ImportError:
    import socket

class RobotCommServer:
    def __init__(self, wifi_mgr, port=8888, beacon_interval_ms=3500):
        self.wifi_mgr = wifi_mgr
        self.port = port
        self.beacon_interval_ms = beacon_interval_ms

        # Quản lý non-blocking I/O
        self.serial_poll = uselect.poll()
        self.serial_poll.register(sys.stdin, uselect.POLLIN)

        self.tcp_server = None
        self.tcp_client = None
        self.tcp_rx_buf = ""
        self.last_beacon_time = 0

        # Failsafe và kết nối lại
        self.emergency_mode = False
        self.last_wifi_check_time = 0
        self.last_emergency_retry_time = 0
        self.wifi_check_interval_ms = 1500
        self.emergency_retry_interval_ms = 3000

        # Callback khi nhận lệnh từ bên ngoài
        self.command_callback = None
        # Callback khi có sự cố mạng khẩn cấp (ví dụ để dừng motor)
        self.emergency_callback = None

        if self.wifi_mgr.is_connected():
            self.start_tcp_server()

    def set_command_callback(self, cb):
        """Đăng ký hàm xử lý lệnh: cb(cmd_str)"""
        self.command_callback = cb

    def set_emergency_callback(self, cb):
        """Đăng ký hàm xử lý sự cố mạng: cb(is_emergency)"""
        self.emergency_callback = cb

    def start_tcp_server(self):
        """Khởi động TCP Socket Server lắng nghe tại cổng chỉ định"""
        try:
            if self.tcp_server:
                try: self.serial_poll.unregister(self.tcp_server)
                except: pass
                try: self.tcp_server.close()
                except: pass
            self.tcp_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.tcp_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.tcp_server.bind(('0.0.0.0', self.port))
            self.tcp_server.listen(1)
            self.tcp_server.setblocking(False)
            self.serial_poll.register(self.tcp_server, uselect.POLLIN)
            print(f"[CommServer] ✅ Đang lắng nghe Wi-Fi TCP tại cổng {self.port}")
        except Exception as e:
            print("[CommServer Error] Khởi tạo TCP Server thất bại:", e)
            self.tcp_server = None

    def broadcast(self, msg_str):
        """Gửi thông điệp ra cả cổng USB Serial và Wi-Fi TCP Client (nếu đang kết nối)"""
        print(msg_str)
        if self.tcp_client:
            try:
                self.tcp_client.write((msg_str + "\n").encode('utf-8'))
            except Exception:
                try:
                    self.serial_poll.unregister(self.tcp_client)
                    self.tcp_client.close()
                except Exception:
                    pass
                self.tcp_client = None

    def poll_messages(self):
        """Kiểm tra và xử lý dữ liệu đến từ USB Serial và TCP Socket (non-blocking)"""
        try:
            events = self.serial_poll.poll(0)
            for item in events:
                fd = item[0]

                # 1. Nhận từ USB Serial
                if fd == sys.stdin:
                    try:
                        line = sys.stdin.readline()
                        if line and self.command_callback:
                            self.command_callback(line.strip())
                    except Exception:
                        pass

                # 2. Nhận kết nối TCP Client mới
                elif self.tcp_server and fd == self.tcp_server:
                    try:
                        cl, addr = self.tcp_server.accept()
                        cl.setblocking(False)
                        if self.tcp_client:
                            try:
                                self.serial_poll.unregister(self.tcp_client)
                                self.tcp_client.close()
                            except: pass
                        self.tcp_client = cl
                        self.serial_poll.register(self.tcp_client, uselect.POLLIN)
                        print(f"[CommServer] Client kết nối từ: {addr}")
                    except Exception as e:
                        print("[CommServer Error] Chấp nhận client lỗi:", e)

                # 3. Nhận dữ liệu lệnh từ TCP Client
                elif self.tcp_client and fd == self.tcp_client:
                    try:
                        chunk = self.tcp_client.recv(256)
                        if not chunk:
                            self.serial_poll.unregister(self.tcp_client)
                            self.tcp_client.close()
                            self.tcp_client = None
                            print("[CommServer] Client đã ngắt kết nối.")
                        else:
                            self.tcp_rx_buf += chunk.decode('utf-8', 'ignore')
                            while '\n' in self.tcp_rx_buf:
                                c_line, self.tcp_rx_buf = self.tcp_rx_buf.split('\n', 1)
                                if self.command_callback:
                                    self.command_callback(c_line.strip())
                    except Exception:
                        try:
                            self.serial_poll.unregister(self.tcp_client)
                            self.tcp_client.close()
                        except: pass
                        self.tcp_client = None
        except Exception:
            pass

    def check_network_and_beacon(self, now_ms):
        """Giám sát kết nối Wi-Fi Failsafe và phát sóng UDP Beacon"""
        # A. Kiểm tra trạng thái Wi-Fi
        if time.ticks_diff(now_ms, self.last_wifi_check_time) >= self.wifi_check_interval_ms:
            self.last_wifi_check_time = now_ms
            is_conn = self.wifi_mgr.is_connected()

            # Mất sóng Wi-Fi -> Bật chế độ khẩn cấp Failsafe
            if (not is_conn) and (not self.emergency_mode):
                self.emergency_mode = True
                if self.wifi_mgr.led:
                    self.wifi_mgr.led.value(1) # Sáng đèn cảnh báo
                print("\n[FAILSAFE] 🚨 PHÁT HIỆN MẤT / CHƯA KẾT NỐI WI-FI!")
                if self.emergency_callback:
                    self.emergency_callback(True)
                self.broadcast("EMERGENCY:" + ujson.dumps({
                    "event": "emergency",
                    "type": "wifi_lost",
                    "msg": "MẤT KẾT NỐI WI-FI: ĐÃ DỪNG MỌI HOẠT ĐỘNG, ĐANG TỰ ĐỘNG TÌM LẠI..."
                }))
                self.last_emergency_retry_time = 0

        # B. Tự động kết nối lại khi ở chế độ Failsafe
        if self.emergency_mode:
            if self.wifi_mgr.led:
                self.wifi_mgr.led.value(1)
            if time.ticks_diff(now_ms, self.last_emergency_retry_time) >= self.emergency_retry_interval_ms:
                self.last_emergency_retry_time = now_ms
                print("[FAILSAFE] 🔍 Đang quét và thử kết nối lại Wi-Fi...")
                if self.wifi_mgr.connect():
                    self.emergency_mode = False
                    print("[FAILSAFE RECOVERED] 🎉 ĐÃ KHÔI PHỤC WI-FI THÀNH CÔNG!")
                    if self.tcp_server is None:
                        self.start_tcp_server()
                    if self.emergency_callback:
                        self.emergency_callback(False)
                    self.broadcast("EMERGENCY_RESOLVED:" + ujson.dumps({
                        "event": "emergency_resolved",
                        "msg": "ĐÃ KẾT NỐI LẠI WI-FI THÀNH CÔNG!",
                        "wifi": {"connected": True, "ssid": self.wifi_mgr.get_ssid(), "ip": self.wifi_mgr.get_ip()}
                    }))
                    if self.wifi_mgr.led:
                        self.wifi_mgr.led.value(0)

        # C. Phát sóng UDP Beacon cho Server
        if self.wifi_mgr.is_connected() and time.ticks_diff(now_ms, self.last_beacon_time) >= self.beacon_interval_ms:
            self.last_beacon_time = now_ms
            try:
                b_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                b_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                b_msg = ("ROBOT_BEACON:" + self.wifi_mgr.get_ip() + f":{self.port}\n").encode('utf-8')
                b_sock.sendto(b_msg, ('255.255.255.255', 8889))
                b_sock.close()
            except Exception:
                pass
