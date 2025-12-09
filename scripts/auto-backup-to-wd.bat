@echo off
REM ESWake Auto Backup Script (Windows Batch File)
REM For Windows Task Scheduler

REM Set encoding to UTF-8
chcp 65001 >nul

REM Change to project root directory (parent of scripts folder)
cd /d "%~dp0\.."

REM Set Node.js path (modify if Node.js is not in system PATH)
REM Example: set NODE_PATH=C:\Program Files\nodejs\node.exe
set NODE_PATH=node

REM Set environment variables (optional)
REM set ESWAKE_API_URL=https://eswake-booking.vercel.app/api/backup-full-database
REM set WD_MY_BOOK_PATH=D:\0_eswake_bookingSystem_backup
REM set BACKUP_KEEP_DAYS=90
REM set VERBOSE=true

REM Execute backup script
%NODE_PATH% scripts\auto-backup-to-wd.cjs

REM If error, pause to view error message
if errorlevel 1 (
    echo.
    echo Backup failed! Please check the error message above.
    pause
)
