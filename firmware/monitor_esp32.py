import sys
import serial
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 'COM3'
BAUD = 115200

def main():
    print(f"[*] Đang kết nối tới cổng {PORT} (Baudrate: {BAUD})...")
    try:
        ser = serial.Serial(PORT, BAUD, timeout=1)
        ser.dtr = False
        ser.rts = False
        print("[OK] Đã kết nối thành công với ESP32!\n")
        print("=" * 65)
        print("💡 HƯỚNG DẪN THỬ NGHIỆM:")
        print("   - Đưa bàn tay hoặc quyển sách lại gần cảm biến (< 10cm) để xem cảnh báo.")
        print("   - Đưa ra xa từ từ để kiểm tra độ nhạy và độ chính xác đo cm.")
        print("   - Nhấn tổ hợp phím Ctrl + C để thoát màn hình theo dõi.")
        print("=" * 65 + "\n")

        while True:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode('utf-8', errors='ignore').strip()
            if not line:
                continue
            
            # Lọc và hiển thị dòng dữ liệu đo khoảng cách
            if "[KHOANG CACH]" in line or "Khoảng cách" in line:
                if "CANH BAO" in line or "CẢNH BÁO" in line:
                    print(f"\033[91m--> {line}\033[0m")
                else:
                    print(f"    {line}")
            elif not line.startswith("TELEMETRY:") and not line.startswith("HEARTBEAT:"):
                print(line)

    except KeyboardInterrupt:
        print("\n[*] Đã dừng màn hình theo dõi Serial.")
    except Exception as e:
        print(f"\n[Lỗi kết nối cổng Serial]: {e}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    main()
