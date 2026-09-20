# BỐI CẢNH DỰ ÁN – XE DÒ LINE KẾT HỢP CÁNH TAY ROBOT 4-DOF
> Tài liệu này mô tả đầy đủ ý tưởng, phần cứng, kiến trúc phần mềm và tiến độ code hiện tại.
> Bất kỳ AI Agent nào nhận tài liệu này đều có thể tiếp tục phát triển đúng hướng mà không cần hỏi lại từ đầu.

---

## 1. TỔNG QUAN DỰ ÁN

| Mục | Nội dung |
|-----|----------|
| **Tên dự án** | Xe Dò Line Kết Hợp Cánh Tay Robot 4-DOF |
| **Mục tiêu học thuật** | Đồ án liên môn phục vụ 4 môn học cùng lúc |
| **Thư mục dự án** | `D:\ki5\line_follower_robot_arm\` |
| **Repository GitHub** | Đã khởi tạo và push lần đầu (cấu trúc file rỗng) |

### Các môn học liên quan
1. **Nhập môn Cơ Điện Tử** – phối hợp cơ khí, điện tử và lập trình
2. **Kiến trúc Máy Tính và Mạng Truyền Thông Công Nghiệp** – khai thác ESP32 dual-core, FreeRTOS, WebSocket, Wi-Fi AP/STA
3. **Lập Trình Nâng Cao** – State Machine (FSM), PID controller, OOP/modular code, kiến trúc hàng chờ phân quyền
4. **Kỹ Thuật Đo Lường và Cảm Biến** – hiệu chuẩn TCRT5000, đo khoảng cách RCWL-1601, lọc nhiễu tín hiệu

---

## 2. Ý TƯỞNG VÀ TÍNH NĂNG

### 2.1 Tính năng CỐT LÕI (bắt buộc hoàn thành)
1. **Dò line tự động** – Xe bám theo băng dính đen trên sàn bằng mảng cảm biến IR TCRT5000 + thuật toán PID
2. **Phát hiện vật cản** – Cảm biến siêu âm RCWL-1601 liên tục đo khoảng cách; khi vật trong vùng ~8–10 cm thì dừng xe
3. **Cánh tay robot gắp vật** – Sau khi dừng, 4 servo SG90 thực hiện chuỗi động tác: nâng, vươn, gắp vật, nâng lên, về vị trí home
4. **Web Dashboard thời gian thực** – Giao diện web điều khiển tay gắp (slider 4 khớp), chuyển chế độ Auto/Manual, hiển thị dữ liệu cảm biến live qua WebSocket

### 2.2 Tính năng MỞ RỘNG (phát triển tương lai)
- Joystick ảo điều khiển xe di chuyển trên web
- Biểu đồ Telemetry (khoảng cách siêu âm, trạng thái cảm biến line) thời gian thực
- Module Camera (ESP32-CAM) quan sát từ xa
- MQTT/ESP-NOW cho nhiều xe phối hợp

### 2.3 Máy trạng thái hoạt động (FSM)
```
[STATE 1: Dò line tự động]
       │ (RCWL-1601 phát hiện vật < 10cm)
       ▼
[STATE 2: Dừng xe & ổn định]
       │
       ▼
[STATE 3: Cánh tay hạ → gắp vật → nâng lên]
       │
       ▼
[STATE 4: Tiếp tục dò line / nhả vật / về Home]
```

---

## 3. PHẦN CỨNG

### 3.1 Bảng linh kiện đầy đủ

| Nhóm | Tên kỹ thuật | Vai trò |
|------|-------------|---------|
| **Vi điều khiển** | ESP32 Devkit V1 30-pin | CPU dual-core, Wi-Fi, Bluetooth, xuất PWM, đọc ADC |
| | Bảng mở rộng ESP32 30-pin | Shield cắm chân, cấp nguồn dễ dàng |
| **Cảm biến** | IR TCRT5000 | Dò line đen/trắng (mảng nhiều mắt) |
| | RCWL-1601 | Siêu âm đo khoảng cách, tương thích 3.3V, chạy tốt với ESP32 |
| **Driver** | TB6612FNG | Cầu H điều khiển 2 động cơ DC, hiệu suất cao, ít nóng |
| **Cơ cấu chấp hành** | Bộ kit cánh tay robot 4 bậc | Khung mica/nhôm 4-DOF (Base, Shoulder, Elbow, Gripper) |
| | Servo SG90 × 4 | Kéo các khớp cánh tay, góc 0–180° |
| | Khung xe 3 bánh | 2 bánh chủ động DC + 1 bánh caster đa hướng |
| **Nguồn** | Pin 18650 3.7V 2600mAh màu tím × 2 | Ghép nối tiếp → 7.4V cấp cho toàn hệ thống |
| | Hộp pin 18650 2AA kèm jack DC đực | Giữ pin và kết nối mạch |
| | Bộ sạc 2 pin 18650 cắm 220V | Sạc pin rời |
| **Kết nối** | Dây đực-cái, cái-cái, đực-đực 10cm | Nối linh kiện trên breadboard/shield |
| | Băng dính đen | Dán đường line dẫn hướng cho xe |
| | Công tắc ON/OFF | Ngắt toàn bộ nguồn |
| | Súng bắn keo / keo nến | Cố định cơ khí |

### 3.2 Lưu ý kỹ thuật nguồn điện (QUAN TRỌNG)
> **Chưa mua nhưng cần bổ sung:** Module hạ áp Buck (LM2596 hoặc MP1584) hạ từ 7.4V → 5V/3A để cấp nguồn **riêng** cho 4 servo SG90. Nếu lấy nguồn từ chân 5V của ESP32 board, khi 4 servo cùng hoạt động sẽ gây sụt áp → ESP32 bị reset liên tục (Brownout Detector).

---

## 4. KIẾN TRÚC PHẦN MỀM

### 4.1 Cấu trúc thư mục dự án
```
D:\ki5\line_follower_robot_arm\
├── README.md
├── .gitignore                         # bỏ qua __pycache__, venv, .vscode...
├── docs/
│   ├── pinout_config.md               # gán chân GPIO (chưa viết)
│   └── system_architecture.md        # sơ đồ khối (chưa viết)
├── firmware/                          # code nạp vào ESP32 (MicroPython/C++)
│   ├── config.py                      # định nghĩa chân GPIO, ngưỡng cảm biến (rỗng)
│   ├── main.py                        # vòng lặp điều khiển chính / FreeRTOS tasks (rỗng)
│   └── modules/
│       ├── __init__.py
│       ├── motor_driver.py            # điều khiển TB6612FNG (rỗng)
│       ├── line_sensor.py             # đọc TCRT5000, tính sai số PID (rỗng)
│       ├── ultrasonic.py              # đo khoảng cách RCWL-1601 (rỗng)
│       └── robot_arm.py               # điều khiển 4 servo SG90, nội suy góc (rỗng)
├── python_app/                        # ứng dụng Python chạy trên máy tính
│   ├── app.py                         # Web Server + WebSocket Server (rỗng)
│   ├── requirements.txt               # thư viện cần cài đặt (rỗng)
│   ├── controllers/
│   │   ├── esp32_bridge.py            # giao tiếp với ESP32 qua USB/Serial hoặc Wi-Fi (rỗng)
│   │   ├── arm_controller.py          # tính góc servo, giới hạn an toàn, preset gắp (rỗng)
│   │   └── car_controller.py          # chuyển đổi chế độ Auto/Manual (rỗng)
│   └── models/
│       └── telemetry.py               # quản lý state dữ liệu cảm biến real-time (rỗng)
└── web/                               # giao diện web điều khiển
    ├── templates/
    │   └── index.html                 # ✅ ĐÃ VIẾT (xem mục 5)
    └── static/
        ├── css/
        │   └── style.css              # ✅ ĐÃ VIẾT (xem mục 5)
        └── js/
            ├── main.js                # ✅ ĐÃ VIẾT (xem mục 5)
            ├── websocket_client.js    # quản lý WebSocket (rỗng)
            └── arm_ui.js              # xử lý slider cánh tay (rỗng)
```

### 4.2 Kiến trúc mạng – Hai chế độ kết nối song song
```
CHẾ ĐỘ 1 – USB Serial (Test trên bàn, ổn định 100%)
  Laptop (Web: localhost:5000)
    └──(Python Server)──[USB Cable]──► ESP32 ──► Motor, Servo, Sensor

CHẾ ĐỘ 2 – Wi-Fi AP (Demo thực tế, không cần cáp)
  ESP32 phát Wi-Fi: "Robot_Car" / "12345678"
    └── Điện thoại/Laptop kết nối vào → Mở 192.168.4.1 trên trình duyệt
```

**Giao thức:** WebSocket (Full-duplex, độ trễ < 20ms). Format lệnh JSON: `{"cmd": "arm", "joint": 1, "angle": 90}`

**Kiến trúc ESP32 Dual-Core (FreeRTOS):**
- **Core 0** – Networking: chạy Web Server, xử lý gói tin WebSocket
- **Core 1** – Real-time Control: đọc cảm biến, tính PID, xuất PWM động cơ và servo

---

## 5. TIẾN ĐỘ CODE HIỆN TẠI

### ✅ ĐÃ HOÀN THÀNH: Giao diện Web (Frontend)

#### 5.1 `web/templates/index.html`
Giao diện HTML hoàn chỉnh với **3 màn hình chuyển tiếp tuần tự**:

**Màn hình 1 – Trailer/Splash Screen (2.6 giây):**
- Hiệu ứng vòng tròn radar xoay 360° (CSS Animation thuần)
- Tiêu đề "MECHATRONICS LAB – HỆ THỐNG XE DÒ LINE & CÁNH TAY ROBOT 4-DOF"
- Thanh Loading Bar chạy từ 0% → 100%
- Font: Chakra Petch (tiêu đề) + Be Vietnam Pro (nội dung) – tối ưu tiếng Việt

**Màn hình 2 – Đăng nhập (Authentication):**
- Form nhập Tài khoản + Mật khẩu
- Nút hình con mắt (👁️/🙈) bật/tắt hiển thị mật khẩu
- Checkbox "Ghi nhớ đăng nhập" (dùng localStorage)
- Thông báo lỗi màu đỏ khi sai thông tin
- Nút "ĐĂNG NHẬP"
- **Phần nền trang trí động phía sau form** (3 vật thể hoạt hình CSS thuần):
  - Xe dò line (bánh xoay, sóng siêu âm, đèn LED nhấp nháy) – góc dưới trái
  - Cánh tay robot 4-DOF dạng SVG vector mô phỏng theo model CAD SPKT TEAM 3 (xanh dương + đỏ, có chữ TEAM 3 và SPKT) – góc dưới phải
  - Robot Humanoid mascot lơ lửng + nháy mắt (winking animation) – góc trên phải
  - Lưới vi mạch 3D phối cảnh + ánh sáng khuếch tán Cyan/Blue

**Màn hình 3 – Bảng điều khiển (Dashboard):**
- Header: hiển thị tên người đang điều khiển + nút "Đăng xuất"
- Nội dung: chỉ có chữ `<h1>Bảng điều khiển</h1>` (chưa có nút gì – theo yêu cầu giai đoạn hiện tại)

#### 5.2 `web/static/css/style.css`
- Gam màu nền tối công nghệ (Dark Industrial SCADA): `#080c14` (xanh đen)
- Font hệ thống: Be Vietnam Pro (body) + Chakra Petch (heading, label công nghệ)
- Màu nhấn chính: Cyan `#06b6d4`, Blue `#2563eb`, Red accent `#ef4444`
- Hiệu ứng Glassmorphism cho login card (backdrop-filter blur)
- Toàn bộ animation trang trí dùng CSS3 thuần: `@keyframes` radar, bánh xe, sóng sonar, LED, cánh tay SVG, mascot nháy mắt
- Responsive: tự co giãn ở breakpoint 1280px / 900px / 640px

#### 5.3 `web/static/js/main.js`
Logic điều phối giao diện (không cần server để chạy thử):
- `showScreen(screenId)` – ẩn/hiện màn hình theo ID
- `DOMContentLoaded` listener – khởi động trailer, sau 2.6s kiểm tra localStorage rồi redirect
- `togglePasswordVisibility()` – chuyển đổi `type="password"` ↔ `type="text"`, đổi icon 👁️/🙈
- `handleLogin(event)` – xác thực tài khoản từ mảng `AUTHORIZED_ACCOUNTS` hardcode
- `showDashboard(username)` – hiển thị tên người điều khiển, kích hoạt dashboard
- `handleLogout()` – xóa localStorage/sessionStorage, reset form, quay về login

**Tài khoản mặc định hiện tại:** `admin` / `robot2026`

**Cơ chế bảo mật phiên:**
- Checkbox "Ghi nhớ" → `localStorage` (vĩnh viễn trên trình duyệt đó)
- Không tick → `sessionStorage` (chỉ trong tab, đóng tab là hết)

**Kiến trúc hàng chờ (Queue) – đã thiết kế nền móng, chưa implement backend:**
- Khi logout, quyền điều khiển được giải phóng → người tiếp theo trong hàng chờ có thể đăng nhập
- Chỉ 1 người được điều khiển tại một thời điểm (phân quyền Master/Viewer)

---

## 6. PHẦN CHƯA LÀM (TODO)

| Ưu tiên | File | Việc cần làm |
|---------|------|-------------|
| 🔴 Cao | `python_app/app.py` | Xây dựng Flask/FastAPI server + WebSocket endpoint |
| 🔴 Cao | `python_app/controllers/esp32_bridge.py` | Giao tiếp Serial USB và Wi-Fi TCP với ESP32 |
| 🔴 Cao | `web/static/js/websocket_client.js` | Kết nối WebSocket từ trình duyệt đến server |
| 🔴 Cao | `web/static/js/arm_ui.js` | Slider 4 khớp cánh tay, nút gắp/nhả, preset Home/Grip |
| 🔴 Cao | `web/templates/index.html` (dashboard) | Bổ sung UI điều khiển thực sự cho màn hình Bảng điều khiển |
| 🔴 Cao | `firmware/modules/motor_driver.py` | PWM điều khiển TB6612FNG |
| 🔴 Cao | `firmware/modules/line_sensor.py` | Đọc TCRT5000, thuật toán PID bám line |
| 🔴 Cao | `firmware/modules/ultrasonic.py` | Đọc RCWL-1601, tính cm |
| 🔴 Cao | `firmware/modules/robot_arm.py` | Điều khiển servo SG90 có nội suy góc mượt |
| 🔴 Cao | `firmware/main.py` | FSM chính + FreeRTOS Task phân Core 0/Core 1 |
| 🟡 Vừa | `docs/pinout_config.md` | Sơ đồ gán chân GPIO ESP32 |
| 🟡 Vừa | `python_app/models/telemetry.py` | State management dữ liệu cảm biến real-time |
| 🟢 Thấp | Backend queue management | Hàng chờ đa người dùng có WebSocket |
| 🟢 Thấp | `python_app/requirements.txt` | Điền thư viện cần thiết (fastapi, uvicorn, pyserial...) |

---

## 7. QUY ƯỚC CODE CỦA DỰ ÁN

- **Ngôn ngữ:** Python 3.x cho server và firmware (MicroPython trên ESP32), HTML/CSS/JS thuần cho frontend
- **Comment:** Ghi chú tiếng Việt rõ ràng, tác dụng từng hàm/đoạn code
- **Không xóa code cũ** khi thêm tính năng mới – chỉ bổ sung/mở rộng
- **Font chữ web:** Luôn dùng Chakra Petch (heading kỹ thuật) và Be Vietnam Pro (body) – đã import Google Fonts
- **Màu sắc chuẩn dự án:** Cyan `#06b6d4`, Blue `#2563eb`, Dark BG `#080c14`, Red accent `#ef4444`
- **Tài khoản test hiện tại:** `admin` / `robot2026` (hardcode trong `main.js`)
- **Port server Python (dự kiến):** `localhost:5000`
- **IP ESP32 khi phát Wi-Fi AP:** `192.168.4.1`
