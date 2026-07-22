import { describe, expect, it, vi } from 'vitest'
import {
  getBackupHealth,
  summarizeBackupHealth,
  type BackupHealth,
  type BackupHealthLog,
} from './backupHealth'

function log(overrides: Partial<BackupHealthLog> = {}): BackupHealthLog {
  return {
    status: 'success',
    checksum: 'a'.repeat(64),
    file_size_bytes: 100,
    format_version: 3,
    created_at: '2026-07-22T00:00:00.000Z',
    ...overrides,
  }
}

function health(status: BackupHealth['status']): BackupHealth {
  return { status, message: status, color: '', light: '' }
}

describe('getBackupHealth', () => {
  it('requires complete integrity metadata', () => {
    expect(getBackupHealth([log({ checksum: null })]).status).toBe('error')
  })

  it('shows a newer failure even when an older success exists', () => {
    expect(getBackupHealth([
      log({ status: 'failed', created_at: '2026-07-22T01:00:00.000Z' }),
      log(),
    ]).status).toBe('error')
  })

  it('warns after 26 hours without a successful backup', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-23T03:00:00.000Z'))
    expect(getBackupHealth([log()]).status).toBe('warning')
    vi.useRealTimers()
  })

  it('does not show a stale partial run as actively syncing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T04:00:00.000Z'))
    expect(getBackupHealth([
      log({ status: 'running', created_at: '2026-07-22T00:00:00.000Z' }),
    ]).message).toBe('同步尚未完成')
    vi.useRealTimers()
  })
})

describe('summarizeBackupHealth', () => {
  it('ignores an unconfigured desktop when cloud backups are healthy', () => {
    expect(summarizeBackupHealth(
      [health('ok'), health('ok')],
      [health('unknown'), health('unknown')],
    )).toEqual({ status: 'ok', message: '雲端備份正常' })
  })

  it('explains which cloud backup is waiting for its first run', () => {
    expect(summarizeBackupHealth(
      [health('ok'), health('unknown')],
      [health('unknown'), health('unknown')],
    ).message).toBe('雲端圖片待首次備份')
  })

  it('summarizes all four after desktop setup', () => {
    expect(summarizeBackupHealth(
      [health('ok'), health('ok')],
      [health('ok'), health('ok')],
    ).message).toBe('4/4 備份正常')
  })
})
