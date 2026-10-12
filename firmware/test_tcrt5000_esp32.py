# ==============================================================================
# TEST_TCRT5000_ESP32.PY – CHƯƠNG TRÌNH TEST CẢM BIẾN DÒ LINE 5 MẮT TRÊN ESP32
# Chạy trên MicroPython: Đọc mức tín hiệu 5 chân liền kề bên Phải:
#   S1 (D21), S2 (D19), S3 (D18), S4 (D5), S5 (D17)
# ==============================================================================

from machine import Pin
import time

# Khởi tạo 5 chân đọc tín hiệu DO từ mảng TCRT5000 (Mạng Bên Phải Shield)
pin_s1 = Pin(21, Pin.IN)  # Ngoài cùng bên Trái
pin_s2 = Pin(19, Pin.IN)  # Giữa Trái
pin_s3 = Pin(18, Pin.IN)  # Chính giữa (Tâm)
pin_s4 = Pin(5, Pin.IN)   # Giữa Phải
pin_s5 = Pin(17, Pin.IN)  # Ngoài cùng bên Phải

print("\n" + "=" * 68)
print("   KIỂM THỬ HOẠT ĐỘNG MẢNG CẢM BIẾN DÒ LINE TCRT5000 (5 MẮT)")
print("   S1: D21 | S2: D19 | S3: D18 (Tâm) | S4: D5 | S5: D17")
print("=" * 68)
print("💡 Quy tắc logic module TCRT5000:")
print("   - Đèn module SÁNG  -> Nền Trắng  (Logic 0 / LOW  / ~0.0V)")
print("   - Đèn module TẮT   -> Vạch Đen   (Logic 1 / HIGH / ~3.3V)")
print("-" * 68)

while True:
    v1 = pin_s1.value()
    v2 = pin_s2.value()
    v3 = pin_s3.value()
    v4 = pin_s4.value()
    v5 = pin_s5.value()
    
    # Ký hiệu trực quan: [█] là vạch đen, [_] là nền trắng
    t1 = "█" if v1 == 1 else "_"
    t2 = "█" if v2 == 1 else "_"
    t3 = "█" if v3 == 1 else "_"
    t4 = "█" if v4 == 1 else "_"
    t5 = "█" if v5 == 1 else "_"
    
    # Tính toán Bitmask
    bitmask = (v1 << 4) | (v2 << 3) | (v3 << 2) | (v4 << 1) | v5
    bin_str = f"{v1}{v2}{v3}{v4}{v5}"
    
    # Nhận diện trạng thái hành vi
    if bin_str == "00100":
        status = "CHÍNH GIỮA (Đi thẳng)"
    elif bin_str in ("01100", "01000"):
        status = "LỆCH PHẢI (Lái nhẹ Trái)"
    elif bin_str in ("11000", "10000"):
        status = "CUA GẮT TRÁI (90°)"
    elif bin_str in ("00110", "00010"):
        status = "LỆCH TRÁI (Lái nhẹ Phải)"
    elif bin_str in ("00011", "00001"):
        status = "CUA GẮT PHẢI (90°)"
    elif bin_str == "11111":
        status = "VẠCH NGANG / NGÃ TƯ"
    elif bin_str == "00000":
        status = "MẤT LINE (Tìm lại)"
    else:
        status = "Đang rà line..."
        
    print(f"[{t1} {t2} {t3} {t4} {t5}] | Bitmask: 0b{bin_str} (0x{bitmask:02X}) | {status}")
    
    time.sleep(0.15)
