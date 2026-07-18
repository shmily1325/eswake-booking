import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const rpcMigration = readFileSync(
  resolve(process.cwd(), 'migrations/148_add_membership_lifecycle_rpcs.sql'),
  'utf8',
)
const invariantMigration = readFileSync(
  resolve(process.cwd(), 'migrations/149_enforce_membership_invariants.sql'),
  'utf8',
)
const auditSql = readFileSync(
  resolve(process.cwd(), 'scripts/audit-membership-integrity.sql'),
  'utf8',
)
const backupDataSource = readFileSync(
  resolve(process.cwd(), 'src/server/backup-data.ts'),
  'utf8',
)

const rpcNames = [
  'create_member_with_membership',
  'update_member_membership',
  'renew_member_membership',
  'set_member_active_status',
] as const

function definitionFor(name: (typeof rpcNames)[number]): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
  )
  const match = rpcMigration.match(pattern)
  expect(match, `missing definition for ${name}`).not.toBeNull()
  return match?.[0] ?? ''
}

describe('membership lifecycle migrations', () => {
  it('makes every lifecycle RPC transactional and super-admin only', () => {
    expect(rpcMigration.trim().startsWith('--')).toBe(true)
    expect(rpcMigration).toContain('BEGIN;')
    expect(rpcMigration).toContain('COMMIT;')

    for (const name of rpcNames) {
      const definition = definitionFor(name)
      expect(definition).toContain('SECURITY DEFINER')
      expect(definition).toContain('PERFORM public.assert_membership_admin();')
      expect(rpcMigration).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^)]+\\) FROM PUBLIC, anon;`),
      )
      expect(rpcMigration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]+\\) TO authenticated;`),
      )
    }
    expect(rpcMigration).toContain('public.is_super_admin()')
  })

  it('locks paired rows and writes pair changes in the same function', () => {
    expect(definitionFor('update_member_membership')).toContain('FOR UPDATE')
    expect(definitionFor('update_member_membership')).toContain("membership_type = 'dual'")
    expect(definitionFor('update_member_membership')).toContain("membership_type = 'general'")
    expect(definitionFor('renew_member_membership')).toContain(
      'WHERE id IN (p_member_id, v_member.membership_partner_id)',
    )
    expect(definitionFor('set_member_active_status')).toContain(
      "SET status = 'revoked'",
    )
    for (const name of rpcNames) {
      expect(definitionFor(name)).toContain(
        "pg_advisory_xact_lock(hashtext('membership_lifecycle'))",
      )
    }
    expect(rpcMigration).toContain("AT TIME ZONE 'Asia/Taipei'")
    expect(definitionFor('create_member_with_membership')).toContain('created_at')
  })

  it('adds rollout-safe row checks and a deferred reciprocal-pair trigger', () => {
    expect(invariantMigration).toContain('members_membership_type_check')
    expect(invariantMigration).toContain('members_membership_shape_check')
    expect(invariantMigration).toContain('members_membership_date_order_check')
    expect(invariantMigration.match(/NOT VALID/g)?.length).toBeGreaterThanOrEqual(4)
    expect(invariantMigration).toContain('DEFERRABLE INITIALLY DEFERRED')
    expect(invariantMigration).toContain('Dual membership pairing must be reciprocal')
    expect(invariantMigration).toContain('must share the same end date')
    expect(invariantMigration).toContain(
      'REVOKE INSERT, DELETE, UPDATE ON TABLE members FROM authenticated',
    )
    expect(invariantMigration).toContain('GRANT UPDATE (')
    expect(invariantMigration).toContain('assert_membership_integrity')
    expect(backupDataSource).toContain('public.assert_membership_integrity()')
  })

  it('provides a read-only production audit', () => {
    const executableSql = auditSql.replace(/--.*$/gm, '')
    expect(executableSql).toContain('guest_with_membership_data')
    expect(executableSql).toContain('non_reciprocal_pair')
    expect(executableSql).toContain('dual_end_date_mismatch')
    expect(executableSql).toContain('dual_self_pair')
    expect(executableSql).toContain('dual_without_end_date')
    expect(executableSql).not.toMatch(
      /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/i,
    )
  })
})
