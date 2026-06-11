import { describe, expect, it } from 'vitest'
import { resolveAppEntry } from '../appEntry'

describe('resolveAppEntry', () => {
  it('routes LIFF paths', () => {
    expect(resolveAppEntry('/liff/book', 'eswake-booking.vercel.app')).toBe('liff')
  })

  it('routes book subdomain and /book', () => {
    expect(resolveAppEntry('/', 'book.eswakeschool.com')).toBe('public-book')
    expect(resolveAppEntry('/book', 'eswake-booking.vercel.app')).toBe('public-book')
  })

  it('routes guide subdomain and /book/guide', () => {
    expect(resolveAppEntry('/', 'guide.eswakeschool.com')).toBe('public-guide')
    expect(resolveAppEntry('/book/guide', 'eswake-booking.vercel.app')).toBe('public-guide')
  })

  it('defaults to full app for admin', () => {
    expect(resolveAppEntry('/', 'eswake-booking.vercel.app')).toBe('full')
    expect(resolveAppEntry('/members', 'eswake-booking.vercel.app')).toBe('full')
  })
})
