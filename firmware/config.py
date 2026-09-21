# ==============================================================================
# CONFIG.PY – CẤU HÌNH THÔNG SỐ VẬN HÀNH CHO ESP32 (FIRMWARE)
# ==============================================================================

# ==============================================================================
# 1. DANH SÁCH MẠNG WI-FI ƯU TIÊN KẾT NỐI (STATION MODE - STA)
# ==============================================================================
# ESP32 sẽ quét các mạng Wi-Fi xung quanh và ưu tiên kết nối theo thứ tự từ trên xuống.
# Bạn có thể thêm nhiều Wi-Fi (nhà riêng, phòng trọ, trường học, hotspot điện thoại...)
WIFI_NETWORKS = [
    {
        "ssid": "Sune",
        "password": "khongcomatkhau"
    },
    # Bạn có thể bổ sung thêm các mạng dự phòng khác tại đây, ví dụ:
    # {
    #     "ssid": "WiFi_Phong_Tro",
    #     "password": "mat_khau_phong_tro"
    # },
    # {
    #     "ssid": "Hotspot_Dien_Thoai",
    #     "password": "12345678"
    # }
]

# Thời gian tối đa chờ kết nối mỗi mạng Wi-Fi (giây) trước khi thử mạng tiếp theo
WIFI_CONNECT_TIMEOUT_SEC = 10

# Thời gian nghỉ giữa các lần thử quét lại nếu không tìm thấy mạng nào (giây)
WIFI_RETRY_DELAY_SEC = 5

# ==============================================================================
# 2. CẤU HÌNH THÔNG SỐ XE & CHU KỲ ĐIỀU KHIỂN
# ==============================================================================
# Chu kỳ vòng lặp điều khiển xe (ms)
CONTROL_LOOP_INTERVAL_MS = 20
