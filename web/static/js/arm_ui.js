/**
 * ==============================================================================
 * ARM_UI.JS - BỘ ĐIỀU KHIỂN CÁNH TAY ROBOT 4 BẬC (4-DOF ARM & SERVO CONTROLLER)
 * ==============================================================================
 * Tính năng:
 *   1. Quản lý và giám sát góc quay của 4 khớp servo (Base, Shoulder, Elbow, Gripper).
 *   2. Điều khiển góc mượt mà qua Slider, bàn phím số trực tiếp và các nút vi bước.
 *   3. Kiểm soát tốc độ quét/quay của servo (Delay step từ 5ms đến 100ms/bước).
 *   4. Các tư thế mẫu tự động (Home, Pick, Place, Rest).
 *   5. Chế độ quét kiểm tra không tải (Sweep Test Mode).
 *   6. Phanh khẩn cấp / Khóa vị trí (Emergency Stop).
 * ==============================================================================
 */

class ArmController {
    constructor(wsClient) {
        this.wsClient = wsClient;

        // Trạng thái góc ban đầu của 4 khớp servo (0 - 180 độ)
        this.joints = {
            base: 90,
            shoulder: 90,
            elbow: 90,
            gripper: 90
        };

        this.jointNames = {
            base: 'Khớp Đế (Base - J1)',
            shoulder: 'Khớp Vai (Shoulder - J2)',
            elbow: 'Khớp Khuỷu (Elbow - J3)',
            gripper: 'Tay Kẹp (Gripper - J4)'
        };

        this.currentJoint = 'base';
        this.currentSpeedDelay = 20; // 20ms/bước là tốc độ tiêu chuẩn mượt mà

        // Trạng thái quét tự động (Sweep test)
        this.isSweeping = false;
        this.sweepTimer = null;
        this.sweepDirection = 1;

        this.sendDebounceTimer = null;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.updateUI();
        this.logMessage('Đã khởi tạo hệ thống điều khiển Cánh tay Robot 4-DOF.', 'text-green');
    }

    cacheElements() {
        // Cột 1: Thẻ chọn khớp
        this.jointCards = {
            base: document.getElementById('joint-card-base'),
            shoulder: document.getElementById('joint-card-shoulder'),
            elbow: document.getElementById('joint-card-elbow'),
            gripper: document.getElementById('joint-card-gripper')
        };

        this.angleBadges = {
            base: document.getElementById('badge-angle-base'),
            shoulder: document.getElementById('badge-angle-shoulder'),
            elbow: document.getElementById('badge-angle-elbow'),
            gripper: document.getElementById('badge-angle-gripper')
        };

        this.miniBars = {
            base: document.getElementById('bar-fill-base'),
            shoulder: document.getElementById('bar-fill-shoulder'),
            elbow: document.getElementById('bar-fill-elbow'),
            gripper: document.getElementById('bar-fill-gripper')
        };

        this.btnPoseHome = document.getElementById('btn-pose-home');
        this.btnPosePick = document.getElementById('btn-pose-pick');
        this.btnPosePlace = document.getElementById('btn-pose-place');
        this.btnPoseRest = document.getElementById('btn-pose-rest');

        // Cột 2: Điều khiển góc
        this.activeJointNameEl = document.getElementById('active-joint-name');
        this.hudAngleDisplay = document.getElementById('hud-angle-display');
        this.gaugeArc = document.getElementById('angle-gauge-arc');
        this.gaugeNeedle = document.getElementById('angle-gauge-needle');
        this.angleSlider = document.getElementById('arm-angle-slider');
        this.angleInput = document.getElementById('arm-angle-input');
        this.btnApplyAngle = document.getElementById('btn-apply-angle');
        this.quickAngleBtns = document.querySelectorAll('.btn-quick-angle');
        this.fineStepBtns = document.querySelectorAll('.btn-fine-step');
        this.btnSweep = document.getElementById('btn-arm-sweep');
        this.sweepText = document.getElementById('sweep-text');
        this.sweepIcon = document.getElementById('sweep-icon');

        // Cột 3: Tốc độ & An toàn
        this.hudSpeedDisplay = document.getElementById('hud-speed-display');
        this.speedStatusDesc = document.getElementById('speed-status-desc');
        this.speedSlider = document.getElementById('arm-speed-slider');
        this.speedPresetBtns = document.querySelectorAll('.btn-speed-preset');
        this.btnEmergency = document.getElementById('btn-arm-emergency');

        // Terminal Log
        this.consoleBody = document.getElementById('arm-console-body');
        this.btnClearLog = document.getElementById('btn-clear-arm-log');
    }

    bindEvents() {
        // 1. Chuyển đổi khớp đang chọn
        Object.keys(this.jointCards).forEach(jointKey => {
            const card = this.jointCards[jointKey];
            if (card) {
                card.addEventListener('click', () => {
                    this.selectJoint(jointKey);
                });
            }
        });

        // 2. Kéo thanh trượt góc
        if (this.angleSlider) {
            this.angleSlider.addEventListener('input', (e) => {
                const angle = parseInt(e.target.value, 10);
                this.setJointAngle(this.currentJoint, angle, false); // Cập nhật UI ngay
                this.debounceSendCommand();
            });
        }

        // 3. Nhập số trực tiếp
        if (this.btnApplyAngle && this.angleInput) {
            this.btnApplyAngle.addEventListener('click', () => {
                const angle = parseInt(this.angleInput.value, 10);
                if (!isNaN(angle) && angle >= 0 && angle <= 180) {
                    this.setJointAngle(this.currentJoint, angle, true);
                } else {
                    alert('Vui lòng nhập góc từ 0 đến 180 độ!');
                }
            });

            this.angleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.btnApplyAngle.click();
                }
            });
        }

        // 4. Các nút tinh chỉnh (-5, -1, +1, +5)
        this.fineStepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const step = parseInt(btn.dataset.step, 10);
                const currentAngle = this.joints[this.currentJoint];
                const newAngle = Math.min(180, Math.max(0, currentAngle + step));
                this.setJointAngle(this.currentJoint, newAngle, true);
            });
        });

        // 5. Nút góc nhanh (0, 45, 90, 135, 180)
        this.quickAngleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const angle = parseInt(btn.dataset.angle, 10);
                this.setJointAngle(this.currentJoint, angle, true);
            });
        });

        // 6. Thanh trượt tốc độ
        if (this.speedSlider) {
            this.speedSlider.addEventListener('input', (e) => {
                const speed = parseInt(e.target.value, 10);
                this.setSpeedDelay(speed);
            });
        }

        // 7. Các nấc tốc độ mẫu (Turbo, Standard, Smooth, Safe)
        this.speedPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseInt(btn.dataset.speed, 10);
                this.setSpeedDelay(speed);
            });
        });

        // 8. Các tư thế mẫu (Presets)
        if (this.btnPoseHome) this.btnPoseHome.addEventListener('click', () => this.applyPose({ base: 90, shoulder: 90, elbow: 90, gripper: 90 }, 'Về vị trí Home (90°)'));
        if (this.btnPosePick) this.btnPosePick.addEventListener('click', () => this.applyPose({ base: 90, shoulder: 130, elbow: 45, gripper: 140 }, 'Tư thế Gắp vật (Pick)'));
        if (this.btnPosePlace) this.btnPosePlace.addEventListener('click', () => this.applyPose({ base: 45, shoulder: 105, elbow: 65, gripper: 30 }, 'Tư thế Đặt vật (Place)'));
        if (this.btnPoseRest) this.btnPoseRest.addEventListener('click', () => this.applyPose({ base: 90, shoulder: 165, elbow: 165, gripper: 0 }, 'Tư thế Nghỉ (Rest)'));

        // 9. Nút Sweep Test tự động
        if (this.btnSweep) {
            this.btnSweep.addEventListener('click', () => {
                this.toggleSweepTest();
            });
        }

        // 10. Dừng khẩn cấp
        if (this.btnEmergency) {
            this.btnEmergency.addEventListener('click', () => {
                this.emergencyStop();
            });
        }

        // 11. Xóa log
        if (this.btnClearLog && this.consoleBody) {
            this.btnClearLog.addEventListener('click', () => {
                this.consoleBody.innerHTML = '';
                this.logMessage('Đã làm sạch nhật ký.', 'text-cyan');
            });
        }
    }

    selectJoint(jointKey) {
        if (!this.joints.hasOwnProperty(jointKey)) return;
        this.currentJoint = jointKey;

        // Cập nhật class active cho các card bên trái
        Object.keys(this.jointCards).forEach(key => {
            const card = this.jointCards[key];
            if (card) {
                if (key === jointKey) card.classList.add('is-selected');
                else card.classList.remove('is-selected');
            }
        });

        if (this.activeJointNameEl) {
            this.activeJointNameEl.textContent = this.jointNames[jointKey];
        }

        const angle = this.joints[jointKey];
        if (this.angleSlider) this.angleSlider.value = angle;
        if (this.angleInput) this.angleInput.value = angle;

        this.updateGauge(angle);
        this.updateQuickAngleButtons(angle);

        this.logMessage(`Chuyển sang điều khiển: ${this.jointNames[jointKey]} (Góc hiện tại: ${angle}°)`, 'text-cyan');
    }

    setJointAngle(jointKey, angle, sendImmediate = false) {
        angle = Math.min(180, Math.max(0, angle));
        this.joints[jointKey] = angle;

        // Cập nhật UI
        if (this.hudAngleDisplay) this.hudAngleDisplay.textContent = angle;
        if (this.angleSlider && this.currentJoint === jointKey) this.angleSlider.value = angle;
        if (this.angleInput && this.currentJoint === jointKey) this.angleInput.value = angle;

        if (this.angleBadges[jointKey]) this.angleBadges[jointKey].textContent = `${angle}°`;
        if (this.miniBars[jointKey]) {
            const pct = Math.round((angle / 180) * 100);
            this.miniBars[jointKey].style.width = `${pct}%`;
        }

        if (this.currentJoint === jointKey) {
            this.updateGauge(angle);
            this.updateQuickAngleButtons(angle);
        }

        if (sendImmediate) {
            this.sendCommand(jointKey, angle, this.currentSpeedDelay);
        }
    }

    updateGauge(angle) {
        // Cập nhật kim và cung SVG
        if (this.gaugeNeedle) {
            // Góc quay từ -90 (0 độ) đến +90 (180 độ) quanh tâm (100, 105)
            const rotationDeg = angle - 90;
            this.gaugeNeedle.setAttribute('transform', `rotate(${rotationDeg} 100 105)`);
        }

        if (this.gaugeArc) {
            // Bán kính r = 80, tâm (100, 105)
            const rad = ((180 - angle) * Math.PI) / 180;
            const x = 100 - 80 * Math.cos(rad);
            const y = 105 - 80 * Math.sin(rad);
            const largeArc = angle > 180 ? 1 : 0;
            this.gaugeArc.setAttribute('d', `M 20 105 A 80 80 0 0 1 ${x} ${y}`);
        }
    }

    updateQuickAngleButtons(currentAngle) {
        this.quickAngleBtns.forEach(btn => {
            const a = parseInt(btn.dataset.angle, 10);
            if (a === currentAngle) btn.classList.add('is-active');
            else btn.classList.remove('is-active');
        });
    }

    setSpeedDelay(delayMs) {
        delayMs = Math.min(100, Math.max(5, delayMs));
        this.currentSpeedDelay = delayMs;

        if (this.hudSpeedDisplay) this.hudSpeedDisplay.textContent = delayMs;
        if (this.speedSlider) this.speedSlider.value = delayMs;

        // Mô tả trạng thái
        let desc = 'TIÊU CHUẨN (MƯỢT MÀ)';
        if (delayMs <= 10) desc = 'TURBO (TỐC ĐỘ CAO)';
        else if (delayMs <= 30) desc = 'TIÊU CHUẨN (MƯỢT MÀ)';
        else if (delayMs <= 60) desc = 'ÊM ÁI (GIẢM QUÁN TÍNH)';
        else desc = 'BẢO VỆ (SIÊU AN TOÀN)';

        if (this.speedStatusDesc) this.speedStatusDesc.textContent = desc;

        // Cập nhật nút preset
        this.speedPresetBtns.forEach(btn => {
            const s = parseInt(btn.dataset.speed, 10);
            if (s === delayMs) btn.classList.add('is-active');
            else btn.classList.remove('is-active');
        });

        this.logMessage(`Cài đặt độ trễ bước: ${delayMs}ms/bước [${desc}]`);
    }

    debounceSendCommand() {
        if (this.sendDebounceTimer) clearTimeout(this.sendDebounceTimer);
        this.sendDebounceTimer = setTimeout(() => {
            this.sendCommand(this.currentJoint, this.joints[this.currentJoint], this.currentSpeedDelay);
        }, 120);
    }

    sendCommand(jointKey, angle, speed) {
        const payload = {
            cmd: 'set_arm_servo',
            joint: jointKey,
            angle: angle,
            speed: speed
        };

        if (this.wsClient && typeof this.wsClient.send === 'function') {
            this.wsClient.send(payload);
        }

        this.logMessage(`[LỆNH GỬI] ${jointKey.toUpperCase()} ➔ ${angle}° (Tốc độ: ${speed}ms/bước)`, 'text-cyan');
    }

    applyPose(poseObj, poseName) {
        if (this.isSweeping) this.stopSweepTest();

        this.logMessage(`Kích hoạt tư thế mẫu: ${poseName}...`, 'text-green');

        // Gửi lệnh đồng bộ cho từng khớp theo trình tự an toàn
        let delay = 0;
        Object.keys(poseObj).forEach(jointKey => {
            const targetAngle = poseObj[jointKey];
            setTimeout(() => {
                this.setJointAngle(jointKey, targetAngle, true);
            }, delay);
            delay += 250; // Giãn cách 250ms giữa các khớp để tránh sụt dòng nguồn
        });
    }

    toggleSweepTest() {
        if (this.isSweeping) {
            this.stopSweepTest();
        } else {
            this.startSweepTest();
        }
    }

    startSweepTest() {
        this.isSweeping = true;
        if (this.btnSweep) {
            this.btnSweep.classList.add('is-running');
            if (this.sweepText) this.sweepText.textContent = 'ĐANG QUÉT THỬ... BẤM ĐỂ DỪNG';
        }

        this.logMessage(`Bắt đầu bài kiểm tra quét tự động không tải cho ${this.jointNames[this.currentJoint]}...`, 'text-cyan');

        // Chu kỳ quét từng nấc 1 độ theo tốc độ delay
        this.sweepTimer = setInterval(() => {
            let angle = this.joints[this.currentJoint];
            angle += this.sweepDirection;

            if (angle >= 180) {
                angle = 180;
                this.sweepDirection = -1;
            } else if (angle <= 0) {
                angle = 0;
                this.sweepDirection = 1;
            }

            this.setJointAngle(this.currentJoint, angle, false);

            // Gửi lệnh mỗi 5 độ để tối ưu hóa băng thông mạng
            if (angle % 5 === 0) {
                this.sendCommand(this.currentJoint, angle, this.currentSpeedDelay);
            }
        }, Math.max(15, this.currentSpeedDelay));
    }

    stopSweepTest() {
        this.isSweeping = false;
        if (this.sweepTimer) {
            clearInterval(this.sweepTimer);
            this.sweepTimer = null;
        }

        if (this.btnSweep) {
            this.btnSweep.classList.remove('is-running');
            if (this.sweepText) this.sweepText.textContent = 'BẮT ĐẦU QUÉT THỬ KHÔNG TẢI (0° ↔ 180°)';
        }

        this.logMessage('Đã dừng bài kiểm tra quét tự động.', 'text-green');
    }

    emergencyStop() {
        if (this.isSweeping) this.stopSweepTest();

        if (this.wsClient && typeof this.wsClient.send === 'function') {
            this.wsClient.send({ cmd: 'arm_emergency_stop' });
        }

        this.logMessage('🛑 [KHẨN CẤP] ĐÃ DỪNG MỌI HOẠT ĐỘNG VÀ KHÓA CỨNG CÁNH TAY!', 'text-red');
    }

    handleTelemetry(data) {
        if (!data) return;
        if (data.joint && data.angle !== undefined) {
            this.joints[data.joint] = data.angle;
            this.updateUI();
        }
    }

    updateUI() {
        Object.keys(this.joints).forEach(key => {
            const angle = this.joints[key];
            if (this.angleBadges[key]) this.angleBadges[key].textContent = `${angle}°`;
            if (this.miniBars[key]) {
                const pct = Math.round((angle / 180) * 100);
                this.miniBars[key].style.width = `${pct}%`;
            }
        });

        this.selectJoint(this.currentJoint);
        this.setSpeedDelay(this.currentSpeedDelay);
    }

    onScreenActivated() {
        this.logMessage('Mở màn hình điều khiển Cánh tay Robot.', 'text-green');
        this.updateUI();
    }

    onScreenDeactivated() {
        if (this.isSweeping) {
            this.stopSweepTest();
        }
    }

    logMessage(msg, cssClass = '') {
        if (!this.consoleBody) return;
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];

        const line = document.createElement('div');
        line.className = `log-line ${cssClass}`;
        line.textContent = `[${timeStr}] ${msg}`;

        this.consoleBody.appendChild(line);
        this.consoleBody.scrollTop = this.consoleBody.scrollHeight;
    }
}

// Xuất controller cho môi trường trình duyệt
window.ArmController = ArmController;
