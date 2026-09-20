# ==============================================================================
# MAIN.PY – CẦU NỐI SERIAL UART ĐIỀU KHIỂN ESP32 QUA PYTHON SERVER & WEB
# ==============================================================================

import sys
import uselect
import ujson
import config
from modules.wifi_manager import WiFiAPManager

try:
    import uasyncio as asyncio
except ImportError:
    import asyncio

# Khởi tạo đối tượng quản lý Wi-Fi Access Point
wifi = WiFiAPManager(
    ssid        = getattr(config, 'WIFI_SSID', 'RobotCar'),
    password    = getattr(config, 'WIFI_PASSWORD', ''),
    channel     = getattr(config, 'WIFI_CHANNEL', 6),
    max_clients = getattr(config, 'WIFI_MAX_CLIENTS', 4)
)

# Đăng ký lắng nghe cổng Serial UART (USB cáp) không chặn
spoll = uselect.poll()
spoll.register(sys.stdin, uselect.POLLIN)


def send_status():
    """Gửi dữ liệu trạng thái Wi-Fi lên máy tính qua cổng Serial với tiền tố RESP:"""
    try:
        data = wifi.get_status_dict()
        print("RESP:" + ujson.dumps(data))
    except Exception as e:
        print(f"[Err] send_status: {e}")


# Các hàm tiện ích khi gõ trực tiếp trong Thonny Shell
def start_wifi():
    wifi.start()
    send_status()

def stop_wifi():
    wifi.stop()
    send_status()

def toggle_wifi():
    wifi.toggle()
    send_status()

def status():
    send_status()


# ==============================================================================
# CÁC TÁC VỤ BẤT ĐỒNG BỘ UASYNCIO (NON-BLOCKING)
# ==============================================================================

async def serial_command_listener():
    """Lắng nghe các lệnh gửi từ Python Backend qua Serial UART (chu kỳ 25ms)"""
    while True:
        if spoll.poll(0):
            try:
                raw_line = sys.stdin.readline()
                if raw_line:
                    cmd = raw_line.strip()
                    if cmd == "CMD:WIFI_TOGGLE":
                        wifi.toggle()
                        send_status()
                    elif cmd == "CMD:WIFI_ON":
                        wifi.start()
                        send_status()
                    elif cmd == "CMD:WIFI_OFF":
                        wifi.stop()
                        send_status()
                    elif cmd == "CMD:WIFI_STATUS":
                        send_status()
            except Exception:
                pass
        await asyncio.sleep_ms(25)


async def wifi_client_monitor():
    """Giám sát số lượng client kết nối vào Wi-Fi. Khi có người vào/ra -> tự báo cáo"""
    while True:
        if wifi.is_active:
            try:
                changed, count = wifi.detect_changes()
                if changed:
                    send_status()
            except Exception:
                pass
        await asyncio.sleep_ms(1500)


async def main_loop():
    """Vòng lặp chính chạy song song các tác vụ"""
    print("\n" + "="*52)
    print("  [ESP32] SẴN SÀNG NHẬN LỆNH QUA CỔNG SERIAL COM3")
    print("="*52)
    send_status() # Báo cáo trạng thái ban đầu khi vừa khởi động

    t_serial = asyncio.create_task(serial_command_listener())
    t_monitor = asyncio.create_task(wifi_client_monitor())

    await asyncio.gather(t_serial, t_monitor)


def run():
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\n[ESP32] Nhận lệnh dừng.")
    finally:
        wifi.stop()


if __name__ == "__main__":
    run()
