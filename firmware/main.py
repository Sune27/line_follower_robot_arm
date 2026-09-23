# ==============================================================================
# MAIN.PY – CHƯƠNG TRÌNH KHỞI ĐỘNG VÀ ĐIỀU KHIỂN CHÍNH TRÊN ESP32 (FIRMWARE)
# Kiến trúc: Kích hoạt theo yêu cầu (On-Demand) & Non-blocking Serial Listener
# ==============================================================================

import sys
import time
import ujson
try:
    import uselect
except ImportError:
    import select as uselect
from machine import Pin
import config
from modules.wifi_client import WiFiStationManager
from modules.ultrasonic import UltrasonicSensor

def setup_serial_poll():
    """Khởi tạo cơ chế kiểm tra cổng Serial non-blocking bằng uselect.poll()"""
    poll = uselect.poll()
    poll.register(sys.stdin, uselect.POLLIN)
    return poll

def read_serial_command(poll):
    """Đọc lệnh từ Serial nếu có, không chặn luồng chính (Non-blocking)"""
    if poll.poll(0):
        try:
            line = sys.stdin.readline()
            if line:
                return line.strip()
        except Exception:
            pass
    return None

def main():
    print("\n" + "=" * 55)
    print("[ESP32] KHOI DONG HE THONG DIEU KHIEN & CAM BIEN RCWL-1601")
    print("=" * 55)

    # 1. Khởi tạo đối tượng quản lý Wi-Fi với danh sách ưu tiên từ config.py
    wifi_mgr = WiFiStationManager(
        networks_config=config.WIFI_NETWORKS,
        timeout_sec=config.WIFI_CONNECT_TIMEOUT_SEC,
        led_pin=2 # Chân đèn LED xanh tích hợp trên ESP32
    )

    # 2. Thực hiện quét và tự động kết nối Wi-Fi ban đầu
    connected = wifi_mgr.connect()

    # 3. Khởi tạo Cảm biến siêu âm RCWL-1601 (OOP)
    print(f"[Cam bien] Khoi tao RCWL-1601: Trig=GPIO{config.PIN_ULTRASONIC_TRIG}, Echo=GPIO{config.PIN_ULTRASONIC_ECHO}")
    ultrasonic = UltrasonicSensor(
        trig_pin=config.PIN_ULTRASONIC_TRIG,
        echo_pin=config.PIN_ULTRASONIC_ECHO
    )

    # 4. Khởi tạo trình lắng nghe Serial Non-blocking
    serial_poll = setup_serial_poll()

    # Trạng thái điều khiển cảm biến & Mạng
    has_connected_once = connected  # Ghi nhận cờ đã từng có kết nối Wi-Fi khi cắm nguồn
    emergency_mode = False       # Chế độ Khẩn cấp (Failsafe) khi mất Wi-Fi
    stream_mode = False          # Mặc định: Chế độ nghỉ (Standby) để tiết kiệm pin & CPU
    last_measure_time = 0
    measure_interval_ms = 200    # Chu kỳ đo liên tục: 200ms (5 lần/giây - Siêu mượt, không giật lag)
    last_wifi_check_time = time.ticks_ms()
    wifi_check_interval_ms = 1500 # Kiểm tra cờ trạng thái Wi-Fi nhanh (tốn < 1us)
    last_emergency_retry_time = 0
    emergency_retry_interval_ms = 3000 # Giãn cách 3s giữa các lần quét lại khi gặp sự cố

    print("[ESP32] Cam bien o che do NGHỈ (STANDBY). San sang nhan lenh dieu khien...")
    print("-" * 55)

    # Gửi gói telemetry khởi đầu thông báo hệ thống sẵn sàng
    initial_telem = {
        "event": "telemetry",
        "wifi": {
            "connected": connected,
            "ssid": wifi_mgr.get_ssid() if connected else "—",
            "ip": wifi_mgr.get_ip() if connected else "—"
        },
        "sensor": {
            "distance_cm": -1.0,
            "obstacle_detected": False
        },
        "mode": "standby"
    }
    print("TELEMETRY:" + ujson.dumps(initial_telem))

    while True:
        try:
            now = time.ticks_ms()

            # --- A. LẮNG NGHE LỆNH TỪ SERIAL (NON-BLOCKING) ---
            cmd = read_serial_command(serial_poll)
            if cmd:
                if "CMD:MEASURE_ONCE" in cmd:
                    if emergency_mode:
                        print("[LỆNH BỊ TỪ CHỐI] Xe đang trong Chế độ Khẩn cấp do mất Wi-Fi!")
                    else:
                        # Đo đúng 1 lần theo yêu cầu On-Demand
                        d = ultrasonic.measure_distance()
                        is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

                        if d < 0:
                            dist_str = "--.- cm (Ngoai tam do)"
                            status_str = "[OK] DUONG TRONG"
                        elif is_obstacle:
                            dist_str = f"{d:>5.1f} cm"
                            status_str = f"[CANH BAO] CO VAT CAN (<{config.OBSTACLE_DISTANCE_THRESHOLD_CM}cm)!"
                        else:
                            dist_str = f"{d:>5.1f} cm"
                            status_str = "[OK] AN TOAN"

                        print(f"[DO 1 LAN]: {dist_str} | {status_str}")

                        telem = {
                            "event": "telemetry",
                            "wifi": {
                                "connected": wifi_mgr.is_connected(),
                                "ssid": wifi_mgr.get_ssid() if wifi_mgr.is_connected() else "—",
                                "ip": wifi_mgr.get_ip() if wifi_mgr.is_connected() else "—"
                            },
                            "sensor": {
                                "distance_cm": d,
                                "obstacle_detected": is_obstacle
                            },
                            "mode": "once"
                        }
                        print("TELEMETRY:" + ujson.dumps(telem))

                        if wifi_mgr.led:
                            wifi_mgr.led.value(not wifi_mgr.led.value())
                            time.sleep_ms(60)
                            wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

                elif "CMD:START_STREAM" in cmd:
                    if emergency_mode:
                        print("[LỆNH BỊ TỪ CHỐI] Không thể bật đo liên tục khi đang mất Wi-Fi (Chế độ Khẩn cấp)!")
                    else:
                        stream_mode = True
                        print("[CMD_ACK] START_STREAM: Bat che do do lien tuc (200ms/mau)")

                elif "CMD:STOP_STREAM" in cmd:
                    stream_mode = False
                    print("[CMD_ACK] STOP_STREAM: Dua cam bien ve che do Nghi (Standby)")
                    if wifi_mgr.led and not emergency_mode:
                        wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

                elif "CMD:GET_WIFI_STATUS" in cmd:
                    # Lệnh truy vấn trạng thái Wi-Fi chủ động từ Web (< 1us)
                    is_conn = wifi_mgr.is_connected()
                    wifi_resp = {
                        "event": "wifi_status",
                        "connected": is_conn,
                        "ssid": wifi_mgr.get_ssid() if is_conn else "—",
                        "ip": wifi_mgr.get_ip() if is_conn else "—",
                        "emergency_mode": emergency_mode,
                        "security": "WPA2-PSK"
                    }
                    print("WIFI_STATUS:" + ujson.dumps(wifi_resp))

            # --- B. GIÁM SÁT KẾT NỐI WI-FI & KÍCH HOẠT CHẾ ĐỘ KHẨN CẤP (FAILSAFE) ---
            if time.ticks_diff(now, last_wifi_check_time) >= wifi_check_interval_ms:
                last_wifi_check_time = now
                is_conn = wifi_mgr.is_connected()

                # Nếu trước đó đã kết nối Wi-Fi thành công nhưng nay bị ngắt sóng:
                if has_connected_once and (not is_conn) and (not emergency_mode):
                    emergency_mode = True
                    stream_mode = False # DỪNG TOÀN BỘ HOẠT ĐỘNG KHÁC NGAY LẬP TỨC
                    print("\n" + "!" * 55)
                    print("[FAILSAFE] 🚨 PHÁT HIỆN MẤT KẾT NỐI WI-FI!")
                    print("[FAILSAFE] 🛑 ĐÃ DỪNG TOÀN BỘ HOẠT ĐỘNG! BẬT CHẾ ĐỘ TỰ ĐỘNG TÌM KIẾM WI-FI...")
                    print("!" * 55 + "\n")

                    em_msg = {
                        "event": "emergency",
                        "type": "wifi_lost",
                        "msg": "MẤT KẾT NỐI WI-FI: ĐÃ DỪNG MỌI HOẠT ĐỘNG, ĐANG TỰ ĐỘNG TÌM KIẾM..."
                    }
                    print("EMERGENCY:" + ujson.dumps(em_msg))
                    last_emergency_retry_time = 0

            # --- C. XỬ LÝ KHI ĐANG TRONG CHẾ ĐỘ KHẨN CẤP (TỰ ĐỘNG TÌM LẠI WI-FI) ---
            if emergency_mode:
                # Nhấp nháy LED cảnh báo khẩn cấp cực nhanh (báo hiệu xe đang mất sóng)
                if wifi_mgr.led:
                    wifi_mgr.led.value(not wifi_mgr.led.value())

                # Cứ mỗi 3 giây thử quét và kết nối lại
                if time.ticks_diff(now, last_emergency_retry_time) >= emergency_retry_interval_ms:
                    last_emergency_retry_time = now
                    print("[FAILSAFE] 🔍 Đang quét và thử kết nối lại Wi-Fi...")
                    reconnected = wifi_mgr.connect()

                    if reconnected:
                        emergency_mode = False
                        has_connected_once = True
                        print("\n" + "=" * 55)
                        print("[FAILSAFE RECOVERED] 🎉 ĐÃ KHÔI PHỤC KẾT NỐI WI-FI THÀNH CÔNG!")
                        print("[FAILSAFE RECOVERED] 🟢 THOÁT CHẾ ĐỘ KHẨN CẤP. HỆ THỐNG TRỞ VỀ STANDBY.")
                        print("=" * 55 + "\n")

                        resolved_msg = {
                            "event": "emergency_resolved",
                            "msg": "ĐÃ KẾT NỐI LẠI WI-FI THÀNH CÔNG! HỆ THỐNG TRỞ LẠI BÌNH THƯỜNG.",
                            "wifi": {
                                "connected": True,
                                "ssid": wifi_mgr.get_ssid(),
                                "ip": wifi_mgr.get_ip()
                            }
                        }
                        print("EMERGENCY_RESOLVED:" + ujson.dumps(resolved_msg))

                        # Gửi cập nhật trạng thái Wi-Fi mới nhất
                        wifi_resp = {
                            "event": "wifi_status",
                            "connected": True,
                            "ssid": wifi_mgr.get_ssid(),
                            "ip": wifi_mgr.get_ip(),
                            "emergency_mode": False,
                            "security": "WPA2-PSK"
                        }
                        print("WIFI_STATUS:" + ujson.dumps(wifi_resp))

                        if wifi_mgr.led:
                            wifi_mgr.led.value(1) # Đèn xanh sáng ổn định

            # --- D. CHẾ ĐỘ ĐO LIÊN TỤC (CHỈ CHẠY KHI KHÔNG CÓ KHẨN CẤP) ---
            elif stream_mode:
                if time.ticks_diff(now, last_measure_time) >= measure_interval_ms:
                    last_measure_time = now
                    d = ultrasonic.measure_distance()
                    is_obstacle = (0 < d <= config.OBSTACLE_DISTANCE_THRESHOLD_CM)

                    if d < 0:
                        dist_str = "--.- cm (Ngoai tam do)"
                        status_str = "[OK] DUONG TRONG"
                    elif is_obstacle:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = f"[CANH BAO] CO VAT CAN (<{config.OBSTACLE_DISTANCE_THRESHOLD_CM}cm)!"
                    else:
                        dist_str = f"{d:>5.1f} cm"
                        status_str = "[OK] AN TOAN"

                    print(f"[STREAM]: {dist_str} | {status_str}")

                    # Điều khiển LED cảnh báo
                    if wifi_mgr.led:
                        if is_obstacle:
                            wifi_mgr.led.value(not wifi_mgr.led.value())
                        else:
                            wifi_mgr.led.value(1 if wifi_mgr.is_connected() else 0)

                    telem = {
                        "event": "telemetry",
                        "wifi": {
                            "connected": wifi_mgr.is_connected(),
                            "ssid": wifi_mgr.get_ssid() if wifi_mgr.is_connected() else "—",
                            "ip": wifi_mgr.get_ip() if wifi_mgr.is_connected() else "—"
                        },
                        "sensor": {
                            "distance_cm": d,
                            "obstacle_detected": is_obstacle
                        },
                        "mode": "streaming"
                    }
                    print("TELEMETRY:" + ujson.dumps(telem))

        except Exception as e:
            print("[Lỗi vòng lặp]", e)

        time.sleep_ms(30) # Nhường CPU 30ms

if __name__ == "__main__":
    main()
