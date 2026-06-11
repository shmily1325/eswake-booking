import { describe, expect, it } from 'vitest'
import {
  bookLegacyRedirectResponse,
  guideLegacyRedirectResponse,
  isAllowedBookHostPath,
  isAllowedGuideHostPath,
  resolveBookHost,
  resolveGuideHost,
} from '../bookHost'

describe('bookHost', () => {
  it('resolves book and guide hosts from base URL', () => {
    expect(resolveBookHost('https://book.eswakeschool.com')).toBe('book.eswakeschool.com')
    expect(resolveGuideHost('https://guide.eswakeschool.com')).toBe('guide.eswakeschool.com')
    expect(resolveBookHost()).toBe('book.eswakeschool.com')
    expect(resolveGuideHost()).toBe('guide.eswakeschool.com')
  })

  it('allows SPA root and static assets on book host', () => {
    expect(isAllowedBookHostPath('/')).toBe(true)
    expect(isAllowedBookHostPath('/liff/book/og.webp')).toBe(true)
    expect(isAllowedBookHostPath('/assets/index.js')).toBe(true)
    expect(isAllowedBookHostPath('/members')).toBe(false)
    expect(isAllowedBookHostPath('/book/guide')).toBe(false)
  })

  it('allows SPA root on guide host', () => {
    expect(isAllowedGuideHostPath('/')).toBe(true)
    expect(isAllowedGuideHostPath('/liff/book/og-guide.webp')).toBe(true)
    expect(isAllowedGuideHostPath('/book')).toBe(false)
  })

  it('redirects legacy paths on subdomains', () => {
    const book = new URL('https://book.eswakeschool.com/book')
    expect(bookLegacyRedirectResponse(book)?.headers.get('location')).toBe('https://book.eswakeschool.com/')

    const guide = new URL('https://guide.eswakeschool.com/book/guide')
    expect(guideLegacyRedirectResponse(guide)?.headers.get('location')).toBe('https://guide.eswakeschool.com/')
  })
})
