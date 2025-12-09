# ESWake 自動備份設定腳本（PowerShell）
# 用於快速配置自動備份

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESWake 自動備份設定精靈" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 取得 API URL
Write-Host "步驟 1: 配置 API 端點" -ForegroundColor Yellow
$apiUrl = Read-Host "請輸入你的 Vercel 部署地址 (例如: https://your-app.vercel.app)"
if (-not $apiUrl) {
    Write-Host "錯誤: API URL 不能為空" -ForegroundColor Red
    exit 1
}
if (-not $apiUrl.StartsWith("http")) {
    $apiUrl = "https://" + $apiUrl
}
$apiUrl = $apiUrl.TrimEnd('/') + "/api/backup-full-database"
Write-Host "API 端點: $apiUrl" -ForegroundColor Green
Write-Host ""

# 2. 取得 WD MY BOOK 路徑
Write-Host "步驟 2: 配置 WD MY BOOK 路徑" -ForegroundColor Yellow
Write-Host "請選擇 WD MY BOOK 硬碟的磁碟機代號:" -ForegroundColor White
$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -gt 0 } | Select-Object -ExpandProperty Name
foreach ($drive in $drives) {
    $drivePath = $drive + ":\"
    $driveInfo = Get-Volume -DriveLetter $drive
    Write-Host "  [$drive] $($driveInfo.FileSystemLabel) - $([math]::Round($driveInfo.SizeRemaining / 1GB, 2)) GB 可用" -ForegroundColor Gray
}
$selectedDrive = Read-Host "請輸入磁碟機代號 (例如: E)"
if (-not $selectedDrive) {
    Write-Host "錯誤: 磁碟機代號不能為空" -ForegroundColor Red
    exit 1
}
$wdPath = $selectedDrive.ToUpper() + ":\ESWake-Backups"
Write-Host "備份路徑: $wdPath" -ForegroundColor Green
Write-Host ""

# 3. 取得保留天數
Write-Host "步驟 3: 配置備份保留天數" -ForegroundColor Yellow
$keepDays = Read-Host "請輸入備份保留天數 (預設: 90)"
if (-not $keepDays) {
    $keepDays = 90
}
Write-Host "保留天數: $keepDays 天" -ForegroundColor Green
Write-Host ""

# 4. 更新腳本配置
Write-Host "步驟 4: 更新腳本配置" -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "auto-backup-to-wd.cjs"
$scriptContent = Get-Content $scriptPath -Raw -Encoding UTF8

# 替換配置
$scriptContent = $scriptContent -replace "const API_URL = .*?;", "const API_URL = '$apiUrl';"
$scriptContent = $scriptContent -replace "const WD_MY_BOOK_PATH = .*?;", "const WD_MY_BOOK_PATH = '$wdPath';"
$scriptContent = $scriptContent -replace "const KEEP_DAYS = .*?;", "const KEEP_DAYS = $keepDays;"

Set-Content -Path $scriptPath -Value $scriptContent -Encoding UTF8
Write-Host "✓ 腳本配置已更新" -ForegroundColor Green
Write-Host ""

# 5. 測試執行
Write-Host "步驟 5: 測試備份" -ForegroundColor Yellow
$testRun = Read-Host "是否現在測試備份? (Y/N)"
if ($testRun -eq "Y" -or $testRun -eq "y") {
    Write-Host "正在測試備份..." -ForegroundColor Cyan
    node $scriptPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ 測試備份成功!" -ForegroundColor Green
    } else {
        Write-Host "✗ 測試備份失敗，請檢查配置" -ForegroundColor Red
    }
}
Write-Host ""

# 6. 建立工作排程器工作
Write-Host "步驟 6: 設定 Windows 工作排程器" -ForegroundColor Yellow
$createTask = Read-Host "是否建立 Windows 工作排程器工作? (Y/N)"
if ($createTask -eq "Y" -or $createTask -eq "y") {
    $taskName = "ESWake 自動備份"
    $batPath = Join-Path $PSScriptRoot "auto-backup-to-wd.bat"
    $batPath = $batPath.Replace('\', '\\')
    
    Write-Host "正在建立工作排程器工作..." -ForegroundColor Cyan
    
    # 刪除已存在的工作（如果存在）
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Host "已刪除現有工作" -ForegroundColor Yellow
    }
    
    # 建立新工作
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$batPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "ESWake 自動備份到 WD MY BOOK" | Out-Null
    
    Write-Host "✓ 工作排程器工作已建立!" -ForegroundColor Green
    Write-Host "  工作名稱: $taskName" -ForegroundColor Gray
    Write-Host "  執行時間: 每天 02:00" -ForegroundColor Gray
    Write-Host ""
    Write-Host "提示: 可以在工作排程器中修改執行時間" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "設定完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "備份檔案將保存在: $wdPath\Full-Database-Backups\" -ForegroundColor White
Write-Host "備份日誌: $wdPath\backup-log.txt" -ForegroundColor White
Write-Host ""

