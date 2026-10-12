# ==============================================================================
# LINE_SENSOR.PY – MODULE QUẢN LÝ CẢM BIẾN DÒ LINE QUANG HỌC TCRT5000 5 MẮT
# Kiến trúc: Lập trình Hướng Đối Tượng (OOP) trên MicroPython ESP32
# ==============================================================================

from machine import Pin

class LineFollowerSensor:
    """
    Lớp điều khiển đọc tín hiệu từ cụm cảm biến dò line quang học TCRT5000 5 mắt (5-Channel Array HW-871).
    
    Phân bổ chân GPIO (mạng bên phải bảng mở rộng 30-pin):
    - Mắt 1 (S1): Ngoài cùng bên Trái  -> GPIO 21
    - Mắt 2 (S2): Giữa bên Trái        -> GPIO 19
    - Mắt 3 (S3): Trung tâm            -> GPIO 18
    - Mắt 4 (S4): Giữa bên Phải        -> GPIO 5
    - Mắt 5 (S5): Ngoài cùng bên Phải  -> GPIO 17
    
    Đặc tính phần cứng module HW-871 (Active-Low):
    - Gặp VẠCH ĐEN (Hấp thụ tia hồng ngoại):
        -> Đèn LED trên module TẮT.
        -> Chân DO xuất mức 0 (LOW, 0V).
        -> Module chuẩn hóa logic phần mềm: 1 (ĐEN / TRUE).
    - Gặp NỀN TRẮNG (Phản xạ tia hồng ngoại):
        -> Đèn LED trên module SÁNG.
        -> Chân DO xuất mức 1 (HIGH, 3.3V/5V).
        -> Module chuẩn hóa logic phần mềm: 0 (TRẮNG / FALSE).
    """

    def __init__(self, s1_pin=21, s2_pin=19, s3_pin=18, s4_pin=5, s5_pin=17, left_pin=None, right_pin=None, active_low=True, **kwargs):
        """
        Khởi tạo cụm cảm biến TCRT5000 5 mắt với các chân GPIO được chỉ định.
        :param active_low: True khi phần cứng xuất mức 0 ở vạch đen (chuẩn bo HW-871)
        """
        # Hỗ trợ tương thích ngược nếu truyền qua left_pin / right_pin cũ
        if left_pin is not None:
            s2_pin = left_pin
        if right_pin is not None:
            s4_pin = right_pin

        self.active_low = active_low

        self.pin_s1_num = s1_pin
        self.pin_s2_num = s2_pin
        self.pin_s3_num = s3_pin
        self.pin_s4_num = s4_pin
        self.pin_s5_num = s5_pin
        self.pins_num = [s1_pin, s2_pin, s3_pin, s4_pin, s5_pin]

        # Tương thích ngược với mã nguồn 2 mắt
        self.pin_left_num = s2_pin
        self.pin_right_num = s4_pin

        # Khởi tạo đối tượng GPIO Pin input
        self.sensor_s1 = Pin(s1_pin, Pin.IN) if s1_pin is not None else None
        self.sensor_s2 = Pin(s2_pin, Pin.IN) if s2_pin is not None else None
        self.sensor_s3 = Pin(s3_pin, Pin.IN) if s3_pin is not None else None
        self.sensor_s4 = Pin(s4_pin, Pin.IN) if s4_pin is not None else None
        self.sensor_s5 = Pin(s5_pin, Pin.IN) if s5_pin is not None else None

        self.sensors = [self.sensor_s1, self.sensor_s2, self.sensor_s3, self.sensor_s4, self.sensor_s5]

        # Tương thích ngược
        self.sensor_left = self.sensor_s2
        self.sensor_right = self.sensor_s4

        self.last_valid_error = 0

    def read_gpio_raw(self, index):
        """Đọc mức logic điện áp vật lý trên chân GPIO (0 hoặc 1)."""
        if 0 <= index < len(self.sensors):
            sensor = self.sensors[index]
            return sensor.value() if sensor is not None else 1
        return 1

    def read_raw(self, index):
        """
        Đọc trạng thái chuẩn hóa của mắt cảm biến thứ index:
        :return: 1 nếu là VẠCH ĐEN, 0 nếu là NỀN TRẮNG
        """
        if 0 <= index < len(self.sensors):
            sensor = self.sensors[index]
            if sensor is None:
                return 0
            val = sensor.value()
            # Bo HW-871: Đèn tắt trên vạch đen xuất GPIO=0 -> Quy đổi thành 1 (ĐEN)
            return (1 if val == 0 else 0) if self.active_low else (1 if val == 1 else 0)
        return 0

    def read_all_raw(self):
        """
        Đọc đồng thời toàn bộ 5 mắt cảm biến đã chuẩn hóa:
        :return: Danh sách 5 số nguyên [s1, s2, s3, s4, s5]
                 1 = VẠCH ĐEN (Đèn trên module tắt)
                 0 = NỀN TRẮNG (Đèn trên module sáng)
        """
        if self.active_low:
            return [
                1 if (self.sensor_s1.value() == 0) else 0 if self.sensor_s1 else 0,
                1 if (self.sensor_s2.value() == 0) else 0 if self.sensor_s2 else 0,
                1 if (self.sensor_s3.value() == 0) else 0 if self.sensor_s3 else 0,
                1 if (self.sensor_s4.value() == 0) else 0 if self.sensor_s4 else 0,
                1 if (self.sensor_s5.value() == 0) else 0 if self.sensor_s5 else 0,
            ]
        else:
            return [
                self.sensor_s1.value() if self.sensor_s1 else 0,
                self.sensor_s2.value() if self.sensor_s2 else 0,
                self.sensor_s3.value() if self.sensor_s3 else 0,
                self.sensor_s4.value() if self.sensor_s4 else 0,
                self.sensor_s5.value() if self.sensor_s5 else 0,
            ]

    def read_raw_left(self):
        """Đọc mức logic mắt trái chuẩn hóa (1: ĐEN, 0: TRẮNG - tương thích ngược Mắt S2)."""
        if self.sensor_s2 is None:
            return 0
        val = self.sensor_s2.value()
        return (1 if val == 0 else 0) if self.active_low else val

    def read_raw_right(self):
        """Đọc mức logic mắt phải chuẩn hóa (1: ĐEN, 0: TRẮNG - tương thích ngược Mắt S4)."""
        if self.sensor_s4 is None:
            return 0
        val = self.sensor_s4.value()
        return (1 if val == 0 else 0) if self.active_low else val

    def is_left_on_black(self):
        """Kiểm tra mắt trái có đang chạm vạch đen."""
        return self.read_raw_left() == 1

    def is_right_on_black(self):
        """Kiểm tra mắt phải có đang chạm vạch đen."""
        return self.read_raw_right() == 1

    def read_bitmask(self, raw_list=None):
        """
        Chuyển trạng thái 5 mắt sang bitmask 5-bit (0b00000 -> 0b11111: 0..31).
        Bit 4: S1, Bit 3: S2, Bit 2: S3, Bit 1: S4, Bit 0: S5.
        """
        if raw_list is None:
            raw_list = self.read_all_raw()
        return (raw_list[0] << 4) | (raw_list[1] << 3) | (raw_list[2] << 2) | (raw_list[3] << 1) | raw_list[4]

    def read_bin_str(self, raw_list=None):
        """Trả về chuỗi 5 ký tự nhị phân (ví dụ: '00100')."""
        if raw_list is None:
            raw_list = self.read_all_raw()
        return "".join(str(v) for v in raw_list)

    def calculate_error(self, raw_list=None):
        """
        Tính toán sai số lệch tâm (-4 đến +4) phục vụ điều khiển PID hoặc vi sai:
        - -4: Lệch phải cực đại (chỉ S1 đen) -> Cần bẻ lái trái hết cỡ (cua 90°)
        - -3: S1 và S2 đen -> Cua trái mạnh
        - -2: S2 đen -> Bẻ lái trái vừa
        - -1: S2 và S3 đen -> Nhích nhẹ sang trái
        -  0: S3 đen (chính giữa) -> Đi thẳng chuẩn tim đường
        - +1: S3 và S4 đen -> Nhích nhẹ sang phải
        - +2: S4 đen -> Bẻ lái phải vừa
        - +3: S4 và S5 đen -> Cua phải mạnh
        - +4: Lệch trái cực đại (chỉ S5 đen) -> Cần bẻ lái phải hết cỡ (cua 90°)
        """
        if raw_list is None:
            raw_list = self.read_all_raw()

        s1, s2, s3, s4, s5 = raw_list
        bitmask = (s1 << 4) | (s2 << 3) | (s3 << 2) | (s4 << 1) | s5

        # Bảng tra nhanh các trạng thái chuẩn
        MAP_ERROR = {
            0b10000: -4,
            0b11000: -3,
            0b01000: -2,
            0b01100: -1,
            0b00100:  0,
            0b00110:  1,
            0b00010:  2,
            0b00011:  3,
            0b00001:  4,
            0b11111:  0,  # Ngã tư / Vạch dừng
            0b01110:  0,  # Vạch đen dày ở giữa
            0b11100: -2,
            0b00111:  2,
        }

        if bitmask in MAP_ERROR:
            err = MAP_ERROR[bitmask]
            self.last_valid_error = err
            return err

        # Mất line hoàn toàn (00000): giữ sai số hợp lệ gần nhất
        if bitmask == 0b00000:
            return self.last_valid_error

        # Trường hợp tổ hợp khác: tính trung bình có trọng số vị trí
        total = s1 + s2 + s3 + s4 + s5
        if total > 0:
            weighted = ((-4 * s1) + (-2 * s2) + (0 * s3) + (2 * s4) + (4 * s5)) / total
            err = int(weighted + 0.5) if weighted >= 0 else int(weighted - 0.5)
            err = max(-4, min(4, err))
            self.last_valid_error = err
            return err

        return self.last_valid_error

    def read_status(self):
        """
        Đọc và trả về từ điển trạng thái chi tiết của cụm 5 mắt TCRT5000.
        Cung cấp dữ liệu phục vụ Telemetry Web Dashboard, tương thích 100% với giao diện người dùng.
        """
        raw = self.read_all_raw()
        bm = self.read_bitmask(raw)
        err = self.calculate_error(raw)
        bin_str = self.read_bin_str(raw)

        return {
            "array": raw,
            "s1": raw[0],
            "s2": raw[1],
            "s3": raw[2],
            "s4": raw[3],
            "s5": raw[4],
            "bitmask": bm,
            "bin_str": bin_str,
            "error": err,
            "left": {
                "pin": self.pin_s2_num,
                "raw": raw[1],
                "is_black": (raw[1] == 1),
                "text": "DEN" if raw[1] == 1 else "TRANG",
                "voltage": 3.3 if raw[1] == 1 else 0.0
            },
            "right": {
                "pin": self.pin_s4_num,
                "raw": raw[3],
                "is_black": (raw[3] == 1),
                "text": "DEN" if raw[3] == 1 else "TRANG",
                "voltage": 3.3 if raw[3] == 1 else 0.0
            }
        }
