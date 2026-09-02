import { designSystem } from '../styles/designSystem'
import { BACKUP_FORMAT_VERSION } from '../server/backup-config'
import { STORAGE_BACKUP_FORMAT_VERSION } from '../server/backup-storage'
import { getVenueDateString } from './date'

export type BackupHealthStatus = 'ok' | 'info' | 'warning' | 'error' | 'unknown'
export type BackupHealthProfile =
  | 'cloud-database'
  | 'cloud-image'
  | 'desktop-database'
  | 'desktop-image'

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

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export interface DailyBackupState {
  message: string
  color: string
  light: string
}

export function getDailyBackupState(
  log: BackupHealthLog | undefined,
  health: BackupHealth,
  unconfigured: boolean,
  now: Date = new Date(),
): DailyBackupState {
  if (unconfigured) {
    return {
      message: '未設定',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  const createdAt = log?.created_at ? new Date(log.created_at) : null
  const ranToday = createdAt && getVenueDateString(createdAt) === getVenueDateString(now)
  if (!log || !ranToday) {
    return {
      message: '今日尚未執行',
      color: designSystem.colors.text.secondary,
      light: designSystem.colors.border.main,
    }
  }

  if (log.status === 'success' && health.status !== 'error') {
    return {
      message: '今日成功',
      color: designSystem.colors.success[700],
      light: designSystem.colors.success[500],
    }
  }

  if (log.status === 'running') {
    const runningHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    if (runningHours <= 2) {
      return {
        message: '執行中',
        color: designSystem.colors.warning[700],
        light: designSystem.colors.warning[500],
      }
    }
  }

  return {
    message: '今日失敗',
    color: designSystem.colors.danger[700],
    light: designSystem.colors.danger[500],
  }
}

function result(
  status: BackupHealthStatus,
  message: string,
): BackupHealth {
  if (status === 'ok') {
    return {
      status,
      message,
      color: designSystem.colors.success[700],
      light: designSystem.colors.success[500],
    }
  }
  if (status === 'warning') {
    return {
      status,
      message,
      color: designSystem.colors.warning[700],
      light: designSystem.colors.warning[500],
    }
  }
  if (status === 'info') {
    return {
      status,
      message,
      color: designSystem.colors.info[700],
      light: designSystem.colors.info[500],
    }
  }
  if (status === 'error') {
    return {
      status,
      message,
      color: designSystem.colors.danger[700],
      light: designSystem.colors.danger[500],
    }
  }
  return {
    status,
    message,
    color: designSystem.colors.text.secondary,
    light: designSystem.colors.border.main,
  }
}

function isValidSuccess(log: BackupHealthLog, expectedFormatVersion: number): boolean {
  return Boolean(
    log.checksum?.match(/^[a-f0-9]{64}$/i)
    && log.file_size_bytes != null
    && log.file_size_bytes >= 0
    && log.format_version === expectedFormatVersion,
  )
}

function consecutiveFailedDays(logs: BackupHealthLog[]): number {
  const failedDays = new Set<string>()
  for (const log of logs) {
    // Resumable image jobs can emit many running rows for a single attempt.
    // They are informational and must neither add to nor reset the streak.
    if (log.status === 'running') continue
    if (log.status !== 'failed') break
    if (log.created_at) failedDays.add(getVenueDateString(new Date(log.created_at)))
  }
  return failedDays.size
}

export function getBackupHealth(
  logs: BackupHealthLog[],
  profile: BackupHealthProfile = 'cloud-database',
  now: Date = new Date(),
): BackupHealth {
  const isDesktop = profile.startsWith('desktop-')
  const isImage = profile.endsWith('-image')
  const expectedFormatVersion = isImage
    ? STORAGE_BACKUP_FORMAT_VERSION
    : BACKUP_FORMAT_VERSION

  if (logs.length === 0) {
    return isDesktop
      ? result('unknown', '未設定')
      : result('error', isImage ? '尚無成功的圖片備份' : '尚無成功的資料庫備份')
  }

  const latestSuccess = logs.find((log) => log.status === 'success')
  if (!latestSuccess?.created_at) {
    return result('error', isImage ? '尚無成功的圖片備份' : '尚無成功的資料庫備份')
  }

  if (!isValidSuccess(latestSuccess, expectedFormatVersion)) {
    return result('error', isImage ? '圖片備份完整性資料無效' : '資料庫備份完整性資料無效')
  }

  const successTime = new Date(latestSuccess.created_at).getTime()
  if (!Number.isFinite(successTime)) {
    return result('error', isImage ? '尚無有效的圖片備份時間' : '尚無有效的資料庫備份時間')
  }

  const elapsed = Math.max(0, now.getTime() - successTime)
  const failedDays = consecutiveFailedDays(logs)
  const hasRunning = logs.some(
    (log) => log.status === 'running' && log.created_at
      && new Date(log.created_at).getTime() > successTime,
  )

  if (isImage) {
    if (elapsed > 30 * DAY_MS) {
      return result('error', `超過 ${Math.floor(elapsed / DAY_MS)} 天無完整圖片備份`)
    }
    if (elapsed > 7 * DAY_MS) {
      return result('warning', `超過 ${Math.floor(elapsed / DAY_MS)} 天無完整圖片備份`)
    }
    if (failedDays >= 2) {
      return result('warning', `圖片同步已連續 ${failedDays} 天失敗`)
    }
    if (failedDays === 1) {
      return result('info', '完整圖片備份正常（最近同步失敗）')
    }
    if (hasRunning) {
      return result('info', '完整圖片備份正常（同步中）')
    }
    return result('ok', '圖片備份正常')
  }

  if (elapsed > 50 * HOUR_MS) {
    return result('error', `超過 ${Math.floor(elapsed / HOUR_MS)} 小時無成功資料庫備份`)
  }
  if (failedDays >= 2) {
    return result('error', `資料庫備份已連續 ${failedDays} 天失敗`)
  }
  if (elapsed > 26 * HOUR_MS) {
    return result('warning', `超過 ${Math.floor(elapsed / HOUR_MS)} 小時無成功資料庫備份`)
  }
  if (failedDays === 1) {
    return result('warning', '最近一次資料庫備份失敗，前次備份仍可用')
  }
  if (hasRunning) {
    return result('ok', '資料庫備份正常（執行中）')
  }
  return result('ok', '資料庫備份正常')
}

export function summarizeBackupHealth(
  cloud: [BackupHealth, BackupHealth],
  desktop?: [BackupHealth, BackupHealth],
): BackupHealthSummary {
  void desktop
  const database = cloud[0]
  return { status: database.status, message: database.message }
}
