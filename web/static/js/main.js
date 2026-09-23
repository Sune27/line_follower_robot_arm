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
        this.telemetryCallback = null;
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
                        const sensorData = data.sensor || data;
                        if (this.telemetryCallback) {
                            this.telemetryCallback(sensorData);
                        } else if (window.app && window.app.ultrasonicController) {
                            window.app.ultrasonicController.handleTelemetry(sensorData);
                        }
                    } else if (data.sensor || data.distance_cm !== undefined) {
                        const sensorData = data.sensor || data;
                        if (this.telemetryCallback) {
                            this.telemetryCallback(sensorData);
                        } else if (window.app && window.app.ultrasonicController) {
                            window.app.ultrasonicController.handleTelemetry(sensorData);
                        }
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
        
        // Kết nối bộ nhận dữ liệu Telemetry trực tiếp từ WebSocket tới Controller
        this.wsClient.telemetryCallback = (sensorData) => {
            this.ultrasonicController.handleTelemetry(sensorData);
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
    window.app = app;
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
