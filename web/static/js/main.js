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
        this.screens = document.querySelectorAll('.screen');
        this.currentScreenId = null;
    }

    /**
     * Kích hoạt hiển thị màn hình mục tiêu và ẩn các màn hình còn lại
     * @param {string} screenId - ID của màn hình cần hiển thị
     */
    show(screenId) {
        this.screens.forEach(screen => {
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
// 2. CLASS AUTH_MANAGER (Quản lý định danh, xác thực & phiên làm việc)
// ==============================================================================
class AuthManager {
    constructor() {
        // Khóa định danh lưu trong bộ nhớ trình duyệt
        this.storageKey = 'robot_car_active_user';
        
        // Danh sách tài khoản hợp lệ được cấp quyền điều khiển
        this.authorizedAccounts = [
            { username: 'sune', password: '24021197' }
        ];
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
                message: '❌ Tài khoản hoặc mật khẩu không chính xác!'
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
// 3. CLASS PASSWORD_FIELD_CONTROLLER (Điều khiển ô nhập mật khẩu & nút con mắt)
// ==============================================================================
class PasswordFieldController {
    constructor(inputSelector, iconSelector) {
        this.input = document.querySelector(inputSelector);
        this.icon = document.querySelector(iconSelector);
    }

    /**
     * Chuyển đổi trạng thái ẩn / hiện mật khẩu
     */
    toggle() {
        if (!this.input || !this.icon) return;

        if (this.input.type === 'password') {
            this.input.type = 'text';
            this.icon.innerText = '🙈'; // Chuyển sang biểu tượng che mắt khi đang hiện chữ
        } else {
            this.input.type = 'password';
            this.icon.innerText = '👁️'; // Chuyển lại biểu tượng con mắt khi che mật khẩu
        }
    }

    /**
     * Đặt lại trạng thái ban đầu (xóa text và đưa về dạng ẩn)
     */
    reset() {
        if (this.input) {
            this.input.value = '';
            this.input.type = 'password';
        }
        if (this.icon) {
            this.icon.innerText = '👁️';
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
        // 1. Luôn mở màn bằng Trailer công nghệ
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

        // 3. Gắn các sự kiện lắng nghe tương tác
        this.bindEvents();
    }

    /**
     * Gắn kết các sự kiện từ giao diện HTML
     */
    bindEvents() {
        // Bắt sự kiện nộp Form đăng nhập
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLoginFormSubmit(e));
        }

        // Bắt sự kiện nút con mắt ẩn/hiện mật khẩu
        const togglePwBtn = document.querySelector('.btn-toggle-pw');
        if (togglePwBtn) {
            togglePwBtn.addEventListener('click', () => this.pwController.toggle());
        }

        // Bắt sự kiện nút đăng xuất
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleUserLogout());
        }
    }

    /**
     * Xử lý sự kiện khi người dùng nhấn ĐĂNG NHẬP
     */
    handleLoginFormSubmit(event) {
        event.preventDefault();

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
// Khởi tạo đối tượng Singleton của hệ thống
let app = null;

window.addEventListener('DOMContentLoaded', () => {
    app = new DashboardApp();
    app.init();
});

// Giữ lại các hàm Wrapper toàn cục để tương thích 100% với các thuộc tính onclick/onsubmit inline cũ (nếu có)
function handleLogin(event) {
    if (app) app.handleLoginFormSubmit(event);
}

function togglePasswordVisibility() {
    if (app) app.pwController.toggle();
}

function handleLogout() {
    if (app) app.handleUserLogout();
}
