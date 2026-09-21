@echo off
chcp 65001 >nul
title He Thong Dieu Khien Robot Global - Ngrok Static Domain
cd /d "%~dp0"

echo ============================================================
echo   KHOI DONG HE THONG ROBOT GLOBAL VOI NGROK CO DINH
echo ============================================================
echo [1/2] Dang khoi dong Python Backend Server (Port 5000)...
start "Python Backend" cmd /k "python python_app\app.py"

timeout /t 3 >nul

echo [2/2] Dang ket noi duong ham toi ten mien co dinh...
echo.
echo ============================================================
echo DUONG LINK CO DINH TRON DOI CUA BAN:
echo https://saturday-sarcasm-quarrel.ngrok-free.dev
echo ============================================================
echo (Luu y: Cua so 'Python Backend' phai luon mo song song cung ngrok!)
echo.

.\ngrok.exe http 127.0.0.1:5000 --url https://saturday-sarcasm-quarrel.ngrok-free.dev
