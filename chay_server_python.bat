@echo off
chcp 65001 >nul
title Server Python - FEMA Robot Port 5000
cd /d "%~dp0"

echo ============================================================
echo   SERVER PYTHON DANG CHAY TAI CONG 5000 (LOCAL & GLOBAL)
echo ============================================================
echo [*] Vui long GIU NGUYEN cua so nay (chi thu nho xuong Taskbar).
echo [*] Khong bam nut dau X de tat vi se lam mat ket noi Web.
echo ============================================================
echo.

python -u python_app\app.py

echo.
echo [!] Server da dung lai! Nhan phim bat ky de dong...
pause >nul
