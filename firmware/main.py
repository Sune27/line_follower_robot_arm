# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG VÀ BÁO CÁO REAL-TIME CỦA ESP32 (FIRMWARE)
# ==============================================================================

import time
import ujson
import config
from modules.wifi_client import WiFiStationManager

def main():
    print("[Hệ thống] Đang khởi động ESP32...")

    # 1. Khởi tạo đối tượng quản lý Wi-Fi với danh sách ưu tiên từ config.py
    wifi_mgr = WiFiStationManager(
        networks_config=config.WIFI_NETWORKS,
        timeout_sec=config.WIFI_CONNECT_TIMEOUT_SEC,
        led_pin=2 # Chân đèn LED xanh tích hợp trên ESP32
    )

    # 2. Thực hiện quét và tự động kết nối ban đầu
    connected = wifi_mgr.connect()

    print("[Hệ thống] Bắt đầu vòng lặp giám sát kết nối thời gian thực...")

    check_counter = 0

    while True:
        try:
            curr_connected = wifi_mgr.is_connected()

            # Nếu bị mất kết nối Wi-Fi (ví dụ người dùng tắt phát Wi-Fi)
            if not curr_connected:
                # Tắt đèn LED báo mất kết nối
                if wifi_mgr.led:
                    wifi_mgr.led.value(0)
                
                # Cứ mỗi 5 giây thử quét và kết nối lại 1 lần
                check_counter += 1
                if check_counter >= 5:
                    check_counter = 0
                    curr_connected = wifi_mgr.connect()
            else:
                check_counter = 0
                # Đèn LED xanh sáng khi có kết nối
                if wifi_mgr.led:
                    wifi_mgr.led.value(1)

            # In gói tin JSON định kỳ mỗi 1 giây để Python Server / Web cập nhật real-time
            status_data = {
                "event": "wifi_heartbeat",
                "connected": curr_connected,
                "ssid": "Sune" if curr_connected else "—",
                "ip": wifi_mgr.get_ip() if curr_connected else "—",
                "security": "WPA2-PSK" if curr_connected else "—"
            }
            print("HEARTBEAT:" + ujson.dumps(status_data))

        except Exception as e:
            pass

        time.sleep(1)

if __name__ == "__main__":
    main()
