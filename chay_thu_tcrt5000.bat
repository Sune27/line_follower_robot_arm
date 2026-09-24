@echo off
chcp 65001 >nul
title Kiểm thử Cảm biến Dò Line TCRT5000 - Cổng COM3
cd /d "%~dp0"

echo ============================================================
echo      KIỂM THỬ CẢM BIẾN DÒ LINE TCRT5000 QUA CỔNG COM3
echo ============================================================
echo.
python chay_thu_tcrt5000.py
echo.
pause
