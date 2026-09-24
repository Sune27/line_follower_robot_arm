# ==============================================================================
# WIFI_CLIENT.PY – MODULE TỰ ĐỘNG KẾT NỐI WI-FI THEO DANH SÁCH ƯU TIÊN (OOP)
# ==============================================================================

import network
import time
from machine import Pin

class WiFiStationManager:
    """
    Quản lý chế độ kết nối Wi-Fi (STA) cho ESP32.
    Thuật toán:
      1. Quét (scan) các sóng Wi-Fi xung quanh.
      2. So khớp với danh sách ưu tiên cấu hình sẵn trong config.py.
      3. Nếu tìm thấy sóng có trong danh sách -> kết nối theo thứ tự ưu tiên.
      4. Nếu không tìm thấy bất kỳ mạng nào hợp lệ -> KHÔNG KẾT NỐI MẠNG NÀO,
         tắt module Wi-Fi hoặc thông báo về chế độ chờ để bảo vệ xe và tiết kiệm pin.
      5. Nhấp nháy đèn LED GPIO 2 báo hiệu trạng thái.
    """

    def __init__(self, networks_config=None, timeout_sec=10, led_pin=2):
        self.networks = networks_config if networks_config else []
        self.timeout_sec = timeout_sec
        self.sta = network.WLAN(network.STA_IF)
        
        # Cấu hình đèn LED báo trạng thái (mặc định chân GPIO 2 trên ESP32)
        try:
            self.led = Pin(led_pin, Pin.OUT)
            self.led.value(0)
        except Exception:
            self.led = None

    def _blink_led(self, times=2, delay_ms=80):
        """Tiện ích nháy đèn LED"""
        if not self.led:
            return
        for _ in range(times):
            self.led.value(1)
            time.sleep_ms(delay_ms)
            self.led.value(0)
            time.sleep_ms(delay_ms)

    def connect(self):
        """
        Thực hiện quy trình quét và kết nối.
        Trả về: True nếu kết nối thành công, False nếu không tìm thấy mạng nào phù hợp.
        """
        print("\n" + "="*50)
        print(" [ESP32] KHỞI ĐỘNG HỆ THỐNG KẾT NỐI WI-FI")
        print("="*50)

        # 1. Kích hoạt anten Wi-Fi chế độ trạm (Station)
        if not self.sta.active():
            self.sta.active(True)
            time.sleep_ms(100)

        # 2. Tắt kết nối cũ nếu đang dở dang
        if self.sta.isconnected():
            self.sta.disconnect()
            time.sleep_ms(100)

        # 3. Quét các mạng Wi-Fi thực tế ở xung quanh
        print("[WiFi] 🔍 Đang quét các mạng Wi-Fi lân cận...")

        try:
            scan_results = self.sta.scan()
            # scan_results trả về danh sách tuple: (ssid, bssid, channel, RSSI, authmode, hidden)
            visible_ssids = set()
            for ap in scan_results:
                try:
                    ssid_name = ap[0].decode('utf-8').strip()
                    if ssid_name:
                        visible_ssids.add(ssid_name)
                except Exception:
                    pass
            print(f"[WiFi] 📡 Tìm thấy {len(visible_ssids)} sóng Wi-Fi xung quanh.")
        except Exception as e:
            print(f"[WiFi] ❌ Lỗi khi quét Wi-Fi: {e}")
            visible_ssids = set()

        # 4. Tìm kiếm mạng phù hợp theo thứ tự ưu tiên trong danh sách cấu hình
        target_network = None
        for net in self.networks:
            configured_ssid = net.get("ssid", "").strip()
            if configured_ssid and configured_ssid in visible_ssids:
                target_network = net
                print(f"[WiFi] ✅ ĐÃ TÌM THẤY MẠNG ƯU TIÊN: '{configured_ssid}'")
                break

        # 5. Nếu không tìm thấy bất kỳ mạng nào có trong danh sách
        if not target_network:
            print("[WiFi] ⚠️ KHÔNG TÌM THẤY BẤT CỨ MẠNG WI-FI NÀO TRONG DANH SÁCH CẤU HÌNH!")
            print("[WiFi] 🛑 ESP32 sẽ KHÔNG KẾT NỐI với bất kỳ Wi-Fi nào.")
            # Tắt anten Wi-Fi để tiết kiệm năng lượng và tránh bị can thiệp
            self.sta.active(False)
            if self.led:
                self.led.value(0)
            return False

        # 6. Tiến hành kết nối vào mạng đã chọn
        ssid = target_network["ssid"]
        password = target_network.get("password", "")
        print(f"[WiFi] ⏳ Đang kết nối tới '{ssid}'...")

        self.sta.connect(ssid, password)

        start_time = time.time()
        while not self.sta.isconnected():
            time.sleep_ms(200)

            if time.time() - start_time > self.timeout_sec:
                print(f"[WiFi] ❌ Hết thời gian chờ ({self.timeout_sec}s)! Không thể kết nối tới '{ssid}'.")
                self.sta.disconnect()
                self.sta.active(False)
                if self.led:
                    self.led.value(0)
                return False

        # 7. Kết nối thành công!
        self.current_ssid = ssid
        ip_info = self.sta.ifconfig()
        print("\n" + "*"*50)
        print(f" [WiFi] 🎉 KẾT NỐI THÀNH CÔNG TỚI: '{ssid}'")
        print(f" [WiFi] 🌐 Địa chỉ IP của ESP32: {ip_info[0]}")
        print(f" [WiFi] 📶 Subnet Mask: {ip_info[1]}")
        print(f" [WiFi] 🚪 Gateway Router: {ip_info[2]}")
        print(f" [WiFi] 🧭 DNS Server: {ip_info[3]}")
        print("*"*50 + "\n")

        # Đã kết nối Wi-Fi thành công -> Đèn LED TẮT (không sáng khi đã bắt Wi-Fi)
        if self.led:
            self.led.value(0)

        return True

    def is_connected(self):
        return self.sta.isconnected()

    def get_ip(self):
        if self.is_connected():
            return self.sta.ifconfig()[0]
        return None

    def get_ssid(self):
        if self.is_connected():
            return getattr(self, 'current_ssid', "Sune")
        return "—"
