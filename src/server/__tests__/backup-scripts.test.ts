import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const verifier = readFileSync(
  resolve(process.cwd(), 'scripts/verify-backup-restore.cjs'),
  'utf8',
)
const portableInstaller = readFileSync(
  resolve(process.cwd(), 'scripts/portable-backup-installer.ps1'),
  'utf8',
)

describe('backup script contracts', () => {
  it('accepts database backup format v4 and audits restored credit lots', () => {
    expect(verifier).toContain('manifest.formatVersion !== 4')
    expect(verifier).toContain("to_regclass('public.credit_lots_balance_audit')")
    expect(verifier).toContain('lot_count > 0')
    expect(verifier).toContain('delta_members_minus_lots <> 0')
  })

  it('keeps the prior storage manifest when an image download fails', () => {
    expect(portableInstaller).toContain('[int]$manifest.formatVersion -ne 4')
    expect(portableInstaller).toContain("throw \"無法下載商品圖片")
    expect(portableInstaller).not.toContain('略過無法下載的商品圖片')

    const stageDownload = portableInstaller.indexOf(
      '$temp = Get-StorageFilePath -Root $downloadStagingRoot',
    )
    const publishDownloads = portableInstaller.indexOf(
      'foreach ($download in $pendingDownloads)',
    )
    const publishManifest = portableInstaller.indexOf(
      'Move-Item -LiteralPath $manifestTemp -Destination $statePath -Force',
    )
    expect(stageDownload).toBeGreaterThan(-1)
    expect(publishDownloads).toBeGreaterThan(stageDownload)
    expect(publishManifest).toBeGreaterThan(publishDownloads)
    expect(portableInstaller).toContain("status        = 'failed'")
  })
})
