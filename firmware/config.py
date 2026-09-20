# ==============================================================================
# CONFIG.PY – CẤU HÌNH PHẦN CỨNG & KẾT NỐI WI-FI (ESP32 MicroPython)
# ==============================================================================

# ==============================================================================
# 1. CẤU HÌNH WI-FI ACCESS POINT (SoftAP phát từ ESP32)
# ==============================================================================
# Tên mạng Wi-Fi (SSID) phát từ xe Robot
WIFI_SSID = "WIFI ESP32"

# Mật khẩu Wi-Fi:
#   - Nhập chuỗi >= 8 ký tự   →  Wi-Fi bảo mật chuẩn WPA2-PSK
#   - Để chuỗi rỗng ""         →  Wi-Fi MỞ (không cần mật khẩu)
WIFI_PASSWORD = "123456789"

# Số lượng thiết bị tối đa được phép kết nối cùng lúc (1 – 4)
WIFI_MAX_CLIENTS = 4

# Kênh phát sóng Wi-Fi (1 – 13). Kênh 6 chuẩn 2.4 GHz
WIFI_CHANNEL = 6

# Chu kỳ quét giám sát thiết bị kết nối (giây)
WIFI_TASK_INTERVAL = 2.0

# ==============================================================================
# 2. CHU KỲ VÒNG LẶP ĐIỀU KHIỂN XE (ms)
# ==============================================================================
CONTROL_LOOP_INTERVAL_MS = 20
