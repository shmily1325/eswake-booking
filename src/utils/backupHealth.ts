import { designSystem } from '../styles/designSystem'

export type BackupHealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

export interface BackupHealthLog {
  status: string
  checksum: string | null
  file_size_bytes: number | null
  format_version: number | null
  created_at: string | null
}

export interface BackupHealth {
  status: BackupHealthStatus
  message: string
  color: string
  light: string
}

export interface BackupHealthSummary {
  status: BackupHealthStatus
  message: string
}

export function getBackupHealth(logs: BackupHealthLog[]): BackupHealth {
  if (logs.length === 0) {
    return {
      status: 'unknown',
      message: '尚無備份記錄',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  const latestBackup = logs[0]
  const latestSuccess = logs.find((log) => log.status === 'success')
  if (latestBackup.status === 'failed') {
    return {
      status: 'error',
      message: '最近一次備份失敗',
      color: designSystem.colors.danger[700],
      light: designSystem.colors.danger[500],
    }
  }
  if (latestBackup.status === 'running') {
    const runningHours = latestBackup.created_at
      ? (Date.now() - new Date(latestBackup.created_at).getTime()) / (1000 * 60 * 60)
      : Number.POSITIVE_INFINITY
    return {
      status: 'warning',
      message: runningHours <= 2 ? '同步中' : '同步尚未完成',
      color: designSystem.colors.warning[700],
      light: designSystem.colors.warning[500],
    }
  }
  if (!latestSuccess?.created_at) {
    return {
      status: 'unknown',
      message: '尚無成功記錄',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  if (
    !latestSuccess.checksum?.match(/^[a-f0-9]{64}$/i)
    || latestSuccess.file_size_bytes == null
    || latestSuccess.format_version == null
  ) {
    return {
      status: 'error',
      message: '完整性資料不完整',
      color: designSystem.colors.danger[700],
      light: designSystem.colors.danger[500],
    }
  }

  const hoursSinceLastBackup =
    (Date.now() - new Date(latestSuccess.created_at).getTime()) / (1000 * 60 * 60)

  if (hoursSinceLastBackup > 26) {
    return {
      status: 'warning',
      message: `超過 ${Math.floor(hoursSinceLastBackup)} 小時未成功`,
      color: designSystem.colors.warning[700],
      light: designSystem.colors.warning[500],
    }
  }

  return {
    status: 'ok',
    message: '備份正常',
    color: designSystem.colors.success[700],
    light: designSystem.colors.success[500],
  }
}

export function summarizeBackupHealth(
  cloud: [BackupHealth, BackupHealth],
  desktop: [BackupHealth, BackupHealth],
): BackupHealthSummary {
  const cloudErrors = cloud.filter((item) => item.status === 'error').length
  if (cloudErrors > 0) {
    return {
      status: 'error',
      message: cloudErrors === 1 ? '1 項雲端備份異常' : '雲端備份異常',
    }
  }
  if (cloud.some((item) => item.status === 'warning')) {
    return { status: 'warning', message: '雲端備份待確認' }
  }
  const unknownCloud = cloud
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === 'unknown')
  if (unknownCloud.length === 2) {
    return { status: 'unknown', message: '等待首次雲端備份' }
  }
  if (unknownCloud[0]?.index === 0) {
    return { status: 'unknown', message: '雲端資料庫待首次備份' }
  }
  if (unknownCloud[0]?.index === 1) {
    return { status: 'unknown', message: '雲端圖片待首次備份' }
  }

  const desktopConfigured = desktop.every((item) => item.status !== 'unknown')
  if (!desktopConfigured) {
    return { status: 'ok', message: '雲端備份正常' }
  }

  const all = [...cloud, ...desktop]
  const errors = all.filter((item) => item.status === 'error').length
  if (errors > 0) {
    return { status: 'error', message: `${errors} 項備份異常` }
  }
  const warnings = all.filter((item) => item.status === 'warning').length
  if (warnings > 0) {
    return { status: 'warning', message: `${warnings} 項備份待確認` }
  }
  return { status: 'ok', message: '4/4 備份正常' }
}
