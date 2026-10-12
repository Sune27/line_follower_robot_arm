@echo off
chcp 65001 >nul
title Nạp Firmware Cho ESP32 - 1-Click Uploader
cd /d "%~dp0"

echo ============================================================
echo   HE THONG TU DONG NAP CODE CHO ESP32 (FIRMWARE 1-CLICK)
echo ============================================================
echo.
echo [*] Vui long dam bao ban da cam cap USB ESP32 vao may tinh!
echo [*] Dang tien hanh dong bo va nap code vao ESP32...
echo.

where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
    py firmware\nap_code_esp32.py
) else (
    python firmware\nap_code_esp32.py
)

echo.
echo ============================================================
echo Hoan tat! Nhan phim bat ky de thoat...
pause >nul
