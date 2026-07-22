# ESWake portable Windows backup installer.
# Run through install-portable-backup.cmd; no Node.js or repository checkout is required.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Read-Value {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [Parameter(Mandatory = $true)][string]$Default
    )

    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $Default
    }
    return $value.Trim()
}

function ConvertTo-PlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' ESWake 桌機自動備份一鍵安裝' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '請先插入備份硬碟。密鑰會由 Windows 加密保存，不會寫入此安裝包。'
Write-Host ''

$drives = @(Get-CimInstance Win32_LogicalDisk |
    Where-Object { $_.DriveType -in 2, 3 -and $_.DeviceID -ne $env:SystemDrive } |
    Sort-Object DeviceID)

if ($drives.Count -gt 0) {
    Write-Host '目前可用磁碟：' -ForegroundColor Yellow
    foreach ($drive in $drives) {
        $freeGb = if ($null -ne $drive.FreeSpace) {
            [Math]::Round($drive.FreeSpace / 1GB, 1)
        } else {
            '?'
        }
        $label = if ([string]::IsNullOrWhiteSpace($drive.VolumeName)) {
            '未命名'
        } else {
            $drive.VolumeName
        }
        Write-Host "  $($drive.DeviceID)  $label  可用 $freeGb GB"
    }
    Write-Host ''
}

$defaultDrive = if ($drives.Count -gt 0) { $drives[0].DeviceID } else { 'D:' }
$driveInput = Read-Value -Prompt '備份硬碟代號' -Default $defaultDrive
if ($driveInput -notmatch '^[A-Za-z]:$') {
    throw '硬碟代號格式錯誤，請輸入例如 D:'
}
$driveRoot = "$($driveInput.ToUpper())\"
if (-not (Test-Path -LiteralPath $driveRoot -PathType Container)) {
    throw "找不到硬碟 $driveRoot，請確認硬碟已連接。"
}

$backupRoot = Join-Path $driveRoot 'ESWake-Backups'
$siteUrl = Read-Value -Prompt '網站網址' -Default 'https://eswake-booking.vercel.app'
$siteUrl = $siteUrl.TrimEnd('/')
if ($siteUrl -notmatch '^https://') {
    throw '網站網址必須使用 https://'
}

$secret = Read-Host '貼上 Vercel CRON_SECRET（畫面不會顯示）' -AsSecureString
$plainSecret = ConvertTo-PlainText -SecureValue $secret
if ([string]::IsNullOrWhiteSpace($plainSecret)) {
    throw '密鑰不能為空。'
}
$plainSecret = $null

$keepDaysText = Read-Value -Prompt '備份保留天數' -Default '90'
$keepDays = 0
if (-not [int]::TryParse($keepDaysText, [ref]$keepDays) -or $keepDays -lt 1 -or $keepDays -gt 3650) {
    throw '保留天數必須是 1 到 3650 的整數。'
}

$installDir = Join-Path $env:LOCALAPPDATA 'ESWakeBackup'
$workerPath = Join-Path $installDir 'backup-worker.ps1'
$configPath = Join-Path $installDir 'config.json'
$secretPath = Join-Path $installDir 'secret.dpapi'

New-Item -ItemType Directory -Path $installDir -Force | Out-Null
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

# ConvertFrom-SecureString uses Windows DPAPI, so only this Windows user can decrypt it.
$secret | ConvertFrom-SecureString | Set-Content -LiteralPath $secretPath -Encoding ASCII

$config = [ordered]@{
    ApiUrl             = "$siteUrl/api/backup-full-database"
    StorageManifestUrl = "$siteUrl/api/backup-storage?mode=manifest"
    ReportUrl          = "$siteUrl/api/backup-report"
    BackupRoot         = $backupRoot
    KeepDays           = $keepDays
    SecretPath         = $secretPath
}
$config | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8

$worker = @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ConfigPath
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-BackupLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('INFO', 'SUCCESS', 'WARNING', 'ERROR')][string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$timestamp] [$Level] $Message"
    Write-Host $line
    try {
        Add-Content -LiteralPath (Join-Path $script:Config.BackupRoot 'backup-log.txt') -Value $line -Encoding UTF8
    }
    catch {
        # The scheduled task exit code still records failures when the drive is unavailable.
    }
}

function ConvertTo-PlainText {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureValue)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Get-BackupManifest {
    param([Parameter(Mandatory = $true)][string]$Path)

    $reader = [IO.File]::OpenText($Path)
    try {
        for ($lineNumber = 0; $lineNumber -lt 100 -and -not $reader.EndOfStream; $lineNumber++) {
            $line = $reader.ReadLine()
            if ($line -match '^-- ESWAKE_BACKUP_MANIFEST: (.+)$') {
                return ($Matches[1] | ConvertFrom-Json)
            }
        }
    }
    finally {
        $reader.Dispose()
    }
    return $null
}

function Send-BackupReport {
    param([Parameter(Mandatory = $true)][hashtable]$Payload)

    $body = $Payload | ConvertTo-Json -Compress
    Invoke-RestMethod `
        -Uri $script:Config.ReportUrl `
        -Method Post `
        -Headers $script:Headers `
        -ContentType 'application/json; charset=utf-8' `
        -Body $body `
        -UseBasicParsing | Out-Null
}

function Get-StorageFilePath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$ObjectPath
    )

    if ([string]::IsNullOrWhiteSpace($ObjectPath)) {
        throw 'Storage 路徑不能為空。'
    }
    return Join-Path ([IO.Path]::GetFullPath($Root)) (Get-TextSha256 -Text $ObjectPath)
}

function Get-TextSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)

    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
    }
}

function Sync-StorageBackup {
    $storageStartedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $storageRoot = Join-Path $script:Config.BackupRoot 'Storage-Backups\product-images'
    $filesRoot = Join-Path $storageRoot 'files'
    $statePath = Join-Path $storageRoot 'manifest.json'
    New-Item -ItemType Directory -Path $filesRoot -Force | Out-Null

    try {
        Write-BackupLog '開始同步商品圖片備份。'
        $remoteManifest = $null
        $remoteFiles = @()
        $offset = 0
        $snapshotToken = $null
        do {
            $pageUrl = "$($script:Config.StorageManifestUrl)&offset=$offset&limit=250"
            if ($null -ne $snapshotToken) {
                $pageUrl += "&snapshot=$snapshotToken"
            }
            $manifestPage = Invoke-RestMethod `
                -Uri $pageUrl `
                -Method Get `
                -Headers $script:Headers `
                -UseBasicParsing
            if ($null -eq $remoteManifest) {
                $remoteManifest = $manifestPage
                $snapshotToken = [string]$manifestPage.page.snapshotToken
            }
            $remoteFiles += @($manifestPage.files)
            $nextOffset = $manifestPage.page.nextOffset
            if ($null -ne $nextOffset) {
                $offset = [int]$nextOffset
            }
        } while ($null -ne $nextOffset)
        $remoteManifest.files = $remoteFiles
        if ($remoteManifest.formatVersion -ne 1 -or $remoteManifest.bucket -ne 'product-images') {
            throw 'Storage manifest 格式不支援。'
        }

        $previous = $null
        if (Test-Path -LiteralPath $statePath -PathType Leaf) {
            $previous = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        }
        $previousByPath = @{}
        foreach ($item in @($previous.files)) {
            $previousByPath[[string]$item.path] = $item
        }

        $activeFiles = @()
        $currentPaths = @{}
        $totalBytes = [long]0
        foreach ($item in @($remoteManifest.files)) {
            $objectPath = [string]$item.path
            $currentPaths[$objectPath] = $true
            $destination = Get-StorageFilePath -Root $filesRoot -ObjectPath $objectPath
            $parent = Split-Path -Parent $destination
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
            $previousItem = $previousByPath[$objectPath]
            $canReuse = $null -ne $previousItem `
                -and (Test-Path -LiteralPath $destination -PathType Leaf) `
                -and [long](Get-Item -LiteralPath $destination).Length -eq [long]$item.size `
                -and [string]$previousItem.updatedAt -eq [string]$item.updatedAt `
                -and [string]$previousItem.sha256 -match '^[a-f0-9]{64}$'

            if ($canReuse) {
                $checksum = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
                $canReuse = $checksum -eq [string]$previousItem.sha256
            }
            if (-not $canReuse) {
                $temp = "$destination.tmp"
                try {
                    Invoke-WebRequest `
                        -Uri ([string]$item.publicUrl) `
                        -Method Get `
                        -OutFile $temp `
                        -UseBasicParsing
                    $download = Get-Item -LiteralPath $temp
                    if ([long]$download.Length -ne [long]$item.size) {
                        throw "$objectPath 圖片大小不一致。"
                    }
                    $checksum = (Get-FileHash -LiteralPath $temp -Algorithm SHA256).Hash.ToLowerInvariant()
                    Move-Item -LiteralPath $temp -Destination $destination -Force
                }
                finally {
                    if (Test-Path -LiteralPath $temp) {
                        Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
                    }
                }
            }

            $totalBytes += [long]$item.size
            $activeFiles += [ordered]@{
                path        = $objectPath
                size        = [long]$item.size
                updatedAt   = $item.updatedAt
                contentType = $item.contentType
                sha256      = $checksum
            }
        }

        $now = Get-Date
        $tombstones = @()
        foreach ($oldItem in @($previous.files)) {
            if (-not $currentPaths.ContainsKey([string]$oldItem.path)) {
                $tombstones += [ordered]@{
                    path        = [string]$oldItem.path
                    size        = [long]$oldItem.size
                    contentType = $oldItem.contentType
                    sha256      = [string]$oldItem.sha256
                    deletedAt   = $now.ToUniversalTime().ToString('o')
                }
            }
        }
        foreach ($deleted in @($previous.tombstones)) {
            if ($currentPaths.ContainsKey([string]$deleted.path)) {
                continue
            }
            $deletedAt = [DateTime]::Parse([string]$deleted.deletedAt)
            if ($deletedAt -lt $now.AddDays(-[int]$script:Config.KeepDays)) {
                $expiredPath = Get-StorageFilePath -Root $filesRoot -ObjectPath ([string]$deleted.path)
                Remove-Item -LiteralPath $expiredPath -Force -ErrorAction SilentlyContinue
            }
            else {
                $tombstones += $deleted
            }
        }

        $filesJson = $activeFiles | ConvertTo-Json -Depth 8 -Compress
        $manifestChecksum = Get-TextSha256 -Text $filesJson
        $localManifest = [ordered]@{
            formatVersion = 1
            bucket        = 'product-images'
            backupTime    = $now.ToUniversalTime().ToString('o')
            fileCount     = $activeFiles.Count
            totalBytes    = $totalBytes
            checksum      = $manifestChecksum
            files         = $activeFiles
            tombstones    = $tombstones
        }
        $manifestTemp = "$statePath.tmp"
        $localManifest | ConvertTo-Json -Depth 10 |
            Set-Content -LiteralPath $manifestTemp -Encoding UTF8
        Move-Item -LiteralPath $manifestTemp -Destination $statePath -Force

        $elapsed = [int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $storageStartedAt)
        Send-BackupReport -Payload @{
            backupType    = 'storage'
            status        = 'success'
            fileName      = 'product-images/manifest.json'
            fileSizeBytes = $totalBytes
            checksum      = $manifestChecksum
            formatVersion = 1
            recordsCount  = $activeFiles.Count
            executionTime = $elapsed
        }
        Write-BackupLog "商品圖片備份成功：$($activeFiles.Count) 個檔案。" 'SUCCESS'
    }
    catch {
        $message = $_.Exception.Message
        try {
            $elapsed = [int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $storageStartedAt)
            Send-BackupReport -Payload @{
                backupType    = 'storage'
                status        = 'failed'
                fileName      = 'product-images/manifest.json'
                errorMessage  = $message
                executionTime = $elapsed
            }
        }
        catch {
            Write-BackupLog '無法回報商品圖片備份失敗狀態。' 'WARNING'
        }
        throw
    }
}

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "找不到設定檔：$ConfigPath"
}

$script:Config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$fileName = "eswake_backup_{0}.sql" -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')
$backupDir = Join-Path $script:Config.BackupRoot 'Full-Database-Backups'
$filePath = Join-Path $backupDir $fileName
$tempPath = "$filePath.tmp"
$sqlCompleted = $false

try {
    if (-not (Test-Path -LiteralPath $script:Config.BackupRoot -PathType Container)) {
        throw "備份硬碟未連接：$($script:Config.BackupRoot)"
    }
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    $encryptedSecret = Get-Content -LiteralPath $script:Config.SecretPath -Raw -Encoding ASCII
    $secureSecret = $encryptedSecret | ConvertTo-SecureString
    $plainSecret = ConvertTo-PlainText -SecureValue $secureSecret
    $script:Headers = @{
        Authorization = "Bearer $plainSecret"
        'User-Agent'  = 'ESWake-Portable-Backup/1.0'
    }

    Write-BackupLog '開始下載完整資料庫備份。'
    $response = Invoke-WebRequest `
        -Uri $script:Config.ApiUrl `
        -Method Get `
        -Headers $script:Headers `
        -OutFile $tempPath `
        -UseBasicParsing

    $downloadedFile = Get-Item -LiteralPath $tempPath
    if ($downloadedFile.Length -le 0) {
        throw '下載的備份檔案是空的。'
    }

    $checksum = (Get-FileHash -LiteralPath $tempPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $expectedChecksum = ([string]$response.Headers['X-Backup-SHA256']).Trim().ToLowerInvariant()
    if ($expectedChecksum -notmatch '^[a-f0-9]{64}$') {
        throw '伺服器未提供有效的 SHA-256 校驗碼。'
    }
    if ($checksum -ne $expectedChecksum) {
        throw 'SHA-256 校驗失敗，下載檔案可能不完整。'
    }
    $manifest = Get-BackupManifest -Path $tempPath
    if ($null -eq $manifest -or [int]$manifest.formatVersion -ne 3) {
        throw 'SQL 備份 manifest 缺失或版本不支援。'
    }

    Move-Item -LiteralPath $tempPath -Destination $filePath -Force
    "$checksum  $fileName" | Set-Content -LiteralPath "$filePath.sha256" -Encoding ASCII

    $elapsed = [int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $startedAt)
    $successReport = @{
        status        = 'success'
        fileName      = $fileName
        fileSizeBytes = [long]$downloadedFile.Length
        checksum      = $checksum
        executionTime = $elapsed
    }
    if ($null -ne $manifest) {
        if ($null -ne $manifest.formatVersion) {
            $successReport.formatVersion = [int]$manifest.formatVersion
        }
        if ($null -ne $manifest.totalRecords) {
            $successReport.recordsCount = [int]$manifest.totalRecords
        }
    }
    Send-BackupReport -Payload $successReport
    $sqlCompleted = $true

    $cutoff = (Get-Date).AddDays(-[int]$script:Config.KeepDays)
    Get-ChildItem -LiteralPath $backupDir -Filter '*.sql' -File |
        Where-Object { $_.LastWriteTime -lt $cutoff } |
        ForEach-Object {
            $oldChecksum = "$($_.FullName).sha256"
            Remove-Item -LiteralPath $_.FullName -Force
            if (Test-Path -LiteralPath $oldChecksum) {
                Remove-Item -LiteralPath $oldChecksum -Force
            }
        }

    Write-BackupLog "資料庫備份成功：$filePath" 'SUCCESS'
    Sync-StorageBackup
}
catch {
    if (Test-Path -LiteralPath $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    $message = $_.Exception.Message
    Write-BackupLog "備份失敗：$message" 'ERROR'
    if ($null -ne $script:Headers -and -not $sqlCompleted) {
        try {
            $elapsed = [int]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $startedAt)
            Send-BackupReport -Payload @{
                status        = 'failed'
                fileName      = $fileName
                errorMessage  = $message
                executionTime = $elapsed
            }
        }
        catch {
            Write-BackupLog '無法將失敗狀態回報到網站。' 'WARNING'
        }
    }
    exit 1
}
finally {
    $plainSecret = $null
    $script:Headers = $null
}
'@

Set-Content -LiteralPath $workerPath -Value $worker -Encoding UTF8

Write-Host ''
Write-Host '正在測試第一次備份，通常需要幾秒鐘……' -ForegroundColor Yellow
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $workerPath -ConfigPath $configPath
if ($LASTEXITCODE -ne 0) {
    throw "測試失敗。請查看 $backupRoot\backup-log.txt"
}

$taskName = 'ESWake 自動備份'
$taskArguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$workerPath`" -ConfigPath `"$configPath`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $taskArguments
$trigger = New-ScheduledTaskTrigger -Daily -At '10:00'
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description '每日將 ESWake 完整資料庫備份到本機硬碟' `
    -Force | Out-Null

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host ' 安裝完成！第一次備份已通過校驗。' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host "備份位置：$backupRoot"
Write-Host '執行時間：每天 10:00（未登入時會略過當天備份）'
Write-Host "工作名稱：$taskName"
Write-Host ''
Read-Host '按 Enter 關閉'
