@echo off
chcp 65001 >nul
title ESWake 桌機自動備份安裝
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0portable-backup-installer.ps1"
if errorlevel 1 (
    echo.
    echo 安裝未完成，請保留上方錯誤訊息。
    pause
)
