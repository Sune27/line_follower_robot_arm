# ==============================================================================
# TEST_TCRT5000_ESP32.PY – CHƯƠNG TRÌNH TEST CẢM BIẾN DÒ LINE TRỰC TIẾP TRÊN ESP32
# Chạy trên MicroPython: Đọc mức tín hiệu GPIO 19 (Mắt Trái) và GPIO 21 (Mắt Phải)
# ==============================================================================

from machine import Pin
import time

# Khởi tạo chân đọc tín hiệu DO từ cảm biến TCRT5000
pin_left = Pin(19, Pin.IN)
pin_right = Pin(21, Pin.IN)

print("\n" + "=" * 62)
print("   KIỂM THỬ HOẠT ĐỘNG CẢM BIẾN DÒ LINE TCRT5000")
print("   Mắt Trái: GPIO 19  |  Mắt Phải: GPIO 21")
print("=" * 62)
print("💡 Quy tắc logic module TCRT5000:")
print("   - Đèn module SÁNG  -> Nền Trắng  (Logic 0 / LOW  / ~0.0V)")
print("   - Đèn module TẮT   -> Vạch Đen   (Logic 1 / HIGH / ~3.3V)")
print("-" * 62)

last_state = (-1, -1)

while True:
    val_l = pin_left.value()
    val_r = pin_right.value()
    
    current_state = (val_l, val_r)
    
    # Chỉ in hoặc in định kỳ để người dùng theo dõi trực tiếp
    tag_l = "[🔴 VẠCH ĐEN]" if val_l == 1 else "[🟢 NỀN TRẮNG]"
    tag_r = "[🔴 VẠCH ĐEN]" if val_r == 1 else "[🟢 NỀN TRẮNG]"
    
    print(f"--> Mắt Trái (D19): {tag_l} ({val_l})  |  Mắt Phải (D21): {tag_r} ({val_r})")
    
    time.sleep(0.2)
