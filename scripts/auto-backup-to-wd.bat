@echo off
REM ESWake 自动备份脚本（Windows 批处理文件）
REM 用于 Windows 任务计划程序

REM 设置编码为 UTF-8
chcp 65001 >nul

REM 切换到脚本目录
cd /d "%~dp0"

REM 设置 Node.js 路径（如果 Node.js 不在系统 PATH 中，请修改下面的路径）
REM 例如：set NODE_PATH=C:\Program Files\nodejs\node.exe
set NODE_PATH=node

REM 设置环境变量（可选）
REM set ESWAKE_API_URL=https://your-app.vercel.app/api/backup-full-database
REM set WD_MY_BOOK_PATH=E:\ESWake-Backups
REM set BACKUP_KEEP_DAYS=90
REM set VERBOSE=true

REM 运行备份脚本
%NODE_PATH% scripts/auto-backup-to-wd.js

REM 如果出错，暂停以便查看错误信息
if errorlevel 1 (
    echo.
    echo 备份失败！请检查上面的错误信息。
    pause
)

