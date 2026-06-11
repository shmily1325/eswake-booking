const fs = require('fs')
const path = require('path')

const srcPath = path.join(__dirname, '_LiffBook.backup.tsx')
const src = fs.readFileSync(srcPath, 'utf8')

const helpersStart = src.indexOf('function bookStepExtras')
const wrappersStart = src.indexOf('export function LiffBook()')
const coreStart = src.indexOf('function BookWizardCore')

if (helpersStart < 0 || wrappersStart < 0 || coreStart < 0) {
  console.error('split markers missing', { helpersStart, wrappersStart, coreStart })
  process.exit(1)
}

const helpersBlock = src.slice(helpersStart, wrappersStart)
const coreStartInHelpers = helpersBlock.indexOf('function NotEnabledView')
const helpersOnly = helpersBlock.slice(0, coreStartInHelpers).trim()
let notEnabled = helpersBlock.slice(coreStartInHelpers).trim()
notEnabled = notEnabled.replace('function NotEnabledView', 'export function NotEnabledView')

let core = src.slice(coreStart)
core = core.replace(
  /member\?: ReturnType<typeof useLiffMember>\['member'\]/,
  'member?: Member | null',
)
core = core.replace('function BookWizardCore', 'export function BookWizardCore')

const guidePattern = /<p style=\{\{ fontSize: ty\.caption[\s\S]*?<\/p>\s*\n\s*<LineInquiryModal/
const guideNew = `<p style={{ fontSize: ty.caption, color: T.mutedLight, textAlign: 'center', margin: '0 0 12px' }}>
              <a
                href={resolveVisitGuideUrl()}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: T.muted }}
              >
                {s.step4.attireLink}
              </a>
            </p>

            <LineInquiryModal`
if (!guidePattern.test(core)) {
  console.warn('guide link pattern not found; skipping replace')
} else {
  core = core.replace(guidePattern, guideNew)
}

const header = `import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { buildAllDayBlockedDates } from './liffBookingDates'
import { triggerHaptic } from '../../../utils/haptic'
import { LiffStyles } from '../components/LiffStyles'
import { BookPageStyles } from './BookPageStyles'
import { BookEssentialsPanel } from './BookEssentialsPanel'
import { BookEstimateCard } from './BookEstimateCard'
import { BookExperiencePanel } from './BookExperiencePanel'
import { BookHeadcountStepper } from './BookHeadcountStepper'
import { BookPricingLegend } from './BookPricingLegend'
import { BookStep2PriceSummary } from './BookStep2PriceSummary'
import { BookStep2Summary } from './BookStep2Summary'
import { BookConfirmSummary } from './BookConfirmSummary'
import { BookFollowBoatPanel } from './BookFollowBoatPanel'
import { BookStepHeader } from './BookStepHeader'
import { BookContextTips } from './BookContextTips'
import { BookBoatPicker } from './BookBoatPicker'
import { BookStaffHint } from './BookStaffHint'
import { LineInquiryModal } from '../../shop/components/LineInquiryModal'
import { BookDateCalendar } from './BookDateCalendar'
import { BookCoachPicker } from './BookCoachPicker'
import { useBookLocale } from './BookLocaleContext'
import type { BookWizardMode } from './bookWizardTypes'
import type {
  ActivityChoice,
  CoachOption,
  LiffBookingFormState,
  PreferredDate,
  TimePreference,
} from './types'
import type { Member } from '../types'
import { getStepNextLabel, type BookLocale } from './liffBookingI18n'
import {
  MAX_PREFERRED_DATES,
  syncBookingPeople,
  TIME_PREFERENCE_OPTIONS,
  syncActivityChoice,
  clearActivityChoice,
} from './liffBookingConfig'
import { onBoatTotal } from './liffBookingBoats'
import { computePriceEstimate } from './liffBookingPricing'
import { designatedCoachPrice20 } from './liffBookingCoaches'
import { buildBookingInquiry, launchBookingInquiry } from './liffBookingMessage'
import {
  bookCard,
  bookFieldGroup,
  bookInput,
  listItemRow,
  optionalSectionLabel,
  bookPage,
  chipBtn,
  fieldLabel,
  stepFieldPrompt,
  fieldHint,
  footerBlockHint,
  linePrimaryBtn,
  primaryBtn,
  secondaryBtn,
  stickyFooter,
} from './bookStyles'
import { getStepBlockReason } from './liffBookingValidation'
import { liffTrack } from '../track'
import { resolveVisitGuideUrl } from './liffBookingGuide'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

`

const out = header + helpersOnly + '\n\n' + notEnabled + '\n\n' + core
fs.writeFileSync(path.join(__dirname, '../src/pages/liff/book/BookWizardCore.tsx'), out)

const liffBook = `import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { useLiffMember } from '../useLiffMember'
import { ErrorView } from '../components/ErrorView'
import { BookBootScreen } from './BookBootScreen'
import { BookBindingGate } from './BookBindingGate'
import { BookLocaleProvider } from './BookLocaleContext'
import type { BookWizardMode } from './bookWizardTypes'
import { isLiffBookEnabled, resolveLiffBookId } from './liffBookingConfig'
import { BookWizardCore, NotEnabledView } from './BookWizardCore'

export function LiffBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff/book'])
  return (
    <BookLocaleProvider>
      <LiffBookInner mode="liff" />
    </BookLocaleProvider>
  )
}

function LiffBookInner({ mode }: { mode: BookWizardMode }) {
  const {
    loading: liffLoading,
    bootPhase: liffBootPhase,
    error: liffError,
    member,
    lineUserId,
    lineDisplayName,
    shouldShowBindingForm,
    bindingFormProps,
    skipBinding,
    retryInit,
  } = useLiffMember({
    requireBinding: false,
    trackIconId: 'liff_book_open',
    liffId: resolveLiffBookId(),
    nonBlockingBinding: true,
    readyBeforeProfile: true,
    lightMember: true,
  })

  if (!isLiffBookEnabled()) return <NotEnabledView />
  if (liffError) return <ErrorView error={liffError} onRetry={() => void retryInit()} />
  if (liffLoading) {
    return (
      <BookBootScreen
        phase={liffBootPhase}
        onRetry={() => void retryInit()}
      />
    )
  }
  if (mode === 'liff' && shouldShowBindingForm) {
    return <BookBindingGate {...bindingFormProps} onSkip={skipBinding} />
  }

  return (
    <BookWizardCore
      mode={mode}
      member={member}
      lineUserId={lineUserId}
      lineDisplayName={lineDisplayName}
    />
  )
}
`

const publicBook = `import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { BookHeader } from '../../book/BookHeader'
import { BookLayout } from '../../book/BookLayout'
import { BookLocaleProvider } from './BookLocaleContext'
import { isLiffBookEnabled } from './liffBookingConfig'
import { BookWizardCore, NotEnabledView } from './BookWizardCore'

export function PublicBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/book'])
  return (
    <BookLocaleProvider>
      <BookLayout>
        <BookHeader />
        {isLiffBookEnabled() ? (
          <BookWizardCore mode="public" usePublicChrome />
        ) : (
          <NotEnabledView />
        )}
      </BookLayout>
    </BookLocaleProvider>
  )
}
`

fs.writeFileSync(path.join(__dirname, '../src/pages/liff/book/LiffBook.tsx'), liffBook)
fs.writeFileSync(path.join(__dirname, '../src/pages/liff/book/PublicBook.tsx'), publicBook)
console.log('split complete', { coreChars: core.length })
