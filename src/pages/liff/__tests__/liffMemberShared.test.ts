import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import liff from '@line/liff'
import {
  buildLiffLoginRedirectUri,
  buildLiffShareUrl,
  ensureLiffLoggedIn,
} from '../liffMemberShared'

vi.mock('@line/liff', () => ({
  default: {
    isLoggedIn: vi.fn(),
    isInClient: vi.fn(),
    login: vi.fn(),
  },
}))

const mockedLiff = vi.mocked(liff, true)

describe('buildLiffShareUrl', () => {
  it('builds liff.line.me URL', () => {
    expect(buildLiffShareUrl('2008652154-Pwpl0Cek')).toBe(
      'https://liff.line.me/2008652154-Pwpl0Cek',
    )
  })
})

describe('buildLiffLoginRedirectUri', () => {
  const original = window.location

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://eswake-booking.vercel.app/liff/book?x=1'),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    })
  })

  it('keeps current path when it matches endpoint prefix', () => {
    expect(buildLiffLoginRedirectUri('/liff/book')).toBe(
      'https://eswake-booking.vercel.app/liff/book?x=1',
    )
  })

  it('falls back to endpoint path when current path differs', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://eswake-booking.vercel.app/other'),
    })
    expect(buildLiffLoginRedirectUri('/liff/book')).toBe(
      'https://eswake-booking.vercel.app/liff/book',
    )
  })
})

describe('ensureLiffLoggedIn', () => {
  const reloadSpy = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    mockedLiff.isLoggedIn.mockReset()
    mockedLiff.isInClient.mockReset()
    mockedLiff.login.mockReset()
    reloadSpy.mockReset()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    })
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { type: 'navigate' } as PerformanceNavigationTiming,
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns logged_in immediately when already logged in', async () => {
    mockedLiff.isLoggedIn.mockReturnValue(true)
    await expect(ensureLiffLoggedIn()).resolves.toBe('logged_in')
    expect(mockedLiff.login).not.toHaveBeenCalled()
  })

  it('polls then succeeds in LINE client without login redirect', async () => {
    mockedLiff.isInClient.mockReturnValue(true)
    mockedLiff.isLoggedIn
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)

    const promise = ensureLiffLoggedIn()
    await vi.advanceTimersByTimeAsync(400)
    await expect(promise).resolves.toBe('logged_in')
    expect(mockedLiff.login).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('reloads once in LINE client on first cold start when still not logged in', async () => {
    mockedLiff.isInClient.mockReturnValue(true)
    mockedLiff.isLoggedIn.mockReturnValue(false)

    const promise = ensureLiffLoggedIn()
    await vi.advanceTimersByTimeAsync(2000)
    await expect(promise).resolves.toBe('reload')
    expect(mockedLiff.login).not.toHaveBeenCalled()
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('calls liff.login in external browser when not logged in', async () => {
    mockedLiff.isInClient.mockReturnValue(false)
    mockedLiff.isLoggedIn.mockReturnValue(false)

    const promise = ensureLiffLoggedIn()
    await vi.advanceTimersByTimeAsync(2000)
    await expect(promise).resolves.toBe('login_redirect')
    expect(mockedLiff.login).toHaveBeenCalledTimes(1)
    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
