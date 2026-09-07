import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const customOrderMode = readFileSync(
  resolve(process.cwd(), 'migrations/227_custom_order_mode.sql'),
  'utf8',
)
const scopeRepair = readFileSync(
  resolve(process.cwd(), 'migrations/229_fix_vibes_custom_order_scope.sql'),
  'utf8',
)

describe('VIBES custom-order migration scope', () => {
  it('only converts products with explicit custom-board options', () => {
    expect(customOrderMode).toContain("option_axis ->> 'key' = 'finish'")
    expect(customOrderMode).toContain(
      "custom_field ->> 'key' = 'build_option'",
    )
  })

  it('restores regular inventory and hides only custom-order VIBES products', () => {
    expect(scopeRepair).toContain('product.is_custom_board = FALSE')
    expect(scopeRepair).toContain(
      "WHEN variant.stock > 0 THEN 'in_stock'",
    )
    expect(scopeRepair).toContain("ELSE 'sold_out'")
    expect(scopeRepair).toContain("option_axis ->> 'key' = 'finish'")
    expect(scopeRepair).toContain('SET is_public = FALSE')
    expect(scopeRepair).toContain("custom_field ->> 'key' = 'build_option'")
  })
})
