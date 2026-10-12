# ==============================================================================
# CONFIG.PY – CẤU HÌNH THÔNG SỐ VẬN HÀNH CHO ESP32 (FIRMWARE)
# ==============================================================================

# ==============================================================================
# 1. DANH SÁCH MẠNG WI-FI ƯU TIÊN KẾT NỐI (STATION MODE - STA)
# ==============================================================================
WIFI_NETWORKS = [
    {
        "ssid": "Sune",
        "password": "khongcomatkhau"
    },
    {
        "ssid" : "NGA-5G",
        "password" : "0961699271"
    }   
]

WIFI_CONNECT_TIMEOUT_SEC = 10
WIFI_RETRY_DELAY_SEC = 5

# ==============================================================================
# 2. CẤU HÌNH CẢM BIẾN SIÊU ÂM RCWL-1601 / HC-SR04 (MẠNG BÊN PHẢI)
# ==============================================================================
PIN_ULTRASONIC_TRIG = 16     # Chân phát xung siêu âm (RX2 / GPIO 16 - Cột S bên Phải)
PIN_ULTRASONIC_ECHO = 4      # Chân thu xung hồi tiếp (D4 / GPIO 4 - Cột S bên Phải)
OBSTACLE_DISTANCE_THRESHOLD_CM = 10.0  # Ngưỡng phát hiện vật cản (cm)

# ==============================================================================
# 3. CẤU HÌNH CHU KỲ VÒNG LẶP ĐIỀU KHIỂN XE
# ==============================================================================
CONTROL_LOOP_INTERVAL_MS = 20

# ==============================================================================
# 4. CẤU HÌNH MẢNG CẢM BIẾN DÒ LINE TCRT5000 5 MẮT (MẠNG BÊN PHẢI LIỀN KỀ)
# ==============================================================================
PIN_LINE_S1 = 21             # Mắt 1: Ngoài Trái  -> D21 (GPIO 21)
PIN_LINE_S2 = 19             # Mắt 2: Giữa Trái   -> D19 (GPIO 19)
PIN_LINE_S3 = 18             # Mắt 3: Trung Tâm   -> D18 (GPIO 18)
PIN_LINE_S4 = 5              # Mắt 4: Giữa Phải   -> D5  (GPIO 5)
PIN_LINE_S5 = 17             # Mắt 5: Ngoài Phải  -> TX2 (GPIO 17)

# Cấu hình dự phòng tương thích ngược cho chế độ 2 mắt cũ
PIN_LINE_LEFT = 19           # Mắt Trái (D19)
PIN_LINE_RIGHT = 21          # Mắt Phải (D21)

# ==============================================================================
# 5. CẤU HÌNH ĐỘNG CƠ TB6612FNG (BÁNH TRÁI VÀ BÁNH PHẢI)
# ==============================================================================
PIN_MOTOR_AIN1 = 13          # Bánh Trái (D13 - Cột S)
PIN_MOTOR_AIN2 = 12          # Bánh Trái (D12 - Cột S)
PIN_MOTOR_BIN1 = 27          # Bánh Phải (D27 - Cột S)
PIN_MOTOR_BIN2 = 26          # Bánh Phải (D26 - Cột S)
MOTOR_PWM_FREQ = 1000        # Tần số PWM 1000Hz chạy êm, mô-men xoắn khỏe


