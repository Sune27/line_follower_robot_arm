@echo off
title Khoi Dong Server Global - Dieu Khien Robot Online
cd /d "%~dp0"

echo ============================================================
echo   HE THONG KHOI DONG SERVER GLOBAL (DIEU KHIEN ROBOT ONLINE)
echo ============================================================
echo.

:: 1. Don dep tien trinh cu neu bi ket cong 5000/8765
taskkill /f /im ngrok.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :5000 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr :8765 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

:: 2. Khoi dong Server Python o mot cua so rieng
echo [1/2] Dang khoi dong Server Python (Port 5000)...
start "" "%~dp0chay_server_python.bat"

:: Cho 3 giay de server Python san sang lang nghe cong 5000
timeout /t 3 >nul

echo.
echo [2/2] Kiem tra ket noi duong ham toan cau Ngrok...

:: Kiem tra xem Ngrok da duoc cau hinh authtoken chua
.\ngrok.exe config check >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================================
    echo   [!] CANH BAO: NGROK CHUA DUOC CAU HINH AUTHTOKEN!
    echo ============================================================
    echo   De su dung ten mien online co dinh:
    echo   https://saturday-sarcasm-quarrel.ngrok-free.dev
    echo.
    echo   [*] Ban can cai dat Authtoken cua Ngrok:
    echo       1. Mo trinh duyet vao:
    echo          https://dashboard.ngrok.com/get-started/your-authtoken
    echo       2. Copy chuoi Authtoken cua ban.
    echo       3. Chay file 'cai_dat_token_ngrok.bat' de luu token.
    echo.
    echo   [!] Server Python Local van dang hoat dong tai Port 5000.
    echo ============================================================
    echo.
    pause
    exit /b
)

echo.
echo ============================================================
echo   DUONG LINK DIEU KHIEN ONLINE CO DINH CUA BAN (NGROK):
echo   https://saturday-sarcasm-quarrel.ngrok-free.dev
echo ============================================================
echo.
echo [*] LUU Y QUAN TRONG:
echo   - Co 2 cua so den: cua so nay (Ngrok) va cua so "Server Python".
echo   - Ban hay GIU NGUYEN CA 2 CUA SO (thu nho xuong Taskbar, KHONG tat dau X).
echo   - Neu tat cua so "Server Python", web se bao loi ERR_NGROK_8012!
echo.

.\ngrok.exe http 127.0.0.1:5000 --url https://saturday-sarcasm-quarrel.ngrok-free.dev
if %ERRORLEVEL% neq 0 (
    echo.
    echo ============================================================
    echo   [!] NGROK DA THOAT HOAC GAP LOI!
    echo ============================================================
    echo   Kiem tra lai:
    echo   1. Authtoken cua ban co hop le hoac bi het han khong?
    echo   2. Ten mien 'saturday-sarcasm-quarrel' co thuoc tai khoan cua ban khong?
    echo.
    pause
)