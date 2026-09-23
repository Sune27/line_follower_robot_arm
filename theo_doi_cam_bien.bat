@echo off
chcp 65001 >nul
title Màn hình theo dõi cảm biến khoảng cách RCWL-1601
cd /d "%~dp0"

echo ============================================================
echo      THEO DÕI CẢM BIẾN SIÊU ÂM RCWL-1601 (REAL-TIME)
echo ============================================================
echo.
python firmware\monitor_esp32.py
echo.
pause
