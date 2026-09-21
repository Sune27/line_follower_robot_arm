@echo off
chcp 65001 >nul
title He Thong Dieu Khien Robot - Python Server
cd /d "%~dp0"

echo ============================================================
echo   HE THONG DIEU KHIEN XE DO LINE & CANH TAY ROBOT
echo ============================================================
echo [1/2] Dang mo trinh duyet Web...
start http://localhost:5000

echo [2/2] Dang khoi dong Python Backend...
echo (Tien trinh se tu dong giai phong COM3 va tat khi ban bam 'Dang xuat' tren Web)
echo ============================================================
echo.

python python_app/app.py
