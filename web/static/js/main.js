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
        this.wifiController = new WiFiScreenController(this.screenManager);
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

        // 5. Xử lý click vào thẻ chức năng Wi-Fi để chuyển sang trang Wi-Fi
        const wifiCard = document.getElementById('card-wifi');
        if (wifiCard) {
            wifiCard.addEventListener('click', () => {
                this.wifiController.open();
            });
        }

        // 6. Xử lý nút quay lại Bảng điều khiển từ màn hình Wi-Fi
        const backBtn = document.getElementById('btn-back-dashboard');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.wifiController.close();
            });
        }

        // 7. Xử lý nút nguồn Bật / Tắt Wi-Fi
        const wifiPowerBtn = document.getElementById('wifi-power-toggle-btn');
        if (wifiPowerBtn) {
            wifiPowerBtn.addEventListener('click', () => {
                this.wifiController.togglePower();
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

    /**
     * Cập nhật trạng thái huy hiệu của thẻ chức năng linh hoạt
     * @param {string} cardSelector - Selector của thẻ (vd: '#card-wifi-bluetooth')
     * @param {'ready' | 'in_progress' | 'not_started'} statusKey - Loại trạng thái
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
// 5. CLASS WIFI_SCREEN_CONTROLLER (Quản lý giao diện & logic màn hình Wi-Fi)
// ==============================================================================
class WiFiScreenController {
    constructor(screenManager) {
        this.screenManager = screenManager;

        // Trạng thái cục bộ (mặc định lấy từ cấu hình phát sóng ESP32)
        this.isActive = false;
        this.ssid = 'WIFI ESP32 CUA SUNE';
        this.password = ''; // Chuỗi rỗng = Mạng mở không cần mật khẩu
        this.clientCount = 0;
        this.maxClients = 4;
        this.channel = 6;
        this.ip = '—';

        // Quản lý kết nối WebSocket tới Python Backend Server
        this.ws = null;
        this.wsConnected = false;
        this.initWebSocket();
    }

    /**
     * Khởi tạo kết nối WebSocket tới Python Backend (Port 8765)
     */
    initWebSocket() {
        const wsUrl = `ws://${window.location.hostname || 'localhost'}:8765`;
        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.wsConnected = true;
                console.log('[WebSocket] ✅ Đã kết nối tới Python Backend Server (COM3 Bridge)');
                // Yêu cầu lấy trạng thái mới nhất từ ESP32
                this.ws.send(JSON.stringify({ cmd: 'wifi_status' }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[WebSocket] 📥 Nhận phản hồi từ ESP32:', data);
                    this.updateFromHardware(data);
                } catch (e) {
                    console.error('[WebSocket] Lỗi giải mã JSON:', e);
                }
            };

            this.ws.onclose = () => {
                this.wsConnected = false;
                console.warn('[WebSocket] ⚠ Mất kết nối tới server. Đang thử kết nối lại sau 2.5s...');
                setTimeout(() => this.initWebSocket(), 2500);
            };

            this.ws.onerror = (err) => {
                this.wsConnected = false;
            };
        } catch (e) {
            console.error('[WebSocket] Không thể khởi tạo:', e);
        }
    }

    /**
     * Mở màn hình quản lý Wi-Fi và cập nhật giao diện
     */
    open() {
        this.screenManager.show('wifi-screen');
        // Nếu đã có kết nối WebSocket, gửi lệnh cập nhật trạng thái mới nhất từ ESP32
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ cmd: 'wifi_status' }));
        }
        this.render();
    }

    /**
     * Quay về Bảng điều khiển chức năng
     */
    close() {
        this.screenManager.show('dashboard-screen');
    }

    /**
     * Chuyển đổi trạng thái Bật / Tắt nguồn Wi-Fi
     * Gửi lệnh trực tiếp xuống Python Server -> truyền qua COM3 tới ESP32
     */
    togglePower() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Hiệu ứng chờ phản hồi
            const statusLabel = document.getElementById('wifi-power-status-text');
            if (statusLabel) statusLabel.textContent = 'Đang xử lý...';

            this.ws.send(JSON.stringify({ cmd: 'wifi_toggle' }));
            console.log('[WiFi] 📤 Đã gửi lệnh wifi_toggle tới Python Backend');
        } else {
            console.warn('[WiFi] ⚠ Chưa kết nối tới Python Server (Chạy python python_app/app.py)');
            // Fallback thay đổi trực quan trên giao diện nếu chưa bật backend
            this.isActive = !this.isActive;
            this.render();
        }
    }

    /**
     * Cập nhật toàn bộ thành phần giao diện theo trạng thái hiện tại
     */
    render() {
        const powerBtn = document.getElementById('wifi-power-toggle-btn');
        const statusLabel = document.getElementById('wifi-power-status-text');
        const cardContainer = document.querySelector('.wifi-control-card');
        const liveBar = document.getElementById('wifi-live-bar');
        const liveText = document.getElementById('wifi-live-text');

        const ssidEl = document.getElementById('wifi-ssid-val');
        const passEl = document.getElementById('wifi-password-val');
        const clientCountEl = document.getElementById('wifi-client-count');
        const clientMaxEl = document.getElementById('wifi-client-max');
        const ipEl = document.getElementById('wifi-ip-val');
        const channelEl = document.getElementById('wifi-channel-val');

        // Cập nhật thông số hiển thị
        if (ssidEl) ssidEl.textContent = this.ssid;
        if (passEl) {
            passEl.textContent = (!this.password || this.password.trim() === '') 
                ? 'Mạng mở (Không mật khẩu)' 
                : this.password;
        }
        if (clientCountEl) clientCountEl.textContent = this.isActive ? this.clientCount : '—';
        if (clientMaxEl) clientMaxEl.textContent = `/ ${this.maxClients} thiết bị`;
        if (ipEl) ipEl.textContent = this.isActive ? (this.ip || '192.168.4.1') : '—';
        if (channelEl) channelEl.textContent = `Kênh ${this.channel} (2.4 GHz)`;

        // Cập nhật hiệu ứng nút nguồn và thanh trạng thái
        if (this.isActive) {
            if (powerBtn) powerBtn.classList.add('wifi-on');
            if (statusLabel) statusLabel.textContent = 'BẬT (Đang phát sóng)';
            if (cardContainer) cardContainer.classList.add('is-active');
            if (liveBar) liveBar.classList.add('active-broadcast');
            if (liveText) liveText.textContent = `Đang phát sóng Access Point: ${this.ssid}`;
        } else {
            if (powerBtn) powerBtn.classList.remove('wifi-on');
            if (statusLabel) statusLabel.textContent = 'TẮT';
            if (cardContainer) cardContainer.classList.remove('is-active');
            if (liveBar) liveBar.classList.remove('active-broadcast');
            if (liveText) liveText.textContent = 'Wi-Fi đang ở trạng thái TẮT';
        }
    }

    /**
     * Cập nhật dữ liệu thực tế nhận từ ESP32 qua WebSocket
     */
    updateFromHardware(data) {
        if (!data) return;
        if (typeof data.active === 'boolean') this.isActive = data.active;
        if (data.ssid) this.ssid = data.ssid;
        if (data.password !== undefined) this.password = data.password;
        if (typeof data.clients === 'number') this.clientCount = data.clients;
        if (typeof data.max_clients === 'number') this.maxClients = data.max_clients;
        if (data.ip) this.ip = data.ip;
        if (data.channel) this.channel = data.channel;
        this.render();
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
