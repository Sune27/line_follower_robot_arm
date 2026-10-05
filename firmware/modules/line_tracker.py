# ==============================================================================
# LINE_TRACKER.PY – MODULE BỘ NÃO ĐIỀU PHỐI DÒ LINE VI SAI (OOP)
# ==============================================================================
# Đóng gói toàn bộ thuật toán dò line:
# - Điều khiển vi sai tối ưu: Đi thẳng 35-35, Rẽ trái 25-42, Rẽ phải 42-25.
# - Bánh trong luôn giữ >= 24% (tránh rơi vào vùng chết mô-men xoắn của motor TT vàng).
# - Bộ nhớ trạng thái ôm cua (State Memory) tránh dừng nhầm khi cắt ngang cua gắt.
# - Bộ lọc trễ thời gian (Time Debounce) xác nhận vạch đích thật.
# ==============================================================================

import time

class LineTracker:
    def __init__(self, motor_driver, base_speed=35, auto_stop_on_cross=False, stop_hold_ms=1000):
        """
        :param motor_driver: Đối tượng MotorDriver để trực tiếp ra lệnh động cơ
        :param base_speed: Mức ga cơ sở chuẩn (mặc định 35%)
        :param auto_stop_on_cross: Tự dừng khi gặp vạch đích (Mặc định False để lướt qua ngã tư/vạch cắt)
        :param stop_hold_ms: Thời gian giữ liên tục 2 mắt đen khi đi thẳng để xác nhận dừng đích (1000ms)
        """
        self.motor = motor_driver
        self.base_speed = max(20, min(85, int(base_speed)))
        self.auto_stop_on_cross = auto_stop_on_cross
        self.stop_hold_ms = stop_hold_ms

        self.is_active = False
        self.last_action = "STRAIGHT"  # "STRAIGHT", "LEFT", "RIGHT", "STOPPED"
        self.both_black_start_time = 0

    def start(self, speed=None):
        """Kích hoạt chế độ tự hành dò line"""
        if speed is not None:
            self.base_speed = max(20, min(85, int(speed)))
        self.is_active = True
        self.last_action = "STRAIGHT"
        self.both_black_start_time = 0
        print(f"[LineTracker] ▶ BẬT DÒ LINE TỰ ĐỘNG (Tốc độ: {self.base_speed}%)")

    def stop(self):
        """Dừng chế độ tự hành dò line và phanh động cơ"""
        self.is_active = False
        self.last_action = "STOPPED"
        self.both_black_start_time = 0
        self.motor.stop()
        print("[LineTracker] ⏹ ĐÃ DỪNG DÒ LINE VÀ PHANH ĐỘNG CƠ")

    def set_speed(self, speed):
        """Cập nhật tốc độ cơ sở khi đang vận hành"""
        self.base_speed = max(20, min(85, int(speed)))

    def update(self, raw_l, raw_r, now_ms):
        """
        Hàm xử lý lõi (gọi ở chu kỳ 10-15ms):
        Nhận tín hiệu 2 mắt TCRT5000 -> Xử lý logic vi sai -> Điều khiển động cơ
        :param raw_l: 0 (Trắng), 1 (Đen)
        :param raw_r: 0 (Trắng), 1 (Đen)
        :param now_ms: time.ticks_ms() hiện tại
        :return: (speed_l, speed_r, action_str)
        """
        if not self.is_active:
            return (0, 0, "IDLE")

        # TH1: CẢ 2 MẮT ĐỀU TRẮNG -> VẠCH ĐEN NẰM CHÍNH GIỮA 2 MẮT -> ĐI THẲNG
        if raw_l == 0 and raw_r == 0:
            self.last_action = "STRAIGHT"
            self.both_black_start_time = 0
            self.motor.set_differential(self.base_speed, self.base_speed)
            return (self.base_speed, self.base_speed, "STRAIGHT")

        # TH2: MẮT TRÁI CHẠM ĐEN, MẮT PHẢI TRẮNG -> XE LỆCH PHẢI -> BẺ LÁI SANG TRÁI
        elif raw_l == 1 and raw_r == 0:
            self.last_action = "LEFT"
            self.both_black_start_time = 0
            # Bánh trong (Trái) = 25%, Bánh ngoài (Phải) = 42% (khi base = 35%)
            speed_l = max(24, int(self.base_speed * 0.71))
            speed_r = min(100, int(self.base_speed * 1.20))
            self.motor.set_differential(speed_l, speed_r)
            return (speed_l, speed_r, "STEER_LEFT")

        # TH3: MẮT PHẢI CHẠM ĐEN, MẮT TRÁI TRẮNG -> XE LỆCH TRÁI -> BẺ LÁI SANG PHẢI
        elif raw_l == 0 and raw_r == 1:
            self.last_action = "RIGHT"
            self.both_black_start_time = 0
            # Bánh ngoài (Trái) = 42%, Bánh trong (Phải) = 25% (khi base = 35%)
            speed_l = min(100, int(self.base_speed * 1.20))
            speed_r = max(24, int(self.base_speed * 0.71))
            self.motor.set_differential(speed_l, speed_r)
            return (speed_l, speed_r, "STEER_RIGHT")

        # TH4: CẢ 2 MẮT ĐỀU ĐEN (1, 1) -> CUA GẮT CẮT VẠCH HOẶC VẠCH NGANG GIAO CẮT
        else:
            # 4A. Nếu trước đó đang bẻ lái -> Khúc cua gắt! Tiếp tục bẻ lái dứt khoát
            if self.last_action == "LEFT":
                self.both_black_start_time = 0
                speed_l = max(20, int(self.base_speed * 0.55))
                speed_r = min(100, int(self.base_speed * 1.30))
                self.motor.set_differential(speed_l, speed_r)
                return (speed_l, speed_r, "SHARP_LEFT")
            elif self.last_action == "RIGHT":
                self.both_black_start_time = 0
                speed_l = min(100, int(self.base_speed * 1.30))
                speed_r = max(20, int(self.base_speed * 0.55))
                self.motor.set_differential(speed_l, speed_r)
                return (speed_l, speed_r, "SHARP_RIGHT")
            else:
                # 4B. Nếu trước đó đang đi thẳng -> Vạch ngang ngã tư hoặc vạch dừng
                if not self.auto_stop_on_cross:
                    # Chế độ tiêu chuẩn: Lướt thẳng qua vạch ngang/ngã tư để tiếp tục bám line
                    speed = max(26, int(self.base_speed * 0.88))
                    self.motor.set_differential(speed, speed)
                    return (speed, speed, "CROSS_LINE")
                else:
                    # Nếu có bật chế độ tự dừng đích: Kiểm chứng liên tục 1000ms mới dừng
                    if self.both_black_start_time == 0:
                        self.both_black_start_time = now_ms
                        self.motor.set_differential(25, 25)
                        return (25, 25, "VERIFY_STOP")
                    elif time.ticks_diff(now_ms, self.both_black_start_time) >= self.stop_hold_ms:
                        self.is_active = False
                        self.motor.stop()
                        print("[LineTracker] 🏁 Đã dừng tại vạch đích.")
                        return (0, 0, "STOPPED_AT_MARK")
                    else:
                        self.motor.set_differential(25, 25)
                        return (25, 25, "VERIFY_STOP")
