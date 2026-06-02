import { describe, expect, it } from 'vitest'
import { formatShopOrderRpcError } from '../shopOrderRpcErrors'

describe('formatShopOrderRpcError', () => {
  it('maps exact RPC messages', () => {
    expect(formatShopOrderRpcError('訂單已作廢')).toContain('已作廢')
    expect(formatShopOrderRpcError('扣儲值需指定會員')).toContain('會員')
  })

  it('maps stock insufficient with available count', () => {
    const msg = formatShopOrderRpcError(
      '現貨不足，無法送結帳（品項 abc-123，可售 2）',
    )
    expect(msg).toContain('最多 2 件')
    expect(msg).not.toContain('abc-123')
  })

  it('maps settle full pending qty', () => {
    const msg = formatShopOrderRpcError(
      'v1 需整批結清待結帳數量（品項 x：待結帳 3，傳入 1）',
    )
    expect(msg).toContain('一次結清')
    expect(msg).toContain('3')
  })

  it('maps submit qty over open', () => {
    expect(formatShopOrderRpcError('送結帳數量超過未送出的訂量（品項 x）')).toContain(
      '未送',
    )
  })

  it('uses fallback for unknown english errors', () => {
    expect(formatShopOrderRpcError('SQLSTATE 23505 duplicate key')).toBe('失敗')
  })
})
