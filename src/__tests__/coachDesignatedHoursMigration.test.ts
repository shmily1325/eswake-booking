import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const schemaSql = readFileSync(
  resolve(process.cwd(), 'migrations/247_create_coach_designated_hours.sql'),
  'utf8',
)
const rpcSql = readFileSync(
  resolve(process.cwd(), 'migrations/248_coach_designated_hours_rpcs.sql'),
  'utf8',
)
const splitSql = readFileSync(
  resolve(process.cwd(), 'migrations/249_split_coach_designated_regular_and_gift.sql'),
  'utf8',
)
const expirySummarySql = readFileSync(
  resolve(process.cwd(), 'migrations/250_add_designated_expiry_to_student_list.sql'),
  'utf8',
)
const combined = `${schemaSql}\n${rpcSql}\n${splitSql}\n${expirySummarySql}`.toLowerCase()

describe('coach designated-hour migrations', () => {
  it('keeps the new ledger isolated from existing financial storage', () => {
    expect(combined).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\.transactions\b/)
    expect(combined).not.toMatch(/\bupdate\s+public\.members\b/)
    expect(combined).not.toContain('create or replace function public.process_deduction_transaction')
  })

  it('deduplicates report deductions and clears only new sidecar rows on report deletion', () => {
    expect(schemaSql).toContain('uq_coach_designated_hour_active_report_deduction')
    expect(schemaSql).toMatch(/booking_participants\(id\)\s+ON DELETE CASCADE/i)
    expect(schemaSql).toContain('coach_designated_hour_report_skips')
  })

  it('creates a credit and selected same-member report deductions atomically', () => {
    expect(rpcSql).toContain('create_coach_designated_credit_with_reports')
    expect(rpcSql).toContain('選取的回報不屬於同一位學生')
    expect(rpcSql).not.toContain('不能用本次回報時數扣除更早的課程')
    expect(rpcSql).toMatch(
      /create_coach_designated_credit\([\s\S]*sync_coach_designated_report_deductions\(/i,
    )
  })

  it('deduplicates a retried credit request', () => {
    expect(schemaSql).toContain('uq_coach_designated_hour_credit_request')
    expect(rpcSql).toMatch(
      /ON CONFLICT \(request_key\) WHERE request_key IS NOT NULL DO NOTHING/i,
    )
    expect(splitSql).toMatch(
      /v_entry\.occurred_at IS DISTINCT FROM COALESCE\(p_occurred_at, v_entry\.occurred_at\)/i,
    )
  })

  it('persists an explicit no-deduction decision separately from the ledger', () => {
    expect(rpcSql).toMatch(/INSERT INTO public\.coach_designated_hour_report_skips/i)
    expect(rpcSql).toContain("'explicit_no_deduction', v_skipped")
    expect(rpcSql).toMatch(
      /void_coach_designated_entry[\s\S]*entry_type = 'report_deduction'[\s\S]*coach_designated_hour_report_skips/i,
    )
  })

  it('keeps LIFF reads behind service role', () => {
    expect(rpcSql).toMatch(
      /get_liff_coach_designated_balances\(TEXT\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    )
    expect(rpcSql).toMatch(
      /get_liff_coach_designated_history\(TEXT, UUID, INTEGER, INTEGER\)[\s\S]*TO service_role/i,
    )
  })

  it('backfills existing entries as regular minutes without changing totals', () => {
    expect(splitSql).toMatch(
      /UPDATE public\.coach_designated_hour_entries[\s\S]*regular_minutes = minutes[\s\S]*gift_minutes = 0/i,
    )
    expect(splitSql).toContain('regular_minutes + gift_minutes = minutes')
  })

  it('keeps one idempotent report deduction while storing a regular/gift split', () => {
    expect(splitSql).toContain("'regular_minutes'")
    expect(splitSql).toContain("'gift_minutes'")
    expect(splitSql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.sync_coach_designated_report_deductions[\s\S]*regular_minutes = v_regular_minutes[\s\S]*gift_minutes = v_gift_minutes/i,
    )
    expect(splitSql).not.toContain('扣除分鐘不能超過本次回報分鐘')
  })

  it('keeps non-zero LIFF balances visible regardless of recent activity', () => {
    expect(splitSql).toMatch(
      /HAVING[\s\S]*e\.regular_minutes[\s\S]*<> 0[\s\S]*e\.gift_minutes[\s\S]*<> 0[\s\S]*INTERVAL '2 months'/i,
    )
  })

  it('returns latest regular and gift expiry reminders in the coach student list', () => {
    expect(expirySummarySql).toContain("'regular_expires_on'")
    expect(expirySummarySql).toContain("'gift_expires_on'")
    expect(expirySummarySql).toMatch(
      /latest_regular\.occurred_at DESC, latest_regular\.id DESC/i,
    )
    expect(expirySummarySql).toMatch(
      /latest_gift\.occurred_at DESC, latest_gift\.id DESC/i,
    )
  })
})
