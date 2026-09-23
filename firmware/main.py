# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG VÀ ĐIỀU KHIỂN CHÍNH TRÊN ESP32 (FIRMWARE)
# Kiến trúc: Kích hoạt theo yêu cầu (On-Demand) & Non-blocking Serial Listener
# ==============================================================================

import sys
import time
import ujson
try:
    import uselect
except ImportError:
    import select as uselect
from machine import Pin
import config
from modules.wifi_client import WiFiStationManager
from modules.ultrasonic import UltrasonicSensor

def setup_serial_poll():
    """Khởi tạo cơ chế kiểm tra cổng Serial non-blocking bằng uselect.poll()"""
    poll = uselect.poll()
    poll.register(sys.stdin, uselect.POLLIN)
    return poll

def read_serial_command(poll):
    """Đọc lệnh từ Serial nếu có, không chặn luồng chính (Non-blocking)"""
    if poll.poll(0):
        try:
            line = sys.stdin.readline()
            if line:
                return line.strip()
        except Exception:
            pass
    return None

def main():
    print("\n" + "=" * 55)
    print("[ESP32] KHOI DONG HE THONG DIEU KHIEN & CAM BIEN RCWL-1601")
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

    # 4. Khởi tạo trình lắng nghe Serial Non-blocking
    serial_poll = setup_serial_poll()

    # Trạng thái điều khiển cảm biến
    stream_mode = False          # Mặc định: Chế độ nghỉ (Standby) để tiết kiệm pin & CPU
    last_measure_time = 0
    measure_interval_ms = 400    # Chu kỳ đo liên tục: 400ms (2.5 lần/giây)
    last_wifi_check_time = time.ticks_ms()
    wifi_check_interval_ms = 5000 # Kiểm tra wifi mỗi 5 giây

    print("[ESP32] Cam bien o che do NGHỈ (STANDBY). San sang nhan lenh dieu khien...")
    print("-" * 55)

    # Gửi gói telemetry khởi đầu thông báo hệ thống sẵn sàng
    initial_telem = {
        "event": "telemetry",
        "wifi": {
            "connected": connected,
            "ssid": "Sune" if connected else "—",
            "ip": wifi_mgr.get_ip() if connected else "—"
        },
        "sensor": {
            "distance_cm": -1.0,
            "obstacle_detected": False
        },
        "mode": "standby"
    }
    print("TELEMETRY:" + ujson.dumps(initial_telem))

    while True:
        try:
            now = time.ticks_ms()

            # --- A. LẮNG NGHE LỆNH TỪ SERIAL (NON-BLOCKING) ---
            cmd = read_serial_command(serial_poll)
            if cmd:
                if "CMD:MEASURE_ONCE" in cmd:
                    # Đo đúng 1 lần theo yêu cầu On-Demand
                    d = ultrasonic.measure_distance()
                    is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

                    if d < 0:
                        dist_str = "--.- cm (Ngoai tam do)"
                        status_str = "[OK] DUONG TRONG"
                    elif is_obstacle:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = f"[CANH BAO] CO VAT CAN (<{config.OBSTACLE_DISTANCE_THRESHOLD_CM}cm)!"
                    else:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = "[OK] AN TOAN"

                    print(f"[DO 1 LAN]: {dist_str} | {status_str}")

                    telem = {
                        "event": "telemetry",
                        "wifi": {
                            "connected": wifi_mgr.is_connected(),
                            "ssid": "Sune" if wifi_mgr.is_connected() else "—",
                            "ip": wifi_mgr.get_ip() if wifi_mgr.is_connected() else "—"
                        },
                        "sensor": {
                            "distance_cm": d,
                            "obstacle_detected": is_obstacle
                        },
                        "mode": "once"
                    }
                    print("TELEMETRY:" + ujson.dumps(telem))

                    # Nháy LED nhanh xác nhận
                    if wifi_mgr.led:
                        wifi_mgr.led.value(not wifi_mgr.led.value())
                        time.sleep_ms(60)
                        wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

                elif "CMD:START_STREAM" in cmd:
                    stream_mode = True
                    print("[CMD_ACK] START_STREAM: Bat che do do lien tuc")

                elif "CMD:STOP_STREAM" in cmd:
                    stream_mode = False
                    print("[CMD_ACK] STOP_STREAM: Dua cam bien ve che do Nghi (Standby)")
                    if wifi_mgr.led:
                        wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

            # --- B. CHẾ ĐỘ ĐO LIÊN TỤC (KHI STREAM_MODE ĐƯỢC BẬT) ---
            if stream_mode:
                if time.ticks_diff(now, last_measure_time) >= measure_interval_ms:
                    last_measure_time = now
                    d = ultrasonic.measure_distance()
                    is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

                    if d < 0:
                        dist_str = "--.- cm (Ngoai tam do)"
                        status_str = "[OK] DUONG TRONG"
                    elif is_obstacle:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = f"[CANH BAO] CO VAT CAN (<{config.OBSTACLE_DISTANCE_THRESHOLD_CM}cm)!"
                    else:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = "[OK] AN TOAN"

                    print(f"[STREAM]: {dist_str} | {status_str}")

                    # Điều khiển LED cảnh báo
                    if wifi_mgr.led:
                        if is_obstacle:
                            wifi_mgr.led.value(not wifi_mgr.led.value()) # Nhấp nháy cảnh báo
                        else:
                            wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

                    telem = {
                        "event": "telemetry",
                        "wifi": {
                            "connected": wifi_mgr.is_connected(),
                            "ssid": "Sune" if wifi_mgr.is_connected() else "—",
                            "ip": wifi_mgr.get_ip() if wifi_mgr.is_connected() else "—"
                        },
                        "sensor": {
                            "distance_cm": d,
                            "obstacle_detected": is_obstacle
                        },
                        "mode": "streaming"
                    }
                    print("TELEMETRY:" + ujson.dumps(telem))

            # --- C. GIÁM SÁT ĐỊNH KỲ ĐƯỜNG TRUYỀN WI-FI ---
            if time.ticks_diff(now, last_wifi_check_time) >= wifi_check_interval_ms:
                last_wifi_check_time = now
                curr_connected = wifi_mgr.is_connected()
                if not curr_connected:
                    print("[Wi-Fi] Phat hien mat ket noi, dang thu ket noi lai...")
                    wifi_mgr.connect()
                elif not stream_mode and wifi_mgr.led:
                    wifi_mgr.led.value(1)

        except Exception as e:
            print("[Lỗi vòng lặp]", e)

        time.sleep_ms(30) # Nhường CPU 30ms

if __name__ == "__main__":
    main()
