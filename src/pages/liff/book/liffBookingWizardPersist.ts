import type { LiffBookingFormState, TimePreference } from './types'

const STORAGE_KEY = 'liff_book_wizard_snapshot'
const RESUME_FLAG_KEY = 'liff_book_resume_wizard'
const GUIDE_RETURN_KEY = 'liff_book_guide_return'

/** book / guide 子網域共用 cookie（sessionStorage 無法跨 origin） */
const SHARED_COOKIE_DOMAIN = '.eswakeschool.com'
const COOKIE_TTL_SEC = 3600

export interface BookWizardSnapshot {
  step: number
  form: LiffBookingFormState
  pickDate: string
  pickTimePref: TimePreference
  showCoachSection: boolean
  showAlternateDates: boolean
}

export const RESUME_BOOK_WIZARD_STATE = { resumeBookWizard: true } as const

function canUseSharedCookies(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'eswakeschool.com' || h.endsWith('.eswakeschool.com')
}

function setSharedCookie(key: string, value: string): void {
  if (!canUseSharedCookies()) return
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie =
      `${key}=${encodeURIComponent(value)}; domain=${SHARED_COOKIE_DOMAIN}; path=/; max-age=${COOKIE_TTL_SEC}; SameSite=Lax${secure}`
  } catch {
    /* ignore */
  }
}

function getSharedCookie(key: string): string | null {
  if (!canUseSharedCookies()) return null
  try {
    const prefix = `${key}=`
    for (const part of document.cookie.split(';')) {
      const trimmed = part.trim()
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length))
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function clearSharedCookie(key: string): void {
  if (!canUseSharedCookies()) return
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie =
      `${key}=; domain=${SHARED_COOKIE_DOMAIN}; path=/; max-age=0; SameSite=Lax${secure}`
  } catch {
    /* ignore */
  }
}

function readDual(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? getSharedCookie(key)
  } catch {
    return getSharedCookie(key)
  }
}

function writeDual(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
  setSharedCookie(key, value)
}

function removeDual(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
  clearSharedCookie(key)
}

export function markResumeBookWizard(): void {
  writeDual(RESUME_FLAG_KEY, '1')
}

export function shouldResumeBookWizard(): boolean {
  const v = readDual(RESUME_FLAG_KEY)
  if (v !== '1') return false
  removeDual(RESUME_FLAG_KEY)
  return true
}

/** URL query `?resume=1`（跨子網域返回時帶上） */
export function shouldResumeFromQuery(search: string): boolean {
  return new URLSearchParams(search).get('resume') === '1'
}

export function saveGuideReturnUrl(url: string): void {
  writeDual(GUIDE_RETURN_KEY, url)
}

export function peekGuideReturnUrl(): string | null {
  return readDual(GUIDE_RETURN_KEY)
}

export function consumeGuideReturnUrl(): string | null {
  const v = readDual(GUIDE_RETURN_KEY)
  if (v) removeDual(GUIDE_RETURN_KEY)
  return v
}

/** 跨子網域進 guide 時，在 URL 帶上返回預約表位址 */
export function guideUrlWithReturn(guideUrl: string, returnUrl: string): string {
  try {
    const url = new URL(guideUrl)
    url.searchParams.set('return', returnUrl)
    return url.toString()
  } catch {
    return guideUrl
  }
}

export function parseGuideReturnFromSearch(search: string): string | null {
  const v = new URLSearchParams(search).get('return')
  return v || null
}

export function bookReturnUrlWithResume(returnUrl: string): string {
  try {
    const url = new URL(returnUrl)
    url.searchParams.set('resume', '1')
    return url.toString()
  } catch {
    return returnUrl
  }
}

export function saveBookWizardSnapshot(snapshot: BookWizardSnapshot): void {
  writeDual(STORAGE_KEY, JSON.stringify(snapshot))
}

export function loadBookWizardSnapshot(): BookWizardSnapshot | null {
  try {
    const raw = readDual(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookWizardSnapshot
    if (typeof parsed.step !== 'number' || !parsed.form) return null
    return parsed
  } catch {
    return null
  }
}

export function clearBookWizardSnapshot(): void {
  removeDual(STORAGE_KEY)
}
