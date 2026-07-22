import { describe, expect, it, vi } from 'vitest'
import { getBackupHealth, type BackupHealthLog } from './backupHealth'

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
