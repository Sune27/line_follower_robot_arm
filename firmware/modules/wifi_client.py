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

        scan_success = False
        visible_ssids = set()
        try:
            for attempt in range(2):
                scan_results = self.sta.scan()
                for ap in scan_results:
                    try:
                        ssid_name = ap[0].decode('utf-8').strip()
                        if ssid_name:
                            visible_ssids.add(ssid_name)
                    except Exception:
                        pass
                if visible_ssids:
                    scan_success = True
                    break
                time.sleep_ms(300)
            print(f"[WiFi] 📡 Tìm thấy {len(visible_ssids)} sóng Wi-Fi xung quanh: {list(visible_ssids)[:6]}")
        except Exception as e:
            print(f"[WiFi] ⚠️ Lỗi khi quét Wi-Fi: {e}")
            scan_success = False

        # 4. Tìm kiếm mạng phù hợp theo thứ tự ưu tiên trong danh sách cấu hình
        candidate_networks = []
        if scan_success and visible_ssids:
            for net in self.networks:
                configured_ssid = net.get("ssid", "").strip()
                if configured_ssid and configured_ssid in visible_ssids:
                    candidate_networks.append(net)
                    print(f"[WiFi] ✅ ĐÃ PHÁT HIỆN SÓNG: '{configured_ssid}'")

        # 4.1 Cơ chế Dự phòng (Fallback): Nếu quét sóng bị sót/chập chờn nhưng có cấu hình
        if not candidate_networks:
            print("[WiFi] ℹ️ Không phát hiện sóng qua scan. Kích hoạt thử lần lượt theo danh sách...")
            candidate_networks = list(self.networks)

        # 5. Lần lượt thử kết nối vào các mạng ứng viên
        for target_network in candidate_networks:
            ssid = target_network.get("ssid", "").strip()
            password = target_network.get("password", "")
            if not ssid:
                continue

            print(f"[WiFi] ⏳ Đang thử kết nối tới '{ssid}'...")
            try:
                self.sta.disconnect()
            except Exception:
                pass
            time.sleep_ms(100)

            try:
                self.sta.connect(ssid, password)
            except Exception as e:
                print(f"[WiFi] ❌ Lỗi gọi lệnh connect('{ssid}'): {e}")
                continue

            start_time = time.time()
            connected_ok = False
            while time.time() - start_time <= self.timeout_sec:
                if self.sta.isconnected():
                    connected_ok = True
                    break
                time.sleep_ms(250)

            if connected_ok:
                self.current_ssid = ssid
                ip_info = self.sta.ifconfig()
                print("\n" + "*"*50)
                print(f" [WiFi] 🎉 KẾT NỐI THÀNH CÔNG TỚI: '{ssid}'")
                print(f" [WiFi] 🌐 Địa chỉ IP của ESP32: {ip_info[0]}")
                print(f" [WiFi] 📶 Subnet Mask: {ip_info[1]}")
                print(f" [WiFi] 🚪 Gateway Router: {ip_info[2]}")
                print(f" [WiFi] 🧭 DNS Server: {ip_info[3]}")
                print("*"*50 + "\n")
                if self.led:
                    self.led.value(0)
                return True
            else:
                print(f"[WiFi] ❌ Không thể kết nối tới '{ssid}' (quá {self.timeout_sec}s).")

        # Nếu đã thử hết các mạng cấu hình mà vẫn không được
        print("[WiFi] 🛑 Không thể kết nối tới bất kỳ Wi-Fi nào trong danh sách.")
        if self.led:
            self.led.value(0)
        return False

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
