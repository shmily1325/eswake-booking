import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/141_harden_shop_financial_rpc_authorization.sql'),
  'utf8',
)
const auditSql = readFileSync(
  resolve(process.cwd(), 'scripts/audit-shop-financial-rpcs.sql'),
  'utf8',
)
const rollbackSql = readFileSync(
  resolve(process.cwd(), 'scripts/rollback-141-shop-financial-rpc-authorization.sql'),
  'utf8',
)

const rpcNames = [
  'submit_shop_order_billing',
  'cancel_shop_order_billing',
  'settle_shop_order',
  'adjust_shop_order_settlement',
  'void_shop_order',
] as const

function definitionFor(name: (typeof rpcNames)[number]): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
  )
  const match = migration.match(pattern)
  expect(match, `missing definition for ${name}`).not.toBeNull()
  return match?.[0] ?? ''
}

describe('shop financial RPC authorization migration', () => {
  it('keeps every existing RPC name and guards it with the staff helper', () => {
    for (const name of rpcNames) {
      const definition = definitionFor(name)
      expect(definition).toContain('SECURITY DEFINER')
      expect(definition).toContain('IF NOT public.can_execute_shop_financial_rpc() THEN')
      expect(definition).toContain("USING ERRCODE = '42501'")
      expect(definition).toContain('WHEN insufficient_privilege THEN RAISE;')
    }
    expect(migration).toContain(
      "SELECT auth.role() = 'authenticated' AND public.is_allowed_staff()",
    )
  })

  it('removes implicit PUBLIC and anon execution while preserving authenticated calls', () => {
    for (const name of rpcNames) {
      expect(migration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${name}\\([^)]+\\) FROM PUBLIC, anon;`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]+\\) TO authenticated;`,
        ),
      )
    }
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*?TO authenticated,\s*anon;/)
  })

  it('uses JWT identity instead of caller-supplied audit identity', () => {
    expect(definitionFor('settle_shop_order')).toContain(
      'v_operator_id := COALESCE(auth.uid(), p_operator_id);',
    )
    expect(definitionFor('settle_shop_order')).toContain(
      "NULLIF(lower(auth.jwt() ->> 'email'), ''),",
    )
    expect(definitionFor('void_shop_order')).toContain('updated_by = v_operator_email')
    expect(migration).not.toContain('SET updated_by = NULLIF(trim(p_operator_email)')
  })

  it('provides a read-only production preflight query', () => {
    const executableSql = auditSql.replace(/--.*$/gm, '')
    expect(executableSql).toContain('has_function_privilege')
    expect(executableSql).toContain('pg_get_functiondef')
    expect(executableSql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/i,
    )
  })

  it('includes an explicit emergency rollback for staff lockout', () => {
    expect(rollbackSql).toContain('CREATE OR REPLACE FUNCTION public.can_execute_shop_financial_rpc()')
    expect(rollbackSql).toContain("SELECT auth.role() = 'authenticated'")
    for (const name of rpcNames) {
      expect(rollbackSql).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]+\\) FROM PUBLIC, anon;`),
      )
      expect(rollbackSql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]+\\) TO authenticated;`),
      )
    }
    expect(rollbackSql).not.toMatch(/\bTO PUBLIC,\s*anon\b/)
  })
})
