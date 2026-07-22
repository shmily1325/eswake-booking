[CmdletBinding()]
param(
    [string]$ApiBaseUrl = 'https://eswake-booking.vercel.app',
    [string]$OutputRoot = (Join-Path $PWD 'DR-Exports')
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

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

function Invoke-Supabase {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & $script:SupabaseCommand @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase CLI 匯出失敗（exit code $LASTEXITCODE）。資料庫網址已從錯誤訊息隱藏。"
    }
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

$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) {
    throw '找不到 Supabase CLI。請先依官方文件安裝，並確認 supabase --version 可執行。'
}
$script:SupabaseCommand = $supabase.Source

$timestamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$exportRoot = Join-Path ([IO.Path]::GetFullPath($OutputRoot)) "eswake-dr-$timestamp"
$databaseRoot = Join-Path $exportRoot 'database'
$storageRoot = Join-Path $exportRoot 'storage\product-images'
$storageFilesRoot = Join-Path $storageRoot 'files'
New-Item -ItemType Directory -Path $databaseRoot -Force | Out-Null
New-Item -ItemType Directory -Path $storageFilesRoot -Force | Out-Null

Write-Host '匯出 roles、schema、data 與 migration history……' -ForegroundColor Cyan
$secureDatabasePassword = Read-Host '輸入已連結 Supabase 專案的資料庫密碼（畫面不會顯示）' -AsSecureString
$databasePassword = ConvertTo-PlainText -SecureValue $secureDatabasePassword
if ([string]::IsNullOrWhiteSpace($databasePassword)) {
    throw '資料庫密碼不能為空。'
}
$env:SUPABASE_DB_PASSWORD = $databasePassword
try {
    Invoke-Supabase -Arguments @(
        'db', 'dump', '--linked',
        '-f', (Join-Path $databaseRoot 'roles.sql'), '--role-only'
    )
    Invoke-Supabase -Arguments @(
        'db', 'dump', '--linked',
        '-f', (Join-Path $databaseRoot 'schema.sql')
    )
    Invoke-Supabase -Arguments @(
        'db', 'dump', '--linked',
        '-f', (Join-Path $databaseRoot 'data.sql'),
        '--use-copy', '--data-only',
        '-x', 'storage.buckets_vectors',
        '-x', 'storage.vector_indexes'
    )
    Invoke-Supabase -Arguments @(
        'db', 'dump', '--linked',
        '-f', (Join-Path $databaseRoot 'migration-history-schema.sql'),
        '--schema', 'supabase_migrations'
    )
    Invoke-Supabase -Arguments @(
        'db', 'dump', '--linked',
        '-f', (Join-Path $databaseRoot 'migration-history-data.sql'),
        '--use-copy', '--data-only', '--schema', 'supabase_migrations'
    )
}
finally {
    Remove-Item Env:SUPABASE_DB_PASSWORD -ErrorAction SilentlyContinue
    $databasePassword = $null
}

$secureSecret = Read-Host '貼上 Vercel CRON_SECRET 以匯出商品圖片（畫面不會顯示）' -AsSecureString
$plainSecret = ConvertTo-PlainText -SecureValue $secureSecret
if ([string]::IsNullOrWhiteSpace($plainSecret)) {
    throw 'CRON_SECRET 不能為空。'
}

try {
    $headers = @{
        Authorization = "Bearer $plainSecret"
        'User-Agent'  = 'ESWake-DR-Export/1.0'
    }
    $manifestUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/backup-storage?mode=manifest"
    $remoteManifest = $null
    $remoteFiles = @()
    $offset = 0
    $snapshotToken = $null
    do {
        $pageUrl = "$manifestUrl&offset=$offset&limit=250"
        if ($null -ne $snapshotToken) {
            $pageUrl += "&snapshot=$snapshotToken"
        }
        $manifestPage = Invoke-RestMethod `
            -Uri $pageUrl `
            -Method Get `
            -Headers $headers `
            -TimeoutSec 120 `
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

    Write-Host "匯出 $($remoteManifest.fileCount) 個商品圖片……" -ForegroundColor Cyan
    $localEntries = @()
    foreach ($item in @($remoteManifest.files)) {
        $destination = Get-StorageFilePath -Root $storageFilesRoot -ObjectPath ([string]$item.path)
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Invoke-WebRequest `
            -Uri ([string]$item.publicUrl) `
            -OutFile $destination `
            -TimeoutSec 300 `
            -UseBasicParsing
        $file = Get-Item -LiteralPath $destination
        if ([long]$file.Length -ne [long]$item.size) {
            throw "$($item.path) 大小驗證失敗。"
        }
        $localEntries += [ordered]@{
            path        = [string]$item.path
            size        = [long]$item.size
            updatedAt   = $item.updatedAt
            contentType = $item.contentType
            sha256      = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }

    [ordered]@{
        formatVersion = 1
        bucket        = 'product-images'
        backupTime    = (Get-Date).ToUniversalTime().ToString('o')
        fileCount     = $localEntries.Count
        totalBytes    = [long](($localEntries | Measure-Object -Property size -Sum).Sum)
        files         = $localEntries
    } | ConvertTo-Json -Depth 10 |
        Set-Content -LiteralPath (Join-Path $storageRoot 'manifest.json') -Encoding UTF8
}
finally {
    $plainSecret = $null
    $headers = $null
}

[ordered]@{
    formatVersion = 1
    createdAt     = (Get-Date).ToUniversalTime().ToString('o')
    project       = 'eswake-booking'
    contents      = @(
        'database/roles.sql',
        'database/schema.sql',
        'database/data.sql',
        'database/migration-history-schema.sql',
        'database/migration-history-data.sql',
        'storage/product-images/manifest.json',
        'checksums.sha256'
    )
} | ConvertTo-Json -Depth 5 |
    Set-Content -LiteralPath (Join-Path $exportRoot 'bundle-manifest.json') -Encoding UTF8

$checksumLines = Get-ChildItem -LiteralPath $exportRoot -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
        $relative = $_.FullName.Substring($exportRoot.Length + 1).Replace('\', '/')
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $relative"
    }
$checksumLines | Set-Content -LiteralPath (Join-Path $exportRoot 'checksums.sha256') -Encoding ASCII

Write-Host ''
Write-Host "完整 DR 匯出完成：$exportRoot" -ForegroundColor Green
Write-Host '請將整個資料夾複製到另一個離線或雲端位置。'
