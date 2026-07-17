import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/143_add_liff_birthday_rpc.sql'),
  'utf8',
)
const shared = readFileSync(
  resolve(process.cwd(), 'src/pages/liff/liffMemberShared.ts'),
  'utf8',
)
const bindingFlows = [
  readFileSync(resolve(process.cwd(), 'src/pages/liff/useLiffMember.ts'), 'utf8'),
  readFileSync(resolve(process.cwd(), 'src/pages/liff/LiffMyBookings.tsx'), 'utf8'),
]

describe('LIFF birthday RPC migration', () => {
  it('resolves the member from an active LINE binding', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.update_liff_member_birthday')
    expect(migration).toContain('FROM public.line_bindings')
    expect(migration).toContain('WHERE line_user_id = p_line_user_id')
    expect(migration).toContain("AND status = 'active'")
  })

  it('updates only the birthday column', () => {
    expect(migration).toMatch(
      /UPDATE public\.members\s+SET birthday = p_birthday\s+WHERE id = v_member_id;/,
    )
    expect(migration).not.toMatch(
      /SET\s+(balance|phone|name|status|vip_voucher_amount|designated_lesson_minutes)\s*=/i,
    )
  })

  it('is callable by LIFF without implicit PUBLIC execution', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) FROM PUBLIC;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.update_liff_member_birthday(TEXT, DATE) TO anon, authenticated;',
    )
  })

  it('switches both binding flows away from direct member updates', () => {
    expect(shared).toContain("supabase.rpc('update_liff_member_birthday'")
    for (const flow of bindingFlows) {
      expect(flow).toContain('updateLiffMemberBirthday(lineUserId, birthday)')
      expect(flow).not.toMatch(
        /\.from\(['"]members['"]\)\s*\.update\(\{\s*birthday\s*\}\)/,
      )
    }
  })

  it('does not revoke the legacy policy during phase one', () => {
    expect(migration).not.toContain('DROP POLICY')
    expect(migration).not.toContain('REVOKE UPDATE ON TABLE public.members FROM anon')
  })
})
