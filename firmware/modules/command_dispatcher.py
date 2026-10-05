# ==============================================================================
# COMMAND_DISPATCHER.PY – MODULE PHÂN PHỐI & THỰC THI LỆNH ĐIỀU KHIỂN (OOP)
# ==============================================================================
# Đóng vai trò là "Người điều phối / Thư ký điều hành" (Command Dispatcher):
# - Nhận chuỗi lệnh thô từ RobotCommServer (qua USB Serial hoặc Wi-Fi TCP Socket).
# - Phân tích cú pháp lệnh (Command Parser).
# - Gọi các phương thức tương ứng của các module: LineTracker, MotorDriver,
#   UltrasonicSensor, LineFollowerSensor, WiFiStationManager.
# - Gửi thông điệp phản hồi (ACK) và Telemetry tức thì thông qua CommServer.
# ==============================================================================

import ujson
import config

class CommandDispatcher:
    def __init__(self, tracker, motor, ultrasonic, line_sensor, comm, wifi_mgr):
        """
        Khởi tạo Người điều phối với quyền truy cập vào các module chức năng của xe.
        """
        self.tracker = tracker
        self.motor = motor
        self.ultrasonic = ultrasonic
        self.line_sensor = line_sensor
        self.comm = comm
        self.wifi_mgr = wifi_mgr

        # Trạng thái stream dữ liệu liên tục
        self.stream_ultrasonic = False
        self.stream_tcrt = False

    def dispatch(self, cmd):
        """
        Phân tích và thực thi lệnh nhận được từ bên ngoài.
        :param cmd: Chuỗi lệnh (ví dụ: "CMD:START_AUTO_LINE:35", "CMD:MOTOR_STOP")
        """
        cmd = cmd.strip()
        if not cmd:
            return

        # 1. LỆNH BẮT ĐẦU DÒ LINE TỰ ĐỘNG
        if "CMD:START_AUTO_LINE" in cmd:
            speed = 35
            try:
                parts = cmd.split(":")
                if len(parts) >= 3 and parts[2].isdigit():
                    speed = int(parts[2])
            except Exception:
                pass

            self.tracker.start(speed)
            self.stream_tcrt = True
            self.comm.broadcast(f"[CMD_ACK] START_AUTO_LINE: Tốc độ {self.tracker.base_speed}%")

        # 2. LỆNH DỪNG DÒ LINE
        elif "CMD:STOP_AUTO_LINE" in cmd:
            self.tracker.stop()
            self.comm.broadcast("[CMD_ACK] STOP_AUTO_LINE: Đã dừng xe")
            # Gửi ngay gói telemetry báo dừng
            self.comm.broadcast("TELEMETRY:" + ujson.dumps({
                "event": "telemetry",
                "tcrt5000": self.line_sensor.read_status(),
                "motor": {"speed_left": 0, "speed_right": 0, "is_running": False},
                "auto_line": False
            }))

        # 3. LỆNH ĐO SIÊU ÂM MỘT LẦN
        elif "CMD:MEASURE_ONCE" in cmd:
            if not self.comm.emergency_mode:
                d = self.ultrasonic.measure_distance()
                is_obs = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)
                self.comm.broadcast("TELEMETRY:" + ujson.dumps({
                    "event": "telemetry",
                    "wifi": {
                        "connected": self.wifi_mgr.is_connected(),
                        "ssid": self.wifi_mgr.get_ssid(),
                        "ip": self.wifi_mgr.get_ip()
                    },
                    "sensor": {"distance_cm": d, "obstacle_detected": is_obs},
                    "tcrt5000": self.line_sensor.read_status(),
                    "auto_line": self.tracker.is_active,
                    "mode": "once"
                }))

        # 4. LỆNH BẬT / TẮT ĐO SIÊU ÂM LIÊN TỤC
        elif "CMD:START_STREAM" in cmd:
            self.stream_ultrasonic = True
            self.comm.broadcast("[CMD_ACK] START_STREAM: Bat do lien tuc")

        elif "CMD:STOP_STREAM" in cmd:
            self.stream_ultrasonic = False
            self.comm.broadcast("[CMD_ACK] STOP_STREAM: Dung do lien tuc")

        # 5. LỆNH BẬT / TẮT STREAM CẢM BIẾN DÒ LINE TCRT5000
        elif "CMD:START_TCRT_STREAM" in cmd:
            self.stream_tcrt = True
            self.comm.broadcast("[CMD_ACK] START_TCRT_STREAM: Bat stream TCRT5000")

        elif "CMD:STOP_TCRT_STREAM" in cmd:
            self.stream_tcrt = False
            self.comm.broadcast("[CMD_ACK] STOP_TCRT_STREAM: Dung stream TCRT5000")

        # 6. LỆNH LẤY TRẠNG THÁI WI-FI
        elif "CMD:GET_WIFI_STATUS" in cmd:
            is_c = self.wifi_mgr.is_connected()
            self.comm.broadcast("WIFI_STATUS:" + ujson.dumps({
                "event": "wifi_status",
                "connected": is_c,
                "ssid": self.wifi_mgr.get_ssid() if is_c else "—",
                "ip": self.wifi_mgr.get_ip() if is_c else "—",
                "emergency_mode": self.comm.emergency_mode,
                "security": "WPA2-PSK"
            }))

        # 7. LỆNH CHỈNH TỐC ĐỘ THỦ CÔNG (TỪ WEB JOYSTICK HOẶC CẦN GẠT)
        elif "CMD:SPEED:" in cmd:
            try:
                self.tracker.stop() # Hủy tự hành nếu người dùng can thiệp thủ công
                val_str = cmd.split("CMD:SPEED:")[1].strip()
                if "," in val_str:
                    parts = val_str.split(",")
                    s_m = int(parts[0])
                    s_l = int(parts[1]) if len(parts) > 1 else s_m
                    s_r = int(parts[2]) if len(parts) > 2 else s_m
                    self.motor.set_differential(s_l, s_r)
                else:
                    self.motor.set_speed(int(val_str))
            except Exception as e:
                print("[Loi CMD:SPEED]", e)

        # 8. LỆNH DỪNG ĐỘNG CƠ / E-STOP
        elif "CMD:MOTOR_STOP" in cmd:
            self.tracker.stop()
            self.motor.stop()
