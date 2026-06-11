import type { LiffBookingFormState, TimePreference } from './types'

const STORAGE_KEY = 'liff_book_wizard_snapshot'

export interface BookWizardSnapshot {
  step: number
  form: LiffBookingFormState
  pickDate: string
  pickTimePref: TimePreference
  showCoachSection: boolean
  showAlternateDates: boolean
}

export const RESUME_BOOK_WIZARD_STATE = { resumeBookWizard: true } as const

const RESUME_FLAG_KEY = 'liff_book_resume_wizard'
const GUIDE_RETURN_KEY = 'liff_book_guide_return'

export function markResumeBookWizard(): void {
  try {
    sessionStorage.setItem(RESUME_FLAG_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function shouldResumeBookWizard(): boolean {
  try {
    const v = sessionStorage.getItem(RESUME_FLAG_KEY)
    sessionStorage.removeItem(RESUME_FLAG_KEY)
    return v === '1'
  } catch {
    return false
  }
}

export function saveGuideReturnUrl(url: string): void {
  try {
    sessionStorage.setItem(GUIDE_RETURN_KEY, url)
  } catch {
    /* ignore */
  }
}

export function consumeGuideReturnUrl(): string | null {
  try {
    const v = sessionStorage.getItem(GUIDE_RETURN_KEY)
    sessionStorage.removeItem(GUIDE_RETURN_KEY)
    return v
  } catch {
    return null
  }
}

export function saveBookWizardSnapshot(snapshot: BookWizardSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadBookWizardSnapshot(): BookWizardSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookWizardSnapshot
    if (typeof parsed.step !== 'number' || !parsed.form) return null
    return parsed
  } catch {
    return null
  }
}

export function clearBookWizardSnapshot(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
