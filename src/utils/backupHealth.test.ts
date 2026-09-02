import { describe, expect, it } from 'vitest'
import {
  getDailyBackupState,
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
    format_version: 4,
    created_at: '2026-07-22T00:00:00.000Z',
    ...overrides,
  }
}

function imageLog(overrides: Partial<BackupHealthLog> = {}): BackupHealthLog {
  return log({ format_version: 1, ...overrides })
}

function health(status: BackupHealth['status']): BackupHealth {
  return { status, message: status, color: '', light: '' }
}

describe('getBackupHealth', () => {
  const now = new Date('2026-07-24T02:00:00.000Z')

  it('reports a missing cloud database success as an error', () => {
    expect(getBackupHealth([], 'cloud-database', now)).toMatchObject({
      status: 'error',
      message: '尚無成功的資料庫備份',
    })
  })

  it('treats an unconfigured desktop destination as secondary', () => {
    expect(getBackupHealth([], 'desktop-database', now)).toMatchObject({
      status: 'unknown',
      message: '未設定',
    })
  })

  it('requires valid integrity metadata on the latest success', () => {
    expect(getBackupHealth(
      [log({ checksum: null, created_at: '2026-07-24T01:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('error')
    expect(getBackupHealth(
      [log({ file_size_bytes: -1, created_at: '2026-07-24T01:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('error')
    expect(getBackupHealth(
      [log({ format_version: 0, created_at: '2026-07-24T01:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('error')
    expect(getBackupHealth(
      [log({ format_version: 3, created_at: '2026-07-24T01:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('error')
  })

  it('uses 26 and 50 hour database thresholds', () => {
    expect(getBackupHealth(
      [log({ created_at: '2026-07-23T00:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('ok')
    expect(getBackupHealth(
      [log({ created_at: '2026-07-22T23:59:59.999Z' })],
      'cloud-database',
      now,
    ).status).toBe('warning')
    expect(getBackupHealth(
      [log({ created_at: '2026-07-22T00:00:00.000Z' })],
      'cloud-database',
      now,
    ).status).toBe('warning')
    expect(getBackupHealth(
      [log({ created_at: '2026-07-21T23:59:59.999Z' })],
      'cloud-database',
      now,
    ).status).toBe('error')
  })

  it('warns for one recoverable database failure', () => {
    expect(getBackupHealth([
      log({ status: 'failed', created_at: '2026-07-24T01:00:00.000Z' }),
      log({ created_at: '2026-07-23T02:00:00.000Z' }),
    ], 'cloud-database', now)).toMatchObject({
      status: 'warning',
      message: '最近一次資料庫備份失敗，前次備份仍可用',
    })
  })

  it('errors after two database failures while ignoring running rows', () => {
    expect(getBackupHealth([
      log({ status: 'running', created_at: '2026-07-24T01:30:00.000Z' }),
      log({ status: 'failed', created_at: '2026-07-24T01:00:00.000Z' }),
      log({ status: 'running', created_at: '2026-07-24T00:30:00.000Z' }),
      log({ status: 'failed', created_at: '2026-07-23T00:00:00.000Z' }),
      log({ created_at: '2026-07-22T02:00:00.000Z' }),
    ], 'cloud-database', now)).toMatchObject({
      status: 'error',
      message: '資料庫備份已連續 2 天失敗',
    })
  })

  it('does not treat same-day retries as multiple missed database cycles', () => {
    expect(getBackupHealth([
      log({ status: 'failed', created_at: '2026-07-24T01:00:00.000Z' }),
      log({ status: 'failed', created_at: '2026-07-24T00:30:00.000Z' }),
      log({ created_at: '2026-07-23T02:00:00.000Z' }),
    ], 'cloud-database', now).status).toBe('warning')
  })

  it('lets a newer success reset the database failure streak', () => {
    expect(getBackupHealth([
      log({ created_at: '2026-07-24T01:00:00.000Z' }),
      log({ status: 'failed', created_at: '2026-07-24T00:00:00.000Z' }),
      log({ status: 'failed', created_at: '2026-07-23T23:00:00.000Z' }),
    ], 'cloud-database', now).status).toBe('ok')
  })

  it('uses 7 and 30 day image thresholds', () => {
    expect(getBackupHealth(
      [imageLog({ created_at: '2026-07-17T02:00:00.000Z' })],
      'cloud-image',
      now,
    ).status).toBe('ok')
    expect(getBackupHealth(
      [imageLog({ created_at: '2026-07-17T01:59:59.999Z' })],
      'cloud-image',
      now,
    ).status).toBe('warning')
    expect(getBackupHealth(
      [imageLog({ created_at: '2026-06-24T02:00:00.000Z' })],
      'cloud-image',
      now,
    ).status).toBe('warning')
    expect(getBackupHealth(
      [imageLog({ created_at: '2026-06-24T01:59:59.999Z' })],
      'cloud-image',
      now,
    ).status).toBe('error')
  })

  it('keeps one image failure or running row informational', () => {
    expect(getBackupHealth([
      imageLog({ status: 'failed', created_at: '2026-07-24T01:00:00.000Z' }),
      imageLog({ created_at: '2026-07-23T02:00:00.000Z' }),
    ], 'cloud-image', now)).toMatchObject({
      status: 'info',
      message: '完整圖片備份正常（最近同步失敗）',
    })
    expect(getBackupHealth([
      imageLog({ status: 'running', created_at: '2026-07-24T01:00:00.000Z' }),
      imageLog({ created_at: '2026-07-23T02:00:00.000Z' }),
    ], 'cloud-image', now)).toMatchObject({
      status: 'info',
      message: '完整圖片備份正常（同步中）',
    })
  })

  it('warns on sustained image failures without counting running rows', () => {
    expect(getBackupHealth([
      imageLog({ status: 'running', created_at: '2026-07-24T01:30:00.000Z' }),
      imageLog({ status: 'failed', created_at: '2026-07-24T01:00:00.000Z' }),
      imageLog({ status: 'running', created_at: '2026-07-23T00:30:00.000Z' }),
      imageLog({ status: 'failed', created_at: '2026-07-23T00:00:00.000Z' }),
      imageLog({ created_at: '2026-07-22T02:00:00.000Z' }),
    ], 'cloud-image', now)).toMatchObject({
      status: 'warning',
      message: '圖片同步已連續 2 天失敗',
    })
  })

  it('reports missing or invalid image successes as errors', () => {
    expect(getBackupHealth([], 'cloud-image', now).status).toBe('error')
    expect(getBackupHealth(
      [imageLog({ checksum: 'bad', created_at: '2026-07-24T01:00:00.000Z' })],
      'cloud-image',
      now,
    ).status).toBe('error')
  })
})

describe('summarizeBackupHealth', () => {
  it('uses only cloud database health for the primary summary', () => {
    expect(summarizeBackupHealth(
      [health('ok'), health('error')],
      [health('error'), health('error')],
    )).toEqual({ status: 'ok', message: 'ok' })
  })
})

describe('getDailyBackupState', () => {
  it('uses the venue timezone to identify a successful run today', () => {
    const state = getDailyBackupState(
      log({ created_at: '2026-07-23T23:50:00.000Z' }),
      health('ok'),
      false,
      new Date('2026-07-24T00:30:00.000Z'),
    )
    expect(state.message).toBe('今日成功')
  })

  it('does not show success when integrity verification failed', () => {
    const state = getDailyBackupState(
      log({ created_at: '2026-07-23T23:50:00.000Z' }),
      health('error'),
      false,
      new Date('2026-07-24T00:30:00.000Z'),
    )
    expect(state.message).toBe('今日失敗')
  })

  it('marks a stale running record as failed', () => {
    const state = getDailyBackupState(
      log({ status: 'running', created_at: '2026-07-24T00:00:00.000Z' }),
      health('warning'),
      false,
      new Date('2026-07-24T03:00:01.000Z'),
    )
    expect(state.message).toBe('今日失敗')
  })

  it('shows when no backup has run today', () => {
    const state = getDailyBackupState(
      log({ created_at: '2026-07-22T18:00:00.000Z' }),
      health('ok'),
      false,
      new Date('2026-07-24T00:30:00.000Z'),
    )
    expect(state.message).toBe('今日尚未執行')
  })
})
