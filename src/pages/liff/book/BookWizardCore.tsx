import { useEffect, useMemo, useState } from 'react'
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
import { buildStep2SummaryLine } from './BookStep2Summary'
import { BookLineMessagePreview } from './BookLineMessagePreview'
import { BookConfirmSummary } from './BookConfirmSummary'
import { BookFollowBoatPanel } from './BookFollowBoatPanel'
import { BookStepHeader, BookStepIntro, BookLiffWizardHeader } from './BookStepHeader'
import { BookCopyrightFooter } from './BookCopyrightFooter'
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
import { step2ShowsFirstTimePrice } from './liffBookingPrices'
import { designatedCoachPrice20 } from './liffBookingCoaches'
import { buildBookingInquiry, launchBookingInquiry, renderBookingInquiryMessage } from './liffBookingMessage'
import {
  bookCard,
  bookSectionDivider,
  bookInput,
  bookNotesInput,
  confirmContactTitle,
  flatListRow,
  optionalSectionFlat,
  optionalSectionLabel,
  bookPage,
  chipBtn,
  fieldLabel,
  stepFieldPrompt,
  fieldHint,
  footerBlockHint,
  footerSoftHint,
  primaryBtn,
  secondaryBtn,
  stickyFooter,
  submitConfirmBtn,
} from './bookStyles'
import { getStepBlockReason } from './liffBookingValidation'
import { liffTrack } from '../track'
import { resolveVisitGuideUrl } from './liffBookingGuide'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

function bookStepExtras(
  step: number,
  form: LiffBookingFormState,
  options?: { dateCount?: number },
): Record<string, unknown> {
  const base = { step, ...(form.activity ? { activity: form.activity } : {}) }
  switch (step) {
    case 2:
      return {
        ...base,
        headcount: form.headcount,
        ...(form.beginnerCount != null ? { beginnerCount: form.beginnerCount } : {}),
        skillLevel: form.skillLevel,
        ...(form.boatPreference ? { boatPreference: form.boatPreference } : {}),
      }
    case 3:
      return {
        ...base,
        coachChoice: form.coachChoice,
        ...(form.coachId ? { coachId: form.coachId } : {}),
        dateCount: options?.dateCount ?? form.preferredDates.length,
      }
    default:
      return base
  }
}

const INITIAL_STATE: LiffBookingFormState = {
  activity: null,
  boatPreference: null,
  skillLevel: 'first_time',
  headcount: 1,
  beginnerCount: null,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [],
  contactName: '',
  contactPhone: '',
  notes: '',
  followBoatCount: 0,
}

function formatPreferredDateLabel(
  pd: PreferredDate,
  locale: BookLocale,
  morning: string,
  afternoon: string,
): string {
  const d = new Date(`${pd.date}T12:00:00`)
  const time = pd.timePreference === 'morning' ? morning : afternoon
  if (locale === 'en') {
    return `${d.toLocaleDateString('en', { month: 'numeric', day: 'numeric', weekday: 'short' })} ${time}`
  }
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'] as const
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）${time}`
}

export function NotEnabledView() {
  const { s } = useBookLocale()
  return (
    <div style={{ ...bookPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...bookCard, maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, fontWeight: 700, color: '#444' }}>ES</div>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>{s.notEnabled.title}</h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>{s.notEnabled.body}</p>
      </div>
    </div>
  )
}

export function BookWizardCore({
  mode,
  member = null,
  lineUserId = null,
  lineDisplayName = null,
  usePublicChrome = false,
}: {
  mode: BookWizardMode
  member?: Member | null
  lineUserId?: string | null
  lineDisplayName?: string | null
  usePublicChrome?: boolean
}) {
  const { locale, s } = useBookLocale()
  const requireLine = mode === 'liff'
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<LiffBookingFormState>(INITIAL_STATE)
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set())
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null)
  const [showCoachSection, setShowCoachSection] = useState(false)
  const [showAlternateDates, setShowAlternateDates] = useState(false)
  const [pickDate, setPickDate] = useState('')
  const [pickTimePref, setPickTimePref] = useState<TimePreference>('morning')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  useEffect(() => {
    const name = member?.nickname?.trim() || member?.name?.trim() || lineDisplayName?.trim() || ''
    const phone = member?.phone?.replace(/\D/g, '') || ''
    if (!name && !phone) return
    setForm(prev => ({
      ...prev,
      contactName: prev.contactName || name,
      contactPhone: prev.contactPhone || phone,
    }))
  }, [member, lineDisplayName])

  useEffect(() => {
    if (mode !== 'liff' || !lineUserId) return
    liffTrack({
      icon_id: `liff_book_step_view:${step}`,
      line_user_id: lineUserId,
      member_id: member?.id,
      extras: { step, mode, ...(form.activity ? { activity: form.activity } : {}) },
    })
  }, [step, lineUserId, mode, form.activity, member?.id])

  useEffect(() => {
    if (form.coachChoice !== 'designated' || !form.coachId || !form.activity) return
    const coach = coaches.find(c => c.id === form.coachId)
    if (!coach || designatedCoachPrice20(coach, form.activity) == null) {
      setForm(prev => ({ ...prev, coachId: null }))
    }
  }, [form.activity, form.coachChoice, form.coachId, coaches])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [coachRes, restrictRes] = await Promise.all([
          supabase.from('coaches').select('id, name, designated_lesson_price_30min').eq('status', 'active').order('name'),
          supabase.from('reservation_restrictions').select('start_date, end_date, start_time, end_time, is_active').eq('is_active', true),
        ])
        if (cancelled) return
        setCoaches(coachRes.data ?? [])
        setBlockedDates(buildAllDayBlockedDates(restrictRes.data ?? []))
      } catch {
        // 估算可 fallback，不阻擋流程
      }
    }
    const schedule = () => { void load() }
    const idleId = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(schedule, { timeout: 2000 })
      : undefined
    const timerId = idleId == null ? window.setTimeout(schedule, 400) : undefined
    return () => {
      cancelled = true
      if (idleId != null && typeof cancelIdleCallback !== 'undefined') cancelIdleCallback(idleId)
      if (timerId != null) window.clearTimeout(timerId)
    }
  }, [])

  const estimate = useMemo(
    () => computePriceEstimate(form, coaches, member, locale),
    [form, coaches, member, locale],
  )

  const linePreviewMessage = useMemo(
    () => renderBookingInquiryMessage(form, coaches, estimate, locale),
    [form, coaches, estimate, locale],
  )

  const syncPrimarySchedule = (date: string, timePref: TimePreference) => {
    if (!date || showAlternateDates) return
    setForm(prev => ({ ...prev, preferredDates: [{ date, timePreference: timePref }] }))
  }

  const handlePickDate = (ymd: string) => {
    setPickDate(ymd)
    if (!showAlternateDates) {
      syncPrimarySchedule(ymd, pickTimePref)
    }
  }

  const handlePickTimePref = (pref: TimePreference) => {
    setPickTimePref(pref)
    if (pickDate && !showAlternateDates) {
      syncPrimarySchedule(pickDate, pref)
    }
  }

  const addAlternateDate = () => {
    if (!pickDate) return
    triggerHaptic('light')
    setForm(prev => {
      const exists = prev.preferredDates.some(p => p.date === pickDate)
      if (exists) {
        return {
          ...prev,
          preferredDates: prev.preferredDates.map(p =>
            p.date === pickDate ? { ...p, timePreference: pickTimePref } : p,
          ),
        }
      }
      if (prev.preferredDates.length >= MAX_PREFERRED_DATES) return prev
      return {
        ...prev,
        preferredDates: [...prev.preferredDates, { date: pickDate, timePreference: pickTimePref }],
      }
    })
  }

  const removePreferredDate = (date: string) => {
    triggerHaptic('light')
    setForm(prev => ({
      ...prev,
      preferredDates: prev.preferredDates.filter(p => p.date !== date),
    }))
    if (pickDate === date) setPickDate('')
  }

  const commitSchedule = (): LiffBookingFormState['preferredDates'] => {
    if (!pickDate) return form.preferredDates
    const exists = form.preferredDates.some(p => p.date === pickDate)
    if (exists) {
      return form.preferredDates.map(p =>
        p.date === pickDate ? { ...p, timePreference: pickTimePref } : p,
      )
    }
    if (form.preferredDates.length >= MAX_PREFERRED_DATES) return form.preferredDates
    return [...form.preferredDates, { date: pickDate, timePreference: pickTimePref }]
  }

  const totalSteps = s.steps.length

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        return form.activity != null
      case 2:
        if (form.beginnerCount == null) return false
        if (form.activity === 'WB' && !form.boatPreference) return false
        return true
      case 3: {
        if (!pickDate && form.preferredDates.length === 0) return false
        if (form.coachChoice === 'designated' && !form.coachId) return false
        return true
      }
      case 4:
        return (
          form.contactName.trim().length > 0
          && form.contactPhone.replace(/\D/g, '').length >= 8
          && (!requireLine || lineUserId != null)
        )
      default: return false
    }
  }

  const goNext = () => {
    if (!canNext()) return
    triggerHaptic('light')
    let dateCount = form.preferredDates.length
    if (step === 3) {
      const dates = commitSchedule()
      dateCount = dates.length
      setForm(prev => ({ ...prev, preferredDates: dates }))
    }
    if (mode === 'liff' && lineUserId) {
      liffTrack({
        icon_id: `liff_book_step_complete:${step}`,
        line_user_id: lineUserId,
        member_id: member?.id,
        extras: bookStepExtras(step, form, { dateCount }),
      })
    }
    setStep(s => Math.min(totalSteps, s + 1))
  }

  const goBack = () => {
    triggerHaptic('light')
    if (mode === 'liff' && lineUserId) {
      liffTrack({
        icon_id: `liff_book_step_back:${step}`,
        line_user_id: lineUserId,
        member_id: member?.id,
        extras: { step, ...(form.activity ? { activity: form.activity } : {}) },
      })
    }
    setStep(s => Math.max(1, s - 1))
  }

  const handleSubmit = () => {
    if (!canNext()) return
    triggerHaptic('medium')
    const payload = buildBookingInquiry(form, coaches, member, locale)
    if (payload.stillTooLong) {
      alert(s.step4.messageTooLong)
      return
    }
    if (mode === 'liff' && lineUserId) {
      liffTrack({
        icon_id: 'liff_book_submit',
        line_user_id: lineUserId,
        member_id: member?.id,
        extras: {
          activity: form.activity,
          headcount: form.headcount,
          coachChoice: form.coachChoice,
          dateCount: form.preferredDates.length,
        },
      })
    }
    const result = launchBookingInquiry(payload)
    if (result.mode === 'desktop-fallback') setDesktopMessage(result.message)
  }

  const confirmDates = form.preferredDates.length ? form.preferredDates : commitSchedule()

  const stepReady = canNext()
  const nextLabel = getStepNextLabel(step, s.footer, stepReady)
  const blockReason = stepReady
    ? null
    : getStepBlockReason(step, form, pickDate, s.validation, lineUserId, { requireLine })
  const showFooterHint = blockReason != null && step !== 1
  const showSubmitHint = step === 4 && blockReason == null
  const step1InlineHint = step === 1 && !stepReady ? blockReason : null

  return (
    <div style={bookPage}>
      {!usePublicChrome ? <LiffStyles /> : null}
      <BookPageStyles />
      {!usePublicChrome ? <BookLiffWizardHeader step={step} /> : null}
      {usePublicChrome ? <BookStepHeader step={step} /> : null}

      <main style={{ padding: 16 }}>
        <BookStepIntro step={step} />
        {/* Step 1: 玩什麼 */}
        {step === 1 && (
          <div style={bookCard}>
            <BookEssentialsPanel
              value={form.activity}
              validationHint={step1InlineHint}
              onChange={(code: ActivityChoice | null) => setForm(prev => ({
                ...prev,
                ...(code ? syncActivityChoice(code) : clearActivityChoice()),
              }))}
            />
          </div>
        )}

        {/* Step 2: 誰要滑 */}
        {step === 2 && (
          <div style={bookCard}>
            <div style={stepFieldPrompt}>{s.step2.headcount}</div>
            <BookHeadcountStepper
              value={form.headcount}
              onChange={n => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { headcount: n }) }))}
            />

            <hr style={bookSectionDivider} aria-hidden />

            <BookExperiencePanel
              headcount={form.headcount}
              beginnerCount={form.beginnerCount}
              activity={form.activity}
              onSyncPeople={patch => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, patch) }))}
            />
            {form.activity && form.activity !== 'WB' && form.beginnerCount == null ? (
              <BookPricingLegend activity={form.activity} />
            ) : null}

            {form.activity === 'WB' ? (
              <>
                <hr style={bookSectionDivider} aria-hidden />
                <BookBoatPicker
                  value={form.boatPreference}
                  aboard={onBoatTotal(form.headcount, form.followBoatCount)}
                  onChange={pref => setForm(prev => ({ ...prev, boatPreference: pref }))}
                />
              </>
            ) : null}

            <BookFollowBoatPanel
              flat
              riders={form.headcount}
              value={form.followBoatCount}
              onChange={count => setForm(prev => ({ ...prev, followBoatCount: count }))}
            />

            <BookContextTips step={2} form={form} pickTimePref={pickTimePref} />

            {estimate ? (
              <BookEstimateCard
                key="est-2"
                estimate={estimate}
                compact
                flat
                summaryLine={buildStep2SummaryLine(form, s, null)}
                footnote={step2ShowsFirstTimePrice(form) ? s.common.priceIncludes : null}
              />
            ) : null}

            <BookStaffHint
              step={2}
              form={form}
              coaches={coaches}
              pickDate={pickDate}
              pickTimePref={pickTimePref}
              lineUserId={lineUserId}
              memberId={member?.id}
              track={mode === 'liff'}
            />
          </div>
        )}

        {/* Step 3: 什麼時候 + 教練選填 */}
        {step === 3 && (
          <div style={bookCard}>
            <BookDateCalendar
              value={pickDate}
              blockedDates={blockedDates}
              onChange={handlePickDate}
            />

            <div style={{ ...fieldLabel, marginTop: 16 }}>{s.step3.timeSlot}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIME_PREFERENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className="book-chip-btn"
                  style={{ ...chipBtn(pickTimePref === opt.value), flex: 1, padding: '12px 0' }}
                  onClick={() => handlePickTimePref(opt.value)}
                >
                  {opt.value === 'morning' ? s.step3.morning : s.step3.afternoon}
                </button>
              ))}
            </div>

            {!showAlternateDates ? (
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowAlternateDates(true) }}
                style={{
                  marginTop: 12,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  color: T.muted,
                  fontSize: ty.caption,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  display: 'block',
                  width: '100%',
                  textAlign: 'center',
                }}
              >
                {s.step3.addAlternateDates}
              </button>
            ) : (
              <div style={{ marginTop: 16 }}>
                {form.preferredDates.length > 0 ? (
                  <>
                    <div style={fieldLabel}>{s.step3.preferredDates}</div>
                    <div style={{ marginBottom: 10 }}>
                      {form.preferredDates.map((pd, i) => (
                        <div
                          key={pd.date}
                          style={{
                            ...flatListRow,
                            ...(i === form.preferredDates.length - 1 ? { borderBottom: 'none' } : {}),
                          }}
                        >
                          <span>{formatPreferredDateLabel(pd, locale, s.step3.morning, s.step3.afternoon)}</span>
                          <button
                            type="button"
                            onClick={() => removePreferredDate(pd.date)}
                            style={{
                              margin: 0,
                              padding: '4px 8px',
                              border: 'none',
                              background: 'none',
                              color: T.muted,
                              fontSize: ty.caption,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              flexShrink: 0,
                            }}
                          >
                            {s.step3.removeDate}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {pickDate && form.preferredDates.length < MAX_PREFERRED_DATES && !form.preferredDates.some(p => p.date === pickDate) ? (
                  <button
                    type="button"
                    onClick={addAlternateDate}
                    style={{
                      marginTop: 4,
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      color: T.muted,
                      fontSize: ty.caption,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      display: 'block',
                      width: '100%',
                      textAlign: 'center',
                    }}
                  >
                    {s.step3.addAlternateDates}
                  </button>
                ) : null}
                <div style={{ ...fieldHint, marginTop: 8, marginBottom: 0, textAlign: 'center' }}>{s.step3.maxDates}</div>
              </div>
            )}

            <div style={optionalSectionFlat}>
              {!showCoachSection ? (
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setShowCoachSection(true) }}
                  style={{
                    padding: '12px 0 4px',
                    border: 'none',
                    background: 'none',
                    color: T.muted,
                    fontSize: ty.body,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  {pickTimePref === 'morning' ? s.step3.addCoachMorningShort : s.step3.addCoachShort}
                </button>
              ) : (
                <>
                  <div style={{ ...optionalSectionLabel, marginTop: 8, fontSize: ty.body, color: T.inkSoft }}>{s.step3.designateCoach}</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <button
                      type="button"
                      className="book-chip-btn"
                      style={{ ...chipBtn(form.coachChoice === 'none'), flex: 1 }}
                      onClick={() => setForm(prev => ({ ...prev, coachChoice: 'none', coachId: null }))}
                    >
                      {s.step3.coachNone}
                    </button>
                    <button
                      type="button"
                      className="book-chip-btn"
                      style={{ ...chipBtn(form.coachChoice === 'designated'), flex: 1 }}
                      onClick={() => setForm(prev => ({ ...prev, coachChoice: 'designated' }))}
                    >
                      {s.step3.coachYes}
                    </button>
                  </div>
                  {form.coachChoice === 'designated' && (
                    <BookCoachPicker
                      coaches={coaches}
                      activity={form.activity}
                      value={form.coachId}
                      onChange={coachId => setForm(prev => ({ ...prev, coachId }))}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: 預約摘要 */}
        {step === 4 && (
          <>
            <div style={bookCard}>
              <BookConfirmSummary
                form={form}
                coaches={coaches}
                dates={confirmDates}
                locale={locale}
                formatDate={pd => formatPreferredDateLabel(pd, locale, s.step3.morning, s.step3.afternoon)}
              />

              {estimate ? (
                <BookEstimateCard key="est-4" estimate={estimate} confirm />
              ) : null}

              <hr style={bookSectionDivider} aria-hidden />

              <div>
                <div style={confirmContactTitle}>{s.step4.contact}</div>
                {member ? (
                  <div style={{ fontSize: ty.caption, color: T.muted, marginBottom: 10 }}>{s.step4.memberPrefill}</div>
                ) : null}
                <input
                  value={form.contactName}
                  onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                  placeholder={s.step4.namePh}
                  style={{ ...bookInput, marginBottom: 10, background: '#fff' }}
                />
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder={s.step4.phonePh}
                  style={{ ...bookInput, marginBottom: 10, background: '#fff' }}
                />
                <textarea
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={form.activity === 'BOTH' ? s.step4.notesPhBoth : s.step4.notesPh}
                  rows={3}
                  style={bookNotesInput}
                />
                <BookLineMessagePreview message={linePreviewMessage} />
              </div>
            </div>

            {usePublicChrome ? (
              <p style={{ fontSize: ty.caption, color: T.mutedLight, textAlign: 'center', margin: '0 0 12px' }}>
                <a
                  href={resolveVisitGuideUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.muted }}
                >
                  {s.step4.attireLink}
                </a>
              </p>
            ) : null}

            <LineInquiryModal
              message={desktopMessage}
              onClose={() => setDesktopMessage(null)}
            />
          </>
        )}
      </main>

      <footer style={{ ...stickyFooter, flexDirection: 'column', alignItems: 'stretch' }}>
        {showSubmitHint ? (
          <div style={footerSoftHint}>{s.step4.submitHint}</div>
        ) : null}
        {showFooterHint ? (
          <div
            style={step === 4 ? footerBlockHint : footerSoftHint}
            role="status"
          >
            {blockReason}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          {step > 1 && (
            <button type="button" style={secondaryBtn} onClick={goBack}>{s.footer.back}</button>
          )}
          {step < totalSteps ? (
            <button
              type="button"
              className="book-primary-btn"
              style={{ ...primaryBtn, opacity: stepReady ? 1 : 0.4 }}
              disabled={!stepReady}
              onClick={goNext}
            >
              {nextLabel}
            </button>
          ) : (
            <button
              type="button"
              className="book-primary-btn"
              style={{ ...submitConfirmBtn(stepReady), opacity: stepReady ? 1 : 0.4 }}
              disabled={!stepReady}
              onClick={handleSubmit}
            >
              {s.footer.submitConfirm}
            </button>
          )}
        </div>
      </footer>

      <BookCopyrightFooter />
    </div>
  )
}