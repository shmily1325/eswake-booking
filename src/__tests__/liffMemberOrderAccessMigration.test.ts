import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/146_scope_liff_member_and_order_access.sql'),
  'utf8',
)
const revokeMigration = readFileSync(
  resolve(process.cwd(), 'migrations/147_revoke_anon_liff_member_and_order_access.sql'),
  'utf8',
)
const liffSources = [
  'src/pages/liff/liffMemberShared.ts',
  'src/pages/liff/useLiffMember.ts',
  'src/pages/liff/LiffMyBookings.tsx',
  'src/pages/liff/liffShopOrders.ts',
].map(path => readFileSync(resolve(process.cwd(), path), 'utf8'))
const api = readFileSync(
  resolve(process.cwd(), 'api/liff-member-access.ts'),
  'utf8',
)

describe('LIFF member and order access hardening', () => {
  it('provides binding-scoped profile, bind, and order RPCs', () => {
    for (const functionName of [
      'get_liff_member_profile',
      'bind_liff_member',
      'get_liff_shop_orders',
    ]) {
      expect(migration).toContain(
        `CREATE OR REPLACE FUNCTION public.${functionName}`,
      )
      expect(migration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([^)]+\\) TO service_role;`),
      )
      expect(migration).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\([^)]+\\) FROM PUBLIC, anon, authenticated;`),
      )
    }
    expect(migration).toContain("AND status = 'active'")
    expect(migration).toContain('WHERE o.member_id = v_member_id')
  })

  it('matches phone and birthday and prevents conflicting bindings', () => {
    expect(migration).toContain(
      "regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone",
    )
    expect(migration).toContain('INSERT INTO public.line_bindings')
    expect(migration).toContain('ON CONFLICT (line_user_id) DO UPDATE')
    expect(migration).toContain("m.birthday = to_char(p_birthday, 'YYYY-MM-DD')")
    expect(migration).toContain('此 LINE 帳號已綁定其他會員')
    expect(migration).toContain('此會員已綁定其他 LINE 帳號')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS uq_line_bindings_active_member')
    expect(migration).toContain("WHERE status = 'active' AND member_id IS NOT NULL")
    expect(migration).toContain('v_member := public._liff_member_snapshot(v_member_id)')
  })

  it('returns profile enrichment and the required LIFF order fields', () => {
    expect(migration).toContain("'board_slots'")
    expect(migration).toContain("'partner'")
    for (const field of [
      'qty',
      'qty_pending_bill',
      'qty_paid',
      'stock',
      'reserved_qty',
      'amount_total',
    ]) {
      expect(migration).toContain(`'${field}'`)
    }
    expect(migration).not.toContain("'internal_notes', o.internal_notes")
    expect(migration).not.toContain("'member_id', o.member_id")
  })

  it('removes direct anon access in the post-deploy revocation phase', () => {
    for (const table of [
      'members',
      'line_bindings',
      'board_storage',
      'shop_orders',
      'shop_order_items',
      'shop_order_settlements',
    ]) {
      expect(revokeMigration).toContain(
        `REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.${table} FROM PUBLIC, anon;`,
      )
    }
    expect(revokeMigration).toContain(
      'REVOKE ALL ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE)',
    )
    expect(revokeMigration).not.toMatch(/REVOKE [^;]+ ON TABLE public\.products FROM/)
    expect(revokeMigration).not.toMatch(/REVOKE [^;]+ ON TABLE public\.product_variants FROM/)
  })

  it('keeps migration 146 additive and defers revocation until 147', () => {
    expect(migration).not.toMatch(
      /REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public\.(members|line_bindings)/,
    )
    expect(migration).not.toContain(
      'REVOKE ALL ON FUNCTION public.get_liff_member_transactions(TEXT, TEXT, DATE)',
    )
    expect(revokeMigration).toContain(
      "to_regprocedure('public.get_liff_member_profile(text,boolean)')",
    )
  })

  it('switches LIFF sources away from direct protected-table access', () => {
    const directProtectedTableAccess =
      /\.from\(['"](members|line_bindings|board_storage|shop_orders|shop_order_items|shop_order_settlements)['"]\)/

    for (const source of liffSources) {
      expect(source).not.toMatch(directProtectedTableAccess)
    }

    expect(liffSources.join('\n')).toContain("callLiffMemberApi<MemberProfileRpcResult>('profile'")
    expect(liffSources.join('\n')).toContain("callLiffMemberApi<MemberProfileRpcResult>('bind'")
    expect(liffSources.join('\n')).toContain("callLiffMemberApi<LiffShopOrdersRpcResult>('orders'")
  })

  it('derives identity from a verified LINE access token', () => {
    expect(api).toContain("'https://api.line.me/v2/profile'")
    expect(api).toContain('Authorization: `Bearer ${token}`')
    expect(api).toContain('const lineUserId = await verifyLineUser(req)')
    expect(api).not.toMatch(/bodyValue\(req,\s*['"]lineUserId['"]\)/)
    expect(api).toContain("p_line_user_id: lineUserId")
  })
})
