@echo off
title Cai Dat Authtoken Ngrok
cd /d "%~dp0"

echo ============================================================
echo           CAI DAT / CAP NHAT AUTHTOKEN NGROK
echo ============================================================
echo.
echo 1. Dang nhap vao trang web Ngrok:
echo    https://dashboard.ngrok.com/get-started/your-authtoken
echo.
echo 2. Sao chep (Copy) chuoi Authtoken cua ban tu trang web tren.
echo.

set TOKEN=
set /p TOKEN="[+] Dan (Paste) ma Authtoken vao day roi an Enter: "

if not defined TOKEN (
    echo.
    echo [!] Ban chua nhap token nao. Huy thao tac.
    echo.
    pause
    exit /b
)

echo.
.\ngrok.exe config add-authtoken %TOKEN%
if %ERRORLEVEL% equ 0 (
    echo.
    echo ============================================================
    echo [OK] DA LUU AUTHTOKEN THANH CONG!
    echo Bay gio ban co the mo file 'khoi_dong_server_global_online.bat'
    echo de chay server online toan cau bat cu luc nao.
    echo ============================================================
) else (
    echo.
    echo [!] Co loi khi luu Authtoken. Vui long kiem tra lai chuoi token.
)

echo.
pause