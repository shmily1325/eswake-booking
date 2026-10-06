import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/244_harden_shop_order_staff_access.sql'),
  'utf8',
)

const dataTables = [
  'shop_orders',
  'shop_order_items',
  'shop_order_settlements',
] as const

describe('shop order staff access migration', () => {
  it('enables RLS and replaces permissive policies with the shared staff boundary', () => {
    for (const table of [...dataTables, 'shop_order_no_seq']) {
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      )
    }

    for (const table of dataTables) {
      expect(migration).toMatch(
        new RegExp(
          `CREATE POLICY ${table}_allowed_staff[^;]*` +
            `ON public\\.${table}[\\s\\S]*?TO authenticated[\\s\\S]*?` +
            `USING \\(\\(SELECT public\\.is_allowed_staff\\(\\)\\)\\)[\\s\\S]*?` +
            `WITH CHECK \\(\\(SELECT public\\.is_allowed_staff\\(\\)\\)\\);`,
        ),
      )
    }
  })

  it('removes anonymous table and RPC access', () => {
    for (const table of [...dataTables, 'shop_order_no_seq']) {
      expect(migration).toMatch(
        new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM [^;]*anon[^;]*;`),
      )
    }

    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.generate_shop_order_no() FROM PUBLIC, anon;',
    )
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.delete_shop_order(UUID, TEXT) FROM PUBLIC, anon;',
    )
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*?TO authenticated,\s*anon;/)
  })

  it('guards both security-definer RPCs and preserves authenticated callers', () => {
    for (const name of ['generate_shop_order_no', 'delete_shop_order']) {
      const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)
      expect(start).toBeGreaterThanOrEqual(0)
      const end = migration.indexOf('\n$$;', start)
      const definition = migration.slice(start, end)

      expect(definition).toContain('SECURITY DEFINER')
      expect(definition).toContain(
        'IF NOT public.can_execute_shop_financial_rpc() THEN',
      )
      expect(definition).toContain("USING ERRCODE = '42501'")
    }

    expect(migration).toContain(
      'WHEN insufficient_privilege THEN RAISE;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.generate_shop_order_no() TO authenticated;',
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_shop_order(UUID, TEXT) TO authenticated;',
    )
  })
})
