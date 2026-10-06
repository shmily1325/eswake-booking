import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/246_get_member_last_transactions.sql'),
  'utf8',
)

describe('member last-transactions migration', () => {
  it('returns one indexed latest transaction lookup per active member', () => {
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS idx_transactions_member_created_desc',
    )
    expect(migration).toContain(
      'ON public.transactions (member_id, created_at DESC NULLS LAST, id DESC);',
    )
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.get_member_last_transactions()',
    )
    expect(migration).toContain('JOIN LATERAL (')
    expect(migration).toContain('WHERE t.member_id = m.id')
    expect(migration).toContain(
      'ORDER BY t.created_at DESC NULLS LAST, t.id DESC',
    )
    expect(migration).toContain("WHERE m.status = 'active';")
  })

  it('allows only authenticated allowed staff to execute the summary RPC', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain(
      'IF NOT public.can_execute_shop_financial_rpc() THEN',
    )
    expect(migration).toContain("USING ERRCODE = '42501'")
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_member_last_transactions() FROM PUBLIC, anon;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_member_last_transactions() TO authenticated;',
    )
  })
})
