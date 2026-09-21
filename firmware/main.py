# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG CHÍNH CỦA ESP32 (FIRMWARE)
# ==============================================================================

import time
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

    # 2. Thực hiện quét và tự động kết nối
    connected = wifi_mgr.connect()

    if connected:
        print("[Hệ thống] ESP32 đã sẵn sàng giao tiếp qua mạng không dây!")
    else:
        print("[Hệ thống] Chạy ở chế độ ngoại tuyến (Offline) - Không kết nối mạng nào.")

    # Vòng lặp giám sát duy trì chương trình
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[Hệ thống] Dừng chương trình.")

if __name__ == "__main__":
    main()
