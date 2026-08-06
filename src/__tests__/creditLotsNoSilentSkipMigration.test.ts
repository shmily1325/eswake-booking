import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/173_credit_lots_no_silent_year_skip.sql'),
  'utf8',
)

describe('173 credit lots no silent year skip', () => {
  it('fails tagged increase when lots cannot be written', () => {
    expect(migration).toContain('無法標年入帳')
    expect(migration).toContain("v_tx.transaction_type IS DISTINCT FROM 'adjust'")
    expect(migration).toContain('無法寫入年帳')
  })
})
