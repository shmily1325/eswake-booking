import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import liff from '@line/liff'
import {
  buildLiffLoginRedirectUri,
  buildLiffShareUrl,
  ensureLiffLoggedIn,
  initLiffSdk,
} from '../liffMemberShared'
import { getCurrentLiffDeepLinkSuffix } from '../liffUrl'

vi.mock('@line/liff', () => ({
  default: {
    init: vi.fn(),
    isLoggedIn: vi.fn(),
    isInClient: vi.fn(),
    login: vi.fn(),
  },
}))

const mockedLiff = vi.mocked(liff, true)

describe('initLiffSdk', () => {
  beforeEach(() => {
    mockedLiff.init.mockReset()
  })

  it('shares one in-flight initialization for the same LIFF ID', async () => {
    mockedLiff.init.mockResolvedValue(undefined)

    await Promise.all([
      initLiffSdk('member-liff-id'),
      initLiffSdk('member-liff-id'),
    ])

    expect(mockedLiff.init).toHaveBeenCalledTimes(1)
  })

  it('clears a rejected singleton so the next attempt really retries', async () => {
    mockedLiff.init.mockRejectedValue(new Error('init failed'))

    await expect(
      initLiffSdk('retry-liff-id', { retryDelaysMs: [0, 0] }),
    ).rejects.toThrow('init failed')
    expect(mockedLiff.init).toHaveBeenCalledTimes(3)

    mockedLiff.init.mockResolvedValue(undefined)
    await expect(initLiffSdk('retry-liff-id')).resolves.toBeUndefined()
    expect(mockedLiff.init).toHaveBeenCalledTimes(4)
  })
})

describe('buildLiffShareUrl', () => {
  it('builds liff.line.me URL', () => {
    expect(buildLiffShareUrl('2008652154-Pwpl0Cek')).toBe(
      'https://liff.line.me/2008652154-Pwpl0Cek',
    )
  })

  it('keeps the requested LIFF state when reopening', () => {
    const suffix = getCurrentLiffDeepLinkSuffix({
      pathname: '/liff',
      search: '?liff.state=%2Fmember%3Ftab%3Dorders',
      hash: '',
    })
    expect(buildLiffShareUrl('member-id', suffix)).toBe(
      'https://liff.line.me/member-id/member?tab=orders',
    )
  })

  it('keeps ordinary query and hash while removing OAuth technical parameters', () => {
    const suffix = getCurrentLiffDeepLinkSuffix({
      pathname: '/liff',
      search: '?tab=orders&code=secret&state=oauth-state',
      hash: '#latest',
    })
    expect(suffix).toBe('?tab=orders#latest')
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

  it('automatically continues when LINE login becomes ready near six seconds', async () => {
    mockedLiff.isInClient.mockReturnValue(true)
    let checks = 0
    mockedLiff.isLoggedIn.mockImplementation(() => {
      checks += 1
      return checks >= 8
    })

    const promise = ensureLiffLoggedIn()
    await vi.advanceTimersByTimeAsync(6400)
    await expect(promise).resolves.toBe('logged_in')
    expect(mockedLiff.login).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('shows a retryable error without reloading when LINE cold start is not ready', async () => {
    mockedLiff.isInClient.mockReturnValue(true)
    mockedLiff.isLoggedIn.mockReturnValue(false)

    const promise = ensureLiffLoggedIn()
    const expectation = expect(promise).rejects.toThrow('LINE 登入狀態尚未就緒，請點擊重試')
    await vi.advanceTimersByTimeAsync(7000)
    await expectation
    expect(mockedLiff.login).not.toHaveBeenCalled()
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('calls liff.login in external browser when not logged in', async () => {
    mockedLiff.isInClient.mockReturnValue(false)
    mockedLiff.isLoggedIn.mockReturnValue(false)

    const promise = ensureLiffLoggedIn()
    await vi.advanceTimersByTimeAsync(7000)
    await expect(promise).resolves.toBe('login_redirect')
    expect(mockedLiff.login).toHaveBeenCalledTimes(1)
    expect(reloadSpy).not.toHaveBeenCalled()
  })
})
