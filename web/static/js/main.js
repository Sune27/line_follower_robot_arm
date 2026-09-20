/**
 * ==============================================================================
 * TỆP XỬ LÝ LOGIC GIAO DIỆN (MAIN JAVASCRIPT)
 * Mục đích:
 * 1. Điều phối chuyển cảnh từ Trailer -> Màn hình đăng nhập -> Bảng điều khiển.
 * 2. Xác thực tài khoản & mật khẩu do người dùng quy định.
 * 3. Hỗ trợ nút hình con mắt bật/tắt hiển thị mật khẩu.
 * 4. Hỗ trợ ghi nhớ phiên (Remember Me) bằng localStorage.
 * 5. Tạo cơ sở kiến trúc hàng chờ (Queue Architecture) 1 người điều khiển.
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. CẤU HÌNH HỆ THỐNG VÀ TÀI KHOẢN HỢP LỆ
// Tác dụng: Lưu danh sách tài khoản được phép điều khiển và thời gian hiệu ứng
// ------------------------------------------------------------------------------
const AUTHORIZED_ACCOUNTS = [
    { username: "sune", password: "24021197" }
];

// Khóa định danh phiên đăng nhập trong bộ nhớ trình duyệt
const STORAGE_KEY = "robot_car_active_user";

// Thời gian chạy của Trailer (2.6 giây để thanh nạp chạy hết)
const TRAILER_DURATION_MS = 2600;


// ------------------------------------------------------------------------------
// 2. HÀM ĐIỀU HƯỚNG MÀN HÌNH (SCREEN ROUTER)
// Tác dụng: Ẩn tất cả các màn hình khác và hiển thị màn hình mục tiêu (screenId)
// ------------------------------------------------------------------------------
function showScreen(screenId) {
    const screens = document.querySelectorAll(".screen");
    screens.forEach(s => s.classList.remove("active"));

    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add("active");
    }
}


// ------------------------------------------------------------------------------
// 3. KHỞI CHẠY HỆ THỐNG KHI MỞ TRANG WEB (INIT ON LOAD)
// Tác dụng:
// - Bắt đầu luôn với màn hình Trailer công nghệ.
// - Sau khi hết trailer, tự động kiểm tra xem thiết bị này đã đăng nhập chưa.
// ------------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    // Mở màn bằng Trailer
    showScreen("trailer-screen");

    // Đợi 2.6s để hiệu ứng trailer hoàn tất
    setTimeout(() => {
        // Kiểm tra xem đã có tài khoản lưu trong localStorage hoặc sessionStorage chưa
        const savedUser = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);

        if (savedUser) {
            // Đã đăng nhập trước đó -> Vào thẳng Bảng điều khiển
            showDashboard(savedUser);
        } else {
            // Chưa đăng nhập -> Chuyển sang Màn hình đăng nhập
            showScreen("login-screen");
        }
    }, TRAILER_DURATION_MS);
});


// ------------------------------------------------------------------------------
// 4. HÀM BẬT / TẮT HIỂN THỊ MẬT KHẨU (TOGGLE PASSWORD VISIBILITY)
// Tác dụng: Chuyển đổi giữa chế độ che mật khẩu (type="password") và đọc rõ (type="text")
// ------------------------------------------------------------------------------
function togglePasswordVisibility() {
    const passwordInput = document.getElementById("password");
    const eyeIcon = document.getElementById("eye-icon");

    if (passwordInput.type === "password") {
        // Chuyển sang hiển thị chữ thông thường
        passwordInput.type = "text";
        eyeIcon.innerText = "🙈"; // Đổi biểu tượng sang nhắm mắt / che mắt
    } else {
        // Chuyển về chế độ ẩn mật khẩu
        passwordInput.type = "password";
        eyeIcon.innerText = "👁️"; // Đổi lại biểu tượng con mắt mở
    }
}


// ------------------------------------------------------------------------------
// 5. HÀM XỬ LÝ ĐĂNG NHẬP (AUTHENTICATION HANDLER)
// Tác dụng: Lấy dữ liệu người dùng nhập, kiểm tra tính hợp lệ và cấp quyền điều khiển
// ------------------------------------------------------------------------------
function handleLogin(event) {
    event.preventDefault(); // Chặn tải lại trang của form HTML mặc định

    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value.trim();
    const rememberMe = document.getElementById("remember-me").checked;
    const errorMsg = document.getElementById("error-message");

    // Reset thông báo lỗi
    errorMsg.innerText = "";

    // Tìm tài khoản khớp trong danh sách hợp lệ
    const matched = AUTHORIZED_ACCOUNTS.find(
        acc => acc.username === usernameInput && acc.password === passwordInput
    );

    if (matched) {
        // Nếu chọn 'Ghi nhớ đăng nhập', lưu vào localStorage (lưu vĩnh viễn trên trình duyệt này)
        if (rememberMe) {
            localStorage.setItem(STORAGE_KEY, matched.username);
        } else {
            // Không chọn thì lưu sessionStorage (chỉ lưu cho tab này, đóng tab là hết)
            sessionStorage.setItem(STORAGE_KEY, matched.username);
        }

        // Chuyển vào Bảng điều khiển
        showDashboard(matched.username);
    } else {
        // Báo lỗi sai thông tin đăng nhập
        errorMsg.innerText = "❌ Tài khoản hoặc mật khẩu không chính xác!";
    }
}


// ------------------------------------------------------------------------------
// 6. HÀM HIỂN THỊ BẢNG ĐIỀU KHIỂN (SHOW DASHBOARD)
// Tác dụng: Cập nhật tên người đang giữ quyền điều khiển và kích hoạt màn hình
// ------------------------------------------------------------------------------
function showDashboard(username) {
    const userLabel = document.getElementById("current-user");
    if (userLabel) {
        userLabel.innerText = username;
    }
    showScreen("dashboard-screen");
}


// ------------------------------------------------------------------------------
// 7. HÀM ĐĂNG XUẤT (LOGOUT & RELEASE OPERATOR)
// Tác dụng:
// - Xóa thông tin đăng nhập khỏi bộ nhớ.
// - Nhường quyền điều khiển xe cho người tiếp theo trong hàng chờ.
// - Quay trở về màn hình Đăng nhập.
// ------------------------------------------------------------------------------
function handleLogout() {
    // Xóa phiên đăng nhập
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);

    // Xóa trắng dữ liệu form cũ và trả input password về lại type='password'
    document.getElementById("username").value = "";
    const passwordInput = document.getElementById("password");
    passwordInput.value = "";
    passwordInput.type = "password";
    document.getElementById("eye-icon").innerText = "👁️";
    document.getElementById("error-message").innerText = "";

    // Quay lại màn hình đăng nhập
    showScreen("login-screen");
}
