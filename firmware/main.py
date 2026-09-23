# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG VÀ ĐIỀU KHIỂN CHÍNH TRÊN ESP32 (FIRMWARE)
# ==============================================================================

import time
import ujson
from machine import Pin
import config
from modules.wifi_client import WiFiStationManager
from modules.ultrasonic import UltrasonicSensor

def main():
    print("\n" + "=" * 55)
    print("[ESP32] KHOI DONG HE THONG DIEU KHIEN & CAM BIEN")
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

    print("[He thong] Bat dau chu ky do khoang cach real-time...")
    print("-" * 55)

    check_counter = 0

    while True:
        try:
            # --- A. ĐO KHOẢNG CÁCH TỪ CẢM BIẾN SIÊU ÂM ---
            distance = ultrasonic.measure_distance()
            is_obstacle = (0 < distance <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

            if distance < 0:
                dist_str = "--.- cm (Ngoai tam do)"
                status_str = "[OK] DUONG TRONG"
            elif is_obstacle:
                dist_str = f"{distance:>5.1f} cm"
                status_str = f"[CANH BAO] CO VAT CAN (<{config.OBSTACLE_DISTANCE_THRESHOLD_CM}cm)!"
            else:
                dist_str = f"{distance:>5.1f} cm"
                status_str = "[OK] AN TOAN"

            # In thông tin hiển thị trực quan lên Terminal / Serial
            print(f"[KHOANG CACH]: {dist_str} | Trang thai: {status_str}")

            # --- B. GIÁM SÁT KẾT NỐI WI-FI ---
            curr_connected = wifi_mgr.is_connected()
            if not curr_connected:
                check_counter += 1
                if check_counter >= 10:  # Thử kết nối lại mỗi ~5 giây (10 * 500ms)
                    check_counter = 0
                    curr_connected = wifi_mgr.connect()
            else:
                check_counter = 0

            # Điều khiển LED báo trạng thái:
            # - Khi phát hiện vật cản gần: nhấp nháy LED cảnh báo
            # - Khi bình thường: LED sáng nếu có wifi, tắt nếu mất wifi
            if wifi_mgr.led:
                if is_obstacle:
                    wifi_mgr.led.value(not wifi_mgr.led.value())
                else:
                    wifi_mgr.led.value(1 if curr_connected else 0)

            # In gói tin JSON định kỳ để hệ thống Web / Server cập nhật
            telemetry_data = {
                "event": "telemetry",
                "wifi": {
                    "connected": curr_connected,
                    "ssid": "Sune" if curr_connected else "—",
                    "ip": wifi_mgr.get_ip() if curr_connected else "—"
                },
                "sensor": {
                    "distance_cm": distance,
                    "obstacle_detected": is_obstacle
                }
            }
            print("TELEMETRY:" + ujson.dumps(telemetry_data))

        except Exception as e:
            print("[Lỗi vòng lặp]", e)

        time.sleep_ms(500)

if __name__ == "__main__":
    main()

