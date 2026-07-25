import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BOAT_OPERATIONS_ALLOWED_EMAILS,
  canAccessBoatOperations,
} from '../utils/boatOperationsAccess'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/158_create_boat_parts_inventory.sql'),
  'utf8',
)
const accessMigration = readFileSync(
  resolve(process.cwd(), 'migrations/160_narrow_boat_parts_access_allowlist.sql'),
  'utf8',
)
const seed = readFileSync(
  resolve(process.cwd(), 'migrations/159_seed_boat_parts_from_latest_excel.sql'),
  'utf8',
)

describe('boat parts inventory access', () => {
  it('shares the expected hard-code allowlist', () => {
    expect(BOAT_OPERATIONS_ALLOWED_EMAILS).toEqual([
      'minlin1325@gmail.com',
      'pjpan0511@gmail.com',
    ])
    expect(canAccessBoatOperations('minlin1325@gmail.com')).toBe(true)
    expect(canAccessBoatOperations('hsulittlepang2015@gmail.com')).toBe(false)
    expect(canAccessBoatOperations('callumbao1122@gmail.com')).toBe(false)
    expect(canAccessBoatOperations('other@example.com')).toBe(false)
  })

  it('enforces the allowlist and atomic stock movement in SQL', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_access_boat_parts()')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.apply_boat_part_movement(')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('Insufficient inventory')
    expect(migration).toContain('ALTER TABLE public.boat_parts ENABLE ROW LEVEL SECURITY')
    expect(accessMigration).toContain("'minlin1325@gmail.com'")
    expect(accessMigration).toContain("'pjpan0511@gmail.com'")
    expect(accessMigration).not.toContain('hsulittlepang2015@gmail.com')
    expect(accessMigration).not.toContain('callumbao1122@gmail.com')
  })
})

describe('latest workbook seed', () => {
  it('uses the workbook stock as opening truth and history as reference only', () => {
    expect(seed).toContain('boat-parts-latest-row-2')
    expect(seed).toContain("'ACME2829'")
    expect(seed).toContain("'FI23'")
    expect(seed).toContain('affects_inventory')
    expect(seed).toContain('false')
  })
})
