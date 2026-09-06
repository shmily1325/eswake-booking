import { describe, expect, it } from 'vitest'
import { buildCartItemId } from '../useShopCart'

describe('shop cart customization identity', () => {
  it('keeps legacy SKU identity when there are no selected options', () => {
    expect(buildCartItemId('variant-1')).toBe('variant-1')
  })

  it('separates the same SKU by customization and ignores key order', () => {
    const pink = buildCartItemId('variant-1', {
      finish: { label: '板面', value: '客製色' },
      pantone: { label: 'Pantone', value: 'PINK C' },
    })
    const reordered = buildCartItemId('variant-1', {
      pantone: { label: 'Pantone', value: 'PINK C' },
      finish: { label: '板面', value: '客製色' },
    })
    const blue = buildCartItemId('variant-1', {
      finish: { label: '板面', value: '客製色' },
      pantone: { label: 'Pantone', value: 'BLUE C' },
    })
    expect(pink).toBe(reordered)
    expect(pink).not.toBe(blue)
  })
})
