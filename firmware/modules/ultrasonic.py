# ==============================================================================
# ULTRASONIC.PY – MODULE CẢM BIẾN SIÊU ÂM RCWL-1601 (OOP - MICROPYTHON)
# ==============================================================================

import time
from machine import Pin, time_pulse_us

class UltrasonicSensor:
    """
    Quản lý cảm biến siêu âm RCWL-1601 / HC-SR04 theo chuẩn OOP.
    Nguyên lý:
      - Phát xung HIGH 10us tại chân Trig.
      - Chân Echo nhận xung phản xạ, đo thời gian t (microgiây).
      - Khoảng cách d = (t * 0.0343) / 2 (cm).
      - Tốc độ âm thanh ~ 343 m/s = 0.0343 cm/us.
    """

    def __init__(self, trig_pin=5, echo_pin=18, timeout_us=30000):
        self.trig = Pin(trig_pin, Pin.OUT)
        self.echo = Pin(echo_pin, Pin.IN)
        self.timeout_us = timeout_us  # 30000us ~ 5 mét (giới hạn an toàn)
        
        # Đưa chân Trig về LOW ban đầu
        self.trig.value(0)
        time.sleep_ms(20)

    def measure_distance(self):
        """
        Đo khoảng cách vật cản (đơn vị: cm).
        Trả về:
          - float: Khoảng cách tính bằng cm (ví dụ: 15.4)
          - -1.0: Nếu vượt quá phạm vi hoặc không bắt được sóng phản xạ (Timeout)
        """
        try:
            # 1. Phát xung Trigger tối thiểu 10us
            self.trig.value(0)
            time.sleep_us(2)
            self.trig.value(1)
            time.sleep_us(10)
            self.trig.value(0)

            # 2. Đo độ rộng xung HIGH trên chân Echo bằng time_pulse_us
            duration = time_pulse_us(self.echo, 1, self.timeout_us)

            # Nếu timeout (duration < 0)
            if duration < 0:
                return -1.0

            # 3. Tính khoảng cách (cm)
            distance = (duration * 0.0343) / 2.0
            return round(distance, 1)

        except Exception:
            return -1.0

    def is_obstacle_detected(self, threshold_cm=10.0):
        """
        Kiểm tra nhanh xem có vật cản trong vùng nguy hiểm không.
        Trả về: True nếu khoảng cách <= threshold_cm và hợp lệ (> 0).
        """
        d = self.measure_distance()
        if 0 < d <= threshold_cm:
            return True, d
        return False, d
