import sys
import serial
import time
import os
from pathlib import Path

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 'COM3'
BAUD = 115200

def send_raw(ser, data, wait=0.1):
    ser.write(data)
    time.sleep(wait)

def enter_raw_repl(ser):
    # Gui Ctrl+C nhieu lan de ngat chuong trinh dang chay tren ESP32
    for _ in range(5):
        ser.write(b'\r\x03')
        time.sleep(0.15)
    ser.read_all()
    
    # Gui Ctrl+A vao Raw REPL
    for attempt in range(3):
        ser.write(b'\r\x01')
        time.sleep(0.3)
        resp = ser.read_all()
        if b'raw REPL' in resp:
            print("[OK] Đã vào chế độ Raw REPL thành công.")
            return True
        ser.write(b'\r\x02\r\x03')
        time.sleep(0.2)
    return False

def exec_raw(ser, code_str):
    payload = code_str.encode('utf-8') + b'\x04'
    ser.write(payload)
    # Doi phan hoi
    time.sleep(0.3)
    out = b""
    while ser.in_waiting > 0 or not out:
        chunk = ser.read(ser.in_waiting or 1)
        if not chunk:
            break
        out += chunk
        if b'\x04' in out:
            break
        time.sleep(0.05)
    return out

def upload_file(ser, local_path, remote_path):
    print(f"-> Đang nạp: {remote_path} ...", end=" ")
    content = Path(local_path).read_bytes()
    # Tao file tren ESP32 bang MicroPython
    setup_code = f"f = open('{remote_path}', 'wb')\n"
    exec_raw(ser, setup_code)
    
    # Ghi theo tung chunk 256 bytes
    chunk_size = 256
    for i in range(0, len(content), chunk_size):
        chunk = content[i:i+chunk_size]
        exec_raw(ser, f"f.write({repr(chunk)})\n")
    
    exec_raw(ser, "f.close()\n")
    print("XONG!")

def main():
    print(f"[Serial] Kết nối tới {PORT}...")
    ser = serial.Serial(PORT, BAUD, timeout=1)
    ser.dtr = False
    ser.rts = False
    time.sleep(1.5)
    
    if not enter_raw_repl(ser):
        print("[ERR] Không thể vào Raw REPL trên ESP32!")
        ser.close()
        return
    
    # Tạo thư mục modules nếu chưa có
    exec_raw(ser, "import os\ntry: os.mkdir('modules')\nexcept: pass\n")
    
    # Nạp các file vào ESP32
    base = Path("D:/ki5/line_follower_robot_arm/firmware")
    upload_file(ser, base / "config.py", "config.py")
    upload_file(ser, base / "modules" / "wifi_client.py", "modules/wifi_client.py")
    upload_file(ser, base / "modules" / "ultrasonic.py", "modules/ultrasonic.py")
    upload_file(ser, base / "boot.py", "boot.py")
    upload_file(ser, base / "main.py", "main.py")
    
    print("\n[OK] Đã nạp đầy đủ toàn bộ code!")
    print("[ESP32] Đang thực hiện Soft Reset để khởi động code mới...\n" + "="*50)
    
    # Gui Ctrl+D de Soft Reset chay main.py
    send_raw(ser, b'\x04', 0.5)
    # Thoat ve Normal REPL Ctrl+B de doc log
    send_raw(ser, b'\x02', 0.2)
    
    # Doc log khoi dong cua ESP32 trong 6 giay
    start = time.time()
    while time.time() - start < 8:
        if ser.in_waiting > 0:
            line = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
            print(line, end="")
        time.sleep(0.1)
        
    ser.close()

if __name__ == "__main__":
    main()
