@echo off
chcp 65001 >nul
title Khởi Động Server Global - Điều Khiển Robot Online
cd /d "%~dp0"

echo ============================================================
echo   HE THONG KHOI DONG SERVER GLOBAL (DIEU KHIEN ROBOT ONLINE)
echo ============================================================
echo.
echo [1/2] Dang khoi dong Python Backend Server (Port 5000)...
start "Python Backend Server" cmd /k "python python_app\app.py"

timeout /t 3 >nul

echo.
echo [2/2] Dang mo ket noi duong ham toan cau Ngrok...
echo.
echo ============================================================
echo   DUONG LINK DIEU KHIEN ONLINE CO DINH TRON DOI CUA BAN:
echo   👉 https://saturday-sarcasm-quarrel.ngrok-free.dev
echo ============================================================
echo.
echo [*] Huong dan:
echo   - Mo link tren tren bat ky dien thoai/may tinh nao (4G/WiFi).
echo   - Dang nhap: Tai khoan 'sune' / Mat khau '24021197'.
echo   - Giu 2 cua so nay chay ngam tren thanh Taskbar khi dieu khien!
echo.

.\ngrok.exe http 127.0.0.1:5000 --url https://saturday-sarcasm-quarrel.ngrok-free.dev
