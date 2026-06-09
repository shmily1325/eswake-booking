import { describe, expect, it } from 'vitest'
import { isLiffPathname } from '../appBootstrap'

describe('isLiffPathname', () => {
  it('matches member area and booking paths', () => {
    expect(isLiffPathname('/liff')).toBe(true)
    expect(isLiffPathname('/liff/')).toBe(true)
    expect(isLiffPathname('/liff/book')).toBe(true)
    expect(isLiffPathname('/liff/book/')).toBe(true)
  })

  it('does not match admin or shop paths', () => {
    expect(isLiffPathname('/')).toBe(false)
    expect(isLiffPathname('/shop')).toBe(false)
    expect(isLiffPathname('/liffish')).toBe(false)
  })
})
