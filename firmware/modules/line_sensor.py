# ==============================================================================
# LINE_SENSOR.PY – MODULE QUẢN LÝ CẢM BIẾN DÒ LINE QUANG HỌC TCRT5000
# Kiến trúc: Lập trình Hướng Đối Tượng (OOP) trên MicroPython ESP32
# ==============================================================================

from machine import Pin

class LineFollowerSensor:
    """
    Lớp điều khiển đọc tín hiệu từ cụm cảm biến dò line quang học TCRT5000.
    
    Nguyên lý hoạt động (Ngõ ra DO - Digital Output):
    - Gặp NỀN TRẮNG (Phản xạ hồng ngoại mạnh):
        -> Đèn LED trên module SÁNG.
        -> Mức logic đọc về = 0 (LOW), điện áp xấp xỉ 0.0V.
    - Gặp VẠCH ĐEN (Hấp thụ ánh sáng, không phản xạ):
        -> Đèn LED trên module TẮT.
        -> Mức logic đọc về = 1 (HIGH), điện áp xấp xỉ 3.3V.
    """

    def __init__(self, left_pin=19, right_pin=21):
        """
        Khởi tạo cảm biến với chân GPIO được chỉ định.
        :param left_pin: Chân GPIO nối với DO của Mắt Trái (Mặc định 19)
        :param right_pin: Chân GPIO nối với DO của Mắt Phải (Mặc định 21)
        """
        self.pin_left_num = left_pin
        self.pin_right_num = right_pin

        self.sensor_left = Pin(left_pin, Pin.IN) if left_pin is not None else None
        self.sensor_right = Pin(right_pin, Pin.IN) if right_pin is not None else None

    def read_raw_left(self):
        """Đọc mức logic thô từ mắt trái (0: LOW / 1: HIGH)."""
        if self.sensor_left is None:
            return None
        return self.sensor_left.value()

    def read_raw_right(self):
        """Đọc mức logic thô từ mắt phải (0: LOW / 1: HIGH)."""
        if self.sensor_right is None:
            return None
        return self.sensor_right.value()

    def is_left_on_black(self):
        """Kiểm tra mắt trái có đang chạm vạch đen hay không."""
        val = self.read_raw_left()
        return val == 1 if val is not None else False

    def is_right_on_black(self):
        """Kiểm tra mắt phải có đang chạm vạch đen hay không."""
        val = self.read_raw_right()
        return val == 1 if val is not None else False

    def read_status(self):
        """
        Đọc và trả về từ điển trạng thái đầy đủ của cả 2 mắt dò line.
        :return: dict chứa dữ liệu logic, vạch đen/trắng và điện áp
        """
        raw_l = self.read_raw_left()
        raw_r = self.read_raw_right()

        return {
            "left": {
                "pin": self.pin_left_num,
                "raw": raw_l,
                "is_black": (raw_l == 1) if raw_l is not None else None,
                "text": "DEN" if raw_l == 1 else "TRANG",
                "voltage": 3.3 if raw_l == 1 else 0.0
            },
            "right": {
                "pin": self.pin_right_num,
                "raw": raw_r,
                "is_black": (raw_r == 1) if raw_r is not None else None,
                "text": "DEN" if raw_r == 1 else "TRANG",
                "voltage": 3.3 if raw_r == 1 else 0.0
            }
        }
