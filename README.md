# 🚗🤖 XE DÒ LINE KẾT HỢP CÁNH TAY ROBOT 4-DOF
> **Hệ thống xe tự hành bám line tích hợp cánh tay robot gắp vật thể, điều khiển và giám sát thời gian thực qua giao diện Web.**

[![Hardware](https://img.shields.io/badge/Hardware-ESP32%20%7C%20TB6612FNG%20%7C%20SG90-blue.svg)](#phần-cứng)
[![Firmware](https://img.shields.io/badge/Firmware-MicroPython%20%2F%20C%2B%2B-green.svg)](#kiến-trúc-phần-mềm)
[![Backend](https://img.shields.io/badge/Backend-Python%20%7C%20WebSocket-yellow.svg)](#kiến-trúc-phần-mềm)
[![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20JS-orange.svg)](#giao-diện-web)

---

## 📌 Giới Thiệu Dự Án

Dự án nghiên cứu và chế tạo **Xe tự hành dò đường (Line Follower Car)** kết hợp **Cánh tay robot 4 bậc tự do (4-DOF Robotic Arm)** phục vụ nghiên cứu thực nghiệm liên môn:
- **Nhập môn Cơ Điện Tử:** Tích hợp cơ khí, mạch động lực, nguồn pin và điều khiển chấp hành.
- **Kiến trúc Máy Tính & Mạng Truyền Thông Công Nghiệp:** Vi điều khiển ESP32 32-bit Dual-Core, giao thức mạng thời gian thực WebSocket, mạng Wi-Fi AP/STA.
- **Lập Trình Nâng Cao:** Mô hình máy trạng thái (FSM), thuật toán điều khiển PID bám line, lập trình hướng đối tượng (OOP).
- **Kỹ Thuật Đo Lường & Cảm Biến:** Thu thập và lọc nhiễu cảm biến hồng ngoại TCRT5000 và cảm biến siêu âm RCWL-1601.

---

## 🌟 Tính Năng Chính

* **Tự động bám line (Line Tracking):** Xe bám theo đường line đen chính xác trên nền sáng nhờ mảng cảm biến hồng ngoại `TCRT5000` và bộ điều khiển PID.
* **Đo khoảng cách & Tránh vật cản (Object Detection):** Cảm biến siêu âm `RCWL-1601` phát hiện vật thể phía trước với độ chính xác cao ở cự ly $\le 10 cm$.
* **Cánh tay gắp tự động (Robotic Pick & Place):** Cánh tay 4-DOF dẫn động bởi 4 động cơ Servo `SG90` thực hiện chuỗi hành động hạ tay, mở kẹp, gắp vật và nâng vật an toàn.
* **Giao diện Web điều khiển thời gian thực:**
  - **Màn hình Trailer:** Quét radar $360^\circ$, hiệu ứng vi mạch công nghệ hiện đại.
  - **Xác thực bảo mật:** Form đăng nhập phân quyền 1 người điều khiển (chống xung đột lệnh), hỗ trợ nút ẩn/hiện mật khẩu và ghi nhớ phiên đăng nhập.
  - **Nền hoạt họa công nghệ:** Xe dò line xoay bánh, cánh tay robot cử động nhịp nhàng mô phỏng theo mẫu CAD SPKT Team 3, robot mascot nháy mắt.
  - **Hỗ trợ 2 chế độ kết nối song song:** Cắm cáp USB Serial với laptop hoặc kết nối không dây qua sóng Wi-Fi do ESP32 tự phát.

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
├── README.md                      # Trang thông tin chính của dự án (Landing page)
├── .gitignore                     # Cấu hình loại trừ file rác Git
│
├── docs/                          # Tài liệu thiết kế & phân tích kỹ thuật
│   ├── pinout_config.md           # Sơ đồ gán chân GPIO vi điều khiển
│   ├── system_architecture.md     # Sơ đồ khối kiến trúc hệ thống & truyền thông
│   └── project_context.md         # Bối cảnh & đặc tả chi tiết cho phát triển / bàn giao
│
├── firmware/                      # Mã nguồn nhúng nạp vào vi điều khiển ESP32
│   ├── config.py                  # Cấu hình chân GPIO, tần số PWM, ngưỡng cảm biến
│   ├── main.py                    # Vòng lặp điều khiển chính & máy trạng thái (FSM)
│   └── modules/
│       ├── motor_driver.py        # Module điều khiển TB6612FNG (tiến/lùi/rẽ/phanh)
│       ├── line_sensor.py         # Module đọc TCRT5000 & tính toán sai số PID
│       ├── ultrasonic.py          # Module đo khoảng cách cảm biến RCWL-1601
│       └── robot_arm.py           # Module điều khiển 4 servo SG90 & làm mượt góc
│
├── python_app/                    # Ứng dụng Backend Python chạy trên máy tính (USB mode)
│   ├── app.py                     # Web Server & trạm điều phối WebSocket thời gian thực
│   ├── requirements.txt           # Danh sách các thư viện Python phụ thuộc
│   ├── controllers/
│   │   ├── esp32_bridge.py        # Cầu nối truyền nhận dữ liệu Serial USB / Wi-Fi
│   │   ├── arm_controller.py      # Giới hạn góc an toàn & kịch bản gắp vật tự động
│   │   └── car_controller.py      # Bộ chuyển đổi trạng thái Auto / Manual
│   └── models/
│       └── telemetry.py           # Quản lý trạng thái xe & dữ liệu cảm biến live
│
└── web/                           # Giao diện Web điều khiển thời gian thực
    ├── templates/
    │   └── index.html             # Giao diện HTML (Trailer, Login, Dashboard)
    └── static/
        ├── css/
        │   └── style.css          # Định kiểu giao diện Dark Cyberpunk (Chakra Petch & Be Vietnam Pro)
        └── js/
            ├── main.js            # Xử lý chuyển cảnh, xác thực đăng nhập, Remember Me
            ├── websocket_client.js# Giao tiếp WebSocket với Server
            └── arm_ui.js          # Xử lý sự kiện thanh trượt điều khiển cánh tay
```

---

## 🚀 Hướng Dẫn Trải Nghiệm Nhanh Giao Diện Web

Hiện tại giao diện Web đã hoàn thiện đầy đủ và có thể mở trực tiếp không cần cài đặt thêm phần mềm:

1. Điều hướng tới thư mục: `D:\ki5\line_follower_robot_arm\web	emplates\`
2. Nhấp đúp chuột vào tệp **`index.html`** để mở trên trình duyệt (Google Chrome, Edge, Cốc Cốc).
3. **Các giai đoạn hiển thị:**
   * **Trailer mở đầu (2.6s):** Hiệu ứng quét radar công nghệ $360^\circ$ và thanh nạp năng lượng.
   * **Đăng nhập xác thực:** Form đăng nhập có nền đồ họa chuyển động (xe chạy quay bánh, cánh tay robot CAD SPKT Team 3, robot mascot nháy mắt).
     * *Tài khoản thử nghiệm:* `admin`
     * *Mật khẩu:* `robot2026` (bấm vào icon con mắt `👁️` để ẩn/hiện mật khẩu).
   * **Bảng điều khiển:** Màn hình chính sau khi xác thực thành công.

---

## 📅 Lộ Trình Phát Triển Tiếp Theo

- [x] Thiết kế cấu trúc thư mục module hóa toàn diện.
- [x] Thiết kế giao diện Web hoàn chỉnh: Trailer, Login Form bảo mật, Hoạt họa CSS nền.
- [ ] Xây dựng bảng điều khiển chi tiết (Sliders góc servo, nút gắp/nhả, nút đổi chế độ).
- [ ] Lập sơ đồ phân bổ chân GPIO trên ESP32 (`docs/pinout_config.md`).
- [ ] Viết Backend Python Server (`python_app/app.py`) kết nối WebSocket và Serial USB.
- [ ] Viết Firmware nhúng điều khiển động cơ, PID bám line và cánh tay robot trên ESP32.

---

## 👥 Nhóm Thực Hiện
* **Đồ án:** Nhập môn Cơ điện tử - Mạng truyền thông & Kiến trúc máy tính
* **Phiên bản tài liệu:** v1.0.0
