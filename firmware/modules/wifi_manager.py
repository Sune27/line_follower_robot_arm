# ==============================================================================
# WIFI_MANAGER.PY – QUẢN LÝ WI-FI ACCESS POINT (OOP – MICROPYTHON)
# ==============================================================================

import network
import time

try:
    import uasyncio as asyncio
except ImportError:
    import asyncio


class WiFiAPManager:
    """
    Quản lý chế độ phát Wi-Fi (SoftAP) của ESP32 theo chuẩn OOP.
    Cung cấp:
      - Bật / Tắt phát sóng ổn định
      - Cấu hình mạng mở hoặc WPA2-PSK an toàn
      - Broadcast SSID công khai (hidden=False) để điện thoại dễ dàng quét thấy
      - Giám sát thiết bị kết nối và phát hiện sự kiện vào/ra mạng
    """

    def __init__(self, ssid="RobotCar", password="", channel=6, max_clients=4):
        self.ssid        = str(ssid) if ssid else "RobotCar"
        self.password    = str(password).strip() if password else ""
        self.channel     = int(channel) if channel else 6
        self.max_clients = int(max_clients) if max_clients else 4

        # Interface Access Point & Station
        self._ap = network.WLAN(network.AP_IF)
        self._sta = network.WLAN(network.STA_IF)

        self._prev_macs = set()
        self.monitoring = False

    @property
    def is_active(self):
        return self._ap.active()

    @property
    def ip_address(self):
        if not self.is_active:
            return None
        return self._ap.ifconfig()[0]

    @property
    def client_count(self):
        return len(self._get_stations())

    def set_credentials(self, ssid=None, password=None, channel=None, max_clients=None):
        if ssid is not None:
            self.ssid = str(ssid)
        if password is not None:
            self.password = str(password).strip() if password else ""
        if channel is not None:
            self.channel = int(channel)
        if max_clients is not None:
            self.max_clients = int(max_clients)

    def start(self, ssid=None, password=None, channel=None, max_clients=None):
        """Khởi động phát sóng Wi-Fi Access Point"""
        self.set_credentials(ssid, password, channel, max_clients)

        # 1. Tắt STA để tránh xung đột
        try:
            if self._sta.active():
                self._sta.active(False)
        except Exception:
            pass

        # 2. Bật AP
        if not self._ap.active():
            self._ap.active(True)
            time.sleep_ms(150)

        # 3. Cấu hình tham số
        is_open = (not self.password or len(self.password) < 8)

        if is_open:
            self.password = ""
            try:
                self._ap.config(
                    essid=self.ssid,
                    channel=self.channel,
                    authmode=network.AUTH_OPEN,
                    hidden=False
                )
            except Exception:
                try:
                    self._ap.config(essid=self.ssid, authmode=network.AUTH_OPEN)
                except Exception:
                    self._ap.config(essid=self.ssid)
        else:
            try:
                self._ap.config(
                    essid=self.ssid,
                    password=self.password,
                    channel=self.channel,
                    authmode=network.AUTH_WPA2_PSK,
                    hidden=False
                )
            except Exception:
                self._ap.config(essid=self.ssid, password=self.password)

        try:
            self._ap.config(max_clients=self.max_clients)
        except Exception:
            pass

        time.sleep_ms(200)
        return True

    def stop(self):
        """Tắt hoàn toàn phát sóng Wi-Fi"""
        self.monitoring = False
        if self._ap.active():
            self._ap.active(False)
            self._prev_macs.clear()
            return True
        return False

    def toggle(self, ssid=None, password=None):
        """Chuyển đổi trạng thái Bật / Tắt"""
        if self.is_active:
            self.stop()
            return False
        else:
            self.start(ssid=ssid, password=password)
            return True

    def get_status_dict(self):
        """Trả về dict dữ liệu trạng thái chuẩn để gửi lên Backend qua Serial"""
        return {
            "event": "wifi_state",
            "active": self.is_active,
            "ssid": self.ssid,
            "password": self.password,
            "ip": self.ip_address or "—",
            "clients": self.client_count,
            "max_clients": self.max_clients,
            "channel": self.channel,
            "open_network": not bool(self.password)
        }

    def _get_stations(self):
        if not self.is_active:
            return []
        try:
            raw = self._ap.status('stations')
            result = []
            for item in raw:
                mac_raw = item[0] if isinstance(item, (tuple, list)) else item
                result.append({
                    "mac": ":".join("{:02X}".format(b) for b in mac_raw)
                })
            return result
        except Exception:
            return []

    def detect_changes(self):
        """So sánh danh sách MAC để phát hiện thiết bị vào/ra mạng"""
        current = self._get_stations()
        curr_mac = set(c["mac"] for c in current)
        changed = (curr_mac != self._prev_macs)
        self._prev_macs = curr_mac
        return changed, len(current)
