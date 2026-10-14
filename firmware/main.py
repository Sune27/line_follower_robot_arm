# ==============================================================================
# MAIN.PY – BỘ ĐIỀU PHỐI TRUNG TÂM HỆ THỐNG ROBOT DÒ LINE (ORCHESTRATOR)
# ==============================================================================
# Thiết kế chuẩn kiến trúc nhúng hướng đối tượng (OOP Multi-Rate Scheduler):
#   - Khởi tạo các module phần cứng: WiFi, Cảm biến siêu âm, TCRT5000, Motor TB6612.
#   - Khởi tạo Bộ não dò line (LineTracker) và Hạ tầng truyền thông (RobotCommServer).
#   - Ủy quyền toàn bộ xử lý lệnh cho Người điều phối (CommandDispatcher).
#   - Vòng lặp chính lập lịch đa nhịp (15ms dò line, 100ms telemetry, 200ms siêu âm).
# ==============================================================================

import time
import ujson
import config
from modules.wifi_client import WiFiStationManager
from modules.ultrasonic import UltrasonicSensor
from modules.line_sensor import LineFollowerSensor
from modules.motor_driver import MotorDriver
from modules.line_tracker import LineTracker
from modules.comm_server import RobotCommServer
from modules.command_dispatcher import CommandDispatcher

def main():
    print("\n" + "=" * 55)
    print("[ESP32] KHOI DONG HE THONG DIEU KHIEN & CAM BIEN ROBOT")
    print("=" * 55)

    # Đợi 800ms để điện áp từ nguồn pin ổn định trước khi bật sóng Wi-Fi
    time.sleep_ms(800)

    # 1. Khởi tạo Module Quản lý Wi-Fi
    wifi_mgr = WiFiStationManager(
        networks_config=config.WIFI_NETWORKS,
        timeout_sec=config.WIFI_CONNECT_TIMEOUT_SEC,
        led_pin=2
    )
    wifi_mgr.connect()

    # 2. Khởi tạo Cảm biến siêu âm RCWL-1601 (GPIO5, GPIO18)
    ultrasonic = UltrasonicSensor(
        trig_pin=config.PIN_ULTRASONIC_TRIG,
        echo_pin=config.PIN_ULTRASONIC_ECHO
    )

    # 3. Khởi tạo Cảm biến dò line TCRT5000 5 mắt (D21, D19, D18, D5, D17)
    line_sensor = LineFollowerSensor(
        s1_pin=config.PIN_LINE_S1,
        s2_pin=config.PIN_LINE_S2,
        s3_pin=config.PIN_LINE_S3,
        s4_pin=config.PIN_LINE_S4,
        s5_pin=config.PIN_LINE_S5
    )

    # 4. Khởi tạo Động cơ TB6612FNG (GPIO13, 12, 27, 26)
    motor = MotorDriver(
        pin_ain1=config.PIN_MOTOR_AIN1,
        pin_ain2=config.PIN_MOTOR_AIN2,
        pin_bin1=config.PIN_MOTOR_BIN1,
        pin_bin2=config.PIN_MOTOR_BIN2,
        freq=config.MOTOR_PWM_FREQ
    )

    # 5. Khởi tạo Bộ điều khiển Dò Line PD 5 kênh (Mặc định Standby - chờ lệnh Web)
    line_tracker = LineTracker(
        motor_driver=motor,
        base_speed=config.LINE_BASE_SPEED,
        kp=config.PID_KP,
        ki=config.PID_KI,
        kd=config.PID_KD,
        startup_duration_ms=config.LINE_STARTUP_DURATION_MS,
        startup_speed=config.LINE_STARTUP_SPEED,
        lost_line_timeout_ms=config.LINE_LOST_TIMEOUT_MS
    )

    # 6. Khởi tạo Server Truyền thông & Failsafe (Port 8888)
    comm = RobotCommServer(wifi_mgr=wifi_mgr, port=8888)

    # 7. Khởi tạo Người điều phối lệnh (Command Dispatcher)
    dispatcher = CommandDispatcher(
        tracker=line_tracker,
        motor=motor,
        ultrasonic=ultrasonic,
        line_sensor=line_sensor,
        comm=comm,
        wifi_mgr=wifi_mgr
    )

    # Đăng ký Người điều phối nhận lệnh và xử lý sự cố mạng
    def handle_emergency(is_err):
        if is_err:
            # Chỉ dừng động cơ khi người dùng đang lái tay thủ công (tránh trôi xe)
            # Tuyệt đối không hủy chế độ dò line tự động vì thuật toán dò line chạy Onboard độc lập
            if not line_tracker.is_active:
                motor.stop()

    comm.set_command_callback(dispatcher.dispatch)
    comm.set_emergency_callback(handle_emergency)

    # Gửi telemetry khởi đầu báo hệ thống đã sẵn sàng
    comm.broadcast("TELEMETRY:" + ujson.dumps({
        "event": "telemetry",
        "wifi": {"connected": wifi_mgr.is_connected(), "ssid": wifi_mgr.get_ssid(), "ip": wifi_mgr.get_ip()},
        "sensor": {"distance_cm": -1.0, "obstacle_detected": False},
        "tcrt5000": line_sensor.read_status(),
        "motor": {"speed_left": 0, "speed_right": 0, "is_running": False},
        "auto_line": False,
        "mode": "standby"
    }))

    # Bộ đếm thời gian cho các nhịp thực thi độc lập (Tick Scheduling)
    last_line_time = 0
    last_telemetry_time = 0

    LINE_INTERVAL_MS = 15        # Nhịp 1: Điều khiển dò line PID cực nhanh (15ms ~ 66Hz)
    TELEMETRY_INTERVAL_MS = 100   # Nhịp 2: Đẩy telemetry lên Web vừa phải (100ms ~ 10Hz)

    print("[ESP32] ✅ HỆ THỐNG SẴN SÀNG VẬN HÀNH!")

    # ==========================================================================
    # VÒNG LẶP CHÍNH – ĐIỀU PHỐI ĐA NHỊP (NON-BLOCKING MULTI-RATE SCHEDULER)
    # ==========================================================================
    while True:
        try:
            now = time.ticks_ms()

            # --- TÁC VỤ A: LẮNG NGHE LỆNH TRUYỀN THÔNG (Serial & Wi-Fi TCP Socket) ---
            comm.poll_messages()

            # --- TÁC VỤ B: NHỊP 1 - ĐIỀU KHIỂN DÒ LINE PID 5 KÊNH (15ms - ƯU TIÊN CAO NHẤT) ---
            # Thuật toán PID chạy Onboard độc lập khi được bật từ Web Dashboard
            if line_tracker.is_active:
                if time.ticks_diff(now, last_line_time) >= LINE_INTERVAL_MS:
                    last_line_time = now
                    raw_sensors = line_sensor.read_all_raw()
                    line_tracker.update(raw_sensors, now)

            # --- TÁC VỤ C: NHỊP 2 - GỬI TELEMETRY ĐỊNH KỲ (100ms) ---
            if dispatcher.stream_tcrt or line_tracker.is_active:
                if time.ticks_diff(now, last_telemetry_time) >= TELEMETRY_INTERVAL_MS:
                    last_telemetry_time = now
                    comm.broadcast("TELEMETRY:" + ujson.dumps({
                        "event": "telemetry",
                        "wifi": {
                            "connected": wifi_mgr.is_connected(),
                            "ssid": wifi_mgr.get_ssid(),
                            "ip": wifi_mgr.get_ip()
                        },
                        "tcrt5000": line_sensor.read_status(),
                        "motor": {
                            "speed_left": motor.current_speed_left,
                            "speed_right": motor.current_speed_right,
                            "is_running": (motor.current_speed_left != 0 or motor.current_speed_right != 0)
                        },
                        "pid": {
                            "error": line_tracker.current_error,
                            "output": round(line_tracker.pid_output, 2),
                            "action": line_tracker.last_action
                        },
                        "auto_line": line_tracker.is_active,
                        "mode": "tcrt_streaming"
                    }))

            # (Tác vụ D - Quét siêu âm 200ms đã được gỡ bỏ để tránh xung chờ time_pulse_us 30ms
            #  làm trễ nhịp 15ms của bộ điều khiển PID TCRT5000 + TB6612FNG)

            # --- TÁC VỤ E: GIÁM SÁT KẾT NỐI WI-FI VÀ GỬI UDP BEACON ---
            comm.check_network_and_beacon(now)

        except Exception as e:
            print("[Lỗi vòng lặp chính]", e)

        time.sleep_ms(5)

if __name__ == "__main__":
    main()
