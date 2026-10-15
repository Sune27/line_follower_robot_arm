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
        } catch (e) { }

        // Danh sách các tài khoản hợp lệ được cấp quyền truy cập hệ thống
        this.authorizedAccounts = [
            { username: 'sune', password: '24021197' }, // Tài khoản quản trị chính
            { username: 'tung', password: '24020000' }, // Tài khoản thành viên 2
            { username: 'hung', password: '24020001' }, // Tài khoản thành viên 3
            { username: 'nghia', password: 'dcmnghiatruong' }, // Tài khoản thành viên 4
            { username: '1', password: '1' }
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
        } catch (e) { }
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
        this.sendQueue = [];
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
                // Tự động yêu cầu phát stream dữ liệu TCRT5000 ngay khi kết nối
                this.ws.send(JSON.stringify({ cmd: 'tcrt_start_stream' }));

                // Xả hàng đợi các lệnh gửi dở khi socket đang kết nối
                if (this.sendQueue && this.sendQueue.length > 0) {
                    while (this.sendQueue.length > 0) {
                        const qItem = this.sendQueue.shift();
                        try {
                            console.log('[WebSocket] 📤 Gửi lệnh từ hàng đợi:', qItem);
                            this.ws.send(qItem);
                        } catch (e) { }
                    }
                }
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

                    } else if (data.event === 'telemetry' || data.event === 'auto_line_status') {
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
                            if (window.app && window.app.missionController) {
                                window.app.missionController.handleTelemetry(data);
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
            console.warn('[WebSocket] ⏳ Đang kết nối hoặc chưa sẵn sàng, lưu lệnh vào hàng đợi:', payload);
            if (!this.sendQueue) this.sendQueue = [];
            this.sendQueue.push(payload);
            if (this.sendQueue.length > 20) this.sendQueue.shift();
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
// 5.5 CLASS TCRT5000_CONTROLLER (Mảng 5 mắt TCRT5000 Dual-Mode: Live + Virtual Simulator)
// ==============================================================================
class TCRT5000Controller {
    constructor(wsClient) {
        this.wsClient = wsClient;
        // Trạng thái 5 mắt: 0 là Trắng, 1 là Đen (S1 -> S5)
        this.sensors = [0, 0, 0, 0, 0];
        this.volts = [0.0, 0.0, 0.0, 0.0, 0.0];
        this.pinNames = ['GPIO 21', 'GPIO 19', 'GPIO 18', 'GPIO 5', 'GPIO 17'];
        this.isWorking = false; // Mặc định cảm biến ở chế độ TẮT

        // DOM elements
        this.btnTogglePower = null;
        this.powerBtnIcon = null;
        this.powerBtnText = null;
        this.btnReset = null;

        this.pods = [];
        this.podStatuses = [];
        this.podVolts = [];
        this.teleStatuses = [];
        this.teleDetails = [];

        this.gaugeIndicator = null;
        this.errorLabel = null;
        this.errorVal = null;
        this.behaviorBadge = null;
        this.speedPreview = null;
        this.bitmaskEl = null;

        this.onStateChange = null; // Callback đồng bộ
    }

    init() {
        this.btnTogglePower = document.getElementById('btn-toggle-tcrt-power');
        this.powerBtnIcon = document.getElementById('tcrt-power-btn-icon');
        this.powerBtnText = document.getElementById('tcrt-power-btn-text');
        this.btnReset = document.getElementById('btn-tcrt-reset');

        this.gaugeIndicator = document.getElementById('tcrt5-gauge-indicator');
        this.errorLabel = document.getElementById('tcrt5-error-label');
        this.errorVal = document.getElementById('tcrt5-error-val');
        this.behaviorBadge = document.getElementById('tcrt5-behavior-badge');
        this.speedPreview = document.getElementById('tcrt5-speed-preview');
        this.bitmaskEl = document.getElementById('tcrt5-bitmask');

        this.pods = [];
        this.podStatuses = [];
        this.podVolts = [];
        this.teleStatuses = [];
        this.teleDetails = [];

        for (let i = 0; i < 5; i++) {
            const pod = document.getElementById(`tcrt-pod-${i + 1}`);
            this.pods.push(pod);
            this.podStatuses.push(document.getElementById(`pod-status-${i + 1}`));
            this.podVolts.push(document.getElementById(`pod-volt-${i + 1}`));
            this.teleStatuses.push(document.getElementById(`tele-status-${i + 1}`));
            this.teleDetails.push(document.getElementById(`tele-detail-${i + 1}`));
            // Chế độ live phần cứng: không gán sự kiện click tay
        }

        if (this.btnTogglePower) {
            this.btnTogglePower.addEventListener('click', (e) => {
                e.preventDefault();
                this.togglePower();
            });
        }

        if (this.btnReset) {
            this.btnReset.addEventListener('click', (e) => {
                e.preventDefault();
                this.sensors = [0, 0, 0, 0, 0];
                this.volts = [0.0, 0.0, 0.0, 0.0, 0.0];
                if (this.onStateChange) {
                    this.onStateChange({
                        sensors: [...this.sensors],
                        left: false,
                        right: false
                    });
                }
                this.render();
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
            this.powerBtnText.textContent = this.isWorking ? 'Tắt cảm biến' : 'Bật cảm biến';
        }

        if (this.wsClient) {
            this.wsClient.send({ cmd: this.isWorking ? 'tcrt_start_stream' : 'tcrt_stop_stream' });
        }

        if (!this.isWorking) {
            this.sensors = [0, 0, 0, 0, 0];
            this.volts = [0.0, 0.0, 0.0, 0.0, 0.0];
        }

        this.render();
    }

    onScreenActivated() {
        // Tự động kích hoạt stream khi vào màn hình để hiển thị ngay dữ liệu đo thực tế từ phần cứng
        if (!this.isWorking) {
            this.setWorkingState(true);
        } else {
            this.render();
            if (this.wsClient) {
                this.wsClient.send({ cmd: 'tcrt_start_stream' });
            }
        }
    }

    onScreenDeactivated() {
        if (this.isWorking) {
            this.setWorkingState(false);
        }
    }

    handleTelemetry(data) {
        if (!data || !data.tcrt5000) return;
        if (!this.isWorking) {
            this.isWorking = true;
            if (this.btnTogglePower) {
                this.btnTogglePower.className = 'btn-tcrt-power is-active';
            }
            if (this.powerBtnIcon) {
                this.powerBtnIcon.textContent = '⏹';
            }
            if (this.powerBtnText) {
                this.powerBtnText.textContent = 'Tắt cảm biến';
            }
        }
        const tcrt = data.tcrt5000;

        // Hỗ trợ cả mảng 5 mắt mới hoặc định dạng 2 mắt cũ
        if (Array.isArray(tcrt.array)) {
            for (let i = 0; i < 5; i++) {
                this.sensors[i] = tcrt.array[i] ? 1 : 0;
                this.volts[i] = this.sensors[i] === 1 ? 3.3 : 0.0;
            }
        } else if (tcrt.s1 !== undefined) {
            this.sensors = [
                tcrt.s1 ? 1 : 0,
                tcrt.s2 ? 1 : 0,
                tcrt.s3 ? 1 : 0,
                tcrt.s4 ? 1 : 0,
                tcrt.s5 ? 1 : 0
            ];
            for (let i = 0; i < 5; i++) {
                this.volts[i] = this.sensors[i] === 1 ? 3.3 : 0.0;
            }
        } else if (tcrt.left && tcrt.right) {
            // Fallback tương thích ngược khi ESP32 chạy firmware 2 mắt cũ
            const l = (tcrt.left.is_black || tcrt.left.raw === 1) ? 1 : 0;
            const r = (tcrt.right.is_black || tcrt.right.raw === 1) ? 1 : 0;
            this.sensors = [0, l, 0, r, 0];
            this.volts[1] = tcrt.left.voltage !== undefined ? tcrt.left.voltage : (l ? 3.3 : 0.0);
            this.volts[3] = tcrt.right.voltage !== undefined ? tcrt.right.voltage : (r ? 3.3 : 0.0);
        }

        this.render();
    }

    calculatePID(s) {
        const [s1, s2, s3, s4, s5] = s;
        const bitmask = (s1 << 4) | (s2 << 3) | (s3 << 2) | (s4 << 1) | s5;

        // Xử lý các mẫu nhận dạng đặc trưng
        if (bitmask === 0b00000) {
            return {
                error: 0,
                status: 'MẤT LINE (00000) ➔ QUÉT TÌM LINE THEO HƯỚNG CŨ (1.5S)',
                badgeClass: 'badge-lost',
                speedPreview: 'Quét tìm vạch',
                bitmask
            };
        }
        if (bitmask === 0b11111) {
            return {
                error: 0,
                status: 'VẠCH NGANG / NGÃ TƯ / ĐÍCH (11111)',
                badgeClass: 'badge-stop',
                speedPreview: 'L: 20% | R: 20%',
                bitmask
            };
        }
        if (bitmask === 0b10000) {
            return { error: -4, status: 'CUA GẮT TRÁI (90°) ➔ XOAY VI SAI TRÁI', badgeClass: 'badge-sharp', speedPreview: 'L: 18% | R: 48%', bitmask };
        }
        if (bitmask === 0b11000) {
            return { error: -3, status: 'CUA TRÁI MẠNH', badgeClass: 'badge-sharp', speedPreview: 'L: 22% | R: 44%', bitmask };
        }
        if (bitmask === 0b01000) {
            return { error: -2, status: 'LỆCH PHẢI ➔ BẺ LÁI TRÁI VỪA', badgeClass: 'badge-steer', speedPreview: 'L: 25% | R: 42%', bitmask };
        }
        if (bitmask === 0b01100) {
            return { error: -1, status: 'LỆCH NHẸ PHẢI ➔ NHÍCH TRÁI', badgeClass: 'badge-steer', speedPreview: 'L: 30% | R: 38%', bitmask };
        }
        if (bitmask === 0b00100) {
            return { error: 0, status: 'ĐÚNG TIM ĐƯỜNG • ĐI THẲNG TỐC ĐỘ CAO', badgeClass: 'badge-straight', speedPreview: 'L: 35% | R: 35%', bitmask };
        }
        if (bitmask === 0b00110) {
            return { error: +1, status: 'LỆCH NHẸ TRÁI ➔ NHÍCH PHẢI', badgeClass: 'badge-steer', speedPreview: 'L: 38% | R: 30%', bitmask };
        }
        if (bitmask === 0b00010) {
            return { error: +2, status: 'LỆCH TRÁI ➔ BẺ LÁI PHẢI VỪA', badgeClass: 'badge-steer', speedPreview: 'L: 42% | R: 25%', bitmask };
        }
        if (bitmask === 0b00011) {
            return { error: +3, status: 'CUA PHẢI MẠNH', badgeClass: 'badge-sharp', speedPreview: 'L: 44% | R: 22%', bitmask };
        }
        if (bitmask === 0b00001) {
            return { error: +4, status: 'CUA GẮT PHẢI (90°) ➔ XOAY VI SAI PHẢI', badgeClass: 'badge-sharp', speedPreview: 'L: 48% | R: 18%', bitmask };
        }

        // Mẫu tổng quát: Trung bình có trọng số
        const total = s1 + s2 + s3 + s4 + s5;
        let weighted = total > 0 ? ((-4 * s1) + (-2 * s2) + (0 * s3) + (2 * s4) + (4 * s5)) / total : 0;
        let rounded = Math.round(weighted);
        rounded = Math.max(-4, Math.min(4, rounded));

        let badgeClass = 'badge-steer';
        if (rounded === 0) badgeClass = 'badge-straight';
        else if (Math.abs(rounded) >= 3) badgeClass = 'badge-sharp';

        return {
            error: rounded,
            status: rounded < 0 ? `LỆCH PHẢI (Error ${rounded}) ➔ LÁI TRÁI` : (rounded > 0 ? `LỆCH TRÁI (Error +${rounded}) ➔ LÁI PHẢI` : 'ĐÚNG TIM ĐƯỜNG'),
            badgeClass,
            speedPreview: `L: ${Math.max(15, 35 - rounded * 3)}% | R: ${Math.max(15, 35 + rounded * 3)}%`,
            bitmask
        };
    }

    render() {
        const isOff = !this.isWorking;

        // Tính toán giải thuật PID & Phân loại hình học vạch
        const pidResult = isOff ?
            { error: 0, status: 'CẢM BIẾN ĐANG NGHỈ (CHƯA BẬT)', badgeClass: 'badge-straight', speedPreview: '-- | --', bitmask: 0 } :
            this.calculatePID(this.sensors);

        // Cập nhật 5 Pods
        for (let i = 0; i < 5; i++) {
            const pod = this.pods[i];
            const isBlack = this.sensors[i] === 1;
            const volt = this.volts[i];

            if (pod) {
                if (isOff) {
                    pod.className = 'tcrt5-pod is-disabled';
                } else {
                    pod.className = `tcrt5-pod ${isBlack ? 'is-black' : 'is-white'}`;
                }
            }
            if (this.podStatuses[i]) {
                this.podStatuses[i].textContent = isOff ? 'TẮT' : (isBlack ? 'ĐEN (1)' : 'TRẮNG (0)');
            }
            if (this.podVolts[i]) {
                this.podVolts[i].textContent = isOff ? '--' : (Number(volt).toFixed(1) + 'V');
            }

            // Cập nhật thẻ Telemetry dưới cùng
            if (this.teleStatuses[i]) {
                this.teleStatuses[i].textContent = isOff ? 'TẮT' : (isBlack ? 'ĐEN' : 'TRẮNG');
                this.teleStatuses[i].style.color = isOff ? '#94a3b8' : (isBlack ? '#ef4444' : '#34d399');
            }
            if (this.teleDetails[i]) {
                this.teleDetails[i].textContent = isOff ? '--' : `${this.sensors[i]} • ${Number(volt).toFixed(1)}V`;
            }
        }

        // Cập nhật Thước đo Gauge & Indicator
        if (this.gaugeIndicator) {
            // error từ -4 đến +4: map vào khoảng 6% đến 94% (tâm 50%)
            const percent = 50 + (pidResult.error / 4) * 44;
            this.gaugeIndicator.style.left = `${Math.max(6, Math.min(94, percent))}%`;
        }
        if (this.errorLabel) {
            this.errorLabel.textContent = pidResult.error > 0 ? `+${pidResult.error}` : pidResult.error;
        }
        if (this.errorVal) {
            this.errorVal.textContent = isOff ? '--' : (pidResult.error > 0 ? `+${pidResult.error}` : pidResult.error);
        }
        if (this.behaviorBadge) {
            this.behaviorBadge.className = `stat-badge ${pidResult.badgeClass}`;
            this.behaviorBadge.textContent = pidResult.status;
        }
        if (this.speedPreview) {
            this.speedPreview.textContent = pidResult.speedPreview;
        }
        if (this.bitmaskEl) {
            const binStr = ('00000' + pidResult.bitmask.toString(2)).slice(-5);
            const hexStr = '0x' + pidResult.bitmask.toString(16).toUpperCase().padStart(2, '0');
            this.bitmaskEl.innerHTML = `BITMASK: <b>0b${binStr}</b> (${hexStr})`;
        }
    }

    syncExternalState(leftOrSensors, rightIsBlack) {
        if (Array.isArray(leftOrSensors)) {
            for (let i = 0; i < 5; i++) {
                this.sensors[i] = leftOrSensors[i] ? 1 : 0;
                this.volts[i] = this.sensors[i] === 1 ? 3.3 : 0.0;
            }
        } else if (typeof leftOrSensors === 'object' && leftOrSensors !== null) {
            if (Array.isArray(leftOrSensors.sensors)) {
                for (let i = 0; i < 5; i++) {
                    this.sensors[i] = leftOrSensors.sensors[i] ? 1 : 0;
                    this.volts[i] = this.sensors[i] === 1 ? 3.3 : 0.0;
                }
            }
        } else {
            this.sensors = [0, leftOrSensors ? 1 : 0, 0, rightIsBlack ? 1 : 0, 0];
            this.volts[1] = leftOrSensors ? 3.3 : 0.0;
            this.volts[3] = rightIsBlack ? 3.3 : 0.0;
        }
        this.render();
    }
}


// ==============================================================================
// 5.6 CLASS TB6612_CONTROLLER (Cân chỉnh Đi Thẳng & Scale Động cơ TB6612FNG)
// ==============================================================================
class TB6612Controller {
    constructor(wsClient) {
        this.wsClient = wsClient;

        // Trạng thái vận hành
        this.baseSpeed = 90;            // Tốc độ cơ sở (Mặc định 90 PWM)
        this.scaleLeft = 0.84;          // Hệ số scale bánh trái (0.50 - 1.00)
        this.scaleRight = 0.87;         // Hệ số scale bánh phải (0.50 - 1.00)
        this.isStraightRunning = false; // Trạng thái chạy thẳng
        this.sendDebounce = null;
        this.lastToggleTime = 0;        // Chống dội phím / double-click
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
    }

    cacheElements() {
        // Bánh trái
        this.scaleLeftText = document.getElementById('scale-left-text');
        this.pwmLeftText = document.getElementById('pwm-left-text');
        this.sliderScaleLeft = document.getElementById('slider-scale-left');
        this.tagSliderLeftVal = document.getElementById('tag-slider-left-val');
        this.btnScaleLeftMinus = document.getElementById('btn-scale-left-minus');
        this.btnScaleLeftReset = document.getElementById('btn-scale-left-reset');
        this.btnScaleLeftPlus = document.getElementById('btn-scale-left-plus');

        // Bánh phải
        this.scaleRightText = document.getElementById('scale-right-text');
        this.pwmRightText = document.getElementById('pwm-right-text');
        this.sliderScaleRight = document.getElementById('slider-scale-right');
        this.tagSliderRightVal = document.getElementById('tag-slider-right-val');
        this.btnScaleRightMinus = document.getElementById('btn-scale-right-minus');
        this.btnScaleRightReset = document.getElementById('btn-scale-right-reset');
        this.btnScaleRightPlus = document.getElementById('btn-scale-right-plus');

        // Trung tâm
        this.btnToggleStraight = document.getElementById('btn-toggle-straight');
        this.straightStatusPill = document.getElementById('straight-status-pill');
        this.straightStatusText = document.getElementById('straight-status-text');
        this.straightMainLabel = document.getElementById('straight-main-label');
        this.straightSubLabel = document.getElementById('straight-sub-label');
        this.straightBtnIcon = document.getElementById('straight-btn-icon');

        // Tốc độ cơ sở
        this.baseSpeedDisplay = document.getElementById('base-speed-display');
        this.sliderBaseSpeed = document.getElementById('slider-base-speed');
        this.btnBaseMinus = document.getElementById('btn-base-minus');
        this.btnBasePlus = document.getElementById('btn-base-plus');

        // Config & Copy
        this.configCodePreview = document.getElementById('config-code-preview');
        this.btnCopyConfig = document.getElementById('btn-copy-config');
    }

    bindEvents() {
        // 1. Nút Bật/Dừng Đi thẳng
        if (this.btnToggleStraight) {
            this.btnToggleStraight.addEventListener('click', (e) => {
                e.preventDefault();
                this.btnToggleStraight.blur(); // Hủy focus tránh xung đột với phím Space
                this.toggleStraight();
            });
        }

        // 2. Thanh gạt Scale Bánh Trái
        if (this.sliderScaleLeft) {
            this.sliderScaleLeft.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 1.0;
                this.setScaleLeft(val);
            });
        }

        // 3. Nút vi chỉnh Bánh Trái
        if (this.btnScaleLeftMinus) {
            this.btnScaleLeftMinus.addEventListener('click', () => {
                this.setScaleLeft(this.scaleLeft - 0.01);
            });
        }
        if (this.btnScaleLeftReset) {
            this.btnScaleLeftReset.addEventListener('click', () => {
                this.setScaleLeft(1.00);
            });
        }
        if (this.btnScaleLeftPlus) {
            this.btnScaleLeftPlus.addEventListener('click', () => {
                this.setScaleLeft(this.scaleLeft + 0.01);
            });
        }

        // 4. Thanh gạt Scale Bánh Phải
        if (this.sliderScaleRight) {
            this.sliderScaleRight.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value) || 1.0;
                this.setScaleRight(val);
            });
        }

        // 5. Nút vi chỉnh Bánh Phải
        if (this.btnScaleRightMinus) {
            this.btnScaleRightMinus.addEventListener('click', () => {
                this.setScaleRight(this.scaleRight - 0.01);
            });
        }
        if (this.btnScaleRightReset) {
            this.btnScaleRightReset.addEventListener('click', () => {
                this.setScaleRight(1.00);
            });
        }
        if (this.btnScaleRightPlus) {
            this.btnScaleRightPlus.addEventListener('click', () => {
                this.setScaleRight(this.scaleRight + 0.01);
            });
        }

        // 6. Điều chỉnh tốc độ cơ sở (Base Speed)
        if (this.sliderBaseSpeed) {
            this.sliderBaseSpeed.addEventListener('input', (e) => {
                const val = parseInt(e.target.value, 10) || 90;
                this.setBaseSpeed(val);
            });
        }
        if (this.btnBaseMinus) {
            this.btnBaseMinus.addEventListener('click', () => {
                this.setBaseSpeed(this.baseSpeed - 5);
            });
        }
        if (this.btnBasePlus) {
            this.btnBasePlus.addEventListener('click', () => {
                this.setBaseSpeed(this.baseSpeed + 5);
            });
        }

        // 7. Nút Sao chép thông số cấu hình
        if (this.btnCopyConfig) {
            this.btnCopyConfig.addEventListener('click', () => {
                const text = `MOTOR_LEFT_SCALE = ${this.scaleLeft.toFixed(2)}\nMOTOR_RIGHT_SCALE = ${this.scaleRight.toFixed(2)}`;
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).then(() => {
                        this.btnCopyConfig.textContent = '✓ Đã chép!';
                        setTimeout(() => { if (this.btnCopyConfig) this.btnCopyConfig.textContent = 'Sao chép'; }, 1500);
                    });
                }
            });
        }

        // 8. Lắng nghe phím tắt khi ở tab tb6612
        window.addEventListener('keydown', (e) => {
            const currentScreen = window.app && window.app.screenManager ? window.app.screenManager.getCurrentScreenId() : null;
            if (currentScreen !== 'tb6612-screen') return;
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;

            if (e.code === 'Space') {
                e.preventDefault();
                if (document.activeElement) {
                    document.activeElement.blur();
                }
                this.toggleStraight();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.setScaleLeft(this.scaleLeft - 0.01);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.setScaleRight(this.scaleRight - 0.01);
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                this.setScaleLeft(1.00);
                this.setScaleRight(1.00);
            }
        });
    }

    setScaleLeft(val) {
        this.scaleLeft = Math.round(Math.max(0.50, Math.min(1.00, val)) * 100) / 100;
        this.updateUI();
        if (this.isStraightRunning) {
            this.dispatchSpeed();
        }
    }

    setScaleRight(val) {
        this.scaleRight = Math.round(Math.max(0.50, Math.min(1.00, val)) * 100) / 100;
        this.updateUI();
        if (this.isStraightRunning) {
            this.dispatchSpeed();
        }
    }

    setBaseSpeed(val) {
        this.baseSpeed = Math.max(20, Math.min(100, val));
        this.updateUI();
        if (this.isStraightRunning) {
            this.dispatchSpeed();
        }
    }

    toggleStraight() {
        const now = Date.now();
        // Chống dội phím / double-click trong 200ms
        if (now - this.lastToggleTime < 200) {
            return;
        }
        this.lastToggleTime = now;

        if (this.isStraightRunning) {
            this.stopStraight();
        } else {
            this.startStraight();
        }
    }

    startStraight() {
        this.lastToggleTime = Date.now();
        this.isStraightRunning = true;
        this.updateUI();

        // GỬI LỆNH NGAY LẬP TỨC (0ms latency, không qua debounce)
        if (this.sendDebounce) {
            clearTimeout(this.sendDebounce);
            this.sendDebounce = null;
        }
        const leftPwm = Math.max(0, Math.min(100, Math.round(this.baseSpeed * this.scaleLeft)));
        const rightPwm = Math.max(0, Math.min(100, Math.round(this.baseSpeed * this.scaleRight)));
        this.executeSendSpeed(leftPwm, rightPwm, true);
    }

    stopStraight() {
        this.lastToggleTime = Date.now();
        this.isStraightRunning = false;
        this.updateUI();

        // DỪNG KHẨN CẤP NGAY LẬP TỨC (0ms latency)
        if (this.sendDebounce) {
            clearTimeout(this.sendDebounce);
            this.sendDebounce = null;
        }
        this.executeSendSpeed(0, 0, false);
    }

    dispatchSpeed() {
        const leftPwm = Math.max(0, Math.min(100, Math.round(this.baseSpeed * this.scaleLeft)));
        const rightPwm = Math.max(0, Math.min(100, Math.round(this.baseSpeed * this.scaleRight)));
        this.sendSpeedDebounced(leftPwm, rightPwm);
    }

    sendSpeedDebounced(left, right) {
        if (this.sendDebounce) {
            clearTimeout(this.sendDebounce);
        }
        this.sendDebounce = setTimeout(() => {
            if (this.isStraightRunning) {
                this.executeSendSpeed(left, right, true);
            }
        }, 30);
    }

    executeSendSpeed(left, right, isRunning) {
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
    }

    updateUI() {
        const leftPwm = Math.round(this.baseSpeed * this.scaleLeft);
        const rightPwm = Math.round(this.baseSpeed * this.scaleRight);

        // Bánh trái
        if (this.scaleLeftText) this.scaleLeftText.textContent = this.scaleLeft.toFixed(2);
        if (this.pwmLeftText) this.pwmLeftText.textContent = leftPwm;
        if (this.tagSliderLeftVal) this.tagSliderLeftVal.textContent = this.scaleLeft.toFixed(2);
        if (this.sliderScaleLeft && parseFloat(this.sliderScaleLeft.value) !== this.scaleLeft) {
            this.sliderScaleLeft.value = this.scaleLeft.toFixed(2);
        }

        // Bánh phải
        if (this.scaleRightText) this.scaleRightText.textContent = this.scaleRight.toFixed(2);
        if (this.pwmRightText) this.pwmRightText.textContent = rightPwm;
        if (this.tagSliderRightVal) this.tagSliderRightVal.textContent = this.scaleRight.toFixed(2);
        if (this.sliderScaleRight && parseFloat(this.sliderScaleRight.value) !== this.scaleRight) {
            this.sliderScaleRight.value = this.scaleRight.toFixed(2);
        }

        // Base Speed
        if (this.baseSpeedDisplay) this.baseSpeedDisplay.textContent = `${this.baseSpeed} PWM`;
        if (this.sliderBaseSpeed && parseInt(this.sliderBaseSpeed.value, 10) !== this.baseSpeed) {
            this.sliderBaseSpeed.value = this.baseSpeed;
        }

        // Nút Đi Thẳng
        if (this.btnToggleStraight) {
            if (this.isStraightRunning) {
                this.btnToggleStraight.className = 'btn-straight-master btn-state-running';
                if (this.straightMainLabel) this.straightMainLabel.textContent = 'DỪNG LẠI';
                if (this.straightSubLabel) this.straightSubLabel.textContent = `Đang chạy: Trái ${leftPwm} · Phải ${rightPwm} PWM`;
                if (this.straightBtnIcon) {
                    this.straightBtnIcon.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
                }
            } else {
                this.btnToggleStraight.className = 'btn-straight-master btn-state-stopped';
                if (this.straightMainLabel) this.straightMainLabel.textContent = 'ĐI THẲNG';
                if (this.straightSubLabel) this.straightSubLabel.textContent = 'Nhấn để kích hoạt động cơ chạy thẳng';
                if (this.straightBtnIcon) {
                    this.straightBtnIcon.innerHTML = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
                }
            }
        }

        // Trạng thái pill
        if (this.straightStatusPill && this.straightStatusText) {
            if (this.isStraightRunning) {
                this.straightStatusPill.className = 'status-pill-center is-running';
                this.straightStatusText.textContent = 'XE ĐANG CHẠY THẲNG';
            } else {
                this.straightStatusPill.className = 'status-pill-center';
                this.straightStatusText.textContent = 'XE ĐANG DỪNG';
            }
        }

        // Preview code cấu hình
        if (this.configCodePreview) {
            this.configCodePreview.textContent = `MOTOR_LEFT_SCALE = ${this.scaleLeft.toFixed(2)}\nMOTOR_RIGHT_SCALE = ${this.scaleRight.toFixed(2)}`;
        }
    }

    handleTelemetry(data) {
        if (!data) return;
        // Bỏ qua telemetry trong 800ms sau khi bấm Bật/Dừng để dập tắt race condition dội gói cũ
        const now = Date.now();
        if (now - this.lastToggleTime < 800) {
            return;
        }

        if (data.event === 'motor_telemetry' || data.motor) {
            const motorData = data.motor || data;
            if (motorData.is_running === false && this.isStraightRunning) {
                this.isStraightRunning = false;
                this.updateUI();
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
        this.baseSpeed = 70;             // Tốc độ cơ sở khi bám vạch sau 1.5s (70% theo yêu cầu)
        this.startupSpeed = 75;          // Tốc độ cơ sở khởi hành trong 1.5s đầu
        this.startupDurationMs = 1500;   // 1.5s chạy tốc độ khởi hành để thoát trạng thái nghỉ
        this.startupStartTime = 0;
        this.pidKp = 4.8;                // Hệ số Kp = 4.8
        this.pidKi = 0.08;               // Hệ số Ki = 0.08 (khâu I tích phân bù lệch cơ khí)
        this.pidKd = 2.8;                // Hệ số Kd = 2.8
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
        this.sensors = [0, 0, 0, 0, 0];  // Mảng 5 mắt TCRT5000: [S1, S2, S3, S4, S5]

        // Callback đồng bộ 2 chiều sang tab TCRT5000
        this.onStateChange = null;

        // Debounce gửi lệnh động cơ
        this.sendThrottleDebounce = null;

        // Bộ đệm thời gian chống xung đột & nảy nút (Debounce & Telemetry Grace Period)
        this.lastUserToggleTime = 0;        // Mốc thời gian bấm nút gần nhất (ms)
        this.toggleCooldownMs = 500;        // Khóa chống click liên tiếp (500ms)
        this.telemetryGracePeriodMs = 700;  // Chặn telemetry cũ đè ngược trạng thái (700ms)
        this.isToggleCooldown = false;      // Cờ khóa tạm thời nút bấm

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

            // 5 dấu chấm đánh số 1-5 TCRT5000 (True: Xanh, False: Đỏ)
            tcrtDots: [
                document.getElementById('mission-tcrt-dot-1'),
                document.getElementById('mission-tcrt-dot-2'),
                document.getElementById('mission-tcrt-dot-3'),
                document.getElementById('mission-tcrt-dot-4'),
                document.getElementById('mission-tcrt-dot-5')
            ],

            actionBadge: document.getElementById('mission-action-badge'),
            actionText: document.getElementById('mission-action-text'),
            stageRobot: document.getElementById('mission-stage-robot'),
            sonarCone: document.getElementById('mission-sonar-cone'),
            coneTag: document.getElementById('mission-cone-tag'),
            steeringAngleVal: document.getElementById('mission-steering-angle'),
            lineTrackingStatusVal: document.getElementById('mission-line-tracking-status'),

            btnToggleAutoLine: document.getElementById('btn-toggle-auto-line'),
            autoLineBtnIcon: document.getElementById('auto-line-btn-icon'),
            autoLineBtnLabel: document.getElementById('auto-line-btn-label'),
            autoLineBtnSub: document.getElementById('auto-line-btn-sub'),
            btnEmergencyStop: document.getElementById('btn-emergency-stop'),

            baseSpeedSlider: document.getElementById('base-speed-slider'),
            baseSpeedDisplay: document.getElementById('mission-base-speed-display') || document.getElementById('base-speed-display'),

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
                this.baseSpeed = parseInt(e.target.value, 10) || 35;
                if (this.elements.baseSpeedDisplay) {
                    this.elements.baseSpeedDisplay.textContent = `${this.baseSpeed}%`;
                }
                if (this.isRunningAutoLine) {
                    this.computeAndApplyLineTracking(true);
                    this.updateUI();
                    // Gửi tốc độ cơ sở mới xuống bộ PID trên ESP32 (debounce 80ms)
                    if (this.speedUpdateDebounce) clearTimeout(this.speedUpdateDebounce);
                    this.speedUpdateDebounce = setTimeout(() => {
                        if (this.wsClient && this.isRunningAutoLine) {
                            this.wsClient.send({
                                cmd: 'start_auto_line',
                                speed: this.baseSpeed
                            });
                        }
                    }, 80);
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

        // Hỗ trợ click thử nghiệm chuyển đổi Đen/Trắng trực tiếp trên cả 5 mắt TCRT5000 (Pill và Eye dot)
        const toggleSensorTest = (index) => {
            this.sensors[index] = this.sensors[index] === 1 ? 0 : 1;
            // Đồng bộ leftIsBlack / rightIsBlack (S2 và S4) cho logic 2 mắt cũ
            this.leftIsBlack = this.sensors[1] === 1;
            this.rightIsBlack = this.sensors[3] === 1;

            if (this.onStateChange) {
                this.onStateChange({
                    sensors: [...this.sensors],
                    left: this.leftIsBlack,
                    right: this.rightIsBlack
                });
            }
            if (this.isRunningAutoLine) this.computeAndApplyLineTracking(true);
            this.updateUI();
        };

        if (this.elements.tcrtDots && Array.isArray(this.elements.tcrtDots)) {
            this.elements.tcrtDots.forEach((dot, idx) => {
                if (dot) {
                    dot.style.cursor = 'pointer';
                    dot.addEventListener('click', () => toggleSensorTest(idx));
                }
            });
        }
    }

    onScreenActivated() {
        this.isScreenActive = true;
        this.updateUI();
        this.log('system', 'Đã kết nối giao diện Tổng quan Chuyển động xe.');

        // Yêu cầu bắt đầu stream dữ liệu TCRT5000 nếu WebSocket kết nối
        if (this.wsClient) {
            this.wsClient.send({ cmd: 'tcrt_start_stream' });
        }
    }

    onScreenDeactivated() {
        this.isScreenActive = false;
        // Không tự động dừng dò line khi chuyển tab để xe tiếp tục tự hành trên sân
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
        const now = Date.now();
        // Chống nảy nút / double-click quá nhanh
        if (this.isToggleCooldown || (now - this.lastUserToggleTime < this.toggleCooldownMs)) {
            console.warn('[VehicleMotion] ⏳ Thao tác quá nhanh, đang trong bộ đệm thời gian.');
            return;
        }

        this.lastUserToggleTime = now;
        this.isToggleCooldown = true;

        // Xóa sạch vùng chọn text nếu người dùng vô tình kéo chuột
        if (window.getSelection) {
            window.getSelection().removeAllRanges();
        }

        // Phản hồi trực quan: làm mờ nhẹ nút trong lúc đang gửi lệnh
        if (this.elements.btnToggleAutoLine) {
            this.elements.btnToggleAutoLine.style.opacity = '0.75';
        }

        setTimeout(() => {
            this.isToggleCooldown = false;
            if (this.elements.btnToggleAutoLine) {
                this.elements.btnToggleAutoLine.style.opacity = '';
            }
        }, this.toggleCooldownMs);

        if (this.isRunningAutoLine) {
            this.stopAutoLine(false);
        } else {
            this.startAutoLine();
        }
    }

    startAutoLine() {
        if (this.sonarDistance > 0 && this.sonarDistance < 10) {
            this.isObstacle = true;
            this.log('danger', `Không thể bắt đầu: Phát hiện vật cản trước xe (${this.sonarDistance.toFixed(1)}cm < 10cm)! Hãy dọn đường trước.`);
            return;
        } else {
            this.isObstacle = false;
        }

        this.lastUserToggleTime = Date.now();
        this.isRunningAutoLine = true;
        this.startupStartTime = Date.now();
        this.log('action', `Khởi động Dò Line PD: 1.5s đầu chạy tốc độ khởi hành ${this.startupSpeed}% để thoát trạng thái nghỉ, sau đó bám vạch ở ${this.baseSpeed}%. (Kp=${this.pidKp}, Ki=0, Kd=${this.pidKd})`);

        // Gửi lệnh kích hoạt PID onboard xuống ESP32 thông qua Python Server
        if (this.wsClient) {
            this.wsClient.send({
                cmd: 'start_auto_line',
                speed: this.baseSpeed
            });
            this.wsClient.send({ cmd: 'tcrt_start_stream' });
        }

        this.computeAndApplyLineTracking(true);
        this.updateUI();
    }

    stopAutoLine(isPassive = false) {
        this.lastUserToggleTime = Date.now();
        this.isRunningAutoLine = false;
        this.startupStartTime = 0;
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
            this.log('action', 'Đã dừng chế độ dò line PD tự động. Xe đã dừng lại.');
        }
        this.updateUI();
    }

    emergencyStop() {
        this.isRunningAutoLine = false;
        this.startupStartTime = 0;
        this.leftSpeed = 0;
        this.rightSpeed = 0;
        this.steeringAngle = 0;
        this.actionText = 'KHẨN CẤP: DỪNG TẤT CẢ (E-STOP)';
        this.lineTrackingStatus = 'Dừng khẩn cấp';

        // Lập tức ngắt motor và ngắt auto line
        if (this.sendThrottleDebounce) clearTimeout(this.sendThrottleDebounce);
        if (this.speedUpdateDebounce) clearTimeout(this.speedUpdateDebounce);
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

    computeAndApplyLineTracking(simulateMotors = false) {
        if (!this.isRunningAutoLine) return;

        // Xác định tốc độ cơ sở: 1.5s đầu chạy tốc độ khởi hành 55% để thoát trạng thái nghỉ, sau đó về baseSpeed
        const now = Date.now();
        const isStartup = this.startupStartTime && (now - this.startupStartTime < this.startupDurationMs);
        const effectiveBase = isStartup ? this.startupSpeed : this.baseSpeed;

        // Tính toán sai số vị trí e ∈ [-4, +4] từ mảng 5 mắt TCRT5000 [S1, S2, S3, S4, S5]
        const weights = [-4.0, -2.0, 0.0, 2.0, 4.0];
        let weightedSum = 0.0;
        let activeCount = 0;

        for (let i = 0; i < 5; i++) {
            if (this.sensors[i] === 1) {
                weightedSum += weights[i];
                activeCount++;
            }
        }

        let err = 0.0;
        let isCrossLine = false;
        let isLostLine = false;

        if (activeCount === 5) {
            isCrossLine = true;
            err = 0.0;
        } else if (activeCount === 0) {
            isLostLine = true;
            err = 0.0;
        } else {
            err = weightedSum / activeCount;
            if (Math.abs(err) >= 1.0) {
                this.lastValidPidError = err;
            }
        }

        // Nếu chỉ mô phỏng trên Web (chưa có gói motor từ ESP32), ước lượng tốc độ 2 bánh theo PD
        if (simulateMotors) {
            if (isLostLine) {
                this.leftSpeed = effectiveBase;
                this.rightSpeed = effectiveBase;
            } else {
                const kp = (this.pidKp || 4.8) * (effectiveBase / (this.baseSpeed || 55.0));
                const pidVal = kp * err;
                let minSpd = 30;
                if (Math.abs(err) >= 3.0) minSpd = 15;
                else if (Math.abs(err) >= 2.0) minSpd = 25;
                this.leftSpeed = Math.round(Math.max(minSpd, Math.min(88, effectiveBase + pidVal)));
                this.rightSpeed = Math.round(Math.max(minSpd, Math.min(88, effectiveBase - pidVal)));
            }
        }

        // Cập nhật góc đánh lái mô phỏng 2D (-20° đến +20°) và nhãn trạng thái PD
        this.steeringAngle = isLostLine ? 0 : Math.round(err * 4.5);

        const tag = isStartup ? '[1.5s KHỞI HÀNH 55%] ' : '';
        if (isCrossLine) {
            this.lastAction = isStartup ? 'STARTUP_CROSS' : 'CROSS_LINE';
            this.steeringAngle = 0;
            this.actionText = `${tag}PD [11111]: CẮT VẠCH NGANG • GIỮ THẲNG`;
            this.lineTrackingStatus = isStartup ? 'Khởi hành 55%: Vạch ngang' : 'Vạch ngang (5 mắt chạm line)';
        } else if (isLostLine) {
            this.lastAction = 'LOST_STRAIGHT';
            this.steeringAngle = 0;
            this.actionText = `${tag}PD [00000]: MẤT VẠCH • TIẾN THẲNG 1.5S RỒI DỪNG`;
            this.lineTrackingStatus = isStartup ? 'Khởi hành 55%: Mất vạch (Tiến thẳng 1.5s)' : 'Mất vạch (Tiến thẳng 1.5s rồi dừng)';
        } else if (err === 0) {
            this.lastAction = isStartup ? 'STARTUP_STRAIGHT' : 'STRAIGHT';
            this.steeringAngle = 0;
            this.actionText = `${tag}PD [e = 0.0]: ĐÚNG TIM ĐƯỜNG • ĐI THẲNG`;
            this.lineTrackingStatus = isStartup ? 'Khởi hành 55%: Đúng tim đường' : 'Đúng tim đường (e = 0)';
        } else if (err < 0) {
            const sharp = err <= -3;
            this.lastAction = isStartup ? (sharp ? 'STARTUP_SHARP_LEFT' : 'STARTUP_STEER_LEFT') : (sharp ? 'SHARP_LEFT' : 'LEFT');
            this.actionText = `${tag}PD [e = ${err.toFixed(1)}]: XE LỆCH PHẢI • BẺ LÁI TRÁI`;
            this.lineTrackingStatus = isStartup ? `Khởi hành 55%: Bẻ trái (e = ${err.toFixed(1)})` : `Bẻ trái (Sai số e = ${err.toFixed(1)})`;
        } else {
            const sharp = err >= 3;
            this.lastAction = isStartup ? (sharp ? 'STARTUP_SHARP_RIGHT' : 'STARTUP_STEER_RIGHT') : (sharp ? 'SHARP_RIGHT' : 'RIGHT');
            this.actionText = `${tag}PD [e = +${err.toFixed(1)}]: XE LỆCH TRÁI • BẺ LÁI PHẢI`;
            this.lineTrackingStatus = isStartup ? `Khởi hành 55%: Bẻ phải (e = +${err.toFixed(1)})` : `Bẻ phải (Sai số e = +${err.toFixed(1)})`;
        }
    }

    /**
     * Nhận đồng bộ trạng thái cảm biến từ Tab TCRT5000
     */
    syncTCRTState(leftOrSensors, rightIsBlack) {
        if (Array.isArray(leftOrSensors)) {
            for (let i = 0; i < 5; i++) {
                this.sensors[i] = leftOrSensors[i] ? 1 : 0;
            }
            this.leftIsBlack = this.sensors[1] === 1;
            this.rightIsBlack = this.sensors[3] === 1;
        } else if (typeof leftOrSensors === 'object' && leftOrSensors !== null) {
            if (Array.isArray(leftOrSensors.sensors)) {
                for (let i = 0; i < 5; i++) {
                    this.sensors[i] = leftOrSensors.sensors[i] ? 1 : 0;
                }
            }
            this.leftIsBlack = leftOrSensors.left !== undefined ? !!leftOrSensors.left : (this.sensors[1] === 1);
            this.rightIsBlack = leftOrSensors.right !== undefined ? !!leftOrSensors.right : (this.sensors[3] === 1);
        } else {
            this.leftIsBlack = !!leftOrSensors;
            this.rightIsBlack = !!rightIsBlack;
            this.sensors[1] = this.leftIsBlack ? 1 : 0;
            this.sensors[3] = this.rightIsBlack ? 1 : 0;
        }
        if (this.isRunningAutoLine) {
            this.computeAndApplyLineTracking(false);
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
        // BẢO VỆ BỘ ĐỆM (Telemetry Grace Period): Nếu người dùng vừa thao tác bấm nút trong vòng 700ms,
        // bỏ qua các gói telemetry cũ còn sót trên đường truyền để chống xung đột ghi đè (Race Condition).
        const now = Date.now();
        const isInGracePeriod = (now - this.lastUserToggleTime < this.telemetryGracePeriodMs);

        if (telemetryData.event === 'auto_line_status') {
            const serverRunning = !!telemetryData.running;
            if (this.isRunningAutoLine !== serverRunning) {
                this.isRunningAutoLine = serverRunning;
                hasChange = true;
            }
        } else if (telemetryData.auto_line !== undefined) {
            if (!isInGracePeriod) {
                if (this.isRunningAutoLine !== telemetryData.auto_line) {
                    this.isRunningAutoLine = telemetryData.auto_line;
                    hasChange = true;
                }
            }
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

        // 3. Phân tích dữ liệu TCRT5000 Dò vạch (Hỗ trợ cả mảng 5 mắt array và 2 mắt cũ)
        if (telemetryData.tcrt5000) {
            const tcrt = telemetryData.tcrt5000;
            if (Array.isArray(tcrt.array) && tcrt.array.length >= 5) {
                for (let i = 0; i < 5; i++) {
                    this.sensors[i] = tcrt.array[i] ? 1 : 0;
                }
                this.leftIsBlack = this.sensors[1] === 1;
                this.rightIsBlack = this.sensors[3] === 1;
            } else if (tcrt.s1 !== undefined) {
                this.sensors = [
                    tcrt.s1 ? 1 : 0,
                    tcrt.s2 ? 1 : 0,
                    tcrt.s3 ? 1 : 0,
                    tcrt.s4 ? 1 : 0,
                    tcrt.s5 ? 1 : 0
                ];
                this.leftIsBlack = this.sensors[1] === 1;
                this.rightIsBlack = this.sensors[3] === 1;
            } else {
                if (tcrt.left) {
                    this.leftIsBlack = (tcrt.left.is_black === true || tcrt.left.raw === 1);
                    this.sensors[1] = this.leftIsBlack ? 1 : 0;
                }
                if (tcrt.right) {
                    this.rightIsBlack = (tcrt.right.is_black === true || tcrt.right.raw === 1);
                    this.sensors[3] = this.rightIsBlack ? 1 : 0;
                }
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

        // Nếu xe đang tự hành bám line, tính toán góc lái và nhãn trạng thái PID
        if (this.isRunningAutoLine) {
            this.computeAndApplyLineTracking(false);
        }

        if (telemetryData.pid && telemetryData.pid.action) {
            const act = telemetryData.pid.action;
            if (act === 'LOST_STRAIGHT') {
                this.actionText = 'PD [00000]: MẤT VẠCH • TIẾN THẲNG QUA KHOẢNG TRỐNG (1.5S)';
                this.lineTrackingStatus = 'Mất vạch: Đi thẳng đón line';
                this.steeringAngle = 0;
            } else if (act === 'LOST_SEARCH_LEFT') {
                this.actionText = 'PD [00000]: MẤT VẠCH • QUAY TRÁI QUÉT TÌM LINE';
                this.lineTrackingStatus = 'Mất vạch: Xoay trái quét tìm lại line';
                this.steeringAngle = -20;
            } else if (act === 'LOST_SEARCH_RIGHT') {
                this.actionText = 'PD [00000]: MẤT VẠCH • QUAY PHẢI QUÉT TÌM LINE';
                this.lineTrackingStatus = 'Mất vạch: Xoay phải quét tìm lại line';
                this.steeringAngle = 20;
            } else if (act === 'LOST_STOPPED') {
                this.actionText = 'PD: ĐÃ PHANH DỪNG XE (MẤT VẠCH QUÁ 1.5S)';
                this.lineTrackingStatus = 'Đã dừng xe do mất vạch quá 1.5s';
                this.steeringAngle = 0;
            }
        }

        if (hasChange || this.isScreenActive) {
            this.updateUI();
        }
    }

    updateUI() {
        const els = this.elements;
        if (!els.masterSpeed) return; // Nếu màn hình chưa render trong DOM

        // 1. Tốc độ tổng và thanh đo 2 bánh
        const maxSpd = Math.max(Math.abs(this.leftSpeed), Math.abs(this.rightSpeed));
        this.masterSpeed = this.isRunningAutoLine ? maxSpd : 0;
        els.masterSpeed.textContent = this.masterSpeed;

        if (els.wsBarLeft) els.wsBarLeft.style.width = `${Math.max(0, Math.min(100, Math.abs(this.leftSpeed)))}%`;
        if (els.wsValLeft) els.wsValLeft.textContent = `${this.leftSpeed}%`;
        if (els.wsBarRight) els.wsBarRight.style.width = `${Math.max(0, Math.min(100, Math.abs(this.rightSpeed)))}%`;
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

        // 3. Trạng thái mảng 5 mắt TCRT5000 (Đánh số 1-5: True = Xanh lá, False = Đỏ)
        const s = this.sensors;
        if (els.tcrtDots && Array.isArray(els.tcrtDots)) {
            for (let i = 0; i < 5; i++) {
                const dot = els.tcrtDots[i];
                if (dot) {
                    const isTrue = (s[i] === 1);
                    dot.className = `tcrt-num-dot ${isTrue ? 'dot-true' : 'dot-false'}`;
                    dot.title = `Mắt ${i + 1} (S${i + 1}) • ${isTrue ? 'TRUE (Xanh lá • Đang chạm vạch đen)' : 'FALSE (Đỏ • Nền trắng)'}`;
                    if (isTrue) {
                        dot.style.background = '#10b981';
                        dot.style.border = '2px solid #34d399';
                        dot.style.boxShadow = '0 0 14px rgba(16, 185, 129, 0.75)';
                    } else {
                        dot.style.background = '#ef4444';
                        dot.style.border = '2px solid #f87171';
                        dot.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.45)';
                    }
                }
            }
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
                if (state && state.sensors) {
                    this.missionController.syncTCRTState(state.sensors);
                } else if (state) {
                    this.missionController.syncTCRTState(state.left, state.right);
                }
            }
        };

        this.missionController.onStateChange = (state) => {
            if (this.tcrtController) {
                if (state && state.sensors) {
                    this.tcrtController.syncExternalState(state.sensors);
                } else if (state) {
                    this.tcrtController.syncExternalState(state.left, state.right);
                }
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
                if (this.tb6612Controller && this.tb6612Controller.isStraightRunning) {
                    this.tb6612Controller.stopStraight();
                }
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

// ==============================================================================
// 7. KHÓA BÔI ĐEN & CHỐNG SAO CHÉP TOÀN CỤC (GLOBAL NO-SELECT & NO-COPY)
// ==============================================================================
// Chặn triệt để sự kiện bắt đầu chọn vùng văn bản (selectstart) trên toàn trang (trừ input/textarea)
document.addEventListener('selectstart', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        return false;
    }
});

// Chặn sự kiện sao chép (copy) trên toàn trang (trừ input/textarea)
document.addEventListener('copy', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        return false;
    }
});

// Chặn sự kiện kéo thả văn bản/hình ảnh/icon (dragstart)
document.addEventListener('dragstart', (e) => {
    const tag = e.target && e.target.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        return false;
    }
});

// Luôn dọn sạch mọi vùng bôi đen nếu người dùng nhả chuột
document.addEventListener('mouseup', () => {
    if (window.getSelection && (!document.activeElement || (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'))) {
        window.getSelection().removeAllRanges();
    }
});
