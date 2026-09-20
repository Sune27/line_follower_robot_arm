/**
 * ==============================================================================
 * HỆ THỐNG ĐIỀU KHIỂN XE DÒ LINE & CÁNH TAY ROBOT 4-DOF
 * Kiến trúc: Lập trình Hướng Đối Tượng (Object-Oriented Programming - ES6 Class)
 * Môn học: Lập trình nâng cao & Mạng truyền thông công nghiệp
 * ==============================================================================
 */

// ==============================================================================
// 1. CLASS SCREEN_MANAGER (Quản lý chuyển đổi các màn hình giao diện)
// ==============================================================================
class ScreenManager {
    constructor() {
        this.currentScreenId = null;
    }

    /**
     * Kích hoạt hiển thị màn hình mục tiêu và ẩn các màn hình còn lại
     * @param {string} screenId - ID của màn hình cần hiển thị
     */
    show(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            screen.classList.remove('active');
        });

        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreenId = screenId;
        } else {
            console.error(`[ScreenManager] Không tìm thấy màn hình có ID: ${screenId}`);
        }
    }

    getCurrentScreenId() {
        return this.currentScreenId;
    }
}


// ==============================================================================
// 2. CLASS AUTH_MANAGER (Quản lý định danh, xác thực & danh sách tài khoản)
// ==============================================================================
class AuthManager {
    constructor() {
        // Khóa định danh lưu trong bộ nhớ trình duyệt
        this.storageKey = 'robot_car_active_user';
        
        // Danh sách các tài khoản hợp lệ được cấp quyền truy cập hệ thống
        this.authorizedAccounts = [
            { username: 'sune', password: '24021197' }, // Tài khoản quản trị chính
            { username: 'tung', password: '24020000' }, // Tài khoản thành viên 2
            { username: 'hung', password: '24020001' }  // Tài khoản thành viên 3
        ];
    }

    /**
     * Thêm tài khoản mới vào danh sách ủy quyền (tiện ích mở rộng động)
     * @param {string} username
     * @param {string} password
     */
    addAccount(username, password) {
        if (!username || !password) return false;
        this.authorizedAccounts.push({
            username: username.trim(),
            password: password.trim()
        });
        return true;
    }

    /**
     * Xác thực thông tin đăng nhập
     * @param {string} username - Tên đăng nhập
     * @param {string} password - Mật khẩu
     * @param {boolean} rememberMe - Có ghi nhớ phiên làm việc hay không
     * @returns {Object} { success: boolean, message: string, user?: string }
     */
    login(username, password, rememberMe) {
        const cleanUser = username.trim();
        const cleanPass = password.trim();

        const matched = this.authorizedAccounts.find(
            acc => acc.username === cleanUser && acc.password === cleanPass
        );

        if (!matched) {
            return {
                success: false,
                message: '❌ Sai tên đăng nhập hoặc mật khẩu!'
            };
        }

        // Lưu phiên đăng nhập
        if (rememberMe) {
            localStorage.setItem(this.storageKey, matched.username);
        } else {
            sessionStorage.setItem(this.storageKey, matched.username);
        }

        return {
            success: true,
            message: 'Đăng nhập thành công',
            user: matched.username
        };
    }

    /**
     * Đăng xuất và giải phóng quyền điều khiển cho người tiếp theo
     */
    logout() {
        localStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.storageKey);
    }

    /**
     * Lấy tên người dùng hiện đang giữ phiên đăng nhập (nếu có)
     * @returns {string|null}
     */
    getActiveUser() {
        return localStorage.getItem(this.storageKey) || sessionStorage.getItem(this.storageKey);
    }

    /**
     * Kiểm tra thiết bị này đã đăng nhập hay chưa
     * @returns {boolean}
     */
    isLoggedIn() {
        return this.getActiveUser() !== null;
    }
}


// ==============================================================================
// 3. CLASS PASSWORD_FIELD_CONTROLLER (Điều khiển ẩn/hiện mật khẩu chống xung đột)
// ==============================================================================
class PasswordFieldController {
    constructor(inputSelector, iconSelector) {
        this.inputSelector = inputSelector;
        this.iconSelector = iconSelector;
        this.lastToggleTime = 0; // Khóa chống kích hoạt lặp (debounce)
    }

    getInput() {
        return document.querySelector(this.inputSelector);
    }

    getIcon() {
        return document.querySelector(this.iconSelector);
    }

    /**
     * Chuyển đổi trạng thái ẩn / hiện mật khẩu
     * Có cơ chế Debounce 250ms để ngăn chặn sự cố double-click hoặc kích hoạt 2 lần liên tiếp
     */
    toggle() {
        const now = Date.now();
        if (now - this.lastToggleTime < 250) {
            return; // Chặn nếu kích hoạt quá nhanh (dưới 250ms)
        }
        this.lastToggleTime = now;

        const input = this.getInput();
        const icon = this.getIcon();
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.innerText = '🙈'; // Chuyển sang biểu tượng che mắt khi đang hiện chữ
        } else {
            input.type = 'password';
            icon.innerText = '👁️'; // Chuyển lại biểu tượng con mắt khi che mật khẩu
        }

        // Đảm bảo con trỏ vẫn nằm trong ô mật khẩu để người dùng tiện chỉnh sửa
        input.focus();
    }

    /**
     * Đặt lại trạng thái ban đầu (xóa text và đưa về dạng ẩn)
     */
    reset() {
        const input = this.getInput();
        const icon = this.getIcon();
        if (input) {
            input.value = '';
            input.type = 'password';
        }
        if (icon) {
            icon.innerText = '👁️';
        }
    }
}


// ==============================================================================
// 4. CLASS DASHBOARD_APP (Lớp ứng dụng trung tâm - Điều phối toàn bộ hệ thống)
// ==============================================================================
class DashboardApp {
    constructor() {
        this.trailerDuration = 2600; // Thời gian chạy trailer (ms)
        this.screenManager = new ScreenManager();
        this.authManager = new AuthManager();
        this.pwController = new PasswordFieldController('#password', '#eye-icon');
    }

    /**
     * Khởi tạo ứng dụng khi DOM đã sẵn sàng
     */
    init() {
        // 1. Mở màn bằng Trailer công nghệ
        this.screenManager.show('trailer-screen');

        // 2. Thiết lập bộ hẹn giờ chuyển cảnh sau khi trailer chạy xong
        setTimeout(() => {
            if (this.authManager.isLoggedIn()) {
                // Nếu đã lưu phiên trước đó -> Vào thẳng Bảng điều khiển
                this.enterDashboard(this.authManager.getActiveUser());
            } else {
                // Nếu chưa đăng nhập -> Chuyển sang Màn hình đăng nhập
                this.screenManager.show('login-screen');
            }
        }, this.trailerDuration);

        // 3. Gắn kết các sự kiện lắng nghe tương tác
        this.bindEvents();
    }

    /**
     * Gắn kết các sự kiện từ giao diện HTML
     */
    bindEvents() {
        // 1. Xử lý Form đăng nhập
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.removeAttribute('onsubmit'); // Gỡ bỏ inline onsubmit cũ nếu có
            loginForm.addEventListener('submit', (e) => this.handleLoginFormSubmit(e));
        }

        // 2. Xử lý nút con mắt ẩn/hiện mật khẩu
        const togglePwBtn = document.querySelector('.btn-toggle-pw');
        if (togglePwBtn) {
            togglePwBtn.removeAttribute('onclick'); // Gỡ bỏ inline onclick cũ để tránh bị gọi 2 lần liên tiếp
            togglePwBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.pwController.toggle();
            });
        }

        // 3. Xử lý nút đăng xuất
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.removeAttribute('onclick'); // Gỡ bỏ inline onclick cũ
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleUserLogout();
            });
        }

        // 4. Tự động xóa dòng thông báo lỗi khi người dùng bắt đầu gõ lại tài khoản hoặc mật khẩu
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const clearErrorMessage = () => {
            const errorMsgElement = document.getElementById('error-message');
            if (errorMsgElement && errorMsgElement.innerText !== '') {
                errorMsgElement.innerText = '';
            }
        };

        if (usernameInput) usernameInput.addEventListener('input', clearErrorMessage);
        if (passwordInput) passwordInput.addEventListener('input', clearErrorMessage);
    }

    /**
     * Xử lý sự kiện khi người dùng nhấn ĐĂNG NHẬP
     */
    handleLoginFormSubmit(event) {
        if (event) event.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const rememberCheckbox = document.getElementById('remember-me');
        const errorMsgElement = document.getElementById('error-message');

        if (!usernameInput || !passwordInput) return;

        // Xóa thông báo lỗi cũ
        if (errorMsgElement) errorMsgElement.innerText = '';

        // Gọi phương thức login từ AuthManager
        const result = this.authManager.login(
            usernameInput.value,
            passwordInput.value,
            rememberCheckbox ? rememberCheckbox.checked : false
        );

        if (result.success) {
            this.enterDashboard(result.user);
        } else {
            if (errorMsgElement) {
                errorMsgElement.innerText = result.message;
            }
            // Không xóa nội dung mật khẩu để người dùng có thể bấm nút con mắt xem lại mật khẩu vừa gõ
        }
    }

    /**
     * Đưa người dùng vào Bảng điều khiển
     * @param {string} username - Tên người điều khiển
     */
    enterDashboard(username) {
        const currentUserElement = document.getElementById('current-user');
        if (currentUserElement) {
            currentUserElement.innerText = username;
        }
        this.screenManager.show('dashboard-screen');
    }

    /**
     * Xử lý đăng xuất
     */
    handleUserLogout() {
        this.authManager.logout();

        // Dọn dẹp các trường input form
        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = '';
        this.pwController.reset();

        const errorMsgElement = document.getElementById('error-message');
        if (errorMsgElement) errorMsgElement.innerText = '';

        // Đưa về màn hình đăng nhập
        this.screenManager.show('login-screen');
    }
}


// ==============================================================================
// 5. KHỞI ĐỘNG ỨNG DỤNG (ENTRY POINT)
// ==============================================================================
let app = null;

window.addEventListener('DOMContentLoaded', () => {
    app = new DashboardApp();
    app.init();
});

// Giữ lại các hàm Wrapper toàn cục có debounce để tương thích 100% nếu có gọi từ bên ngoài
function handleLogin(event) {
    if (app) app.handleLoginFormSubmit(event);
}

function togglePasswordVisibility() {
    if (app) app.pwController.toggle();
}

function handleLogout() {
    if (app) app.handleUserLogout();
}
