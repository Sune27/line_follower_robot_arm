# ==============================================================================
# MOTOR_DRIVER.PY – MODULE ĐIỀU KHIỂN ĐỘNG CƠ TB6612FNG BẰNG BĂM XUNG PWM
# Tương thích MicroPython ESP32: Tần số 1000Hz, dải điều tốc 0 - 100%
# ==============================================================================

from machine import Pin, PWM

class MotorDriver:
    def __init__(self, pin_ain1=13, pin_ain2=12, pin_bin1=27, pin_bin2=26, freq=1000):
        self.freq = freq
        
        # Bánh Trái (Motor A: AIN1, AIN2)
        self.pwm_a1 = PWM(Pin(pin_ain1), freq=self.freq, duty=0)
        self.pwm_a2 = PWM(Pin(pin_ain2), freq=self.freq, duty=0)
        
        # Bánh Phải (Motor B: BIN1, BIN2)
        self.pwm_b1 = PWM(Pin(pin_bin1), freq=self.freq, duty=0)
        self.pwm_b2 = PWM(Pin(pin_bin2), freq=self.freq, duty=0)
        
        self.current_speed_left = 0
        self.current_speed_right = 0
        self.stop()

    def _set_duty(self, pwm_pin, duty_val):
        """Hỗ trợ cả duty() 10-bit (0-1023) và duty_u16() (0-65535) tương thích mọi bản MicroPython"""
        duty_val = max(0, min(1023, int(duty_val)))
        if hasattr(pwm_pin, 'duty'):
            pwm_pin.duty(duty_val)
        elif hasattr(pwm_pin, 'duty_u16'):
            pwm_pin.duty_u16(int(duty_val * 65535 / 1023))

    def set_differential(self, left_percent, right_percent):
        """
        Điều khiển tốc độ độc lập 2 bánh:
        -100% đến +100%: Dương là Tiến, Âm là Lùi, 0 là Dừng.
        """
        left_percent = max(-100, min(100, int(left_percent)))
        right_percent = max(-100, min(100, int(right_percent)))
        
        self.current_speed_left = left_percent
        self.current_speed_right = right_percent
        
        # --- BÁNH TRÁI (MOTOR A) ---
        duty_a = int(abs(left_percent) * 1023 / 100)
        if left_percent > 0:
            # Quay TIẾN (CW)
            self._set_duty(self.pwm_a2, 0)
            self._set_duty(self.pwm_a1, duty_a)
        elif left_percent < 0:
            # Quay LÙI (CCW)
            self._set_duty(self.pwm_a1, 0)
            self._set_duty(self.pwm_a2, duty_a)
        else:
            # DỪNG
            self._set_duty(self.pwm_a1, 0)
            self._set_duty(self.pwm_a2, 0)
            
        # --- BÁNH PHẢI (MOTOR B) ---
        duty_b = int(abs(right_percent) * 1023 / 100)
        if right_percent > 0:
            # Quay TIẾN (CW)
            self._set_duty(self.pwm_b2, 0)
            self._set_duty(self.pwm_b1, duty_b)
        elif right_percent < 0:
            # Quay LÙI (CCW)
            self._set_duty(self.pwm_b1, 0)
            self._set_duty(self.pwm_b2, duty_b)
        else:
            # DỪNG
            self._set_duty(self.pwm_b1, 0)
            self._set_duty(self.pwm_b2, 0)

    def set_speed(self, speed_percent):
        """Cài đặt cùng một mức tốc độ cho cả 2 bánh (Tiến / Dừng / Lùi)"""
        self.set_differential(speed_percent, speed_percent)

    def stop(self):
        """Dừng khẩn cấp toàn bộ 2 động cơ (PWM = 0)"""
        self.set_differential(0, 0)
