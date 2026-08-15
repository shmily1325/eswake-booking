@echo off
chcp 65001 >nul
title ESWake Portable Backup Install
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0portable-backup-installer.ps1"
if errorlevel 1 (
    echo.
    echo Install failed. Keep the error message above.
    pause
)
