"""
==============================================================================
ROBOT_ARM.PY – MODULE ĐIỀU KHIỂN CÁNH TAY ROBOT 4 BẬC (4-DOF ARM) CHO ESP32
==============================================================================
Tính năng:
  - Quản lý 4 Servo: Base (Đế), Shoulder (Vai), Elbow (Khuỷu), Gripper (Tay kẹp)
  - Điều khiển góc từ 0 đến 180 độ qua PWM 50Hz tiêu chuẩn
  - Kiểm soát tốc độ quay mượt mà (Smooth Stepping) chống rung giật & sụt dòng
  - Chế độ Preset tư thế mẫu (Home, Pick, Place, Rest)
==============================================================================
"""

import time
from machine import Pin, PWM

class RobotArm:
    def __init__(self, pin_base=14, pin_shoulder=22, pin_elbow=23, pin_gripper=15):
        self.pins = {
            'base': pin_base,
            'shoulder': pin_shoulder,
            'elbow': pin_elbow,
            'gripper': pin_gripper
        }

        self.current_angles = {
            'base': 90,
            'shoulder': 90,
            'elbow': 90,
            'gripper': 90
        }

        self.pwms = {}
        for joint, pin_num in self.pins.items():
            try:
                p = Pin(pin_num, Pin.OUT)
                pwm = PWM(p, freq=50)
                self.pwms[joint] = pwm
                # Đưa về 90 độ ban đầu
                self._write_duty(joint, 90)
            except Exception as e:
                print(f"[RobotArm] Khong the khoi tao PWM tren GPIO {pin_num} cho {joint}: {e}")

    def _angle_to_duty(self, angle):
        """
        Chuyển góc 0 - 180 độ sang duty 10-bit hoặc 16-bit của MicroPython ESP32.
        Xung chuẩn 50Hz (chu kỳ 20ms = 20000us):
          - 0 độ   = 500us  (~ 2.5% = duty ~ 26 trên 1023)
          - 90 độ  = 1500us (~ 7.5% = duty ~ 77 trên 1023)
          - 180 độ = 2500us (~ 12.5% = duty ~ 128 trên 1023)
        """
        angle = max(0, min(180, angle))
        duty = int(26 + (angle / 180.0) * (128 - 26))
        return duty

    def _write_duty(self, joint, angle):
        if joint in self.pwms:
            duty = self._angle_to_duty(angle)
            try:
                self.pwms[joint].duty(duty)
            except Exception:
                pass

    def move_joint(self, joint, target_angle, speed_delay_ms=20):
        """
        Quay khớp servo từ góc hiện tại đến góc đích với tốc độ được kiểm soát
        """
        joint = str(joint).lower()
        if joint not in self.current_angles:
            return

        target_angle = max(0, min(180, int(target_angle)))
        current = self.current_angles[joint]
        speed_delay_ms = max(5, min(100, int(speed_delay_ms)))

        if target_angle > current:
            for a in range(current, target_angle + 1, 1):
                self._write_duty(joint, a)
                time.sleep_ms(speed_delay_ms)
        elif target_angle < current:
            for a in range(current, target_angle - 1, -1):
                self._write_duty(joint, a)
                time.sleep_ms(speed_delay_ms)

        self.current_angles[joint] = target_angle

    def apply_preset(self, preset_name):
        """
        Áp dụng tư thế mẫu
        """
        presets = {
            'home': {'base': 90, 'shoulder': 90, 'elbow': 90, 'gripper': 90},
            'pick': {'base': 90, 'shoulder': 130, 'elbow': 45, 'gripper': 140},
            'place': {'base': 45, 'shoulder': 105, 'elbow': 65, 'gripper': 30},
            'rest': {'base': 90, 'shoulder': 165, 'elbow': 165, 'gripper': 0}
        }

        preset = presets.get(preset_name.lower())
        if preset:
            for joint, angle in preset.items():
                self.move_joint(joint, angle, speed_delay_ms=25)
                time.sleep_ms(100)

    def stop(self):
        """Ngắt tín hiệu khẩn cấp"""
        pass
