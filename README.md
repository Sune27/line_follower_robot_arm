# 🚗🤖 XE DÒ LINE KẾT HỢP CÁNH TAY ROBOT 4-DOF
> **Hệ thống xe tự hành bám line tích hợp cánh tay robot gắp vật thể, điều khiển và giám sát thời gian thực qua giao diện Web.**

[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%7C%20TB6612FNG%20%7C%20SG90-blue.svg)](#phần-cứng)
[![Firmware](https://img.shields.io/badge/Firmware-MicroPython-green.svg)](#kiến-trúc-phần-mềm)
[![Backend](https://img.shields.io/badge/Backend-Python%20%7C%20AioHTTP%20%7C%20WebSocket-yellow.svg)](#kiến-trúc-phần-mềm)
[![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20JS-orange.svg)](#hướng-dẫn-truy-cập-web)

---

## 📌 Giới Thiệu Dự Án

Dự án nghiên cứu và chế tạo **Xe tự hành dò đường (Line Follower Car)** kết hợp **Cánh tay robot 4 bậc tự do (4-DOF Robotic Arm)** phục vụ nghiên cứu thực nghiệm liên môn:
- **Nhập môn Cơ Điện Tử:** Tích hợp cơ khí, mạch động lực, nguồn pin và điều khiển chấp hành.
- **Kiến trúc Máy Tính & Mạng Truyền Thông Công Nghiệp:** Vi điều khiển ESP32 32-bit Dual-Core, giao thức mạng thời gian thực WebSocket, mạng Wi-Fi không dây.
- **Lập Trình Nâng Cao:** Mô hình máy trạng thái (FSM), thuật toán điều khiển PID bám line, lập trình hướng đối tượng (OOP).
- **Kỹ Thuật Đo Lường & Cảm Biến:** Thu thập và lọc nhiễu cảm biến hồng ngoại TCRT5000 và cảm biến siêu âm RCWL-1601.

---

## 🌟 Tính Năng Chính

* **Tự động bám line (Line Tracking):** Xe bám theo đường line đen chính xác trên nền sáng nhờ mảng cảm biến hồng ngoại `TCRT5000` và bộ điều khiển PID.
* **Đo khoảng cách & Tránh vật cản (Object Detection):** Cảm biến siêu âm `RCWL-1601` phát hiện vật thể phía trước với độ chính xác cao ở cự ly $\le 10\text{ cm}$.
* **Cánh tay gắp tự động (Robotic Pick & Place):** Cánh tay 4-DOF dẫn động bởi 4 động cơ Servo `SG90` thực hiện chuỗi hành động hạ tay, mở kẹp, gắp vật và nâng vật an toàn.
* **Giao diện Web điều khiển thời gian thực:**
  - **Màn hình Trailer:** Quét radar $360^\circ$, hiệu ứng vi mạch công nghệ hiện đại.
  - **Xác thực bảo mật:** Form đăng nhập phân quyền 1 người điều khiển (chống xung đột lệnh), hỗ trợ nút ẩn/hiện mật khẩu và ghi nhớ phiên đăng nhập.
  - **Nền hoạt họa công nghệ:** Xe dò line xoay bánh, cánh tay robot cử động nhịp nhàng mô phỏng theo mẫu CAD SPKT Team 3, robot mascot biểu cảm.
  - **Giám sát kết nối Wi-Fi thời gian thực:** Theo dõi trạng thái kết nối mạng của ESP32 trực tiếp trên Web.

---

## ⚙️ Cấu Hình Phần Cứng

| STT | Khối chức năng | Tên linh kiện | Mô tả kỹ thuật |
| :---: | :--- | :--- | :--- |
| 1 | **Vi điều khiển** | ESP32 Devkit V1 (30 chân) | Vi xử lý Xtensa Dual-Core 240MHz, tích hợp Wi-Fi & BLE |
| 2 | **Shield mở rộng** | Bảng mở rộng ESP32 30P | Phân phối chân GPIO, chân nguồn $5V$, $3.3V$ và GND |
| 3 | **Cảm biến dò line** | Module IR TCRT5000 | Cảm biến phản xạ hồng ngoại phát hiện vạch đen |
| 4 | **Cảm biến cự ly** | Module Siêu âm RCWL-1601 | Đo khoảng cách vật cản (hoạt động tốt ở mức $3.3V$ - $5V$) |
| 5 | **Mạch công suất** | Driver cầu H TB6612FNG | Điều khiển 2 động cơ DC (hiệu suất cao, sụt áp thấp) |
| 6 | **Cơ cấu gắp** | Bộ kit cánh tay robot 4-DOF | 4 khớp chuyển động: Đế xoay, Khớp vai, Khớp khuỷu, Kẹp gắp |
| 7 | **Động cơ Servo** | Micro Servo SG90 (x4) | Góc quay $0^\circ - 180^\circ$, điều khiển bằng PWM |
| 8 | **Khung gầm** | Khung xe 3 bánh | 2 bánh chủ động gắn động cơ DC TT + 1 bánh xe đa hướng |
| 9 | **Hệ thống nguồn** | 2 cell Pin 18650 3.7V (7.4V) | Hộp đựng 2 pin kèm jack DC, công tắc ON/OFF và bộ sạc 220V |

> [!IMPORTANT]
> **Lưu ý cấp nguồn:** Để tránh sụt áp gây khởi động lại vi điều khiển khi 4 servo hoạt động đồng thời, hệ thống sử dụng nguồn riêng hoặc qua module hạ áp Buck (LM2596/MP1584 hạ về $5V/3A$) cấp cho dàn Servo.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
D:\ki5\line_follower_robot_arm\
├── README.md                              # Trang thông tin chính của dự án
├── .gitignore                             # Cấu hình loại trừ file rác Git
├── .gitattributes                         # Cấu hình chuẩn hóa dòng văn bản đa nền tảng
├── khoi_dong_server_global_online.bat     # 1-Click: Bật Python Backend & mở link Web online toàn cầu
├── nap_code_esp32.bat                     # 1-Click: Tự động nạp toàn bộ firmware vào ESP32
│
├── docs/                                  # Tài liệu thiết kế & phân tích kỹ thuật
│   ├── pinout_config.md                   # Sơ đồ gán chân GPIO vi điều khiển
│   ├── system_architecture.md             # Sơ đồ khối kiến trúc hệ thống & truyền thông
│   └── project_context.md                 # Bối cảnh & đặc tả kỹ thuật chi tiết
│
├── firmware/                              # Mã nguồn nhúng nạp vào vi điều khiển ESP32
│   ├── config.py                          # Cấu hình danh sách Wi-Fi ưu tiên, chu kỳ xe
│   ├── boot.py                            # Khởi chạy chương trình tự động khi cấp điện
│   ├── main.py                            # Vòng lặp điều khiển chính & báo cáo trạng thái real-time
│   ├── nap_code_esp32.py                  # Script nạp firmware tự động qua Serial
│   └── modules/
│       ├── wifi_client.py                 # Module quét & kết nối Wi-Fi thông minh
│       ├── motor_driver.py                # Điều khiển động cơ DC qua TB6612FNG
│       ├── line_sensor.py                 # Đọc cảm biến TCRT5000 & tính sai số PID
│       ├── ultrasonic.py                  # Đo cự ly cảm biến RCWL-1601
│       └── robot_arm.py                   # Điều khiển các servo cánh tay robot
│
├── python_app/                            # Ứng dụng Backend Server chạy trên máy chủ
│   ├── app.py                             # Máy chủ Web HTTP & WebSocket điều phối dữ liệu
│   ├── requirements.txt                   # Thư viện Python phụ thuộc
│   ├── controllers/
│   │   ├── esp32_bridge.py                # Cầu nối truyền nhận dữ liệu với ESP32
│   │   ├── arm_controller.py              # Giới hạn an toàn & preset gắp vật
│   │   └── car_controller.py              # Chuyển đổi trạng thái Auto / Manual
│   └── models/
│       └── telemetry.py                   # Quản lý state xe & dữ liệu cảm biến
│
└── web/                                   # Giao diện Web điều khiển
    ├── templates/
    │   └── index.html                     # Giao diện HTML (Trailer, Đăng nhập, Bảng điều khiển)
    └── static/
        ├── css/
        │   └── style.css                  # Giao diện Dark Cyberpunk công nghệ cao
        └── js/
            └── main.js                    # Xử lý tương tác, WebSocket và cập nhật real-time
```

---

## 🌐 Hướng Dẫn Truy Cập Web

Giao diện điều khiển Web có thể truy cập linh hoạt từ máy tính hoặc điện thoại thông qua các đường link sau:

1. **Khởi động hệ thống:**
   - Nhấp đúp chuột vào tệp **`khoi_dong_server_global_online.bat`** tại thư mục gốc để khởi chạy máy chủ và kết nối mạng toàn cầu.

2. **Truy cập giao diện điều khiển:**
   - **Truy cập Online (Internet toàn cầu từ điện thoại 4G hoặc máy tính từ xa):**  
     Truy cập vào đường link cố định của hệ thống:  
     👉 **`https://saturday-sarcasm-quarrel.ngrok-free.dev`**
   - **Truy cập Nội bộ (Mạng LAN / Localhost trên máy tính):**  
     👉 **`http://localhost:5000`**

3. **Vào hệ thống điều khiển:**
   - Sau khi truy cập đường link trên, hệ thống sẽ mở màn hình xác thực quyền điều khiển.
   - Người dùng tiến hành đăng nhập bằng tài khoản được cấp quyền truy cập để vào màn hình Bảng điều khiển và theo dõi trạng thái xe robot.
