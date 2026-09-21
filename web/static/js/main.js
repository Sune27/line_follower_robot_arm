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
// ==============================================================================
// 4. CLASS WEBSOCKET_CLIENT (Quản lý kết nối thời gian thực tới Backend Server)
// ==============================================================================
class WebSocketClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.init();
    }

    init() {
        const isHttps = window.location.protocol === 'https:';
        const wsProtocol = isHttps ? 'wss:' : 'ws:';
        const wsUrl = (window.location.port === '5000' || isHttps)
            ? `${wsProtocol}//${window.location.host}/ws`
            : `${wsProtocol}//${window.location.hostname || 'localhost'}:8765`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('[WebSocket] ✅ Đã kết nối tới Server máy chủ');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[WebSocket] 📥 Nhận dữ liệu:', data);
                } catch (e) {
                    console.error('[WebSocket] Lỗi giải mã JSON:', e);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.warn('[WebSocket] ⚠ Mất kết nối tới server. Đang thử kết nối lại sau 3s...');
                setTimeout(() => this.init(), 3000);
            };

            this.ws.onerror = () => {
                this.connected = false;
            };
        } catch (e) {
            console.error('[WebSocket] Không thể khởi tạo:', e);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        }
    }
}


// ==============================================================================
// 5. CLASS DASHBOARD_APP (Lớp ứng dụng trung tâm - Điều phối toàn bộ hệ thống)
// ==============================================================================
class DashboardApp {
    constructor() {
        this.trailerDuration = 2600; // Thời gian chạy trailer (ms)
        this.screenManager = new ScreenManager();
        this.authManager = new AuthManager();
        this.pwController = new PasswordFieldController('#password', '#eye-icon');
        this.wsClient = new WebSocketClient();
    }

    /**
     * Khởi tạo ứng dụng khi DOM đã sẵn sàng
     */
    init() {
        // Khởi đầu: Hiển thị ngay Màn hình Đăng nhập trước tiên
        this.screenManager.show('login-screen');

        // Gắn kết các sự kiện lắng nghe tương tác
        this.bindEvents();
    }

    /**
     * Gắn kết các sự kiện từ giao diện HTML
     */
    bindEvents() {
        // 1. Xử lý Form đăng nhập
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.removeAttribute('onsubmit');
            loginForm.addEventListener('submit', (e) => this.handleLoginFormSubmit(e));
        }

        // 2. Xử lý nút con mắt ẩn/hiện mật khẩu
        const togglePwBtn = document.querySelector('.btn-toggle-pw');
        if (togglePwBtn) {
            togglePwBtn.removeAttribute('onclick');
            togglePwBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.pwController.toggle();
            });
        }

        // 3. Xử lý nút đăng xuất
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.removeAttribute('onclick');
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleUserLogout();
            });
        }

        // 4. Tự động xóa dòng thông báo lỗi khi người dùng gõ phím
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

        // 5. Thẻ Wi-Fi: Click vào để mở Bảng thông tin Giám sát mạng không dây
        const wifiCard = document.getElementById('card-wifi');
        const wifiModal = document.getElementById('wifi-info-modal');
        const closeBtn = document.getElementById('btn-close-wifi-modal');
        const okBtn = document.getElementById('btn-ok-wifi-modal');

        const openWifiModal = () => {
            if (wifiModal) wifiModal.style.display = 'flex';
        };

        const closeWifiModal = () => {
            if (wifiModal) wifiModal.style.display = 'none';
        };

        if (wifiCard) wifiCard.addEventListener('click', openWifiModal);
        if (closeBtn) closeBtn.addEventListener('click', closeWifiModal);
        if (okBtn) okBtn.addEventListener('click', closeWifiModal);

        // Đóng khi click vào vùng nền mờ bên ngoài
        if (wifiModal) {
            wifiModal.addEventListener('click', (e) => {
                if (e.target === wifiModal) closeWifiModal();
            });
        }
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

        if (errorMsgElement) errorMsgElement.innerText = '';

        const result = this.authManager.login(
            usernameInput.value,
            passwordInput.value,
            rememberCheckbox ? rememberCheckbox.checked : false
        );

        if (result.success) {
            this.playTrailerAndEnterDashboard(result.user);
        } else {
            if (errorMsgElement) {
                errorMsgElement.innerText = result.message;
            }
        }
    }

    /**
     * Hiển thị Trailer công nghệ chào mừng sau khi đăng nhập thành công
     */
    playTrailerAndEnterDashboard(username) {
        const currentUserElement = document.getElementById('current-user');
        if (currentUserElement) {
            currentUserElement.innerText = username;
        }

        this.screenManager.show('trailer-screen');

        // Báo cho backend biết người dùng đã đăng nhập thành công
        this.wsClient.send({ cmd: 'login_success', user: username });

        // Reset thanh nạp dữ liệu animation
        const loadingFill = document.querySelector('.loading-bar-fill');
        if (loadingFill) {
            loadingFill.style.animation = 'none';
            void loadingFill.offsetWidth;
            loadingFill.style.animation = '';
        }

        setTimeout(() => {
            this.enterDashboard(username);
        }, this.trailerDuration);
    }

    /**
     * Đưa người dùng vào Bảng điều khiển
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
        // Gửi thông báo xuống Python backend
        this.wsClient.send({ cmd: 'logout_and_stop' });

        this.authManager.logout();

        const usernameInput = document.getElementById('username');
        if (usernameInput) usernameInput.value = '';
        this.pwController.reset();

        const errorMsgElement = document.getElementById('error-message');
        if (errorMsgElement) errorMsgElement.innerText = '';

        this.screenManager.show('login-screen');
    }

    /**
     * Cập nhật trạng thái huy hiệu của thẻ chức năng linh hoạt
     */
    setCardStatus(cardSelector, statusKey) {
        const card = document.querySelector(cardSelector);
        if (!card) return;

        const badge = card.querySelector('.card-status-badge');
        const textEl = card.querySelector('.status-text');
        if (!badge || !textEl) return;

        badge.classList.remove('status-ready', 'status-in-progress', 'status-not-started');

        switch (statusKey) {
            case 'ready':
                badge.classList.add('status-ready');
                textEl.textContent = 'Sẵn sàng';
                break;
            case 'in_progress':
                badge.classList.add('status-in-progress');
                textEl.textContent = 'Đang phát triển';
                break;
            case 'not_started':
            default:
                badge.classList.add('status-not-started');
                textEl.textContent = 'Chưa phát triển';
                break;
        }
    }
}


// ==============================================================================
// 6. KHỞI ĐỘNG ỨNG DỤNG (ENTRY POINT)
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
