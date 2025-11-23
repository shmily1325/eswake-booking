# ESWake 自动备份设置脚本（PowerShell）
# 用于快速配置自动备份

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESWake 自动备份设置向导" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 获取 API URL
Write-Host "步骤 1: 配置 API 端点" -ForegroundColor Yellow
$apiUrl = Read-Host "请输入你的 Vercel 部署地址 (例如: https://your-app.vercel.app)"
if (-not $apiUrl) {
    Write-Host "错误: API URL 不能为空" -ForegroundColor Red
    exit 1
}
if (-not $apiUrl.StartsWith("http")) {
    $apiUrl = "https://" + $apiUrl
}
$apiUrl = $apiUrl.TrimEnd('/') + "/api/backup-full-database"
Write-Host "API 端点: $apiUrl" -ForegroundColor Green
Write-Host ""

# 2. 获取 WD MY BOOK 路径
Write-Host "步骤 2: 配置 WD MY BOOK 路径" -ForegroundColor Yellow
Write-Host "请选择 WD MY BOOK 硬盘的盘符:" -ForegroundColor White
$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 } | Select-Object -ExpandProperty Name
foreach ($drive in $drives) {
    $drivePath = $drive + ":\"
    $driveInfo = Get-Volume -DriveLetter $drive
    Write-Host "  [$drive] $($driveInfo.FileSystemLabel) - $([math]::Round($driveInfo.SizeRemaining / 1GB, 2)) GB 可用" -ForegroundColor Gray
}
$selectedDrive = Read-Host "请输入盘符 (例如: E)"
if (-not $selectedDrive) {
    Write-Host "错误: 盘符不能为空" -ForegroundColor Red
    exit 1
}
$wdPath = $selectedDrive.ToUpper() + ":\ESWake-Backups"
Write-Host "备份路径: $wdPath" -ForegroundColor Green
Write-Host ""

# 3. 获取保留天数
Write-Host "步骤 3: 配置备份保留天数" -ForegroundColor Yellow
$keepDays = Read-Host "请输入备份保留天数 (默认: 90)"
if (-not $keepDays) {
    $keepDays = 90
}
Write-Host "保留天数: $keepDays 天" -ForegroundColor Green
Write-Host ""

# 4. 更新脚本配置
Write-Host "步骤 4: 更新脚本配置" -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "auto-backup-to-wd.js"
$scriptContent = Get-Content $scriptPath -Raw -Encoding UTF8

# 替换配置
$scriptContent = $scriptContent -replace "const API_URL = .*?;", "const API_URL = '$apiUrl';"
$scriptContent = $scriptContent -replace "const WD_MY_BOOK_PATH = .*?;", "const WD_MY_BOOK_PATH = '$wdPath';"
$scriptContent = $scriptContent -replace "const KEEP_DAYS = .*?;", "const KEEP_DAYS = $keepDays;"

Set-Content -Path $scriptPath -Value $scriptContent -Encoding UTF8
Write-Host "✓ 脚本配置已更新" -ForegroundColor Green
Write-Host ""

# 5. 测试运行
Write-Host "步骤 5: 测试备份" -ForegroundColor Yellow
$testRun = Read-Host "是否现在测试备份? (Y/N)"
if ($testRun -eq "Y" -or $testRun -eq "y") {
    Write-Host "正在测试备份..." -ForegroundColor Cyan
    node $scriptPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 测试备份成功!" -ForegroundColor Green
    } else {
        Write-Host "✗ 测试备份失败，请检查配置" -ForegroundColor Red
    }
}
Write-Host ""

# 6. 创建任务计划程序任务
Write-Host "步骤 6: 设置 Windows 任务计划程序" -ForegroundColor Yellow
$createTask = Read-Host "是否创建 Windows 任务计划程序任务? (Y/N)"
if ($createTask -eq "Y" -or $createTask -eq "y") {
    $taskName = "ESWake 自动备份"
    $batPath = Join-Path $PSScriptRoot "auto-backup-to-wd.bat"
    $batPath = $batPath.Replace('\', '\\')
    
    Write-Host "正在创建任务计划程序任务..." -ForegroundColor Cyan
    
    # 删除已存在的任务（如果存在）
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "已删除现有任务" -ForegroundColor Yellow
    }
    
    # 创建新任务
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "ESWake 自动备份到 WD MY BOOK" | Out-Null
    
    Write-Host "✓ 任务计划程序任务已创建!" -ForegroundColor Green
    Write-Host "  任务名称: $taskName" -ForegroundColor Gray
    Write-Host "  运行时间: 每天 02:00" -ForegroundColor Gray
    Write-Host ""
    Write-Host "提示: 可以在任务计划程序中修改运行时间" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "设置完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "备份文件将保存在: $wdPath\Full-Database-Backups\" -ForegroundColor White
Write-Host "备份日志: $wdPath\backup-log.txt" -ForegroundColor White
Write-Host ""

