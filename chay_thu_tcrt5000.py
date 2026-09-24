# ==============================================================================
# CHAY_THU_TCRT5000.PY – CHƯƠNG TRÌNH KIỂM THỬ TRỰC TIẾP CẢM BIẾN DÒ LINE TCRT5000
# Kết nối qua cổng Serial COM3 với board ESP32
# ==============================================================================

import sys
import time
import os

# Thiết lập bảng mã UTF-8 cho Windows Terminal để hiển thị tiếng Việt & biểu tượng emoji
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("\n[LỖI THIẾU THƯ VIỆN] Chưa cài đặt pyserial!")
    print("Vui lòng chạy lệnh: pip install pyserial\n")
    sys.exit(1)

PORT = 'COM3'
BAUD = 115200

# Đoạn mã MicroPython chạy trên chip ESP32 để đọc nhanh 2 chân GPIO 19 và GPIO 21
ESP32_TEST_CODE = """
from machine import Pin
import time
import sys

pin_l = Pin(19, Pin.IN)
pin_r = Pin(21, Pin.IN)

print("READY_TCRT")

try:
    while True:
        vl = pin_l.value()
        vr = pin_r.value()
        print("TCRT:" + str(vl) + ":" + str(vr))
        time.sleep(0.1)
except KeyboardInterrupt:
    print("STOPPED")
"""

def find_com_ports():
    """Liệt kê các cổng COM hiện có trên máy tính."""
    return [p.device for p in serial.tools.list_ports.comports()]

def run_test():
    print("\n" + "=" * 68)
    print("      CHƯƠNG TRÌNH CHẠY THỬ CẢM BIẾN DÒ LINE TCRT5000 (COM3)")
    print("=" * 68)

    available_ports = find_com_ports()
    print(f"[*] Các cổng COM đang có trên máy tính: {available_ports if available_ports else 'Chưa phát hiện cổng nào'}")

    if PORT not in available_ports:
        print(f"\n[⚠️ CẢNH BÁO] Không tìm thấy cổng '{PORT}'!")
        print("💡 Hãy kiểm tra:")
        print("   1. Bạn đã cắm cáp USB nối ESP32 với máy tính chưa?")
        print("   2. Cáp USB phải cắm thẳng vào cổng micro-USB/Type-C trên thân ESP32.")
        print(f"   3. Nếu máy nhận cổng COM khác ({available_ports}), vui lòng đổi PORT trong file này.\n")
        return

    print(f"[*] Đang mở cổng {PORT} với tốc độ Baud {BAUD}...")
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        ser.dtr = False
        ser.rts = False
        time.sleep(0.5)
    except Exception as e:
        print(f"\n[❌ LỖI] Không thể mở cổng {PORT}: {e}")
        print("💡 Cổng có thể đang bị chiếm dụng bởi app khác (Thonny, Python server, Serial Monitor).")
        print("   Hãy đóng các cửa sổ đó rồi chạy lại file này!\n")
        return

    print("[*] Đang kết nối chế độ Raw REPL trên ESP32...")
    try:
        # Gửi Ctrl+C ngắt tiến trình đang chạy trên ESP32
        for _ in range(3):
            ser.write(b'\r\x03')
            time.sleep(0.15)
        
        # Gửi Ctrl+A để vào Raw REPL của MicroPython
        ser.write(b'\r\x01')
        time.sleep(0.3)
        resp = ser.read_all()
        
        if b'raw REPL' not in resp:
            # Thử gửi lại 1 lần nữa
            ser.write(b'\r\x03\r\x01')
            time.sleep(0.3)
            resp = ser.read_all()

        print("[OK] Đã kết nối thành công với MicroPython trên ESP32!")
        print("-" * 68)
        print("💡 HƯỚNG DẪN KIỂM TRA ĐỘ NHẠY CẢM BIẾN:")
        print("   - Đưa tờ giấy trắng lại gần mắt (~1cm): Đèn LED sáng  -> [🟢 NỀN TRẮNG]")
        print("   - Đưa vào vạch băng dính đen        : Đèn LED tắt    -> [🔴 VẠCH ĐEN]")
        print("   - Nếu chưa nhạy: Dùng tuốc nơ vít vặn nhẹ biến trở xanh trên module.")
        print("   - Nhấn phím Ctrl + C để dừng kiểm tra.")
        print("-" * 68 + "\n")

        # Nạp và thực thi đoạn mã đọc cảm biến
        payload = ESP32_TEST_CODE.encode('utf-8') + b'\x04'
        ser.write(payload)

        # Chờ ESP32 phản hồi
        last_l = None
        last_r = None
        sample_count = 0

        while True:
            raw_line = ser.readline()
            if not raw_line:
                continue

            text = raw_line.decode('utf-8', errors='ignore').strip()
            
            if text.startswith("TCRT:"):
                parts = text.split(":")
                if len(parts) >= 3:
                    try:
                        vl = int(parts[1])
                        vr = int(parts[2])
                    except ValueError:
                        continue

                    # Định dạng hiển thị trực quan
                    tag_l = "🔴 VẠCH ĐEN  (1 / 3.3V)" if vl == 1 else "🟢 NỀN TRẮNG (0 / 0.0V)"
                    tag_r = "🔴 VẠCH ĐEN  (1 / 3.3V)" if vr == 1 else "🟢 NỀN TRẮNG (0 / 0.0V)"

                    # Đổi màu nổi bật trong terminal ANSI
                    color_l = "\033[91m" if vl == 1 else "\033[92m"
                    color_r = "\033[91m" if vr == 1 else "\033[92m"
                    reset_c = "\033[0m"

                    sample_count += 1
                    status_line = (
                        f"  [Mắt Trái - D19]: {color_l}{tag_l}{reset_c}  |  "
                        f"[Mắt Phải - D21]: {color_r}{tag_r}{reset_c}"
                    )

                    # In ra màn hình console (in đè hoặc in dòng)
                    print(f"[{sample_count:04d}] {status_line}")

            elif "OK" in text or "READY" in text:
                continue
            elif "Traceback" in text or "Error" in text:
                print(f"[ESP32 Log]: {text}")

    except KeyboardInterrupt:
        print("\n\n[*] Đang dừng kiểm thử và khôi phục ESP32...")
        try:
            ser.write(b'\r\x03')  # Dừng vòng lặp trên ESP32
            time.sleep(0.2)
            ser.write(b'\r\x02')  # Thoát về Normal REPL
            time.sleep(0.2)
            ser.write(b'\r\x04')  # Soft reset để ESP32 chạy lại bình thường
        except Exception:
            pass
        print("[OK] Đã hoàn thành kiểm thử. ESP32 đã được khôi phục trạng thái sẵn sàng!")
    except Exception as e:
        print(f"\n[Lỗi kết nối Serial]: {e}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    run_test()
