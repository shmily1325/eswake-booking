import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/174_history_edit_all_transaction_types.sql'),
  'utf8',
)

describe('174 history edit all transaction types', () => {
  it('removes adjust-only edit/delete gates', () => {
    expect(migration).toContain('process_manual_member_adjust_edit')
    expect(migration).toContain('process_manual_member_adjust_delete')
    expect(migration).not.toContain("v_tx.transaction_type IS DISTINCT FROM 'adjust'")
    expect(migration).toContain('保留原 transaction_type')
  })

  it('auto-applies untagged lot deltas only when exactly one year', () => {
    expect(migration).toContain('resolve_credit_lot_year_for_untagged')
    expect(migration).toContain('require_voucher_year_if_multi_lot')
    expect(migration).toContain('lots_auto_year')
    expect(migration).toContain('process_manual_member_adjust(')
    expect(migration).toContain('新增選無：剛好一年有剩額→自動寫入')
    expect(migration).toContain('此會員已有年度明細，請選擇入帳年後再儲存')
    expect(migration).toContain('AND remaining <> 0')
    expect(migration).toContain('剛好一年有剩額回傳該年')
    expect(migration).toContain('此會員有跨年度明細，請選擇入帳年後再儲存')
    // 不得殘留「只寫差額」取巧（避免與整筆還原重複扣減）
    expect(migration).not.toContain('p_qty - v_old_abs')
  })
})
