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
        // Khóa định danh lưu trong bộ nhớ phiên làm việc của trình duyệt
        this.storageKey = 'robot_car_active_user';
        
        // Xóa sạch mọi phiên ghi nhớ cũ trong localStorage nếu có
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {}

        // Danh sách các tài khoản hợp lệ được cấp quyền truy cập hệ thống
        this.authorizedAccounts = [
            { username: 'sune', password: '24021197' }, // Tài khoản quản trị chính
            { username: 'tung', password: '24020000' }, // Tài khoản thành viên 2
            { username: 'hung', password: '24020001' }, // Tài khoản thành viên 3
            { username: 'nghia', password: 'dcmnghiatruong' } // Tài khoản thành viên 4
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
     * Kiểm tra thông tin tài khoản hợp lệ
     * @param {string} username
     * @param {string} password
     * @returns {Object} { success: boolean, message?: string, user?: string }
     */
    checkCredentials(username, password) {
        const cleanUser = (username || '').trim();
        const cleanPass = (password || '').trim();

        const matched = this.authorizedAccounts.find(
            acc => acc.username === cleanUser && acc.password === cleanPass
        );

        if (!matched) {
            return {
                success: false,
                message: '❌ Sai tên đăng nhập hoặc mật khẩu!'
            };
        }
        return {
            success: true,
            user: matched.username
        };
    }

    /**
     * Lưu phiên đăng nhập sau khi được Server cấp quyền điều khiển
     */
    saveSession(username) {
        sessionStorage.setItem(this.storageKey, username);
    }

    /**
     * Xác thực thông tin đăng nhập (cục bộ)
     */
    login(username, password) {
        const check = this.checkCredentials(username, password);
        if (!check.success) return check;

        this.saveSession(check.user);
        return {
            success: true,
            message: 'Đăng nhập thành công',
            user: check.user
        };
    }

    /**
     * Đăng xuất và giải phóng quyền điều khiển cho người tiếp theo
     */
    logout() {
        sessionStorage.removeItem(this.storageKey);
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {}
    }

    /**
     * Lấy tên người dùng hiện đang giữ phiên đăng nhập (nếu có)
     * @returns {string|null}
     */
    getActiveUser() {
        return sessionStorage.getItem(this.storageKey);
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
        this.telemetryCallback = null;
        this.init();
    }

    init() {
        const isFile = window.location.protocol === 'file:';
        const isHttps = window.location.protocol === 'https:';
        const wsProtocol = isHttps ? 'wss:' : 'ws:';
        const wsUrl = isFile
            ? 'ws://localhost:8765'
            : `${wsProtocol}//${window.location.host}/ws`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('[WebSocket] ✅ Đã kết nối tới Server máy chủ');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // console.log('[WebSocket] 📥 Nhận gói tin:', data);

                    // Xử lý cập nhật thông tin Wi-Fi thời gian thực (Real-time)
                    if (data.event === 'wifi_status' || data.event === 'wifi_heartbeat') {
                        this.updateWifiRealtimeUI(data);
                        // Tắt xoay spinner nếu đang bấm nút làm mới
                        const btnRefresh = document.getElementById('btn-refresh-wifi');
                        const textRefresh = document.getElementById('btn-refresh-wifi-text');
                        if (btnRefresh) btnRefresh.classList.remove('spinning');
                        if (textRefresh) textRefresh.textContent = 'Cập nhật trạng thái Wi-Fi';

                    } else if (data.event === 'emergency') {
                        console.warn('[HỆ THỐNG] 🚨 CHẾ ĐỘ KHẨN CẤP ĐÃ KÍCH HOẠT:', data.msg);
                        const banner = document.getElementById('global-emergency-banner');
                        const bannerDesc = document.getElementById('emergency-banner-desc');
                        if (banner) banner.style.display = 'block';
                        if (bannerDesc && data.msg) bannerDesc.textContent = data.msg;

                        // Tự động dừng đo liên tục nếu đang bật
                        if (window.app && window.app.ultrasonicController && window.app.ultrasonicController.isStreaming) {
                            window.app.ultrasonicController.toggleStream(false);
                        }

                    } else if (data.event === 'emergency_resolved') {
                        console.log('[HỆ THỐNG] 🎉 CHẾ ĐỘ KHẨN CẤP ĐÃ ĐƯỢC GIẢI QUYẾT:', data.msg);
                        const banner = document.getElementById('global-emergency-banner');
                        if (banner) banner.style.display = 'none';

                        if (data.wifi) {
                            this.updateWifiRealtimeUI(data.wifi);
                        }

                    } else if (data.event === 'telemetry') {
                        if (data.wifi) {
                            this.updateWifiRealtimeUI(data.wifi);
                        }
                        if (this.telemetryCallback) {
                            this.telemetryCallback(data);
                        } else {
                            if (window.app && window.app.ultrasonicController) {
                                window.app.ultrasonicController.handleTelemetry(data.sensor || data);
                            }
                            if (window.app && window.app.tcrtController) {
                                window.app.tcrtController.handleTelemetry(data);
                            }
                            if (window.app && window.app.tb6612Controller) {
                                window.app.tb6612Controller.handleTelemetry(data);
                            }
                        }
                    } else if (data.sensor || data.tcrt5000 || data.motor || data.distance_cm !== undefined) {
                        if (this.telemetryCallback) {
                            this.telemetryCallback(data);
                        } else {
                            if (window.app && window.app.ultrasonicController) {
                                window.app.ultrasonicController.handleTelemetry(data.sensor || data);
                            }
                            if (window.app && window.app.tcrtController) {
                                window.app.tcrtController.handleTelemetry(data);
                            }
                            if (window.app && window.app.tb6612Controller) {
                                window.app.tb6612Controller.handleTelemetry(data);
                            }
                        }
                    } else if (data.event === 'login_response') {
                        if (this.loginResponseCallback) {
                            this.loginResponseCallback(data);
                        }
                    } else if (data.event === 'controller_status') {
                        if (this.controllerStatusCallback) {
                            this.controllerStatusCallback(data);
                        }
                    } else if (data.event === 'command_rejected') {
                        alert(data.message || '❌ Hành động bị từ chối!');
                    }
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

    updateWifiRealtimeUI(data) {
        const ssidEl = document.getElementById('modal-wifi-ssid');
        const statusEl = document.getElementById('modal-wifi-status');
        const ipEl = document.getElementById('modal-wifi-ip');

        const isConnected = data.connected === true;

        if (statusEl) {
            statusEl.className = 'wifi-status-pill ' + (isConnected ? 'online' : 'offline');
            statusEl.textContent = isConnected ? 'Đã kết nối' : 'Không kết nối';
        }

        if (ssidEl) {
            ssidEl.textContent = isConnected ? (data.ssid || 'Sune') : 'Chưa kết nối';
            if (isConnected) {
                ssidEl.classList.add('highlight-cyan');
            } else {
                ssidEl.classList.remove('highlight-cyan');
            }
        }

        if (ipEl) {
            ipEl.textContent = isConnected ? (data.ip || '—') : '—';
        }
    }

    send(data) {
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('[WebSocket] 📤 Gửi lệnh:', payload);
            this.ws.send(payload);
        } else {
            console.warn('[WebSocket] ⚠ Chưa kết nối tới server máy chủ! Trạng thái readyState:', this.ws ? this.ws.readyState : 'null');
        }
    }
}


// ==============================================================================
// 5. CLASS ULTRASONIC_CHART_CONTROLLER (Quản lý Cảm biến RCWL-1601 & Biểu đồ Canvas)
// ==============================================================================
class UltrasonicChartController {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.canvas = document.getElementById('ultrasonic-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.wrapper = document.getElementById('canvas-wrapper');

        this.dataPoints = []; // Mảng chứa các mẫu đo: { timestamp, distance, isObstacle }
        this.maxPoints = 30;  // Hiển thị tối đa 30 mẫu trượt trên màn hình
        this.isStreaming = false;
        this.isMeasuringOnce = false;

        // Giới hạn trục Y (0 -> 40 cm)
        this.maxY = 40;
        this.minY = 0;
        this.dangerThreshold = 10.0; // cm
        this.statsVisible = true;    // Trạng thái bật/tắt hiển thị & tính toán phân tích thống kê

        this.init();
    }

    init() {
        if (!this.canvas) return;

        // Lắng nghe thay đổi kích thước cửa sổ để tự co giãn biểu đồ
        window.addEventListener('resize', () => {
            if (document.getElementById('ultrasonic-screen')?.classList.contains('active')) {
                this.resizeCanvas();
                this.draw();
            }
        });

        // Bắt sự kiện nút Ẩn/Hiện thông số phân tích
        const btnToggleStats = document.getElementById('btn-toggle-stats');
        if (btnToggleStats) {
            btnToggleStats.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleStats();
            });
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.wrapper) return;
        const rect = this.wrapper.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);

        if (this.ctx) {
            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset scale
            this.ctx.scale(dpr, dpr);
        }
        this.displayWidth = rect.width;
        this.displayHeight = rect.height;
    }

    onScreenActivated() {
        setTimeout(() => {
            this.resizeCanvas();
            this.draw();
        }, 60);
    }

    onScreenDeactivated() {
        if (this.isStreaming) {
            this.toggleStream(false);
        }
    }

    handleTelemetry(sensorData) {
        if (!sensorData) return;
        const distance = typeof sensorData.distance_cm === 'number' 
            ? sensorData.distance_cm 
            : parseFloat(sensorData.distance_cm);

        const isObstacle = sensorData.obstacle_detected === true || (distance > 0 && distance <= this.dangerThreshold);

        console.log(`[Ultrasonic] 📊 Cập nhật: ${distance} cm | Vật cản: ${isObstacle}`);
        this.addPoint(distance, isObstacle);
    }

    addPoint(distance, isObstacle) {
        const point = {
            time: new Date(),
            distance: distance,
            isObstacle: isObstacle
        };

        this.dataPoints.push(point);
        if (this.dataPoints.length > this.maxPoints) {
            this.dataPoints.shift();
        }

        this.updateUI(distance, isObstacle);
        this.draw();
    }

    updateUI(distance, isObstacle) {
        const valEl = document.getElementById('distance-display-val');
        const alarmBanner = document.getElementById('alarm-banner');
        const alarmIcon = document.getElementById('alarm-icon');
        const alarmText = document.getElementById('alarm-text');
        const gaugeFill = document.getElementById('gauge-bar-fill');
        const gaugeReading = document.getElementById('gauge-reading-text');

        // 1. Số Neon lớn
        if (valEl) {
            valEl.classList.remove('neon-danger', 'neon-out-range');
            if (distance < 0) {
                valEl.textContent = '--.-';
                valEl.classList.add('neon-out-range');
            } else {
                valEl.textContent = distance.toFixed(1);
                if (isObstacle) {
                    valEl.classList.add('neon-danger');
                }
            }
        }

        // 2. Banner Cảnh báo
        if (alarmBanner && alarmText && alarmIcon) {
            alarmBanner.classList.remove('banner-safe', 'banner-danger');
            if (distance < 0) {
                alarmBanner.classList.add('banner-safe');
                alarmIcon.textContent = 'ℹ️';
                alarmText.textContent = '[THÔNG BÁO] NGOÀI TẦM ĐO / TIMEOUT';
            } else if (isObstacle) {
                alarmBanner.classList.add('banner-danger');
                alarmIcon.textContent = '⚠️';
                alarmText.textContent = `[CẢNH BÁO] CÓ VẬT CẢN (<${this.dangerThreshold}cm)!`;
            } else {
                alarmBanner.classList.add('banner-safe');
                alarmIcon.textContent = '🛡️';
                alarmText.textContent = '[OK] ĐƯỜNG TRỐNG AN TOÀN';
            }
        }

        // 3. Vạch thước đo quang học Gauge
        if (gaugeFill && gaugeReading) {
            const displayDist = distance > 0 ? distance : 0;
            const pct = Math.min(100, Math.max(0, (displayDist / this.maxY) * 100));
            gaugeFill.style.width = `${pct}%`;
            gaugeReading.textContent = `${displayDist.toFixed(1)} cm`;
        }

        // 4. Cập nhật phân tích số liệu (CHỈ tính toán khi statsVisible = true)
        if (this.statsVisible) {
            this.updateStats();
        }
    }

    toggleStats(forceState = null) {
        this.statsVisible = forceState !== null ? forceState : !this.statsVisible;

        const grid = document.getElementById('stats-overview-grid');
        const btn = document.getElementById('btn-toggle-stats');
        const icon = document.getElementById('toggle-stats-icon');
        const text = document.getElementById('toggle-stats-text');
        const badge = document.getElementById('stats-calc-status');

        if (this.statsVisible) {
            if (grid) grid.style.display = 'grid';
            if (btn) btn.classList.remove('hidden-state');
            if (icon) icon.textContent = '👁️';
            if (text) text.textContent = 'Ẩn thông số';
            if (badge) {
                badge.textContent = 'Đang tính toán';
                badge.className = 'stats-header-badge badge-active';
            }
            // Khi hiện: Kích hoạt tính toán và hiển thị ngay lập tức
            this.updateStats();
        } else {
            if (grid) grid.style.display = 'none';
            if (btn) btn.classList.add('hidden-state');
            if (icon) icon.textContent = '👁️‍🗨️';
            if (text) text.textContent = 'Hiện thông số';
            if (badge) {
                badge.textContent = 'Tạm dừng tính toán';
                badge.className = 'stats-header-badge badge-paused';
            }
            // Khi ẩn: Không hiển thị và KHÔNG thực hiện tính toán
        }
    }

    updateStats() {
        // ĐẢM BẢO YÊU CẦU: Nếu đang ẩn thì TUYỆT ĐỐI KHÔNG tính toán
        if (!this.statsVisible) return;

        const avgEl = document.getElementById('stat-avg');
        const stdEl = document.getElementById('stat-std');
        const q1El = document.getElementById('stat-q1');
        const q2El = document.getElementById('stat-q2');
        const q3El = document.getElementById('stat-q3');
        const samplesEl = document.getElementById('stat-samples');

        const validDistances = this.dataPoints
            .map(p => p.distance)
            .filter(d => d > 0);

        if (samplesEl) {
            samplesEl.textContent = this.dataPoints.length;
        }

        if (validDistances.length === 0) {
            if (avgEl) avgEl.textContent = '--.- cm';
            if (stdEl) stdEl.textContent = '--.- cm';
            if (q1El) q1El.textContent = '--.- cm';
            if (q2El) q2El.textContent = '--.- cm';
            if (q3El) q3El.textContent = '--.- cm';
            return;
        }

        // 1. Cự ly trung bình (Mean / Avg)
        const n = validDistances.length;
        const sum = validDistances.reduce((acc, v) => acc + v, 0);
        const avg = sum / n;

        // 2. Độ lệch chuẩn (Sample Standard Deviation)
        let std = 0;
        if (n > 1) {
            const variance = validDistances.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / (n - 1);
            std = Math.sqrt(variance);
        }

        // 3. Tứ phân vị Q1, Q2 (Median), Q3 (Nội suy tuyến tính phân vị chuẩn)
        const sorted = [...validDistances].sort((a, b) => a - b);
        const getPercentile = (arr, p) => {
            if (arr.length === 0) return 0;
            if (arr.length === 1) return arr[0];
            const idx = (arr.length - 1) * p;
            const low = Math.floor(idx);
            const high = Math.ceil(idx);
            const weight = idx - low;
            return arr[low] * (1 - weight) + arr[high] * weight;
        };

        const q1 = getPercentile(sorted, 0.25);
        const q2 = getPercentile(sorted, 0.50);
        const q3 = getPercentile(sorted, 0.75);

        // Hiển thị kết quả ra giao diện
        if (avgEl) avgEl.textContent = `${avg.toFixed(1)} cm`;
        if (stdEl) stdEl.textContent = `±${std.toFixed(2)} cm`;
        if (q1El) q1El.textContent = `${q1.toFixed(1)} cm`;
        if (q2El) q2El.textContent = `${q2.toFixed(1)} cm`;
        if (q3El) q3El.textContent = `${q3.toFixed(1)} cm`;
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.displayWidth || this.canvas.width;
        const h = this.displayHeight || this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 52;
        const padRight = 30;
        const padTop = 32;
        const padBottom = 35;
        const chartW = w - padLeft - padRight;
        const chartH = h - padTop - padBottom;

        if (chartW <= 0 || chartH <= 0) return;

        // 1. Vẽ lưới ngang và nhãn trục Y (0 - 40 cm)
        const ySteps = 4; // 0, 10, 20, 30, 40 cm
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '600 11px "Chakra Petch", sans-serif';

        for (let i = 0; i <= ySteps; i++) {
            const val = Math.round((this.maxY / ySteps) * i);
            const y = padTop + chartH - (i / ySteps) * chartH;

            // Đường kẻ ngang mờ
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.16)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(padLeft, y);
            ctx.lineTo(padLeft + chartW, y);
            ctx.stroke();

            // Nhãn số
            ctx.fillStyle = '#64748b';
            ctx.fillText(`${val}cm`, padLeft - 10, y);
        }

        // 2. Vẽ đường kẻ đỏ cảnh báo ngưỡng 10cm
        const dangerY = padTop + chartH - (this.dangerThreshold / this.maxY) * chartH;
        ctx.beginPath();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.shadowColor = 'rgba(239, 68, 68, 0.6)';
        ctx.shadowBlur = 6;
        ctx.moveTo(padLeft, dangerY);
        ctx.lineTo(padLeft + chartW, dangerY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
        ctx.shadowBlur = 0;  // Reset shadow

        // Nhãn cảnh báo 10cm trên biểu đồ
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'right';
        ctx.font = '700 10px "Chakra Petch", sans-serif';
        ctx.fillText('NGƯỠNG CẢNH BÁO: 10 CM', padLeft + chartW - 6, dangerY - 9);

        // 3. Nếu chưa có dữ liệu, hiển thị thông báo
        if (this.dataPoints.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'center';
            ctx.font = '500 13px "Be Vietnam Pro", sans-serif';
            ctx.fillText('Chưa có dữ liệu đo. Nhấn "Đo 1 lần" hoặc "Bắt đầu đo liên tục" để ghi nhận.', padLeft + chartW / 2, padTop + chartH / 2);
            return;
        }

        // 4. Tính toán tọa độ các điểm
        const points = [];
        const n = this.dataPoints.length;

        for (let i = 0; i < n; i++) {
            const p = this.dataPoints[i];
            const dist = p.distance > 0 ? Math.min(this.maxY, Math.max(0, p.distance)) : 0;
            // Dồn điểm về bên phải nếu chưa đầy buffer
            const x = padLeft + (this.maxPoints - n + i) * (chartW / (this.maxPoints - 1));
            const y = padTop + chartH - (dist / this.maxY) * chartH;
            points.push({ x, y, dist: p.distance, isObstacle: p.isObstacle });
        }

        // 5. Tô nền dải màu chuyển tiếp bên dưới đường (Gradient Area Fill)
        const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        areaGrad.addColorStop(0, 'rgba(6, 182, 212, 0.32)');
        areaGrad.addColorStop(0.7, 'rgba(6, 182, 212, 0.08)');
        areaGrad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

        ctx.beginPath();
        ctx.moveTo(points[0].x, padTop + chartH);
        ctx.lineTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.lineTo(points[points.length - 1].x, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // 6. Vẽ đường nối chính (Line Stroke) phát sáng Neon
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 7. Vẽ các điểm tròn nhỏ
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = pt.isObstacle ? '#ef4444' : '#38bdf8';
            ctx.fill();
        }

        // 8. Điểm cuối cùng (Mới nhất): Vòng tròn phát sáng lớn và nhãn giá trị
        const lastPt = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPt.x, lastPt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = lastPt.isObstacle ? '#ef4444' : '#06b6d4';
        ctx.shadowColor = lastPt.isObstacle ? 'rgba(239, 68, 68, 0.9)' : 'rgba(6, 182, 212, 0.9)';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Nhãn số cự ly gắn ngay trên điểm cuối cùng
        ctx.font = '700 11px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = lastPt.isObstacle ? '#f87171' : '#38bdf8';
        const labelY = Math.max(padTop + 14, lastPt.y - 12);
        const labelText = lastPt.dist > 0 ? `${lastPt.dist.toFixed(1)} cm` : '--.-';
        ctx.fillText(labelText, lastPt.x, labelY);
    }

    measureOnce() {
        const now = Date.now();
        if (this._lastMeasureTime && (now - this._lastMeasureTime < 350)) {
            return;
        }
        this._lastMeasureTime = now;

        // Nếu đang bật đo liên tục thì dừng đo liên tục trước
        if (this.isStreaming) {
            this.toggleStream(false);
        }

        console.log('[Ultrasonic] 🎯 Bắt đầu Đo 1 lần...');
        const modeTag = document.getElementById('current-mode-tag');
        if (modeTag) {
            modeTag.textContent = 'Đang đo 1 lần...';
            modeTag.className = 'mode-status-tag tag-measuring';
        }

        this.wsClient.send({ cmd: 'ultrasonic_measure_once' });

        setTimeout(() => {
            if (!this.isStreaming && modeTag) {
                modeTag.textContent = 'Nghỉ (Standby)';
                modeTag.className = 'mode-status-tag tag-standby';
            }
        }, 1200);
    }

    toggleStream(forceState = null) {
        const now = Date.now();
        if (this._lastToggleTime && (now - this._lastToggleTime < 350)) {
            console.warn('[Ultrasonic] ⚠ Bỏ qua click lặp quá nhanh (debounce)');
            return;
        }
        this._lastToggleTime = now;

        const nextState = forceState !== null ? forceState : !this.isStreaming;
        this.isStreaming = nextState;

        const btn = document.getElementById('btn-stream-toggle');
        const icon = document.getElementById('stream-btn-icon');
        const text = document.getElementById('stream-btn-text');
        const modeTag = document.getElementById('current-mode-tag');

        if (this.isStreaming) {
            console.log('[Ultrasonic] ▶ BẮT ĐẦU ĐO LIÊN TỤC');
            if (btn) btn.classList.add('streaming');
            if (icon) icon.textContent = '⏸';
            if (text) text.textContent = 'Dừng đo liên tục';
            if (modeTag) {
                modeTag.textContent = 'Đang đo liên tục';
                modeTag.className = 'mode-status-tag tag-streaming';
            }
            this.wsClient.send({ cmd: 'ultrasonic_start_stream' });
        } else {
            console.log('[Ultrasonic] ⏸ DỪNG ĐO LIÊN TỤC');
            if (btn) btn.classList.remove('streaming');
            if (icon) icon.textContent = '▶';
            if (text) text.textContent = 'Bắt đầu đo liên tục';
            if (modeTag) {
                modeTag.textContent = 'Nghỉ (Standby)';
                modeTag.className = 'mode-status-tag tag-standby';
            }
            this.wsClient.send({ cmd: 'ultrasonic_stop_stream' });
        }
    }

    clearData() {
        this.dataPoints = [];
        this.updateUI(-1, false);
        this.draw();
    }
}


// ==============================================================================

// ==============================================================================
// 5.5 CLASS TCRT5000_CONTROLLER (Dieu khien mo phong 2D Cam bien Do Line TCRT5000)
// ==============================================================================
class TCRT5000Controller {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.leftEnabled = true;
        this.rightEnabled = true;
        this.leftIsBlack = false;
        this.rightIsBlack = false;
        this.currentSim = 'forward';

        this.chkLeft = null;
        this.chkRight = null;
        this.chassis = null;
        this.eyeLeft = null;
        this.eyeRight = null;
        this.boxLeft = null;
        this.boxRight = null;
        this.statusBadgeLeft = null;
        this.statusBadgeRight = null;
        this.statusDotLeft = null;
        this.statusDotRight = null;
        this.statusTextLeft = null;
        this.statusTextRight = null;
        this.logicValLeft = null;
        this.logicValRight = null;
        this.voltValLeft = null;
        this.voltValRight = null;
        this.voltLeft = 0.0;
        this.voltRight = 0.0;
        this.isWorking = false; // Mặc định cảm biến ở chế độ TẮT (Nghỉ)

        this.blackLine = null;
        this.btnTogglePower = null;
        this.powerDot = null;
        this.powerStatusText = null;
        this.powerBtnIcon = null;
        this.powerBtnText = null;

        this.behaviorBadge = null;
        this.behaviorText = null;
        this.onStateChange = null; // Callback đồng bộ sang Mission Control
    }

    init() {
        this.chkLeft = document.getElementById('chk-sensor-left');
        this.chkRight = document.getElementById('chk-sensor-right');
        this.chassis = document.getElementById('tcrt-robot-chassis');
        this.blackLine = document.getElementById('tcrt-black-line');
        this.eyeLeft = document.getElementById('tcrt-eye-left');
        this.eyeRight = document.getElementById('tcrt-eye-right');
        this.boxLeft = document.getElementById('telemetry-box-left');
        this.boxRight = document.getElementById('telemetry-box-right');

        this.statusBadgeLeft = document.getElementById('status-badge-left');
        this.statusBadgeRight = document.getElementById('status-badge-right');
        this.statusDotLeft = document.getElementById('status-dot-left');
        this.statusDotRight = document.getElementById('status-dot-right');
        this.statusTextLeft = document.getElementById('status-text-left');
        this.statusTextRight = document.getElementById('status-text-right');
        this.logicValLeft = document.getElementById('logic-val-left');
        this.logicValRight = document.getElementById('logic-val-right');
        this.voltValLeft = document.getElementById('volt-val-left');
        this.voltValRight = document.getElementById('volt-val-right');

        // Nút bấm và bảng trạng thái Bật/Tắt hoạt động cảm biến
        this.btnTogglePower = document.getElementById('btn-toggle-tcrt-power');
        this.powerDot = document.getElementById('tcrt-power-dot');
        this.powerStatusText = document.getElementById('tcrt-power-status-text');
        this.powerBtnIcon = document.getElementById('tcrt-power-btn-icon');
        this.powerBtnText = document.getElementById('tcrt-power-btn-text');

        // Thanh tóm tắt phản ứng hành vi điều hướng
        this.behaviorBadge = document.getElementById('tcrt-behavior-badge');
        this.behaviorText = document.getElementById('tcrt-behavior-text');

        if (this.btnTogglePower) {
            this.btnTogglePower.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePower();
            });
        }

        if (this.chkLeft) {
            this.chkLeft.addEventListener('change', () => {
                if (!this.chkLeft.checked && !this.chkRight.checked) {
                    this.chkLeft.checked = true;
                    return;
                }
                this.leftEnabled = this.chkLeft.checked;
                this.render();
            });
        }

        if (this.chkRight) {
            this.chkRight.addEventListener('change', () => {
                if (!this.chkLeft.checked && !this.chkRight.checked) {
                    this.chkRight.checked = true;
                    return;
                }
                this.rightEnabled = this.chkRight.checked;
                this.render();
            });
        }

        if (this.eyeLeft) {
            this.eyeLeft.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isWorking || !this.leftEnabled) return;
                this.leftIsBlack = !this.leftIsBlack;
                this.voltLeft = this.leftIsBlack ? 3.3 : 0.0;
                this.render();
                if (this.onStateChange) {
                    this.onStateChange({ left: this.leftIsBlack, right: this.rightIsBlack });
                }
            });
        }

        if (this.eyeRight) {
            this.eyeRight.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.isWorking || !this.rightEnabled) return;
                this.rightIsBlack = !this.rightIsBlack;
                this.voltRight = this.rightIsBlack ? 3.3 : 0.0;
                this.render();
                if (this.onStateChange) {
                    this.onStateChange({ left: this.leftIsBlack, right: this.rightIsBlack });
                }
            });
        }

        this.render();
    }

    togglePower() {
        this.setWorkingState(!this.isWorking);
    }

    setWorkingState(active) {
        this.isWorking = active;

        if (this.btnTogglePower) {
            this.btnTogglePower.className = `btn-tcrt-power ${this.isWorking ? 'is-active' : 'is-off'}`;
        }
        if (this.powerBtnIcon) {
            this.powerBtnIcon.textContent = this.isWorking ? '⏹' : '▶';
        }
        if (this.powerBtnText) {
            this.powerBtnText.textContent = this.isWorking ? 'Tắt cảm biến TCRT5000' : 'Bật cảm biến TCRT5000';
        }
        if (this.powerDot) {
            this.powerDot.className = `tcrt-power-status-dot ${this.isWorking ? 'dot-active' : 'dot-off'}`;
        }
        if (this.powerStatusText) {
            this.powerStatusText.textContent = this.isWorking ? 'ĐANG HOẠT ĐỘNG' : 'ĐÃ TẮT (NGHỈ)';
            this.powerStatusText.className = `tcrt-power-status-val ${this.isWorking ? 'status-active' : 'status-standby'}`;
        }

        if (this.wsClient) {
            this.wsClient.send({ cmd: this.isWorking ? 'tcrt_start_stream' : 'tcrt_stop_stream' });
        }

        if (!this.isWorking) {
            this.leftIsBlack = false;
            this.rightIsBlack = false;
            this.voltLeft = 0.0;
            this.voltRight = 0.0;
        }

        this.render();
    }

    onScreenActivated() {
        this.render();
        if (this.isWorking && this.wsClient) {
            this.wsClient.send({ cmd: 'tcrt_start_stream' });
        }
    }

    onScreenDeactivated() {
        if (this.isWorking) {
            this.setWorkingState(false);
        }
    }

    handleTelemetry(data) {
        if (!this.isWorking || !data || !data.tcrt5000) return;
        const tcrt = data.tcrt5000;

        if (tcrt.left && this.leftEnabled) {
            this.leftIsBlack = (tcrt.left.is_black === true || tcrt.left.raw === 1);
            if (tcrt.left.voltage !== undefined) {
                this.voltLeft = tcrt.left.voltage;
            } else {
                this.voltLeft = this.leftIsBlack ? 3.3 : 0.0;
            }
        }

        if (tcrt.right && this.rightEnabled) {
            this.rightIsBlack = (tcrt.right.is_black === true || tcrt.right.raw === 1);
            if (tcrt.right.voltage !== undefined) {
                this.voltRight = tcrt.right.voltage;
            } else {
                this.voltRight = this.rightIsBlack ? 3.3 : 0.0;
            }
        }

        this.render();
    }

    render() {
        // TRƯỜNG HỢP 1: CẢM BIẾN ĐANG TẮT (NGHỈ)
        if (!this.isWorking) {
            if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
            if (this.blackLine) this.blackLine.classList.remove('line-hidden');
            if (this.eyeLeft) this.eyeLeft.className = 'tcrt-eye-pod is-disabled';
            if (this.eyeRight) this.eyeRight.className = 'tcrt-eye-pod is-disabled';
            if (this.boxLeft) this.boxLeft.classList.add('box-disabled');
            if (this.boxRight) this.boxRight.classList.add('box-disabled');
            if (this.statusBadgeLeft) this.statusBadgeLeft.className = 'telemetry-badge badge-disabled';
            if (this.statusDotLeft) this.statusDotLeft.className = 'badge-dot dot-gray';
            if (this.statusTextLeft) this.statusTextLeft.textContent = 'ĐÃ TẮT';
            if (this.logicValLeft) this.logicValLeft.textContent = '--';
            if (this.voltValLeft) this.voltValLeft.textContent = '--';
            if (this.statusBadgeRight) this.statusBadgeRight.className = 'telemetry-badge badge-disabled';
            if (this.statusDotRight) this.statusDotRight.className = 'badge-dot dot-gray';
            if (this.statusTextRight) this.statusTextRight.textContent = 'ĐÃ TẮT';
            if (this.logicValRight) this.logicValRight.textContent = '--';
            if (this.voltValRight) this.voltValRight.textContent = '--';
            if (this.behaviorBadge && this.behaviorText) {
                this.behaviorBadge.className = 'behavior-status-badge badge-standby';
                this.behaviorText.textContent = 'CẢM BIẾN ĐANG NGHỈ (CHƯA BẬT)';
            }
            return;
        }

        // TRƯỜNG HỢP 2: CẢM BIẾN ĐANG BẬT (HOẠT ĐỘNG THỜI GIAN THỰC)
        // 1. Logic hướng xe (chassis) và phản ứng vi sai bám vạch quang học
        let behaviorText = 'ĐÚNG TIM ĐƯỜNG • ĐI THẲNG ĐỀU';
        let behaviorClass = 'badge-straight';

        if (this.leftEnabled && this.rightEnabled) {
            // Cả 2 mắt đều đang bật kiểm tra
            if (!this.leftIsBlack && !this.rightIsBlack) {
                // TH 1: CẢ 2 ĐỀU TRẮNG (0, 0):
                // Vạch đen nằm chính giữa 2 mắt (2 mắt kẹp 2 bên vạch đen trên nền trắng).
                // Xe đang bám ĐÚNG TIM ĐƯỜNG -> Đi thẳng!
                if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
                if (this.blackLine) this.blackLine.classList.remove('line-hidden');
                behaviorText = 'ĐÚNG TIM ĐƯỜNG • ĐI THẲNG ĐỀU';
                behaviorClass = 'badge-straight';
            } else if (this.leftIsBlack && !this.rightIsBlack) {
                // TH 2: MẮT TRÁI ĐEN (1), MẮT PHẢI TRẮNG (0):
                // Mắt trái chạm vào vạch đen -> Xe đang bị LỆCH SANG PHẢI so với vạch đen!
                // Phản ứng: Xe phải BẺ LÁI SANG TRÁI để quay lại tâm đường.
                if (this.chassis) this.chassis.style.transform = 'translateX(24px) rotate(-8deg)';
                if (this.blackLine) this.blackLine.classList.remove('line-hidden');
                behaviorText = 'XE LỆCH PHẢI ➔ ĐÁNH LÁI SANG TRÁI';
                behaviorClass = 'badge-turn-left';
            } else if (!this.leftIsBlack && this.rightIsBlack) {
                // TH 3: MẮT TRÁI TRẮNG (0), MẮT PHẢI ĐEN (1):
                // Mắt phải chạm vào vạch đen -> Xe đang bị LỆCH SANG TRÁI so với vạch đen!
                // Phản ứng: Xe phải BẺ LÁI SANG PHẢI để quay lại tâm đường.
                if (this.chassis) this.chassis.style.transform = 'translateX(-24px) rotate(8deg)';
                if (this.blackLine) this.blackLine.classList.remove('line-hidden');
                behaviorText = 'XE LỆCH TRÁI ➔ ĐÁNH LÁI SANG PHẢI';
                behaviorClass = 'badge-turn-right';
            } else if (this.leftIsBlack && this.rightIsBlack) {
                // TH 4: CẢ 2 ĐỀU ĐEN (1, 1):
                // Cả 2 mắt cùng chạm vạch đen -> Gặp vạch ngang dừng trạm / giao lộ / vạch đích!
                if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
                if (this.blackLine) this.blackLine.classList.remove('line-hidden');
                behaviorText = 'GẶP VẠCH NGANG ➔ DỪNG TRẠM / VẠCH ĐÍCH';
                behaviorClass = 'badge-stop-line';
            }
        } else if (this.leftEnabled && !this.rightEnabled) {
            // Chỉ bật kiểm tra Mắt Trái (D19)
            if (this.blackLine) this.blackLine.classList.remove('line-hidden');
            if (!this.leftIsBlack) {
                if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
                behaviorText = 'MẮT TRÁI TRẮNG ➔ ĐI THẲNG THEO TIM';
                behaviorClass = 'badge-straight';
            } else {
                if (this.chassis) this.chassis.style.transform = 'translateX(24px) rotate(-8deg)';
                behaviorText = 'MẮT TRÁI ĐEN ➔ ĐÁNH LÁI SANG TRÁI';
                behaviorClass = 'badge-turn-left';
            }
        } else if (!this.leftEnabled && this.rightEnabled) {
            // Chỉ bật kiểm tra Mắt Phải (D21)
            if (this.blackLine) this.blackLine.classList.remove('line-hidden');
            if (!this.rightIsBlack) {
                if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
                behaviorText = 'MẮT PHẢI TRẮNG ➔ ĐI THẲNG THEO TIM';
                behaviorClass = 'badge-straight';
            } else {
                if (this.chassis) this.chassis.style.transform = 'translateX(-24px) rotate(8deg)';
                behaviorText = 'MẮT PHẢI ĐEN ➔ ĐÁNH LÁI SANG PHẢI';
                behaviorClass = 'badge-turn-right';
            }
        } else {
            if (this.chassis) this.chassis.style.transform = 'translateX(0px) rotate(0deg)';
            if (this.blackLine) this.blackLine.classList.remove('line-hidden');
        }

        if (this.behaviorBadge && this.behaviorText) {
            this.behaviorBadge.className = `behavior-status-badge ${behaviorClass}`;
            this.behaviorText.textContent = behaviorText;
        }

        // 2. Cập nhật giao diện Mắt Trái (D19)
        if (this.eyeLeft) {
            if (!this.leftEnabled) {
                this.eyeLeft.className = 'tcrt-eye-pod is-disabled';
            } else {
                this.eyeLeft.className = `tcrt-eye-pod ${this.leftIsBlack ? 'is-black' : 'is-white'}`;
            }
        }
        if (this.boxLeft) {
            this.boxLeft.classList.toggle('box-disabled', !this.leftEnabled);
        }
        if (this.statusBadgeLeft && this.statusDotLeft && this.statusTextLeft) {
            if (!this.leftEnabled) {
                this.statusBadgeLeft.className = 'telemetry-badge badge-disabled';
                this.statusDotLeft.className = 'badge-dot dot-gray';
                this.statusTextLeft.textContent = 'ĐÃ TẮT';
                if (this.logicValLeft) this.logicValLeft.textContent = '--';
                if (this.voltValLeft) this.voltValLeft.textContent = '--';
            } else if (this.leftIsBlack) {
                this.statusBadgeLeft.className = 'telemetry-badge badge-black';
                this.statusDotLeft.className = 'badge-dot dot-green';
                this.statusTextLeft.textContent = 'ĐEN (1)';
                if (this.logicValLeft) this.logicValLeft.textContent = '1 (HIGH)';
                if (this.voltValLeft) this.voltValLeft.textContent = (this.voltLeft !== undefined ? Number(this.voltLeft).toFixed(2) : '3.30') + 'V';
            } else {
                this.statusBadgeLeft.className = 'telemetry-badge badge-white';
                this.statusDotLeft.className = 'badge-dot dot-gray';
                this.statusTextLeft.textContent = 'TRẮNG (0)';
                if (this.logicValLeft) this.logicValLeft.textContent = '0 (LOW)';
                if (this.voltValLeft) this.voltValLeft.textContent = (this.voltLeft !== undefined ? Number(this.voltLeft).toFixed(2) : '0.00') + 'V';
            }
        }

        // 3. Cập nhật giao diện Mắt Phải (D21)
        if (this.eyeRight) {
            if (!this.rightEnabled) {
                this.eyeRight.className = 'tcrt-eye-pod is-disabled';
            } else {
                this.eyeRight.className = `tcrt-eye-pod ${this.rightIsBlack ? 'is-black' : 'is-white'}`;
            }
        }
        if (this.boxRight) {
            this.boxRight.classList.toggle('box-disabled', !this.rightEnabled);
        }
        if (this.statusBadgeRight && this.statusDotRight && this.statusTextRight) {
            if (!this.rightEnabled) {
                this.statusBadgeRight.className = 'telemetry-badge badge-disabled';
                this.statusDotRight.className = 'badge-dot dot-gray';
                this.statusTextRight.textContent = 'ĐÃ TẮT';
                if (this.logicValRight) this.logicValRight.textContent = '--';
                if (this.voltValRight) this.voltValRight.textContent = '--';
            } else if (this.rightIsBlack) {
                this.statusBadgeRight.className = 'telemetry-badge badge-black';
                this.statusDotRight.className = 'badge-dot dot-green';
                this.statusTextRight.textContent = 'ĐEN (1)';
                if (this.logicValRight) this.logicValRight.textContent = '1 (HIGH)';
                if (this.voltValRight) this.voltValRight.textContent = (this.voltRight !== undefined ? Number(this.voltRight).toFixed(2) : '3.30') + 'V';
            } else {
                this.statusBadgeRight.className = 'telemetry-badge badge-white';
                this.statusDotRight.className = 'badge-dot dot-gray';
                this.statusTextRight.textContent = 'TRẮNG (0)';
                if (this.logicValRight) this.logicValRight.textContent = '0 (LOW)';
                if (this.voltValRight) this.voltValRight.textContent = (this.voltRight !== undefined ? Number(this.voltRight).toFixed(2) : '0.00') + 'V';
            }
        }
    }

    /**
     * Nhận đồng bộ trạng thái cảm biến từ Tab Điều khiển chung
     */
    syncExternalState(leftIsBlack, rightIsBlack) {
        this.leftIsBlack = leftIsBlack;
        this.rightIsBlack = rightIsBlack;
        this.voltLeft = this.leftIsBlack ? 3.3 : 0.0;
        this.voltRight = this.rightIsBlack ? 3.3 : 0.0;
        this.render();
    }
}


// ==============================================================================
// 5.6 CLASS TB6612_CONTROLLER (Điều khiển 2 Cần số dọc độc lập & Giám sát Động cơ TB6612FNG)
// ==============================================================================
class TB6612Controller {
    constructor(wsClient) {
        this.wsClient = wsClient;
        this.leftSpeed = 0;   // Tốc độ bánh trái Motor A (0 - 100%)
        this.rightSpeed = 0;  // Tốc độ bánh phải Motor B (0 - 100%)
        this.isEngineRunning = false;
        this.isSync = false;  // Chế độ đồng bộ 2 cần gạt (mặc định tắt: chỉnh riêng lẻ)
        this.direction = 'CW'; // Chiều quay tiến

        this.sendThrottleDebounce = null;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
    }

    cacheElements() {
        // --- 1. KHU VỰC CẦN SỐ BÁNH TRÁI (MOTOR A - CYAN) ---
        this.sliderLeft = document.getElementById('tb6612-slider-left');
        this.shifterLeftSpeedVal = document.getElementById('shifter-left-speed-val');
        this.shifterLeftStatus = document.getElementById('shifter-left-status');
        this.shifterGlowLeft = document.getElementById('shifter-glow-left');
        this.shiftKnobLeft = document.getElementById('shift-knob-left');
        this.knobGearSymbolLeft = document.getElementById('knob-gear-symbol-left');
        this.btnBrakeLeft = document.getElementById('btn-brake-left');

        this.gearButtonsLeft = [
            { el: document.getElementById('gear-btn-left-p'), gear: 'P', speed: 0 },
            { el: document.getElementById('gear-btn-left-1'), gear: '1', speed: 35 },
            { el: document.getElementById('gear-btn-left-2'), gear: '2', speed: 65 },
            { el: document.getElementById('gear-btn-left-3'), gear: '3', speed: 100 }
        ];

        // --- 2. KHU VỰC CẦN SỐ BÁNH PHẢI (MOTOR B - PURPLE) ---
        this.sliderRight = document.getElementById('tb6612-slider-right');
        this.shifterRightSpeedVal = document.getElementById('shifter-right-speed-val');
        this.shifterRightStatus = document.getElementById('shifter-right-status');
        this.shifterGlowRight = document.getElementById('shifter-glow-right');
        this.shiftKnobRight = document.getElementById('shift-knob-right');
        this.knobGearSymbolRight = document.getElementById('knob-gear-symbol-right');
        this.btnBrakeRight = document.getElementById('btn-brake-right');

        this.gearButtonsRight = [
            { el: document.getElementById('gear-btn-right-p'), gear: 'P', speed: 0 },
            { el: document.getElementById('gear-btn-right-1'), gear: '1', speed: 35 },
            { el: document.getElementById('gear-btn-right-2'), gear: '2', speed: 65 },
            { el: document.getElementById('gear-btn-right-3'), gear: '3', speed: 100 }
        ];

        // --- 3. ĐỒNG HỒ ĐO & GIÁM SÁT 2 BÁNH Ở TRUNG TÂM ---
        this.diffMotionStatus = document.getElementById('tb6612-motion-status');
        this.motionStatusText = document.getElementById('motion-status-text');

        // Bánh trái
        this.gaugeFillLeft = document.getElementById('gauge-fill-left');
        this.wheelGraphicLeft = document.getElementById('wheel-graphic-left');
        this.speedLeftVal = document.getElementById('speed-left-val');
        this.rpmLeftVal = document.getElementById('rpm-left-val');
        this.leftDirPill = document.getElementById('left-dir-pill');
        this.leftDirText = document.getElementById('left-dir-text');

        // Bánh phải
        this.gaugeFillRight = document.getElementById('gauge-fill-right');
        this.wheelGraphicRight = document.getElementById('wheel-graphic-right');
        this.speedRightVal = document.getElementById('speed-right-val');
        this.rpmRightVal = document.getElementById('rpm-right-val');
        this.rightDirPill = document.getElementById('right-dir-pill');
        this.rightDirText = document.getElementById('right-dir-text');

        // Differential Balance
        this.ratioLeftTxt = document.getElementById('ratio-left-txt');
        this.ratioRightTxt = document.getElementById('ratio-right-txt');
        this.diffBarLeft = document.getElementById('diff-bar-left');
        this.diffBarRight = document.getElementById('diff-bar-right');

        // --- 4. CÁC NÚT ĐIỀU KHIỂN TRUNG TÂM (ENGINE & SYNC) ---
        this.btnToggleMotorPower = document.getElementById('btn-toggle-motor-power');
        this.engineBtnLabel = document.getElementById('engine-btn-label');
        this.engineBtnSub = document.getElementById('engine-btn-sub');

        this.btnToggleSync = document.getElementById('btn-toggle-sync');
        this.syncBtnLabel = document.getElementById('sync-btn-label');
        this.syncBtnSub = document.getElementById('sync-btn-sub');
    }

    bindEvents() {
        // 1. Kéo cần số bánh trái
        if (this.sliderLeft) {
            this.sliderLeft.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                this.setLeftSpeed(val, true, this.isSync);
            });
        }

        // 2. Kéo cần số bánh phải
        if (this.sliderRight) {
            this.sliderRight.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 0;
                this.setRightSpeed(val, true, this.isSync);
            });
        }

        // 3. Các nút nấc số bánh trái (P, 1, 2, 3)
        this.gearButtonsLeft.forEach(btnObj => {
            if (btnObj.el) {
                btnObj.el.addEventListener('click', () => {
                    this.setLeftSpeed(btnObj.speed, true, this.isSync);
                });
            }
        });

        // 4. Các nút nấc số bánh phải (P, 1, 2, 3)
        this.gearButtonsRight.forEach(btnObj => {
            if (btnObj.el) {
                btnObj.el.addEventListener('click', () => {
                    this.setRightSpeed(btnObj.speed, true, this.isSync);
                });
            }
        });

        // 5. Nút phanh nhanh từng bánh
        if (this.btnBrakeLeft) {
            this.btnBrakeLeft.addEventListener('click', () => {
                this.setLeftSpeed(0, true, this.isSync);
            });
        }

        if (this.btnBrakeRight) {
            this.btnBrakeRight.addEventListener('click', () => {
                this.setRightSpeed(0, true, this.isSync);
            });
        }

        // 6. Nút Bật/Tắt Động cơ chính (Engine Master Toggle)
        if (this.btnToggleMotorPower) {
            this.btnToggleMotorPower.addEventListener('click', () => {
                this.toggleEngine();
            });
        }

        // 7. Nút Bật/Tắt Đồng bộ 2 cần gạt (Sync Toggle)
        if (this.btnToggleSync) {
            this.btnToggleSync.addEventListener('click', () => {
                this.toggleSync();
            });
        }
    }

    setLeftSpeed(speedVal, dispatchServer = true, syncToRight = false) {
        speedVal = Math.max(0, Math.min(100, Math.round(speedVal)));
        this.leftSpeed = speedVal;

        if (syncToRight) {
            this.rightSpeed = speedVal;
        }

        this.checkEngineState();
        this.updateUI();

        if (dispatchServer) {
            this.sendSpeedToServer();
        }
    }

    setRightSpeed(speedVal, dispatchServer = true, syncToLeft = false) {
        speedVal = Math.max(0, Math.min(100, Math.round(speedVal)));
        this.rightSpeed = speedVal;

        if (syncToLeft) {
            this.leftSpeed = speedVal;
        }

        this.checkEngineState();
        this.updateUI();

        if (dispatchServer) {
            this.sendSpeedToServer();
        }
    }

    setDualSpeed(leftVal, rightVal, dispatchServer = true) {
        this.leftSpeed = Math.max(0, Math.min(100, Math.round(leftVal)));
        this.rightSpeed = Math.max(0, Math.min(100, Math.round(rightVal)));
        this.checkEngineState();
        this.updateUI();

        if (dispatchServer) {
            this.sendSpeedToServer();
        }
    }

    checkEngineState() {
        this.isEngineRunning = (this.leftSpeed > 0 || this.rightSpeed > 0);
    }

    toggleEngine() {
        if (this.isEngineRunning) {
            // Đang chạy -> Dừng cả 2 bánh về 0
            this.setDualSpeed(0, 0, true);
        } else {
            // Đang dừng -> Bật ở mức khởi động 35%
            const defaultSpeed = 35;
            this.setDualSpeed(defaultSpeed, defaultSpeed, true);
        }
    }

    toggleSync() {
        this.isSync = !this.isSync;

        // Nếu vừa BẬT đồng bộ: Cho bánh phải đồng bộ theo tốc độ bánh trái
        if (this.isSync) {
            if (this.rightSpeed !== this.leftSpeed) {
                this.rightSpeed = this.leftSpeed;
                this.checkEngineState();
                this.sendSpeedToServer();
            }
        }

        this.updateUI();
    }

    sendSpeedToServer() {
        if (this.sendThrottleDebounce) {
            clearTimeout(this.sendThrottleDebounce);
        }
        this.sendThrottleDebounce = setTimeout(() => {
            if (this.wsClient) {
                const maxSpeed = Math.max(this.leftSpeed, this.rightSpeed);
                this.wsClient.send({
                    cmd: 'set_motor_speed',
                    speed: maxSpeed,
                    left: this.leftSpeed,
                    right: this.rightSpeed,
                    is_running: this.isEngineRunning
                });
            }
        }, 70);
    }

    handleTelemetry(data) {
        if (!data) return;
        // Nếu Server hoặc ESP32 gửi thông tin tốc độ vi sai phản hồi
        if (data.event === 'motor_telemetry' || data.motor) {
            const motorData = data.motor || data;
            if (motorData.speed_left !== undefined) this.leftSpeed = motorData.speed_left;
            if (motorData.speed_right !== undefined) this.rightSpeed = motorData.speed_right;
            if (motorData.is_running !== undefined) this.isEngineRunning = motorData.is_running;
            this.updateUI();
        }
    }

    getGearInfo(speed) {
        if (speed === 0 || !this.isEngineRunning) {
            return { gear: 'P', label: 'DỪNG (PARK)', color: '#64748b' };
        } else if (speed <= 45) {
            return { gear: '1', label: 'CHẬM / ECO', color: '#38bdf8' };
        } else if (speed <= 75) {
            return { gear: '2', label: 'TIÊU CHUẨN', color: '#a78bfa' };
        } else {
            return { gear: '3', label: 'TURBO', color: '#f59e0b' };
        }
    }

    updateUI() {
        const leftSpd = this.leftSpeed;
        const rightSpd = this.rightSpeed;

        const leftGear = this.getGearInfo(leftSpd);
        const rightGear = this.getGearInfo(rightSpd);

        // --- 1. CẬP NHẬT CẦN SỐ BÁNH TRÁI (MOTOR A) ---
        if (this.shifterLeftSpeedVal) this.shifterLeftSpeedVal.textContent = leftSpd;
        if (this.shifterLeftStatus) {
            this.shifterLeftStatus.textContent = leftGear.label;
            this.shifterLeftStatus.style.color = leftGear.color;
        }
        if (this.shiftKnobLeft) this.shiftKnobLeft.style.bottom = `${leftSpd}%`;
        if (this.shifterGlowLeft) this.shifterGlowLeft.style.height = `${leftSpd}%`;
        if (this.knobGearSymbolLeft) this.knobGearSymbolLeft.textContent = leftGear.gear;

        if (this.sliderLeft && parseInt(this.sliderLeft.value, 10) !== leftSpd) {
            this.sliderLeft.value = leftSpd;
        }

        this.gearButtonsLeft.forEach(btnObj => {
            if (btnObj.el) {
                btnObj.el.classList.toggle('is-active', btnObj.gear === leftGear.gear);
            }
        });

        // --- 2. CẬP NHẬT CẦN SỐ BÁNH PHẢI (MOTOR B) ---
        if (this.shifterRightSpeedVal) this.shifterRightSpeedVal.textContent = rightSpd;
        if (this.shifterRightStatus) {
            this.shifterRightStatus.textContent = rightGear.label;
            this.shifterRightStatus.style.color = rightGear.color;
        }
        if (this.shiftKnobRight) this.shiftKnobRight.style.bottom = `${rightSpd}%`;
        if (this.shifterGlowRight) this.shifterGlowRight.style.height = `${rightSpd}%`;
        if (this.knobGearSymbolRight) this.knobGearSymbolRight.textContent = rightGear.gear;

        if (this.sliderRight && parseInt(this.sliderRight.value, 10) !== rightSpd) {
            this.sliderRight.value = rightSpd;
        }

        this.gearButtonsRight.forEach(btnObj => {
            if (btnObj.el) {
                btnObj.el.classList.toggle('is-active', btnObj.gear === rightGear.gear);
            }
        });

        // --- 3. CẬP NHẬT ĐỒNG HỒ ĐO 2 BÁNH Ở GIỮA ---
        const maxArcLength = 386.4;

        // Bánh Trái
        if (this.speedLeftVal) this.speedLeftVal.textContent = leftSpd;
        if (this.rpmLeftVal) this.rpmLeftVal.textContent = `${Math.round(leftSpd * 2.2)} RPM`;
        const leftOffset = maxArcLength - (maxArcLength * (leftSpd / 100));
        if (this.gaugeFillLeft) {
            this.gaugeFillLeft.style.strokeDashoffset = leftOffset;
            this.gaugeFillLeft.style.opacity = leftSpd > 0 ? '1' : '0';
        }
        if (this.wheelGraphicLeft) {
            if (leftSpd > 0) {
                this.wheelGraphicLeft.classList.add('is-spinning');
                const duration = Math.max(0.18, (1.6 - (leftSpd / 100 * 1.35))).toFixed(2);
                this.wheelGraphicLeft.style.animationDuration = `${duration}s`;
            } else {
                this.wheelGraphicLeft.classList.remove('is-spinning');
            }
        }

        // Bánh Phải
        if (this.speedRightVal) this.speedRightVal.textContent = rightSpd;
        if (this.rpmRightVal) this.rpmRightVal.textContent = `${Math.round(rightSpd * 2.2)} RPM`;
        const rightOffset = maxArcLength - (maxArcLength * (rightSpd / 100));
        if (this.gaugeFillRight) {
            this.gaugeFillRight.style.strokeDashoffset = rightOffset;
            this.gaugeFillRight.style.opacity = rightSpd > 0 ? '1' : '0';
        }
        if (this.wheelGraphicRight) {
            if (rightSpd > 0) {
                this.wheelGraphicRight.classList.add('is-spinning');
                const duration = Math.max(0.18, (1.6 - (rightSpd / 100 * 1.35))).toFixed(2);
                this.wheelGraphicRight.style.animationDuration = `${duration}s`;
            } else {
                this.wheelGraphicRight.classList.remove('is-spinning');
            }
        }

        // Tỷ lệ phân bổ vi sai
        const totalSpd = leftSpd + rightSpd;
        let leftRatio = 50;
        let rightRatio = 50;
        if (totalSpd > 0) {
            leftRatio = Math.round((leftSpd / totalSpd) * 100);
            rightRatio = 100 - leftRatio;
        }
        if (this.ratioLeftTxt) this.ratioLeftTxt.textContent = `${leftRatio}%`;
        if (this.ratioRightTxt) this.ratioRightTxt.textContent = `${rightRatio}%`;
        if (this.diffBarLeft) this.diffBarLeft.style.width = `${leftRatio}%`;
        if (this.diffBarRight) this.diffBarRight.style.width = `${rightRatio}%`;

        // Trạng thái chuyển động vi sai
        if (this.diffMotionStatus && this.motionStatusText) {
            if (!this.isEngineRunning || (leftSpd === 0 && rightSpd === 0)) {
                this.diffMotionStatus.className = 'diff-motion-pill';
                this.motionStatusText.textContent = 'XE ĐANG DỪNG';
            } else {
                this.diffMotionStatus.className = 'diff-motion-pill is-moving';
                if (leftSpd === rightSpd) {
                    this.motionStatusText.textContent = 'XE ĐANG ĐI THẲNG (ĐỀU TỐC)';
                } else if (leftSpd < rightSpd) {
                    if (leftSpd === 0) {
                        this.motionStatusText.textContent = 'XE ĐANG QUAY TẠI CHỖ SANG TRÁI';
                    } else {
                        this.motionStatusText.textContent = 'XE ĐANG RẼ TRÁI (BÁNH PHẢI NHANH HƠN)';
                    }
                } else {
                    if (rightSpd === 0) {
                        this.motionStatusText.textContent = 'XE ĐANG QUAY TẠI CHỖ SANG PHẢI';
                    } else {
                        this.motionStatusText.textContent = 'XE ĐANG RẼ PHẢI (BÁNH TRÁI NHANH HƠN)';
                    }
                }
            }
        }

        // --- 4. CẬP NHẬT CÁC NÚT ĐIỀU KHIỂN TRUNG TÂM ---
        // Nút Bật/Dừng Động cơ
        if (this.btnToggleMotorPower) {
            if (this.isEngineRunning) {
                this.btnToggleMotorPower.className = 'btn-engine-toggle engine-running';
                if (this.engineBtnLabel) this.engineBtnLabel.textContent = 'DỪNG ĐỘNG CƠ';
                if (this.engineBtnSub) this.engineBtnSub.textContent = `Trái: ${leftSpd}% · Phải: ${rightSpd}%`;
            } else {
                this.btnToggleMotorPower.className = 'btn-engine-toggle engine-stopped';
                if (this.engineBtnLabel) this.engineBtnLabel.textContent = 'BẬT ĐỘNG CƠ';
                if (this.engineBtnSub) this.engineBtnSub.textContent = 'Khởi động ở mức ga 35%';
            }
        }

        // Nút Đồng bộ 2 cần
        if (this.btnToggleSync) {
            if (this.isSync) {
                this.btnToggleSync.className = 'btn-sync-toggle sync-enabled';
                if (this.syncBtnLabel) this.syncBtnLabel.textContent = 'ĐỒNG BỘ 2 CẦN: BẬT';
                if (this.syncBtnSub) this.syncBtnSub.textContent = 'Kéo 1 cần cả 2 bánh cùng đổi';
            } else {
                this.btnToggleSync.className = 'btn-sync-toggle sync-disabled';
                if (this.syncBtnLabel) this.syncBtnLabel.textContent = 'ĐỒNG BỘ 2 CẦN: TẮT';
                if (this.syncBtnSub) this.syncBtnSub.textContent = 'Điều chỉnh riêng lẻ từng bánh';
            }
        }
    }
}


// ==============================================================================
// 5.7 CLASS VEHICLE_MOTION_CONTROLLER (Trung tâm chỉ huy & Giám sát Chuyển động xe)
// ==============================================================================
class VehicleMotionController {
    constructor(wsClient) {
        this.wsClient = wsClient;

        // Trạng thái vận hành
        this.isRunningAutoLine = false;  // Trạng thái tự hành bám vạch quang học
        this.baseSpeed = 45;             // Tốc độ cơ sở khi bám vạch (20% - 85%)
        this.leftSpeed = 0;              // Tốc độ hiện tại bánh trái (0 - 100%)
        this.rightSpeed = 0;             // Tốc độ hiện tại bánh phải (0 - 100%)
        this.masterSpeed = 0;            // Mức ga tổng
        this.steeringAngle = 0;          // Góc đánh lái mô phỏng (-15° đến +15°)
        this.lineTrackingStatus = 'Chưa kích hoạt';
        this.actionText = 'XE ĐANG NGHỈ (STANDBY)';
        this.isScreenActive = false;

        // Dữ liệu cảm biến trực tiếp
        this.sonarDistance = -1;         // Cự ly siêu âm cm
        this.isObstacle = false;         // Vật cản nguy hiểm (< 10cm)
        this.leftIsBlack = false;        // Mắt trái TCRT (D19)
        this.rightIsBlack = false;       // Mắt phải TCRT (D21)

        // Callback đồng bộ 2 chiều sang tab TCRT5000
        this.onStateChange = null;

        // Debounce gửi lệnh động cơ
        this.sendThrottleDebounce = null;

        // Cache DOM elements
        this.elements = {};
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
    }

    cacheElements() {
        this.elements = {
            masterSpeed: document.getElementById('mission-master-speed'),
            wsBarLeft: document.getElementById('mission-ws-bar-left'),
            wsBarRight: document.getElementById('mission-ws-bar-right'),
            wsValLeft: document.getElementById('mission-ws-val-left'),
            wsValRight: document.getElementById('mission-ws-val-right'),

            sonarDist: document.getElementById('mission-sonar-dist'),
            sonarAlertBadge: document.getElementById('mission-sonar-alert-badge'),
            sonarAlertText: document.getElementById('mission-sonar-alert-text'),
            sonarFill: document.getElementById('mission-sonar-fill'),

            tcrtPillLeft: document.getElementById('mission-tcrt-pill-left'),
            tcrtPillRight: document.getElementById('mission-tcrt-pill-right'),

            actionBadge: document.getElementById('mission-action-badge'),
            actionText: document.getElementById('mission-action-text'),
            stageRobot: document.getElementById('mission-stage-robot'),
            sonarCone: document.getElementById('mission-sonar-cone'),
            coneTag: document.getElementById('mission-cone-tag'),
            robotEyeLeft: document.getElementById('mission-robot-eye-left'),
            robotEyeRight: document.getElementById('mission-robot-eye-right'),
            steeringAngleVal: document.getElementById('mission-steering-angle'),
            lineTrackingStatusVal: document.getElementById('mission-line-tracking-status'),

            btnToggleAutoLine: document.getElementById('btn-toggle-auto-line'),
            autoLineBtnIcon: document.getElementById('auto-line-btn-icon'),
            autoLineBtnLabel: document.getElementById('auto-line-btn-label'),
            autoLineBtnSub: document.getElementById('auto-line-btn-sub'),
            btnEmergencyStop: document.getElementById('btn-emergency-stop'),

            baseSpeedSlider: document.getElementById('base-speed-slider'),
            baseSpeedDisplay: document.getElementById('base-speed-display'),

            logBox: document.getElementById('mission-log-box'),
            btnClearLog: document.getElementById('btn-clear-mission-log')
        };
    }

    bindEvents() {
        if (this.elements.btnToggleAutoLine) {
            this.elements.btnToggleAutoLine.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAutoLine();
            });
        }

        if (this.elements.btnEmergencyStop) {
            this.elements.btnEmergencyStop.addEventListener('click', (e) => {
                e.preventDefault();
                this.emergencyStop();
            });
        }

        if (this.elements.baseSpeedSlider) {
            this.elements.baseSpeedSlider.addEventListener('input', (e) => {
                this.baseSpeed = parseInt(e.target.value, 10) || 45;
                if (this.elements.baseSpeedDisplay) {
                    this.elements.baseSpeedDisplay.textContent = `${this.baseSpeed}%`;
                }
                if (this.isRunningAutoLine) {
                    this.computeAndApplyLineTracking();
                }
            });
        }

        if (this.elements.btnClearLog) {
            this.elements.btnClearLog.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.elements.logBox) {
                    this.elements.logBox.innerHTML = '';
                    this.log('system', 'Nhật ký đã được làm mới.');
                }
            });
        }

        // Hỗ trợ click thử nghiệm chuyển đổi Đen/Trắng trực tiếp trên sân khấu Mission Control
        const toggleLeftTest = () => {
            this.leftIsBlack = !this.leftIsBlack;
            if (this.onStateChange) this.onStateChange({ left: this.leftIsBlack, right: this.rightIsBlack });
            if (this.isRunningAutoLine) this.computeAndApplyLineTracking();
            this.updateUI();
        };

        const toggleRightTest = () => {
            this.rightIsBlack = !this.rightIsBlack;
            if (this.onStateChange) this.onStateChange({ left: this.leftIsBlack, right: this.rightIsBlack });
            if (this.isRunningAutoLine) this.computeAndApplyLineTracking();
            this.updateUI();
        };

        if (this.elements.tcrtPillLeft) {
            this.elements.tcrtPillLeft.style.cursor = 'pointer';
            this.elements.tcrtPillLeft.title = 'Click để thử nghiệm chuyển đổi Đen/Trắng';
            this.elements.tcrtPillLeft.addEventListener('click', toggleLeftTest);
        }
        if (this.elements.robotEyeLeft) {
            this.elements.robotEyeLeft.style.cursor = 'pointer';
            this.elements.robotEyeLeft.title = 'Click để thử nghiệm chuyển đổi Đen/Trắng';
            this.elements.robotEyeLeft.addEventListener('click', toggleLeftTest);
        }

        if (this.elements.tcrtPillRight) {
            this.elements.tcrtPillRight.style.cursor = 'pointer';
            this.elements.tcrtPillRight.title = 'Click để thử nghiệm chuyển đổi Đen/Trắng';
            this.elements.tcrtPillRight.addEventListener('click', toggleRightTest);
        }
        if (this.elements.robotEyeRight) {
            this.elements.robotEyeRight.style.cursor = 'pointer';
            this.elements.robotEyeRight.title = 'Click để thử nghiệm chuyển đổi Đen/Trắng';
            this.elements.robotEyeRight.addEventListener('click', toggleRightTest);
        }
    }

    onScreenActivated() {
        this.isScreenActive = true;
        this.updateUI();
        this.log('system', 'Đã kết nối giao diện Tổng quan Chuyển động xe.');

        // Yêu cầu bắt đầu stream dữ liệu nếu WebSocket kết nối
        if (this.wsClient) {
            this.wsClient.send({ cmd: 'tcrt_start_stream' });
            this.wsClient.send({ cmd: 'start_stream' });
        }
    }

    onScreenDeactivated() {
        this.isScreenActive = false;
        // Nếu đang tự hành bám vạch, dừng để bảo đảm an toàn khi rời màn hình
        if (this.isRunningAutoLine) {
            this.stopAutoLine(true);
            this.log('warn', 'Rời khỏi màn hình chỉ huy: Tự động dừng xe để đảm bảo an toàn.');
        }
    }

    log(type, msg) {
        if (!this.elements.logBox) return;
        const now = new Date();
        const timeStr = [
            String(now.getHours()).padStart(2, '0'),
            String(now.getMinutes()).padStart(2, '0'),
            String(now.getSeconds()).padStart(2, '0')
        ].join(':');

        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        let prefix = '[HỆ THỐNG]';
        if (type === 'action') prefix = '[LỆNH]';
        else if (type === 'warn') prefix = '[CẢNH BÁO]';
        else if (type === 'danger') prefix = '[NGUY HIỂM]';
        else if (type === 'success') prefix = '[THÀNH CÔNG]';

        entry.innerHTML = `<span class="log-time">${timeStr} ${prefix}</span> ${msg}`;
        this.elements.logBox.prepend(entry);

        // Giới hạn số lượng bản ghi tối đa 60 dòng để mượt mà
        while (this.elements.logBox.children.length > 60) {
            this.elements.logBox.removeChild(this.elements.logBox.lastChild);
        }
    }

    toggleAutoLine() {
        if (this.isRunningAutoLine) {
            this.stopAutoLine(false);
        } else {
            this.startAutoLine();
        }
    }

    startAutoLine() {
        if (this.isObstacle) {
            this.log('danger', 'Không thể bắt đầu: Phát hiện vật cản trước xe (< 10cm)! Hãy dọn đường trước.');
            return;
        }

        this.isRunningAutoLine = true;
        this.log('action', `Khởi động chế độ Dò Line Onboard trên ESP32. Tốc độ cơ sở: ${this.baseSpeed}%.`);
        
        // Gửi lệnh kích hoạt onboard xuống ESP32 thông qua Python Server
        if (this.wsClient) {
            this.wsClient.send({
                cmd: 'start_auto_line',
                speed: this.baseSpeed
            });
            this.wsClient.send({ cmd: 'tcrt_start_stream' });
        }

        this.computeAndApplyLineTracking();
        this.updateUI();
    }

    stopAutoLine(isPassive = false) {
        this.isRunningAutoLine = false;
        this.leftSpeed = 0;
        this.rightSpeed = 0;
        this.steeringAngle = 0;
        this.actionText = 'XE ĐANG NGHỈ (STANDBY)';
        this.lineTrackingStatus = 'Đã dừng dò line';

        // Gửi lệnh dừng dò line onboard xuống ESP32
        if (this.wsClient) {
            this.wsClient.send({ cmd: 'stop_auto_line' });
        }

        if (!isPassive) {
            this.log('action', 'Đã dừng chế độ dò line tự động. Xe đã dừng lại.');
        }
        this.updateUI();
    }

    emergencyStop() {
        this.isRunningAutoLine = false;
        this.leftSpeed = 0;
        this.rightSpeed = 0;
        this.steeringAngle = 0;
        this.actionText = 'KHẨN CẤP: DỪNG TẤT CẢ (E-STOP)';
        this.lineTrackingStatus = 'Dừng khẩn cấp';

        // Lập tức ngắt motor và ngắt auto line
        if (this.sendThrottleDebounce) clearTimeout(this.sendThrottleDebounce);
        if (this.wsClient) {
            this.wsClient.send({ cmd: 'stop_auto_line' });
            this.wsClient.send({
                cmd: 'set_motor_speed',
                speed: 0,
                left: 0,
                right: 0,
                is_running: false
            });
        }

        this.log('danger', '🛑 KÍCH HOẠT E-STOP! TẤT CẢ ĐỘNG CƠ ĐÃ NGẮT HOÀN TOÀN!');

        // Hiệu ứng rung phản hồi trên nút E-STOP
        if (this.elements.btnEmergencyStop) {
            this.elements.btnEmergencyStop.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (this.elements.btnEmergencyStop) {
                    this.elements.btnEmergencyStop.style.transform = '';
                }
            }, 180);
        }

        this.updateUI();
    }

    computeAndApplyLineTracking() {
        if (!this.isRunningAutoLine) return;

        // Cập nhật trạng thái hiển thị mô phỏng trên Web theo 2 mắt cảm biến
        const L = this.leftIsBlack;
        const R = this.rightIsBlack;

        if (!L && !R) {
            // TH 1: CẢ 2 ĐỀU TRẮNG (0, 0) -> Vạch đen nằm chính giữa 2 mắt -> XE ĐI THẲNG
            this.lastAction = 'STRAIGHT';
            this.steeringAngle = 0;
            this.actionText = 'ĐI THẲNG: ĐÚNG TIM ĐƯỜNG (2 MẮT KẸP LINE)';
            this.lineTrackingStatus = 'Đúng tim đường (Trong vạch)';
        } else if (L && !R) {
            // TH 2: MẮT TRÁI ĐEN (1), MẮT PHẢI TRẮNG (0) -> Xe lệch phải -> BẺ LÁI SANG TRÁI
            this.lastAction = 'LEFT';
            this.steeringAngle = -14;
            this.actionText = 'BẺ LÁI TRÁI: MẮT TRÁI CHẠM VẠCH';
            this.lineTrackingStatus = 'Lệch phải (Bẻ sang trái)';
        } else if (!L && R) {
            // TH 3: MẮT PHẢI ĐEN (1), MẮT TRÁI TRẮNG (0) -> Xe lệch trái -> BẺ LÁI SANG PHẢI
            this.lastAction = 'RIGHT';
            this.steeringAngle = 14;
            this.actionText = 'BẺ LÁI PHẢI: MẮT PHẢI CHẠM VẠCH';
            this.lineTrackingStatus = 'Lệch trái (Bẻ sang phải)';
        } else {
            // TH 4: CẢ 2 ĐỀU ĐEN (1, 1)
            if (this.lastAction === 'LEFT') {
                this.steeringAngle = -16;
                this.actionText = 'CUA GẮT TRÁI: CẮT NGANG LINE (TIẾP TỤC ÔM CUA)';
                this.lineTrackingStatus = 'Cua gắt: Ép cua trái (Không dừng)';
            } else if (this.lastAction === 'RIGHT') {
                this.steeringAngle = 16;
                this.actionText = 'CUA GẮT PHẢI: CẮT NGANG LINE (TIẾP TỤC ÔM CUA)';
                this.lineTrackingStatus = 'Cua gắt: Ép cua phải (Không dừng)';
            } else {
                this.steeringAngle = 0;
                this.actionText = 'VẠCH NGANG: DỪNG TRẠM / VẠCH ĐÍCH';
                this.lineTrackingStatus = 'Gặp vạch ngang (Dừng trạm)';
            }
        }
    }

    /**
     * Nhận đồng bộ trạng thái cảm biến từ Tab TCRT5000
     */
    syncTCRTState(leftIsBlack, rightIsBlack) {
        this.leftIsBlack = leftIsBlack;
        this.rightIsBlack = rightIsBlack;
        if (this.isRunningAutoLine) {
            this.computeAndApplyLineTracking();
        }
        this.updateUI();
    }

    sendSpeedToServer(left, right, isRunning) {
        if (this.sendThrottleDebounce) clearTimeout(this.sendThrottleDebounce);
        this.sendThrottleDebounce = setTimeout(() => {
            if (this.wsClient) {
                const maxSpeed = Math.max(left, right);
                this.wsClient.send({
                    cmd: 'set_motor_speed',
                    speed: maxSpeed,
                    left: left,
                    right: right,
                    is_running: isRunning
                });
            }
        }, 60);
    }

    handleTelemetry(telemetryData) {
        if (!telemetryData) return;

        let hasChange = false;

        // 1. Phân tích trạng thái Auto Line từ ESP32 / Server
        if (telemetryData.auto_line !== undefined) {
            if (this.isRunningAutoLine !== telemetryData.auto_line) {
                this.isRunningAutoLine = telemetryData.auto_line;
                hasChange = true;
            }
        }
        if (telemetryData.event === 'auto_line_status') {
            this.isRunningAutoLine = !!telemetryData.running;
            hasChange = true;
        }

        // 2. Phân tích dữ liệu Siêu âm (RCWL-1601)
        const sensor = telemetryData.sensor || (telemetryData.distance_cm !== undefined ? telemetryData : null);
        if (sensor && sensor.distance_cm !== undefined) {
            const dist = typeof sensor.distance_cm === 'number' ? sensor.distance_cm : parseFloat(sensor.distance_cm);
            const prevObstacle = this.isObstacle;

            this.sonarDistance = isNaN(dist) ? -1 : dist;
            this.isObstacle = (this.sonarDistance > 0 && this.sonarDistance < 10) || (sensor.obstacle_detected === true);

            // Cảnh báo vật cản nếu mới phát hiện
            if (this.isObstacle && !prevObstacle) {
                this.log('warn', `Phát hiện vật cản trước mặt: ${this.sonarDistance.toFixed(1)}cm (<10cm)!`);
            } else if (!this.isObstacle && prevObstacle && this.sonarDistance >= 10) {
                this.log('success', `Đường đi đã thông thoáng (${this.sonarDistance.toFixed(1)}cm).`);
            }

            hasChange = true;
        }

        // 3. Phân tích dữ liệu TCRT5000 Dò vạch
        if (telemetryData.tcrt5000) {
            const tcrt = telemetryData.tcrt5000;
            if (tcrt.left) {
                this.leftIsBlack = (tcrt.left.is_black === true || tcrt.left.raw === 1);
            }
            if (tcrt.right) {
                this.rightIsBlack = (tcrt.right.is_black === true || tcrt.right.raw === 1);
            }
            hasChange = true;
        }

        // 4. Phân tích dữ liệu phản hồi Motor từ ESP32
        if (telemetryData.motor) {
            const m = telemetryData.motor;
            if (m.speed_left !== undefined) this.leftSpeed = m.speed_left;
            if (m.speed_right !== undefined) this.rightSpeed = m.speed_right;
            hasChange = true;
        }

        // Nếu xe đang tự hành bám line, tính toán góc lái và nhãn trạng thái hiển thị
        if (this.isRunningAutoLine) {
            this.computeAndApplyLineTracking();
        }

        if (hasChange || this.isScreenActive) {
            this.updateUI();
        }
    }

    updateUI() {
        const els = this.elements;
        if (!els.masterSpeed) return; // Nếu màn hình chưa render trong DOM

        // 1. Tốc độ tổng và thanh đo 2 bánh
        const maxSpd = Math.max(this.leftSpeed, this.rightSpeed);
        this.masterSpeed = this.isRunningAutoLine ? maxSpd : 0;
        els.masterSpeed.textContent = this.masterSpeed;

        if (els.wsBarLeft) els.wsBarLeft.style.width = `${this.leftSpeed}%`;
        if (els.wsValLeft) els.wsValLeft.textContent = `${this.leftSpeed}%`;
        if (els.wsBarRight) els.wsBarRight.style.width = `${this.rightSpeed}%`;
        if (els.wsValRight) els.wsValRight.textContent = `${this.rightSpeed}%`;

        // 2. Cảm biến siêu âm & Huy hiệu cảnh báo
        if (els.sonarDist) {
            if (this.sonarDistance < 0) {
                els.sonarDist.textContent = '--.-';
            } else {
                els.sonarDist.textContent = this.sonarDistance.toFixed(1);
            }
        }

        if (els.sonarAlertBadge && els.sonarAlertText) {
            if (this.sonarDistance < 0) {
                els.sonarAlertBadge.className = 'sonar-alert-badge badge-safe';
                els.sonarAlertText.textContent = 'CHỜ TÍN HIỆU';
            } else if (this.isObstacle) {
                els.sonarAlertBadge.className = 'sonar-alert-badge badge-danger';
                els.sonarAlertText.textContent = 'NGUY HIỂM: CÓ VẬT CẢN';
            } else {
                els.sonarAlertBadge.className = 'sonar-alert-badge badge-safe';
                els.sonarAlertText.textContent = 'AN TOÀN: ĐƯỜNG TRỐNG';
            }
        }

        if (els.sonarFill) {
            const fillPct = this.sonarDistance <= 0 ? 0 : Math.min(100, Math.max(0, (this.sonarDistance / 40) * 100));
            els.sonarFill.style.width = `${fillPct}%`;
        }

        // 3. Trạng thái 2 mắt TCRT5000 (Pill + Eye dot trên xe)
        if (els.tcrtPillLeft) {
            els.tcrtPillLeft.className = `pod-state-pill ${this.leftIsBlack ? 'pill-black' : 'pill-white'}`;
            els.tcrtPillLeft.textContent = this.leftIsBlack ? 'ĐEN' : 'TRẮNG';
        }
        if (els.tcrtPillRight) {
            els.tcrtPillRight.className = `pod-state-pill ${this.rightIsBlack ? 'pill-black' : 'pill-white'}`;
            els.tcrtPillRight.textContent = this.rightIsBlack ? 'ĐEN' : 'TRẮNG';
        }

        if (els.robotEyeLeft) {
            els.robotEyeLeft.className = `eye-dot eye-left ${this.leftIsBlack ? 'active-black' : ''}`;
        }
        if (els.robotEyeRight) {
            els.robotEyeRight.className = `eye-dot eye-right ${this.rightIsBlack ? 'active-black' : ''}`;
        }

        // 4. Sân khấu Digital Twin 2D
        if (els.sonarCone && els.coneTag) {
            if (this.isObstacle) {
                els.sonarCone.className = 'sonar-beam-cone cone-danger';
                els.coneTag.textContent = 'VẬT CẢN <10CM!';
            } else {
                els.sonarCone.className = 'sonar-beam-cone cone-safe';
                els.coneTag.textContent = 'RADAR QUÉT TRƯỚC';
            }
        }

        if (els.stageRobot) {
            if (this.isRunningAutoLine) {
                els.stageRobot.classList.add('is-running');
                els.stageRobot.style.transform = `rotate(${this.steeringAngle}deg)`;
            } else {
                els.stageRobot.classList.remove('is-running');
                els.stageRobot.style.transform = 'rotate(0deg)';
            }
        }

        // Huy hiệu hành vi chuyển động
        if (els.actionBadge && els.actionText) {
            els.actionText.textContent = this.actionText;
            if (this.isObstacle) {
                els.actionBadge.className = 'motion-action-badge badge-alert';
            } else if (this.isRunningAutoLine) {
                els.actionBadge.className = 'motion-action-badge badge-tracking';
            } else {
                els.actionBadge.className = 'motion-action-badge badge-standby';
            }
        }

        // Góc đánh lái & trạng thái bám vạch
        if (els.steeringAngleVal) {
            const dirLabel = this.steeringAngle < 0 ? 'Rẽ trái' : this.steeringAngle > 0 ? 'Rẽ phải' : 'Thẳng';
            els.steeringAngleVal.textContent = `${this.steeringAngle.toFixed(1)}° (${dirLabel})`;
        }

        if (els.lineTrackingStatusVal) {
            els.lineTrackingStatusVal.textContent = this.lineTrackingStatus;
        }

        // 5. Nút Bật / Tắt Dò Line
        if (els.btnToggleAutoLine) {
            if (this.isRunningAutoLine) {
                els.btnToggleAutoLine.className = 'btn-mission-toggle-track track-running';
                if (els.autoLineBtnIcon) els.autoLineBtnIcon.textContent = '⏹';
                if (els.autoLineBtnLabel) els.autoLineBtnLabel.textContent = 'DỪNG DÒ LINE';
                if (els.autoLineBtnSub) els.autoLineBtnSub.textContent = 'Click để tạm dừng xe ngay lập tức';
            } else {
                els.btnToggleAutoLine.className = 'btn-mission-toggle-track track-stopped';
                if (els.autoLineBtnIcon) els.autoLineBtnIcon.textContent = '▶';
                if (els.autoLineBtnLabel) els.autoLineBtnLabel.textContent = 'BẮT ĐẦU DÒ LINE TỰ ĐỘNG';
                if (els.autoLineBtnSub) els.autoLineBtnSub.textContent = 'Click để xe tự động bám vạch quang học';
            }
        }
    }
}


// 6. CLASS DASHBOARD_APP (Lớp ứng dụng trung tâm - Điều phối toàn bộ hệ thống)
// ==============================================================================
class DashboardApp {
    constructor() {
        this.trailerDuration = 2600; // Thời gian chạy trailer (ms)
        this.screenManager = new ScreenManager();
        this.authManager = new AuthManager();
        this.pwController = new PasswordFieldController('#password', '#eye-icon');
        this.wsClient = new WebSocketClient();
        this.ultrasonicController = new UltrasonicChartController(this.wsClient);
        this.tcrtController = new TCRT5000Controller(this.wsClient);
        this.tb6612Controller = new TB6612Controller(this.wsClient);
        this.missionController = new VehicleMotionController(this.wsClient);
        
        this.pendingLogin = null;
        this.loginTimeoutTimer = null;

        // Kết nối bộ nhận dữ liệu Telemetry trực tiếp từ WebSocket tới Controllers
        this.wsClient.telemetryCallback = (telemetryData) => {
            if (this.ultrasonicController) {
                this.ultrasonicController.handleTelemetry(telemetryData.sensor || telemetryData);
            }
            if (this.tcrtController) {
                this.tcrtController.handleTelemetry(telemetryData);
            }
            if (this.tb6612Controller) {
                this.tb6612Controller.handleTelemetry(telemetryData);
            }
            if (this.missionController) {
                this.missionController.handleTelemetry(telemetryData);
            }
        };

        // Đồng bộ 2 chiều trạng thái thử nghiệm cảm biến giữa Tab TCRT5000 và Tab Điều khiển chung
        this.tcrtController.onStateChange = (state) => {
            if (this.missionController) {
                this.missionController.syncTCRTState(state.left, state.right);
            }
        };

        this.missionController.onStateChange = (state) => {
            if (this.tcrtController) {
                this.tcrtController.syncExternalState(state.left, state.right);
            }
        };

        // Phản hồi xin cấp quyền điều khiển độc quyền từ Server
        this.wsClient.loginResponseCallback = (resp) => {
            this.handleLoginResponse(resp);
        };

        // Nhận trạng thái bận/rảnh của xe từ Server
        this.wsClient.controllerStatusCallback = (status) => {
            this.updateControllerStatusUI(status);
        };
    }

    /**
     * Khởi tạo ứng dụng khi DOM đã sẵn sàng
     */
    init() {
        // Khởi đầu: Hiển thị ngay Màn hình Đăng nhập trước tiên
        this.screenManager.show('login-screen');

        // Gắn kết các sự kiện lắng nghe tương tác
        this.bindEvents();
        this.tcrtController.init();
        this.tb6612Controller.init();
        this.missionController.init();
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
        const backBtn = document.getElementById('btn-back-wifi-modal');

        const openWifiModal = () => {
            if (wifiModal) wifiModal.style.display = 'flex';
            // Yêu cầu lấy thông tin trạng thái Wi-Fi mới nhất
            this.wsClient.send({ cmd: 'get_wifi_status' });
        };

        const closeWifiModal = () => {
            if (wifiModal) wifiModal.style.display = 'none';
        };

        if (wifiCard) wifiCard.addEventListener('click', openWifiModal);
        if (backBtn) backBtn.addEventListener('click', closeWifiModal);

        // Đóng khi click vào vùng nền mờ bên ngoài
        if (wifiModal) {
            wifiModal.addEventListener('click', (e) => {
                if (e.target === wifiModal) closeWifiModal();
            });
        }

        // Nút Cập nhật trạng thái Wi-Fi thủ công (On-Demand)
        const refreshWifiBtn = document.getElementById('btn-refresh-wifi');
        if (refreshWifiBtn) {
            refreshWifiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                refreshWifiBtn.classList.add('spinning');
                const textRefresh = document.getElementById('btn-refresh-wifi-text');
                if (textRefresh) textRefresh.textContent = 'Đang kiểm tra...';
                this.wsClient.send({ cmd: 'get_wifi_status' });

                // Tự động gỡ spinning sau 4s nếu timeout
                setTimeout(() => {
                    refreshWifiBtn.classList.remove('spinning');
                    if (textRefresh) textRefresh.textContent = 'Cập nhật trạng thái Wi-Fi';
                }, 4000);
            });
        }

        // 6. Thẻ Cảm biến khoảng cách RCWL-1601: Click vào để mở Phòng Lab Cảm biến
        const ultrasonicCard = document.getElementById('card-ultrasonic');
        const backUltrasonicBtn = document.getElementById('btn-back-ultrasonic');

        if (ultrasonicCard) {
            ultrasonicCard.removeAttribute('onclick');
            ultrasonicCard.addEventListener('click', (e) => {
                e.preventDefault();
                this.screenManager.show('ultrasonic-screen');
                this.ultrasonicController.onScreenActivated();
            });
        }

        if (backUltrasonicBtn) {
            backUltrasonicBtn.removeAttribute('onclick');
            backUltrasonicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.ultrasonicController.onScreenDeactivated();
                this.screenManager.show('dashboard-screen');
            });
        }

        // 7. Các nút điều khiển cảm biến RCWL-1601
        const btnMeasureOnce = document.getElementById('btn-measure-once');
        const btnStreamToggle = document.getElementById('btn-stream-toggle');
        const btnClearChart = document.getElementById('btn-clear-chart');

        if (btnMeasureOnce) {
            btnMeasureOnce.removeAttribute('onclick');
            btnMeasureOnce.addEventListener('click', (e) => {
                e.preventDefault();
                this.ultrasonicController.measureOnce();
            });
        }

        if (btnStreamToggle) {
            btnStreamToggle.removeAttribute('onclick');
            btnStreamToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.ultrasonicController.toggleStream();
            });
        }

        if (btnClearChart) {
            btnClearChart.removeAttribute('onclick');
            btnClearChart.addEventListener('click', (e) => {
                e.preventDefault();
                this.ultrasonicController.clearData();
            });
        }

        // 8. Thẻ Cảm biến dò line TCRT5000 (Chassis Visualizer 2D)
        const tcrtCard = document.getElementById('card-tcrt5000');
        const backTcrtBtn = document.getElementById('btn-back-tcrt5000');

        if (tcrtCard) {
            tcrtCard.removeAttribute('onclick');
            tcrtCard.addEventListener('click', (e) => {
                e.preventDefault();
                this.screenManager.show('tcrt5000-screen');
                if (this.tcrtController) {
                    this.tcrtController.onScreenActivated();
                }
            });
        }

        if (backTcrtBtn) {
            backTcrtBtn.removeAttribute('onclick');
            backTcrtBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.tcrtController) {
                    this.tcrtController.onScreenDeactivated();
                }
                this.screenManager.show('dashboard-screen');
            });
        }

        // 9. Thẻ Điều khiển động cơ TB6612FNG (Đang phát triển)
        const tb6612Card = document.getElementById('card-tb6612');
        const backTb6612Btn = document.getElementById('btn-back-tb6612');

        if (tb6612Card) {
            tb6612Card.removeAttribute('onclick');
            tb6612Card.addEventListener('click', (e) => {
                e.preventDefault();
                this.screenManager.show('tb6612-screen');
            });
        }

        if (backTb6612Btn) {
            backTb6612Btn.removeAttribute('onclick');
            backTb6612Btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.screenManager.show('dashboard-screen');
            });
        }

        // 10. Thẻ Tổng quan Chuyển động xe (Mission Control)
        const vehicleMotionCard = document.getElementById('card-vehicle-motion');
        const backVehicleMotionBtn = document.getElementById('btn-back-vehicle-motion');

        if (vehicleMotionCard) {
            vehicleMotionCard.removeAttribute('onclick');
            vehicleMotionCard.addEventListener('click', (e) => {
                e.preventDefault();
                this.screenManager.show('vehicle-motion-screen');
                if (this.missionController) {
                    this.missionController.onScreenActivated();
                }
            });
        }

        if (backVehicleMotionBtn) {
            backVehicleMotionBtn.removeAttribute('onclick');
            backVehicleMotionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.missionController) {
                    this.missionController.onScreenDeactivated();
                }
                this.screenManager.show('dashboard-screen');
            });
        }
    }

    /**
     * Xử lý sự kiện khi người dùng nhấn ĐĂNG NHẬP
     * Gửi yêu cầu xin quyền độc quyền tới Server (Chỉ 1 người được điều khiển)
     */
    handleLoginFormSubmit(event) {
        if (event) event.preventDefault();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const errorMsgElement = document.getElementById('error-message');
        const submitBtn = document.querySelector('.btn-submit');

        if (!usernameInput || !passwordInput) return;

        if (errorMsgElement) errorMsgElement.innerText = '';

        // 1. Kiểm tra tài khoản & mật khẩu cục bộ trước
        const credCheck = this.authManager.checkCredentials(usernameInput.value, passwordInput.value);
        if (!credCheck.success) {
            if (errorMsgElement) errorMsgElement.innerText = credCheck.message;
            return;
        }

        // 2. Kiểm tra kết nối tới Server
        if (!this.wsClient.connected) {
            if (errorMsgElement) errorMsgElement.innerText = '❌ Chưa kết nối tới máy chủ! Vui lòng kiểm tra server Python.';
            return;
        }

        // 3. Khóa nút đăng nhập và hiển thị trạng thái chờ cấp quyền
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = '⏳ Đang xin quyền điều khiển...';
        }

        this.pendingLogin = {
            username: credCheck.user
        };

        // Gửi yêu cầu xin quyền độc quyền tới Server
        this.wsClient.send({
            cmd: 'request_login',
            user: credCheck.user
        });

        // Timeout dự phòng sau 5s nếu server không phản hồi
        if (this.loginTimeoutTimer) clearTimeout(this.loginTimeoutTimer);
        this.loginTimeoutTimer = setTimeout(() => {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = submitBtn.dataset.originalText || 'ĐĂNG NHẬP';
            }
            if (errorMsgElement && errorMsgElement.innerText === '') {
                errorMsgElement.innerText = '❌ Máy chủ không phản hồi yêu cầu cấp quyền. Vui lòng thử lại!';
            }
        }, 5000);
    }

    /**
     * Nhận phản hồi cấp quyền từ Server Python
     */
    handleLoginResponse(resp) {
        if (this.loginTimeoutTimer) clearTimeout(this.loginTimeoutTimer);

        const submitBtn = document.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = submitBtn.dataset.originalText || 'ĐĂNG NHẬP';
        }

        const errorMsgElement = document.getElementById('error-message');

        if (resp && resp.success) {
            if (this.pendingLogin) {
                this.authManager.saveSession(this.pendingLogin.username);
            }
            if (errorMsgElement) errorMsgElement.innerText = '';
            const user = resp.user || (this.pendingLogin ? this.pendingLogin.username : 'User');
            this.playTrailerAndEnterDashboard(user);
        } else {
            // Bị từ chối do có người khác đang điều khiển!
            if (errorMsgElement) {
                errorMsgElement.innerText = resp.message || '❌ Yêu cầu đăng nhập bị từ chối!';
            }
        }
        this.pendingLogin = null;
    }

    /**
     * Cập nhật thông báo trạng thái khóa phiên điều khiển độc quyền lên giao diện
     */
    updateControllerStatusUI(status) {
        const queueNotice = document.querySelector('.queue-notice');
        if (!queueNotice) return;

        if (status.is_locked) {
            queueNotice.className = 'queue-notice is-busy';
            queueNotice.innerHTML = `<span class="queue-status-icon">🔒</span> <span class="queue-status-text">'${status.active_user}' đang điều khiển!</span>`;
        } else {
            queueNotice.className = 'queue-notice is-available';
            queueNotice.innerHTML = `<span class="queue-status-icon">🟢</span> <span class="queue-status-text">Sẵn sàng nhận 1 người điều khiển</span>`;
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
    window.app = app;
    app.init();
});

// Giữ lại các hàm Wrapper toàn cục có debounce để tương thích 100% nếu có gọi từ bên ngoài
function handleLogin(event) {
    if (event) event.preventDefault();
    if (app) app.handleLoginFormSubmit(event);
}

function togglePasswordVisibility() {
    if (app) app.pwController.toggle();
}

function handleLogout() {
    if (app) app.handleUserLogout();
}

function handleOpenUltrasonicScreen() {
    if (window.app) {
        window.app.screenManager.show('ultrasonic-screen');
        if (window.app.ultrasonicController) {
            window.app.ultrasonicController.onScreenActivated();
        }
    }
}

function handleBackUltrasonic() {
    if (window.app) {
        if (window.app.ultrasonicController) {
            window.app.ultrasonicController.onScreenDeactivated();
        }
        window.app.screenManager.show('dashboard-screen');
    }
}

function handleMeasureOnce() {
    console.log('[Global] 👉 Gọi hàm handleMeasureOnce()');
    if (window.app && window.app.ultrasonicController) {
        window.app.ultrasonicController.measureOnce();
    }
}

function handleStreamToggle() {
    console.log('[Global] 👉 Gọi hàm handleStreamToggle()');
    if (window.app && window.app.ultrasonicController) {
        window.app.ultrasonicController.toggleStream();
    }
}

function handleClearChart() {
    console.log('[Global] 👉 Gọi hàm handleClearChart()');
    if (window.app && window.app.ultrasonicController) {
        window.app.ultrasonicController.clearData();
    }
}
