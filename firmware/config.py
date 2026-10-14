# ==============================================================================
# CONFIG.PY – CẤU HÌNH THÔNG SỐ VẬN HÀNH CHO ESP32 (FIRMWARE)
# ==============================================================================

# ==============================================================================
# 1. DANH SÁCH MẠNG WI-FI ƯU TIÊN KẾT NỐI (STATION MODE - STA)
# ==============================================================================
WIFI_NETWORKS = [
    {
        "ssid": "Sune",
        "password": "mouse_love_rice"
    }
]

WIFI_CONNECT_TIMEOUT_SEC = 8
WIFI_RETRY_DELAY_SEC = 3

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

# ==============================================================================
# 6. CẤU HÌNH THUẬT TOÁN PD DÒ LINE 5 MẮT (ĐIỀU KHIỂN ÊM ÁI - CHỐNG VĂNG LINE)
# ==============================================================================
LINE_BASE_SPEED = 32           # Tốc độ cơ sở bình thường sau 1.5s (32% chạy êm, bám vạch chính xác)
LINE_STARTUP_SPEED = 55        # Tốc độ cơ sở khởi hành trong 1.5s đầu (55% để thắng ma sát nghỉ)
LINE_STARTUP_DURATION_MS = 1500 # Thời gian chạy tốc độ khởi hành 55% (1500ms = 1.5s)
LINE_LOST_TIMEOUT_MS = 1500     # Khi mất line (00000): tiếp tục chạy THẲNG tốc độ cơ sở trong 1.5s rồi phanh về 0
PID_KP = 4.2                   # Hệ số Tỷ lệ (P): 4.2 để lệch nhẹ xe lượn êm, không bị bẻ gắt văng line
PID_KI = 0.0                   # Hệ số Tích phân (I): Đặt bằng 0 để triệt tiêu khâu I (thuần thuật toán PD)
PID_KD = 2.2                   # Hệ số Đạo hàm (D): 2.2 để giảm chấn vừa phải, chống lắc đuôi xe
