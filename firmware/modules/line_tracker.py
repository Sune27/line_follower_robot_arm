# ==============================================================================
# LINE_TRACKER.PY – MODULE BỘ NÃO ĐIỀU KHIỂN DÒ LINE PID 5 MẮT (OOP)
# ==============================================================================
# Thiết kế bộ điều khiển PID rời rạc (Discrete PID Controller) cho mảng 5 mắt TCRT5000:
# - Chuẩn hóa sai số vị trí (Positional Error): e in [-4.0, +4.0] (9 vùng không gian).
# - Khâu P (Proportional): Lực bẻ lái tỷ lệ thuận với độ lệch vạch hiện tại.
# - Khâu I (Integral): Tích lũy sai số bù lệch cơ khí 2 motor, tự xóa khi qua tâm (Zero-Crossing Reset).
# - Khâu D (Derivative): Phanh giảm chấn chống văng đuôi khi xe đang lao nhanh về tâm vạch.
# - Cơ chế cứu mất line (Lost-Line Recovery): Nhớ hướng lệch cuối cùng khi vọt khỏi vạch (00000).
# - Chỉ kích hoạt khi nhận lệnh BẮT ĐẦU từ giao diện Web (is_active = True).
# ==============================================================================

import time
import config

# Đảm bảo tương thích trên cả MicroPython (ESP32) và Python Desktop (Unit Test)
if not hasattr(time, "ticks_ms"):
    time.ticks_ms = lambda: int(time.time() * 1000)
if not hasattr(time, "ticks_diff"):
    time.ticks_diff = lambda a, b: a - b

class LineTracker:
    def __init__(
        self,
        motor_driver,
        base_speed=None,
        kp=None,
        ki=None,
        kd=None,
        filter_alpha=None,
        auto_stop_on_cross=False,
        stop_hold_ms=1000,
        startup_duration_ms=None,
        startup_speed=None,
        lost_line_timeout_ms=None,
        search_reverse_speed=None
    ):
        """
        Khởi tạo bộ điều khiển PD/PID dò line 5 mắt.
        :param motor_driver: Đối tượng MotorDriver (TB6612FNG)
        :param base_speed: Tốc độ cơ sở (%) khi đi thẳng sau giai đoạn khởi hành (20% - 85%)
        :param kp: Hệ số Tỷ lệ (Proportional Gain)
        :param ki: Hệ số Tích phân (Integral Gain) - đặt 0.0 để dùng thuần PD
        :param kd: Hệ số Đạo hàm (Derivative Gain)
        :param filter_alpha: Hệ số lọc thông thấp làm mịn sai số (0.1 - 1.0, 1.0 là không lọc)
        :param startup_duration_ms: Thời gian chạy tốc độ khởi hành 55% (mặc định 1500ms = 1.5s)
        :param startup_speed: Tốc độ cơ sở khởi hành để thắng ma sát nghỉ (mặc định 55%)
        :param lost_line_timeout_ms: Thời gian quét tìm vạch khi mất vạch trước khi phanh về 0 (1500ms = 1.5s)
        :param search_reverse_speed: Tốc độ quay lùi bánh trong khi quét tìm lại line (-15%)
        """
        self.motor = motor_driver

        default_min_spd = getattr(config, "LINE_MIN_SPEED", 30)
        self.min_speed = int(default_min_spd)

        default_spd = getattr(config, "LINE_BASE_SPEED", 45)
        self.base_speed = max(self.min_speed, min(85, int(base_speed if base_speed is not None else default_spd)))

        self.kp = float(kp if kp is not None else getattr(config, "PID_KP", 4.2))
        self.ki = float(ki if ki is not None else getattr(config, "PID_KI", 0.08))
        self.kd = float(kd if kd is not None else getattr(config, "PID_KD", 2.2))

        default_alpha = getattr(config, "PID_FILTER_ALPHA", 0.7)
        self.filter_alpha = float(filter_alpha if filter_alpha is not None else default_alpha)

        default_startup_dur = getattr(config, "LINE_STARTUP_DURATION_MS", 1500)
        self.startup_duration_ms = int(startup_duration_ms if startup_duration_ms is not None else default_startup_dur)

        default_startup_spd = getattr(config, "LINE_STARTUP_SPEED", 55)
        self.startup_speed = int(startup_speed if startup_speed is not None else default_startup_spd)
        self.start_ticks = 0

        default_lost_dur = getattr(config, "LINE_LOST_TIMEOUT_MS", 1500)
        self.lost_line_timeout_ms = int(lost_line_timeout_ms if lost_line_timeout_ms is not None else default_lost_dur)
        self.lost_line_start_time = 0

        default_search_rev = getattr(config, "LINE_SEARCH_REVERSE_SPEED", -15)
        self.lost_search_reverse_speed = int(search_reverse_speed if search_reverse_speed is not None else default_search_rev)

        self.auto_stop_on_cross = auto_stop_on_cross
        self.stop_hold_ms = stop_hold_ms

        # Trạng thái vận hành: Mặc định TẮT (chờ ấn Bắt đầu trên Web)
        self.is_active = False
        self.last_action = "STANDBY"

        # Các biến trạng thái của thuật toán PID & Bộ lọc làm mịn
        self.current_error = 0.0
        self.smooth_error = 0.0
        self.prev_smooth_error = 0.0
        self.prev_error = 0.0
        self.last_valid_error = 0.0
        self.integral = 0.0
        self.pid_output = 0.0
        self.both_black_start_time = 0

    def _drive(self, left, right):
        """
        Xuất xung PWM có tự động nhân hệ số cân bằng cơ khí (MOTOR_LEFT_SCALE, MOTOR_RIGHT_SCALE)
        được cấu hình từ Tab TB6612, đảm bảo 2 bánh triệt tiêu sai lệch phần cứng.
        """
        scale_l = getattr(config, "MOTOR_LEFT_SCALE", 1.0)
        scale_r = getattr(config, "MOTOR_RIGHT_SCALE", 1.0)
        out_l = int(round(left * scale_l))
        out_r = int(round(right * scale_r))
        self.motor.set_differential(out_l, out_r)
        return (out_l, out_r)

    def reset_pid(self):
        """Đặt lại toàn bộ các thanh ghi trạng thái PID về 0."""
        self.current_error = 0.0
        self.smooth_error = 0.0
        self.prev_smooth_error = 0.0
        self.prev_error = 0.0
        self.last_valid_error = 0.0
        self.integral = 0.0
        self.pid_output = 0.0
        self.both_black_start_time = 0
        self.lost_line_start_time = 0

    def start(self, speed=None):
        """Kích hoạt chế độ tự hành dò line bằng PID/PD (Gọi khi ấn Bắt đầu trên Web)."""
        if speed is not None:
            self.base_speed = max(20, min(85, int(speed)))
        self.reset_pid()
        self.is_active = True
        self.start_ticks = time.ticks_ms()
        self.lost_line_start_time = 0
        self.last_action = "STARTUP"
        # 1.5s đầu chạy với tốc độ cơ sở khởi hành để thắng ma sát nghỉ
        init_speed = self.startup_speed if self.startup_duration_ms > 0 else self.base_speed
        self._drive(init_speed, init_speed)
        print(f"[LineTracker PD] ▶ BẮT ĐẦU DÒ LINE (1.5s đầu chạy tốc độ {self.startup_speed}%, sau đó {self.base_speed}%, Kp={self.kp}, Ki={self.ki}, Kd={self.kd})")

    def stop(self):
        """Dừng chế độ tự hành dò line và phanh động cơ ngay lập tức."""
        self.is_active = False
        self.reset_pid()
        self.last_action = "STOPPED"
        self.motor.stop()
        print("[LineTracker PID] ⏹ ĐÃ DỪNG DÒ LINE & NGẮT ĐỘNG CƠ")

    def set_speed(self, speed):
        """Cập nhật tốc độ cơ sở trực tiếp khi đang chạy mà không làm gián đoạn PID."""
        self.base_speed = max(self.min_speed, min(85, int(speed)))

    def set_pid(self, kp=None, ki=None, kd=None, filter_alpha=None):
        """Cập nhật nóng các hệ số Kp, Ki, Kd, filter_alpha."""
        if kp is not None:
            self.kp = float(kp)
        if ki is not None:
            self.ki = float(ki)
        if kd is not None:
            self.kd = float(kd)
        if filter_alpha is not None:
            self.filter_alpha = float(filter_alpha)
        print(f"[LineTracker PID] ⚙️ Cập nhật PID: Kp={self.kp}, Ki={self.ki}, Kd={self.kd}, Alpha={self.filter_alpha}")

    def _compute_error(self, sensors):
        """
        Tính toán sai số vị trí e từ mảng 5 mắt [s1, s2, s3, s4, s5]:
        - s1..s5: 1 là VẠCH ĐEN, 0 là NỀN TRẮNG.
        - Trả về tuple: (error, mode_str)
          Trong đó error nằm trong dải [-4.0 .. +4.0]:
            * error < 0: Vạch đen nằm bên TRÁI tâm xe -> Cần RẼ TRÁI (Giảm bánh trái, Tăng bánh phải).
            * error > 0: Vạch đen nằm bên PHẢI tâm xe -> Cần RẼ PHẢI (Tăng bánh trái, Giảm bánh phải).
            * error = 0: Vạch đen nằm chính giữa tâm S3 -> ĐI THẲNG.
        """
        s1, s2, s3, s4, s5 = sensors[0], sensors[1], sensors[2], sensors[3], sensors[4]
        bitmask = (s1 << 4) | (s2 << 3) | (s3 << 2) | (s4 << 1) | s5

        # 1. Cả 5 mắt cùng Đen (11111) -> Vạch ngang ngã tư hoặc vạch đích
        if bitmask == 0b11111:
            return (0.0, "CROSS_LINE")

        # 2. Cả 5 mắt cùng Trắng (00000) -> Mất vạch hoàn toàn
        if bitmask == 0b00000:
            return (0.0, "LOST_LINE")

        # 3. Bảng tra nhanh 9 vị trí chuẩn (từ -4 đến +4)
        MAP_ERROR = {
            0b10000: -4.0,
            0b11000: -3.0,
            0b01000: -2.0,
            0b01100: -1.0,
            0b00100:  0.0,
            0b00110:  1.0,
            0b00010:  2.0,
            0b00011:  3.0,
            0b00001:  4.0,
            0b01110:  0.0,
            0b11100: -2.0,
            0b00111:  2.0,
        }

        if bitmask in MAP_ERROR:
            err = MAP_ERROR[bitmask]
        else:
            # Trung bình có trọng số cho mọi tổ hợp mắt còn lại
            total = s1 + s2 + s3 + s4 + s5
            err = ((-4.0 * s1) + (-2.0 * s2) + (0.0 * s3) + (2.0 * s4) + (4.0 * s5)) / total

        # Lưu lại hướng lệch hợp lệ gần nhất
        if err != 0.0:
            self.last_valid_error = err
        elif bitmask == 0b00100:
            # Khi đã bám vững ở tâm S3, giảm dần bộ nhớ lệch cũ
            self.last_valid_error = self.last_valid_error * 0.5

        return (err, "TRACKING")

    def update(self, sensors_or_left, raw_r=None, now_ms=None):
        """
        Chu kỳ tính toán PID (gọi mỗi 15ms khi self.is_active == True).
        Hỗ trợ nhận:
          - Mảng 5 mắt: update([s1, s2, s3, s4, s5], now_ms)
          - Hoặc 2 mắt cũ: update(raw_l, raw_r, now_ms)
        :return: (speed_left, speed_right, action_str)
        """
        if not self.is_active:
            return (0, 0, "IDLE")

        # Chuẩn hóa đầu vào thành mảng 5 mắt [s1, s2, s3, s4, s5]
        if isinstance(sensors_or_left, (list, tuple)):
            sensors = sensors_or_left
            if now_ms is None and raw_r is not None:
                now_ms = raw_r
        else:
            l_val = 1 if sensors_or_left else 0
            r_val = 1 if raw_r else 0
            sensors = [0, l_val, 0, r_val, 0]

        if now_ms is None:
            now_ms = time.ticks_ms()

        # Xác định tốc độ cơ sở: 1.5s đầu chạy tốc độ khởi hành 55% để thoát trạng thái nghỉ, sau đó về base_speed
        is_startup = (self.startup_duration_ms > 0 and time.ticks_diff(now_ms, self.start_ticks) < self.startup_duration_ms)
        current_base = self.startup_speed if is_startup else self.base_speed

        # Bước 1: Tính sai số vị trí thô e in [-4.0, +4.0]
        raw_error, mode = self._compute_error(sensors)

        # Bước 2: TÍNH NĂNG 2 - NHỚ HƯỚNG MẤT LINE (RECOVERY BASED ON LAST KNOWN ERROR)
        # Thay vì chỉ đâm thẳng, xe ghi nhớ hướng vạch trôi để chủ động quét tìm lại line
        if mode == "LOST_LINE":
            if self.lost_line_start_time == 0:
                self.lost_line_start_time = now_ms

            # Kiểm tra thời gian tối đa tìm vạch (mặc định 1.5s = lost_line_timeout_ms)
            if time.ticks_diff(now_ms, self.lost_line_start_time) >= self.lost_line_timeout_ms:
                self.stop()
                self.last_action = "LOST_STOPPED"
                print(f"[LineTracker PID] ⏹ MẤT LINE QUÁ {self.lost_line_timeout_ms}ms -> ĐÃ PHANH DỪNG XE HOÀN TOÀN!")
                return (0, 0, "LOST_STOPPED")

            # Trong 1.5s đầu mất vạch: Dựa vào last_valid_error để quyết định hành động thông minh
            self.integral = 0.0
            self.prev_smooth_error = 0.0
            self.smooth_error = 0.0
            self.current_error = 0.0
            self.pid_output = 0.0

            if abs(self.last_valid_error) < 0.5:
                # TH 1: Mất vạch khi đang bám đúng tâm (vạch đứt quãng) -> Tiếp tục chạy THẲNG đón vạch
                self.last_action = "LOST_STRAIGHT"
                self._drive(current_base, current_base)
                return (current_base, current_base, "LOST_STRAIGHT")
            elif self.last_valid_error <= -0.5:
                # TH 2: Vạch vừa trôi sang TRÁI (cua gấp trái) -> Bẻ lái quay TRÁI để quét đón vạch
                # Bánh trong dừng (0% làm trụ), Bánh ngoài chạy vừa phải 35-40%, KHÔNG QUAY LÙI để chống xoay ngang xe
                search_outer = min(42, max(28, int(current_base * 0.55)))
                search_inner = getattr(config, "LINE_SEARCH_REVERSE_SPEED", 0)
                self.last_action = "LOST_SEARCH_LEFT"
                self._drive(search_inner, search_outer)
                return (search_inner, search_outer, "LOST_SEARCH_LEFT")
            else:
                # TH 3: Vạch vừa trôi sang PHẢI (cua gấp phải) -> Bẻ lái quay PHẢI để quét đón vạch
                search_outer = min(42, max(28, int(current_base * 0.55)))
                search_inner = getattr(config, "LINE_SEARCH_REVERSE_SPEED", 0)
                self.last_action = "LOST_SEARCH_RIGHT"
                self._drive(search_outer, search_inner)
                return (search_outer, search_inner, "LOST_SEARCH_RIGHT")
        else:
            # Khi thấy lại vạch (dù chỉ 1 mắt), reset ngay bộ đếm mất vạch
            self.lost_line_start_time = 0

        # Bước 3: Xử lý trường hợp gặp vạch ngang (11111)
        if mode == "CROSS_LINE":
            if self.auto_stop_on_cross:
                if self.both_black_start_time == 0:
                    self.both_black_start_time = now_ms
                elif time.ticks_diff(now_ms, self.both_black_start_time) >= self.stop_hold_ms:
                    self.stop()
                    print("[LineTracker PID] 🏁 Đã dừng tại vạch đích (11111).")
                    return (0, 0, "STOPPED_AT_MARK")
            # Đi thẳng ổn định qua giao lộ theo tốc độ hiện tại
            self.integral = 0.0
            self.prev_smooth_error = 0.0
            self.smooth_error = 0.0
            self.current_error = 0.0
            self.pid_output = 0.0
            self.last_action = "STARTUP_CROSS" if is_startup else "CROSS_LINE"
            self._drive(current_base, current_base)
            return (current_base, current_base, self.last_action)
        else:
            self.both_black_start_time = 0

        # Bước 4: TÍNH NĂNG 1 - BỘ LỌC THÔNG THẤP LÀM MỊN SAI SỐ (EXPONENTIAL LOW-PASS FILTER)
        # Khử hiện tượng nhảy bậc thang gián đoạn của cảm biến số, triệt tiêu xung gai khâu D
        if self.filter_alpha >= 1.0:
            smooth_err = raw_error
        else:
            smooth_err = (self.filter_alpha * raw_error) + ((1.0 - self.filter_alpha) * self.smooth_error)
            if raw_error == 0.0 and abs(smooth_err) < 0.05:
                smooth_err = 0.0

        # 4.1. Thành phần Tỷ lệ (P)
        p_term = self.kp * smooth_err

        # 4.2. Thành phần Tích phân (I)
        if self.ki == 0.0:
            self.integral = 0.0
            i_term = 0.0
        else:
            # Zero-crossing reset: xóa tích phân khi đổi dấu hoặc qua tâm
            if abs(smooth_err) < 0.1 or (smooth_err * self.prev_smooth_error < 0):
                self.integral = 0.0
            else:
                self.integral = max(-20.0, min(20.0, self.integral + smooth_err))
            i_term = self.ki * self.integral

        # 4.3. Thành phần Đạo hàm (D) mượt mà
        derivative = smooth_err - self.prev_smooth_error
        d_term = self.kd * derivative

        # Lưu trạng thái sai số cho chu kỳ tiếp theo
        self.prev_smooth_error = smooth_err
        self.smooth_error = smooth_err
        self.current_error = round(smooth_err, 2)
        self.prev_error = raw_error

        # Bước 5: KHUẾCH ĐẠI VI SAI HỢP LÝ KHI VÀO CUA
        abs_err = abs(smooth_err)
        if abs_err > 1.0:
            curve_mult = 1.0 + 0.35 * (abs_err - 1.0)
        else:
            curve_mult = 1.0

        # Hệ số co giãn theo tốc độ cơ sở hiện tại
        speed_scale = (current_base / float(self.base_speed)) if self.base_speed > 0 else 1.0
        pid_val = (p_term + i_term + d_term) * speed_scale * curve_mult
        self.pid_output = round(pid_val, 2)

        # Bước 6: PHÂN TẦNG TỐC ĐỘ BÁNH TRONG THÔNG MINH (CHỦ ĐỘNG ÉP GIẢM GA BÁNH TRONG)
        # Khắc phục triệt để hiện tượng vạch ở Mắt 2/4 xe không chịu rẽ mà trượt ra Mắt 1/5!
        speed_l = int(round(current_base + pid_val))
        speed_r = int(round(current_base - pid_val))

        min_gentle = self.min_speed  # Ngưỡng tốc độ tối thiểu khi bám tâm

        if abs_err <= 1.2:
            # VÙNG 1: Bám tim đường thẳng (Mắt 3 trung tâm, |err| <= 1.2)
            # Cả 2 bánh duy trì tốc độ ổn định xung quanh current_base
            speed_l = max(min_gentle, min(88, speed_l))
            speed_r = max(min_gentle, min(88, speed_r))
        elif smooth_err < -1.2:
            # VẠCH LỆCH SANG TRÁI -> CẦN RẼ TRÁI (Bánh Trái: Bánh Trong, Bánh Phải: Bánh Ngoài)
            if abs_err <= 2.5:
                # VÙNG 2: Mắt 2 thấy vạch (Lệch vừa: 1.2 < abs_err <= 2.5)
                # Chủ động ép bánh trong hạ sâu (tối đa 40% base speed), bánh ngoài tăng ga để rẽ vào tâm ngay
                speed_l = max(18, min(int(current_base * 0.40), speed_l))
                speed_r = min(88, max(int(current_base * 1.10), speed_r))
            else:
                # VÙNG 3 & 4: Mắt 1 thấy vạch (Cua gắt: abs_err > 2.5)
                # Bánh trong hạ xuống 15-20%, bánh ngoài giữ 75-85% ôm cua cánh cung, không khóa bánh
                speed_l = max(15, min(int(current_base * 0.25), speed_l))
                speed_r = min(88, max(int(current_base * 1.15), speed_r))
        else:
            # VẠCH LỆCH SANG PHẢI -> CẦN RẼ PHẢI (Bánh Phải: Bánh Trong, Bánh Trái: Bánh Ngoài)
            if abs_err <= 2.5:
                # VÙNG 2: Mắt 4 thấy vạch (Lệch vừa: 1.2 < abs_err <= 2.5)
                # Chủ động ép bánh trong hạ sâu (tối đa 40% base speed), bánh ngoài tăng ga để rẽ vào tâm ngay
                speed_r = max(18, min(int(current_base * 0.40), speed_r))
                speed_l = min(88, max(int(current_base * 1.10), speed_l))
            else:
                # VÙNG 3 & 4: Mắt 5 thấy vạch (Cua gắt: abs_err > 2.5)
                # Bánh trong hạ xuống 15-20%, bánh ngoài giữ 75-85% ôm cua cánh cung, không khóa bánh
                speed_r = max(15, min(int(current_base * 0.25), speed_r))
                speed_l = min(88, max(int(current_base * 1.15), speed_l))

        # Gán nhãn hành động phục vụ Telemetry hiển thị trên Web
        if abs_err < 0.2:
            act_name = "STRAIGHT"
        elif smooth_err <= -3.0:
            act_name = "SHARP_LEFT"
        elif smooth_err < 0.0:
            act_name = "STEER_LEFT"
        elif smooth_err >= 3.0:
            act_name = "SHARP_RIGHT"
        else:
            act_name = "STEER_RIGHT"

        self.last_action = f"STARTUP_{act_name}" if is_startup else act_name

        # Bước 7: Xuất xung PWM xuống mạch công suất TB6612FNG (tự động nhân scale cơ khí bù lệch 2 bánh)
        self._drive(speed_l, speed_r)
        return (speed_l, speed_r, self.last_action)

