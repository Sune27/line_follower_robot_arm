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
        auto_stop_on_cross=False,
        stop_hold_ms=1000,
        startup_duration_ms=None,
        startup_speed=None,
        lost_line_timeout_ms=None
    ):
        """
        Khởi tạo bộ điều khiển PD/PID dò line 5 mắt.
        :param motor_driver: Đối tượng MotorDriver (TB6612FNG)
        :param base_speed: Tốc độ cơ sở (%) khi đi thẳng sau giai đoạn khởi hành (20% - 85%)
        :param kp: Hệ số Tỷ lệ (Proportional Gain)
        :param ki: Hệ số Tích phân (Integral Gain) - đặt 0.0 để dùng thuần PD
        :param kd: Hệ số Đạo hàm (Derivative Gain)
        :param startup_duration_ms: Thời gian chạy tốc độ khởi hành 55% (mặc định 1500ms = 1.5s)
        :param startup_speed: Tốc độ cơ sở khởi hành để thắng ma sát nghỉ (mặc định 55%)
        :param lost_line_timeout_ms: Thời gian chạy thẳng khi mất vạch trước khi phanh về 0 (1500ms = 1.5s)
        """
        self.motor = motor_driver

        default_spd = getattr(config, "LINE_BASE_SPEED", 32)
        self.base_speed = max(20, min(85, int(base_speed if base_speed is not None else default_spd)))

        self.kp = float(kp if kp is not None else getattr(config, "PID_KP", 4.2))
        self.ki = float(ki if ki is not None else getattr(config, "PID_KI", 0.0))
        self.kd = float(kd if kd is not None else getattr(config, "PID_KD", 2.2))

        default_startup_dur = getattr(config, "LINE_STARTUP_DURATION_MS", 1500)
        self.startup_duration_ms = int(startup_duration_ms if startup_duration_ms is not None else default_startup_dur)

        default_startup_spd = getattr(config, "LINE_STARTUP_SPEED", 55)
        self.startup_speed = int(startup_speed if startup_speed is not None else default_startup_spd)
        self.start_ticks = 0

        default_lost_dur = getattr(config, "LINE_LOST_TIMEOUT_MS", 1500)
        self.lost_line_timeout_ms = int(lost_line_timeout_ms if lost_line_timeout_ms is not None else default_lost_dur)
        self.lost_line_start_time = 0

        self.auto_stop_on_cross = auto_stop_on_cross
        self.stop_hold_ms = stop_hold_ms

        # Trạng thái vận hành: Mặc định TẮT (chờ ấn Bắt đầu trên Web)
        self.is_active = False
        self.last_action = "STANDBY"

        # Các biến trạng thái của thuật toán PID
        self.current_error = 0.0
        self.prev_error = 0.0
        self.last_valid_error = 0.0
        self.integral = 0.0
        self.pid_output = 0.0
        self.both_black_start_time = 0

    def reset_pid(self):
        """Đặt lại toàn bộ các thanh ghi trạng thái PID về 0."""
        self.current_error = 0.0
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
        self.last_action = "STARTUP_55"
        # 1.5s đầu chạy với tốc độ cơ sở khởi hành (55%) để thắng ma sát nghỉ
        init_speed = self.startup_speed if self.startup_duration_ms > 0 else self.base_speed
        self.motor.set_differential(init_speed, init_speed)
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
        self.base_speed = max(20, min(85, int(speed)))

    def set_pid(self, kp=None, ki=None, kd=None):
        """Cập nhật nóng các hệ số Kp, Ki, Kd."""
        if kp is not None:
            self.kp = float(kp)
        if ki is not None:
            self.ki = float(ki)
        if kd is not None:
            self.kd = float(kd)
        print(f"[LineTracker PID] ⚙️ Cập nhật PID: Kp={self.kp}, Ki={self.ki}, Kd={self.kd}")

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

        # Bước 1: Tính sai số vị trí e in [-4.0, +4.0]
        error, mode = self._compute_error(sensors)

        # Bước 2: Xử lý trường hợp mất line hoàn toàn (00000)
        # Yêu cầu: Tiếp tục chạy THẲNG với tốc độ cơ sở trong 1.5s, sau đó phanh tốc độ về 0
        if mode == "LOST_LINE":
            if self.lost_line_start_time == 0:
                self.lost_line_start_time = now_ms

            # Kiểm tra thời gian mất line (1.5s = lost_line_timeout_ms)
            if time.ticks_diff(now_ms, self.lost_line_start_time) >= self.lost_line_timeout_ms:
                self.stop()
                self.last_action = "LOST_STOPPED"
                print(f"[LineTracker PD] ⏹ MẤT LINE QUÁ {self.lost_line_timeout_ms}ms -> ĐÃ PHANH DỪNG XE HOÀN TOÀN!")
                return (0, 0, "LOST_STOPPED")

            # Trong 1.5s đầu mất vạch: Giữ xe chạy THẲNG với tốc độ cơ sở (không rẽ, không giữ trạng thái cũ)
            self.integral = 0.0
            self.prev_error = 0.0
            self.current_error = 0.0
            self.pid_output = 0.0
            self.last_action = "LOST_STRAIGHT"
            self.motor.set_differential(current_base, current_base)
            return (current_base, current_base, "LOST_STRAIGHT")
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
                    print("[LineTracker PD] 🏁 Đã dừng tại vạch đích (11111).")
                    return (0, 0, "STOPPED_AT_MARK")
            # Đi thẳng ổn định qua giao lộ theo tốc độ hiện tại
            self.integral = 0.0
            self.prev_error = 0.0
            self.current_error = 0.0
            self.pid_output = 0.0
            self.last_action = "STARTUP_CROSS" if is_startup else "CROSS_LINE"
            self.motor.set_differential(current_base, current_base)
            return (current_base, current_base, self.last_action)
        else:
            self.both_black_start_time = 0

        # Bước 4: Tính toán 3 thành phần P - I - D (Thuần PD khi Ki = 0)
        # 4.1. Thành phần Tỷ lệ (P)
        p_term = self.kp * error

        # 4.2. Thành phần Tích phân (I) - Khi Ki = 0.0, triệt tiêu hoàn toàn thành phần I
        if self.ki == 0.0:
            self.integral = 0.0
            i_term = 0.0
        else:
            if error == 0.0 or (error * self.prev_error < 0):
                self.integral = 0.0
            else:
                self.integral = max(-20.0, min(20.0, self.integral + error))
            i_term = self.ki * self.integral

        # 4.3. Thành phần Đạo hàm (D) giảm chấn
        derivative = error - self.prev_error
        d_term = self.kd * derivative

        # Lưu trạng thái sai số cho chu kỳ tiếp theo
        self.prev_error = error
        self.current_error = error

        # Hệ số co giãn theo tốc độ cơ sở hiện tại
        speed_scale = current_base / 32.0
        pid_val = (p_term + i_term + d_term) * speed_scale
        self.pid_output = round(pid_val, 2)

        # Bước 5: Quy đổi ra tốc độ 2 bánh Trái / Phải theo current_base
        # Khi error < 0 (vạch bên trái) -> pid_val < 0 -> speed_l giảm, speed_r tăng -> Rẽ Trái
        # Khi error > 0 (vạch bên phải) -> pid_val > 0 -> speed_l tăng, speed_r giảm -> Rẽ Phải
        speed_l = int(round(current_base + pid_val))
        speed_r = int(round(current_base - pid_val))

        # Bước 6: Giới hạn biên độ PWM thông minh (Chống kẹt vùng chết mô-men xoắn motor)
        min_gentle = 25 if is_startup else 20
        if abs(error) >= 4.0:
            # Cua gắt 90 độ: cho phép bánh trong phanh/lùi nhẹ tới -20% để xoay tâm nhanh
            speed_l = max(-20, min(100, speed_l))
            speed_r = max(-20, min(100, speed_r))
        elif abs(error) >= 3.0:
            # Cua vừa: cho phép bánh trong giảm xuống tối thiểu 10%
            speed_l = max(10, min(100, speed_l))
            speed_r = max(10, min(100, speed_r))
        else:
            # Lệch nhẹ (error trong [-2.0 .. +2.0]): Bánh trong luôn giữ >= min_gentle
            # Tránh rớt vào vùng chết motor (stall zone) khiến xe bị giật ngoắt văng khỏi line
            speed_l = max(min_gentle, min(100, speed_l))
            speed_r = max(min_gentle, min(100, speed_r))

        # Gán nhãn hành động phục vụ Telemetry hiển thị trên Web
        if error == 0.0:
            act_name = "STRAIGHT"
        elif error <= -3.0:
            act_name = "SHARP_LEFT"
        elif error < 0.0:
            act_name = "STEER_LEFT"
        elif error >= 3.0:
            act_name = "SHARP_RIGHT"
        else:
            act_name = "STEER_RIGHT"

        self.last_action = f"STARTUP_{act_name}" if is_startup else act_name

        # Bước 7: Xuất xung PWM xuống mạch công suất TB6612FNG
        self.motor.set_differential(speed_l, speed_r)
        return (speed_l, speed_r, self.last_action)

