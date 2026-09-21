import sys
import serial
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

s = serial.Serial('COM3', 115200, timeout=1)
# Đọc file boot.py xem nội dung
s.write(b'\r\x03\x03')
time.sleep(0.3)
s.write(b"f = open('boot.py'); print('BOOT_PY:', f.read()); f.close()\r\n")
time.sleep(0.5)
print(s.read_all().decode('utf-8', errors='ignore'))
s.close()
