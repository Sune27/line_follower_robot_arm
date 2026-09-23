@echo off
chcp 65001 >nul
title Khoi Dong Server Global - Dieu Khien Robot Online
cd /d "%~dp0"

echo ============================================================
echo   HE THONG KHOI DONG SERVER GLOBAL (DIEU KHIEN ROBOT ONLINE)
echo ============================================================
echo.

:: 1. Don dep tien trinh ngrok cu neu co bi ket
taskkill /f /im ngrok.exe >nul 2>&1

:: 2. Khoi dong Server Python o mot cua so rieng
echo [1/2] Dang khoi dong Server Python (Port 5000)...
start "" "%~dp0chay_server_python.bat"

:: Cho 3 giay de server Python san sang lang nghe cong 5000
timeout /t 3 >nul

echo.
echo [2/2] Dang mo ket noi duong ham toan cau Ngrok...
echo.
echo ============================================================
echo   DUONG LINK DIEU KHIEN ONLINE CO DINH TRON DOI CUA BAN:
echo   👉 https://saturday-sarcasm-quarrel.ngrok-free.dev
echo ============================================================
echo.
echo [*] LUY Y QUAN TRONG:
echo   - Co 2 cua so den: cua so nay (Ngrok) va cua so "Server Python".
echo   - Ban hay GIU NGUYEN CA 2 CUA SO (thu nho xuong Taskbar, KHONG tat dau X).
echo   - Neu tat cua so "Server Python", web se bao loi ERR_NGROK_8012!
echo.

.\ngrok.exe http 127.0.0.1:5000 --url https://saturday-sarcasm-quarrel.ngrok-free.dev
