# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG VÀ ĐIỀU KHIỂN CHÍNH TRÊN ESP32 (FIRMWARE)
# Kiến trúc: Dual-Channel Control (USB Serial & Wi-Fi TCP Socket Non-blocking)
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
from machine import Pin
import config
from modules.wifi_client import WiFiStationManager
from modules.ultrasonic import UltrasonicSensor
from modules.line_sensor import LineFollowerSensor
from modules.motor_driver import MotorDriver
from modules.robot_arm import RobotArm

def setup_serial_poll():
    """Khởi tạo cơ chế kiểm tra cổng Serial non-blocking bằng uselect.poll()"""
    poll = uselect.poll()
    poll.register(sys.stdin, uselect.POLLIN)
    return poll

def main():
    print("\n" + "=" * 55)
    print("[ESP32] KHOI DONG HE THONG DIEU KHIEN & CAM BIEN ROBOT")
    print("=" * 55)

    # 1. Khởi tạo đối tượng quản lý Wi-Fi với danh sách ưu tiên từ config.py
    wifi_mgr = WiFiStationManager(
        networks_config=config.WIFI_NETWORKS,
        timeout_sec=config.WIFI_CONNECT_TIMEOUT_SEC,
        led_pin=2 # Chân đèn LED xanh tích hợp trên ESP32
    )

    # 2. Thực hiện quét và tự động kết nối Wi-Fi ban đầu
    connected = wifi_mgr.connect()

    # 3. Khởi tạo Cảm biến siêu âm RCWL-1601 (OOP)
    print(f"[Cam bien] Khoi tao RCWL-1601: Trig=GPIO{config.PIN_ULTRASONIC_TRIG}, Echo=GPIO{config.PIN_ULTRASONIC_ECHO}")
    ultrasonic = UltrasonicSensor(
        trig_pin=config.PIN_ULTRASONIC_TRIG,
        echo_pin=config.PIN_ULTRASONIC_ECHO
    )

    # 4. Khởi tạo Cảm biến dò line quang học TCRT5000 (OOP)
    print(f"[Cam bien] Khoi tao TCRT5000: Left=GPIO{config.PIN_LINE_LEFT}, Right=GPIO{config.PIN_LINE_RIGHT}")
    line_sensor = LineFollowerSensor(
        left_pin=config.PIN_LINE_LEFT,
        right_pin=config.PIN_LINE_RIGHT
    )

    # 4.5 Khởi tạo Module Động cơ TB6612FNG (OOP)
    print(f"[Dong co] Khoi tao TB6612FNG: A=(GPIO{config.PIN_MOTOR_AIN1}, GPIO{config.PIN_MOTOR_AIN2}), B=(GPIO{config.PIN_MOTOR_BIN1}, GPIO{config.PIN_MOTOR_BIN2})")
    motor = MotorDriver(
        pin_ain1=config.PIN_MOTOR_AIN1,
        pin_ain2=config.PIN_MOTOR_AIN2,
        pin_bin1=config.PIN_MOTOR_BIN1,
        pin_bin2=config.PIN_MOTOR_BIN2,
        freq=config.MOTOR_PWM_FREQ
    )

    # 4.6 Khởi tạo Cánh tay Robot 4 Bậc (4-DOF Arm & Servo)
    try:
        arm = RobotArm()
        print("[Canh tay] Khoi tao thanh cong 4 Servo Canh tay Robot")
    except Exception as e:
        arm = None
        print("[Canh tay] Khong the khoi tao Servo:", e)

    # 5. Khởi tạo trình lắng nghe I/O Non-blocking (Serial + Wi-Fi Sockets)
    serial_poll = setup_serial_poll()

    # 5.5 Quản lý Wi-Fi TCP Socket Server & Client
    tcp_server = None
    tcp_client = None
    tcp_rx_buf = ""
    last_beacon_time = 0
    beacon_interval_ms = 3500

    def start_tcp_server():
        nonlocal tcp_server
        try:
            if tcp_server:
                try: serial_poll.unregister(tcp_server)
                except: pass
                try: tcp_server.close()
                except: pass
            tcp_server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            tcp_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            tcp_server.bind(('0.0.0.0', 8888))
            tcp_server.listen(1)
            tcp_server.setblocking(False)
            serial_poll.register(tcp_server, uselect.POLLIN)
            print("[TCP Server] ✅ Đang lắng nghe điều khiển qua Wi-Fi tại cổng 8888")
        except Exception as e:
            print("[TCP Server Error]", e)
            tcp_server = None

    if connected:
        start_tcp_server()

    def broadcast_msg(msg):
        """Phát sóng gói tin telemetry/status ra cả cổng USB Serial và Wi-Fi TCP"""
        nonlocal tcp_client
        print(msg)
        if tcp_client:
            try:
                tcp_client.write((msg + "\n").encode('utf-8'))
            except Exception:
                try:
                    serial_poll.unregister(tcp_client)
                    tcp_client.close()
                except Exception:
                    pass
                tcp_client = None

    # Trạng thái điều khiển cảm biến & Mạng
    has_connected_once = connected  # Ghi nhận cờ đã từng có kết nối Wi-Fi khi cắm nguồn
    emergency_mode = False          # Chế độ Khẩn cấp (Failsafe) khi mất Wi-Fi
    stream_mode = False             # Chế độ đo liên tục siêu âm
    tcrt_stream_mode = False        # Chế độ stream cảm biến dò line TCRT5000 (Mặc định nghỉ)
    last_measure_time = 0
    measure_interval_ms = 200       # Chu kỳ đo liên tục siêu âm: 200ms
    last_tcrt_time = 0
    tcrt_interval_ms = 80           # Chu kỳ stream TCRT5000: 80ms (12.5Hz - Cực nhạy)
    last_wifi_check_time = time.ticks_ms()
    wifi_check_interval_ms = 1500   # Kiểm tra cờ trạng thái Wi-Fi nhanh (tốn < 1us)
    last_emergency_retry_time = 0
    emergency_retry_interval_ms = 3000 # Giãn cách 3s giữa các lần quét lại khi gặp sự cố

    print("[ESP32] Sẵn sàng nhận lệnh qua USB Serial & Wi-Fi Socket (Port 8888)...")
    print("-" * 55)

    # Gửi gói telemetry khởi đầu thông báo hệ thống sẵn sàng
    initial_telem = {
        "event": "telemetry",
        "wifi": {
            "connected": connected,
            "ssid": wifi_mgr.get_ssid() if connected else "—",
            "ip": wifi_mgr.get_ip() if connected else "—"
        },
        "sensor": {
            "distance_cm": -1.0,
            "obstacle_detected": False
        },
        "tcrt5000": line_sensor.read_status(),
        "mode": "standby"
    }
    broadcast_msg("TELEMETRY:" + ujson.dumps(initial_telem))

    def process_command(cmd):
        nonlocal emergency_mode, stream_mode, tcrt_stream_mode
        cmd = cmd.strip()
        if not cmd:
            return

        if "CMD:MEASURE_ONCE" in cmd:
            if emergency_mode:
                print("[LỆNH BỊ TỪ CHỐI] Xe đang trong Chế độ Khẩn cấp do mất Wi-Fi!")
            else:
                d = ultrasonic.measure_distance()
                is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)
                telem = {
                    "event": "telemetry",
                    "wifi": {
                        "connected": wifi_mgr.is_connected(),
                        "ssid": wifi_mgr.get_ssid() if wifi_mgr.is_connected() else "—",
                        "ip": wifi_mgr.get_ip() if wifi_mgr.is_connected() else "—"
                    },
                    "sensor": {
                        "distance_cm": d,
                        "obstacle_detected": is_obstacle
                    },
                    "tcrt5000": line_sensor.read_status(),
                    "mode": "once"
                }
                broadcast_msg("TELEMETRY:" + ujson.dumps(telem))
                if wifi_mgr.led:
                    wifi_mgr.led.value(0)

        elif "CMD:START_STREAM" in cmd:
            if emergency_mode:
                print("[LỆNH BỊ TỪ CHỐI] Không thể bật đo liên tục khi đang mất Wi-Fi!")
            else:
                stream_mode = True
                broadcast_msg("[CMD_ACK] START_STREAM: Bat che do do lien tuc")
                if wifi_mgr.led:
                    wifi_mgr.led.value(0)

        elif "CMD:STOP_STREAM" in cmd:
            stream_mode = False
            broadcast_msg("[CMD_ACK] STOP_STREAM: Dua ve Standby")
            if wifi_mgr.led and not emergency_mode:
                wifi_mgr.led.value(0)

        elif "CMD:START_TCRT_STREAM" in cmd:
            tcrt_stream_mode = True
            broadcast_msg("[CMD_ACK] START_TCRT_STREAM: Bat luong doc TCRT5000")

        elif "CMD:STOP_TCRT_STREAM" in cmd:
            tcrt_stream_mode = False
            broadcast_msg("[CMD_ACK] STOP_TCRT_STREAM: Dung luong doc TCRT5000")

        elif "CMD:GET_WIFI_STATUS" in cmd:
            is_conn = wifi_mgr.is_connected()
            wifi_resp = {
                "event": "wifi_status",
                "connected": is_conn,
                "ssid": wifi_mgr.get_ssid() if is_conn else "—",
                "ip": wifi_mgr.get_ip() if is_conn else "—",
                "emergency_mode": emergency_mode,
                "security": "WPA2-PSK"
            }
            broadcast_msg("WIFI_STATUS:" + ujson.dumps(wifi_resp))

        elif "CMD:SPEED:" in cmd:
            try:
                val_str = cmd.split("CMD:SPEED:")[1].strip()
                if "," in val_str:
                    parts = val_str.split(",")
                    s_main = int(parts[0])
                    s_l = int(parts[1]) if len(parts) > 1 else s_main
                    s_r = int(parts[2]) if len(parts) > 2 else s_main
                    motor.set_differential(s_l, s_r)
                else:
                    s = int(val_str)
                    motor.set_speed(s)
            except Exception as e:
                print("[Loi CMD:SPEED]", e)

        elif "CMD:MOTOR_STOP" in cmd:
            motor.stop()

        elif "CMD:SERVO:" in cmd:
            try:
                parts = cmd.split("CMD:SERVO:")[1].strip().split(":")
                joint = parts[0].strip()
                angle = int(parts[1])
                speed = int(parts[2]) if len(parts) > 2 else 20
                print(f"[ESP32] Servo {joint} -> {angle} deg (delay {speed}ms)")
                if arm:
                    arm.move_joint(joint, angle, speed)
            except Exception as e:
                print("[Loi CMD:SERVO]", e)

        elif "CMD:ARM_STOP" in cmd:
            print("[ESP32] Dung khan cap Canh tay")
            if arm:
                arm.stop()

        elif "CMD:ARM_PRESET:" in cmd:
            try:
                preset = cmd.split("CMD:ARM_PRESET:")[1].strip()
                print(f"[ESP32] Tu the canh tay: {preset}")
                if arm:
                    arm.apply_preset(preset)
            except Exception as e:
                print("[Loi CMD:ARM_PRESET]", e)

    while True:
        try:
            now = time.ticks_ms()

            # --- A. LẮNG NGHE LỆNH TỪ SERIAL VÀ WI-FI TCP SOCKET (NON-BLOCKING) ---
            events = serial_poll.poll(0)
            for item in events:
                fd = item[0]
                if fd == sys.stdin:
                    try:
                        s_cmd = sys.stdin.readline()
                        if s_cmd:
                            process_command(s_cmd)
                    except Exception:
                        pass
                elif tcp_server and fd == tcp_server:
                    try:
                        cl, addr = tcp_server.accept()
                        cl.setblocking(False)
                        if tcp_client:
                            try:
                                serial_poll.unregister(tcp_client)
                                tcp_client.close()
                            except: pass
                        tcp_client = cl
                        serial_poll.register(tcp_client, uselect.POLLIN)
                        print(f"[TCP Client] Đã kết nối từ: {addr}")
                        # Gửi gói telemetry tức thì
                        init_pkt = {
                            "event": "telemetry",
                            "wifi": {
                                "connected": wifi_mgr.is_connected(),
                                "ssid": wifi_mgr.get_ssid(),
                                "ip": wifi_mgr.get_ip()
                            },
                            "sensor": {"distance_cm": -1.0, "obstacle_detected": False},
                            "tcrt5000": line_sensor.read_status(),
                            "mode": "standby"
                        }
                        broadcast_msg("TELEMETRY:" + ujson.dumps(init_pkt))
                    except Exception as e:
                        print("[TCP Accept Error]", e)
                elif tcp_client and fd == tcp_client:
                    try:
                        chunk = tcp_client.recv(256)
                        if not chunk:
                            serial_poll.unregister(tcp_client)
                            tcp_client.close()
                            tcp_client = None
                            print("[TCP Client] Ngắt kết nối.")
                        else:
                            tcp_rx_buf += chunk.decode('utf-8', 'ignore')
                            while '\n' in tcp_rx_buf:
                                c_line, tcp_rx_buf = tcp_rx_buf.split('\n', 1)
                                process_command(c_line)
                    except Exception:
                        try:
                            serial_poll.unregister(tcp_client)
                            tcp_client.close()
                        except: pass
                        tcp_client = None

            # --- B. GIÁM SÁT KẾT NỐI WI-FI & KÍCH HOẠT CHẾ ĐỘ KHẨN CẤP (FAILSAFE) ---
            if time.ticks_diff(now, last_wifi_check_time) >= wifi_check_interval_ms:
                last_wifi_check_time = now
                is_conn = wifi_mgr.is_connected()

                # Nếu trước đó đã kết nối Wi-Fi thành công nhưng nay bị ngắt sóng:
                if has_connected_once and (not is_conn) and (not emergency_mode):
                    emergency_mode = True
                    stream_mode = False # DỪNG TOÀN BỘ HOẠT ĐỘNG KHÁC NGAY LẬP TỨC
                    motor.stop()        # Dừng động cơ ngay khi mất kết nối để an toàn
                    if wifi_mgr.led:
                        wifi_mgr.led.value(1) # SÁNG ĐÈN khi đang ở chế độ khẩn cấp dò Wi-Fi mới
                    print("\n" + "!" * 55)
                    print("[FAILSAFE] 🚨 PHÁT HIỆN MẤT KẾT NỐI WI-FI!")
                    print("[FAILSAFE] 🛑 ĐÃ DỪNG TOÀN BỘ HOẠT ĐỘNG! BẬT CHẾ ĐỘ TỰ ĐỘNG TÌM KIẾM WI-FI...")
                    print("!" * 55 + "\n")

                    em_msg = {
                        "event": "emergency",
                        "type": "wifi_lost",
                        "msg": "MẤT KẾT NỐI WI-FI: ĐÃ DỪNG MỌI HOẠT ĐỘNG, ĐANG TỰ ĐỘNG TÌM KIẾM..."
                    }
                    broadcast_msg("EMERGENCY:" + ujson.dumps(em_msg))
                    last_emergency_retry_time = 0

            # --- C. XỬ LÝ KHI ĐANG TRONG CHẾ ĐỘ KHẨN CẤP (TỰ ĐỘNG TÌM LẠI WI-FI) ---
            if emergency_mode:
                if wifi_mgr.led:
                    wifi_mgr.led.value(1)

                if time.ticks_diff(now, last_emergency_retry_time) >= emergency_retry_interval_ms:
                    last_emergency_retry_time = now
                    print("[FAILSAFE] 🔍 Đang quét và thử kết nối lại Wi-Fi...")
                    reconnected = wifi_mgr.connect()

                    if reconnected:
                        emergency_mode = False
                        has_connected_once = True
                        print("\n" + "=" * 55)
                        print("[FAILSAFE RECOVERED] 🎉 ĐÃ KHÔI PHỤC KẾT NỐI WI-FI THÀNH CÔNG!")
                        print("[FAILSAFE RECOVERED] 🟢 THOÁT CHẾ ĐỘ KHẨN CẤP. HỆ THỐNG TRỞ VỀ STANDBY.")
                        print("=" * 55 + "\n")

                        resolved_msg = {
                            "event": "emergency_resolved",
                            "msg": "ĐÃ KẾT NỐI LẠI WI-FI THÀNH CÔNG! HỆ THỐNG TRỞ LẠI BÌNH THƯỜNG.",
                            "wifi": {
                                "connected": True,
                                "ssid": wifi_mgr.get_ssid(),
                                "ip": wifi_mgr.get_ip()
                            }
                        }
                        broadcast_msg("EMERGENCY_RESOLVED:" + ujson.dumps(resolved_msg))

                        # Khởi động lại TCP Server nếu bị mất
                        if tcp_server is None:
                            start_tcp_server()

                        wifi_resp = {
                            "event": "wifi_status",
                            "connected": True,
                            "ssid": wifi_mgr.get_ssid(),
                            "ip": wifi_mgr.get_ip(),
                            "emergency_mode": False,
                            "security": "WPA2-PSK"
                        }
                        broadcast_msg("WIFI_STATUS:" + ujson.dumps(wifi_resp))

                        if wifi_mgr.led:
                            wifi_mgr.led.value(0)

            # --- D. CHẾ ĐỘ ĐO SIÊU ÂM LIÊN TỤC ---
            if stream_mode and not emergency_mode:
                if time.ticks_diff(now, last_measure_time) >= measure_interval_ms:
                    last_measure_time = now
                    d = ultrasonic.measure_distance()
                    is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

                    telem = {
                        "event": "telemetry",
                        "sensor": {
                            "distance_cm": d,
                            "obstacle_detected": is_obstacle
                        },
                        "tcrt5000": line_sensor.read_status(),
                        "mode": "streaming"
                    }
                    broadcast_msg("TELEMETRY:" + ujson.dumps(telem))

            # --- E. CHẾ ĐỘ STREAM CẢM BIẾN DÒ LINE TCRT5000 ---
            if tcrt_stream_mode and not emergency_mode:
                if time.ticks_diff(now, last_tcrt_time) >= tcrt_interval_ms:
                    last_tcrt_time = now
                    telem = {
                        "event": "telemetry",
                        "tcrt5000": line_sensor.read_status(),
                        "mode": "tcrt_streaming"
                    }
                    broadcast_msg("TELEMETRY:" + ujson.dumps(telem))

            # --- F. GỬI UDP BEACON ĐỊNH KỲ ĐỂ PYTHON SERVER TỰ ĐỘNG PHÁT HIỆN IP ---
            if wifi_mgr.is_connected() and time.ticks_diff(now, last_beacon_time) >= beacon_interval_ms:
                last_beacon_time = now
                try:
                    b_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    b_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
                    b_msg = ("ROBOT_BEACON:" + wifi_mgr.get_ip() + ":8888\n").encode('utf-8')
                    b_sock.sendto(b_msg, ('255.255.255.255', 8889))
                    b_sock.close()
                except Exception:
                    pass

        except Exception as e:
            print("[Lỗi vòng lặp]", e)

        time.sleep_ms(25)

if __name__ == "__main__":
    main()
