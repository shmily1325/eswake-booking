import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/145_scope_liff_transaction_reads.sql'),
  'utf8',
)
const shared = readFileSync(
  resolve(process.cwd(), 'src/pages/liff/liffMemberShared.ts'),
  'utf8',
)
const bookingsPage = readFileSync(
  resolve(process.cwd(), 'src/pages/liff/LiffMyBookings.tsx'),
  'utf8',
)

describe('LIFF transaction read hardening', () => {
  it('resolves transactions through an active LINE binding', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.get_liff_member_transactions',
    )
    expect(migration).toContain('FROM public.line_bindings')
    expect(migration).toContain('WHERE line_user_id = p_line_user_id')
    expect(migration).toContain("AND status = 'active'")
    expect(migration).toContain('WHERE t.member_id = v_member_id')
  })

  it('returns only fields used by the LIFF transaction modal', () => {
    for (const field of [
      'id',
      'transaction_date',
      'category',
      'adjust_type',
      'transaction_type',
      'amount',
      'minutes',
      'description',
      'notes',
    ]) {
      expect(migration).toContain(`'${field}', t.${field}`)
    }
    expect(migration).not.toContain("'member_id', t.member_id")
    expect(migration).not.toContain("'operator_id', t.operator_id")
  })

  it('revokes broad anon reads while preserving RPC execution', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Allow anon users to read transactions" ON public.transactions;',
    )
    expect(migration).toContain(
      'REVOKE SELECT ON TABLE public.transactions FROM anon;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE) TO anon, authenticated;',
    )
  })

  it('switches LIFF away from direct transaction table reads', () => {
    expect(shared).toContain("supabase.rpc('get_liff_member_transactions'")
    expect(bookingsPage).toContain(
      'fetchLiffMemberTransactions(lineUserId, category, twoMonthsAgoStr)',
    )
    expect(bookingsPage).not.toMatch(
      /\.from\(['"]transactions['"]\)/,
    )
  })
})
