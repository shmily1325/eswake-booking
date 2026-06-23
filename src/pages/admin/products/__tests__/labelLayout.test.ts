import { describe, expect, it } from 'vitest'
import { mmToPx } from '../labelLayout'

describe('mmToPx', () => {
  it('converts 40mm at 203 DPI to ~320px', () => {
    expect(mmToPx(40, 203)).toBe(320)
  })

  it('converts 30mm at 203 DPI to ~240px', () => {
    expect(mmToPx(30, 203)).toBe(240)
  })
})
