import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { buildAllDayBlockedDates } from './liffBookingDates'
import { triggerHaptic } from '../../../utils/haptic'
import { useLiffMember } from '../useLiffMember'
import { ErrorView } from '../components/ErrorView'
import { LiffStyles } from '../components/LiffStyles'
import { BookBootScreen } from './BookBootScreen'
import { BookPageStyles } from './BookPageStyles'
import { BookBindingGate } from './BookBindingGate'
import { BookEssentialsPanel } from './BookEssentialsPanel'
import { BookEstimateCard } from './BookEstimateCard'
import { BookFollowBoatPanel } from './BookFollowBoatPanel'
import { BookStepHeader } from './BookStepHeader'
import { BookContextTips } from './BookContextTips'
import { BookBoatPicker } from './BookBoatPicker'
import { BookStaffHint } from './BookStaffHint'
import { BookDateCalendar } from './BookDateCalendar'
import { BookCoachPicker } from './BookCoachPicker'
import { BookLocaleProvider, useBookLocale } from './BookLocaleContext'
import { activityTitleLabel } from './liffBookingI18n'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import type {
  CoachOption,
  LiffBookingFormState,
  PreferredDate,
  TimePreference,
} from './types'
import type { BookLocale } from './liffBookingI18n'
import {
  beginnerCountOptions,
  HEADCOUNT_OPTIONS,
  MAX_PREFERRED_DATES,
  syncBookingPeople,
  TIME_PREFERENCE_OPTIONS,
  getActivityInfo,
  isBothActivities,
  isLiffBookEnabled,
  syncActivityChoice,
  resolveLiffBookId,
} from './liffBookingConfig'
import { boatLayoutLabel, onBoatTotal, wbNeedsLargeGroupBoatChoice } from './liffBookingBoats'
import { bookMemberRate } from './liffBookingPrices'
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
  experienceChipBtn,
  experienceChipNote,
  experienceChipTitle,
  fieldLabel,
  fieldHint,
  footerBlockHint,
  linePrimaryBtn,
  primaryBtn,
  secondaryBtn,
  stickyFooter,
} from './bookStyles'
import { getStepBlockReason } from './liffBookingValidation'
import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { liffTrack } from '../track'
import { OFFICIAL_INFO_URL } from './liffBookingContent'
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
  beginnerCount: 1,
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

function NotEnabledView() {
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

export function LiffBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff/book'])
  return (
    <BookLocaleProvider>
      <LiffBookInner />
    </BookLocaleProvider>
  )
}

function LiffBookInner() {
  const { locale, s } = useBookLocale()

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

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<LiffBookingFormState>(INITIAL_STATE)
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set())
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null)
  const [showCoachSection, setShowCoachSection] = useState(false)
  const [pickDate, setPickDate] = useState('')
  const [pickTimePref, setPickTimePref] = useState<TimePreference>('morning')

  useEffect(() => {
    if (step === 2 && form.beginnerCount == null) {
      setForm(prev => ({ ...prev, ...syncBookingPeople(prev, {}) }))
    }
  }, [step, form.beginnerCount])

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

  const wizardReady = !liffLoading && !liffError && !shouldShowBindingForm

  useEffect(() => {
    if (!wizardReady || !lineUserId) return
    liffTrack({
      icon_id: `liff_book_step_view:${step}`,
      line_user_id: lineUserId,
      member_id: member?.id,
      extras: { step, ...(form.activity ? { activity: form.activity } : {}) },
    })
  }, [step, wizardReady, lineUserId])

  useEffect(() => {
    if (form.coachChoice !== 'designated' || !form.coachId || !form.activity) return
    const coach = coaches.find(c => c.id === form.coachId)
    if (!coach || designatedCoachPrice20(coach, form.activity) == null) {
      setForm(prev => ({ ...prev, coachId: null }))
    }
  }, [form.activity, form.coachChoice, form.coachId, coaches])

  useEffect(() => {
    if (!wizardReady) return
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
  }, [wizardReady])

  const estimate = useMemo(
    () => computePriceEstimate(form, coaches, member, locale),
    [form, coaches, member, locale],
  )

  const totalSteps = s.steps.length

  const addPreferredDate = () => {
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
  }

  const canAddPreferredDate = Boolean(pickDate) && (
    form.preferredDates.some(p => p.date === pickDate)
    || form.preferredDates.length < MAX_PREFERRED_DATES
  )

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
          && lineUserId != null
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
    if (lineUserId) {
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
    if (lineUserId) {
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
    if (!lineUserId || !canNext()) return
    triggerHaptic('medium')
    const payload = buildBookingInquiry(form, coaches, member, locale)
    if (payload.stillTooLong) {
      alert(s.step4.messageTooLong)
      return
    }
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
    const result = launchBookingInquiry(payload)
    if (result.mode === 'desktop-fallback') setDesktopMessage(result.message)
  }

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
  if (shouldShowBindingForm) {
    return <BookBindingGate {...bindingFormProps} onSkip={skipBinding} />
  }

  const selectedActivity =
    form.activity && !isBothActivities(form.activity) ? getActivityInfo(form.activity) : null
  const memberRate = bookMemberRate(member?.membership_type)
  const nextLabel = step === totalSteps
    ? s.footer.submitLine
    : step === 3
      ? s.footer.confirm
      : s.footer.next

  const stepReady = canNext()
  const blockReason = stepReady ? null : getStepBlockReason(step, form, pickDate, s.validation, lineUserId)

  return (
    <div style={bookPage}>
      <LiffStyles />
      <BookPageStyles />
      <BookStepHeader step={step} />

      <main style={{ padding: 16 }}>
        {/* Step 1: 玩什麼 */}
        {step === 1 && (
          <div style={bookCard}>
            <BookEssentialsPanel
              memberRate={memberRate}
              value={form.activity}
              onChange={code => setForm(prev => ({ ...prev, ...syncActivityChoice(code) }))}
            />
            <BookStaffHint step={1} form={form} coaches={coaches} pickDate={pickDate} pickTimePref={pickTimePref} lineUserId={lineUserId} memberId={member?.id} />
          </div>
        )}

        {/* Step 2: 誰要滑 */}
        {step === 2 && (
          <div style={bookCard}>
            {estimate && <BookEstimateCard key="est-2" estimate={estimate} defaultExpanded />}

            <div style={bookFieldGroup}>
              <div style={{ marginBottom: 16 }}>
                <div style={fieldLabel}>{s.step2.headcount}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {HEADCOUNT_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      className="book-chip-btn"
                      style={{ ...chipBtn(form.headcount === n), flex: '1 1 calc(20% - 8px)', minWidth: 52, padding: '12px 0' }}
                      onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { headcount: n }) }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {form.activity === 'WB' && (
                <div style={{ marginBottom: 16 }}>
                  <BookBoatPicker
                    variant={wbNeedsLargeGroupBoatChoice(form.activity, form.headcount, form.followBoatCount) ? 'largeGroup' : 'step1'}
                    value={form.boatPreference}
                    headcount={onBoatTotal(form.headcount, form.followBoatCount)}
                    onChange={pref => setForm(prev => ({ ...prev, boatPreference: pref }))}
                  />
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                {form.headcount === 1 ? (
                  <>
                    <div style={fieldLabel}>{s.step2.experienceSingle}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                      <button
                        type="button"
                        className="book-chip-btn"
                        style={experienceChipBtn(form.beginnerCount === 1)}
                        onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: 1 }) }))}
                      >
                        <div style={experienceChipTitle}>{s.step2.firstTime}</div>
                        <div style={experienceChipNote(form.beginnerCount === 1)}>
                          <div>{s.step2.firstTimeLand}</div>
                          <div>{s.step2.firstTimeWater}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="book-chip-btn"
                        style={experienceChipBtn(form.beginnerCount === 0)}
                        onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: 0 }) }))}
                      >
                        <div style={experienceChipTitle}>{s.step2.experienced}</div>
                        <div style={experienceChipNote(form.beginnerCount === 0)}>
                          {s.step2.experiencedNote}
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={fieldLabel}>{s.step2.experienceMulti}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {beginnerCountOptions(form.headcount).map(n => (
                        <button
                          key={n}
                          type="button"
                          className="book-chip-btn"
                          style={chipBtn(form.beginnerCount === n)}
                          onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: n }) }))}
                        >
                          {n === form.headcount ? s.step2.allFirstTime : n === 0 ? s.step2.noneFirstTime : s.step2.nFirstTime(n)}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <div style={optionalSectionLabel}>{s.step2.optionalLabel}</div>
              <BookFollowBoatPanel
                riders={form.headcount}
                value={form.followBoatCount}
                onChange={count => setForm(prev => ({ ...prev, followBoatCount: count }))}
              />
            </div>

            <BookContextTips step={2} form={form} pickTimePref={pickTimePref} />
          </div>
        )}

        {/* Step 3: 什麼時候 + 教練選填 */}
        {step === 3 && (
          <div style={bookCard}>
            {estimate && <BookEstimateCard key="est-3" estimate={estimate} />}

            <div style={bookFieldGroup}>
            <BookDateCalendar
              value={pickDate}
              blockedDates={blockedDates}
              onChange={setPickDate}
            />

            <div style={{ ...fieldLabel, marginTop: 16 }}>{s.step3.timeSlot}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIME_PREFERENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className="book-chip-btn"
                  style={{ ...chipBtn(pickTimePref === opt.value), flex: 1, padding: '12px 0' }}
                  onClick={() => setPickTimePref(opt.value)}
                >
                  {opt.value === 'morning' ? s.step3.morning : s.step3.afternoon}
                </button>
              ))}
            </div>
            <div style={fieldHint}>{s.step3.scheduleNote}</div>

            {(form.preferredDates.length > 0 || pickDate) && (
              <div style={{ marginTop: 16 }}>
                {form.preferredDates.length > 0 ? (
                  <>
                    <div style={fieldLabel}>{s.step3.preferredDates}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {form.preferredDates.map(pd => (
                        <div key={pd.date} style={listItemRow}>
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
                            }}
                          >
                            {s.step3.removeDate}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {pickDate ? (
                  <button
                    type="button"
                    onClick={addPreferredDate}
                    disabled={!canAddPreferredDate}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px dashed #ccc',
                      borderRadius: 10,
                      background: 'white',
                      color: canAddPreferredDate ? T.inkSoft : T.mutedLight,
                      fontSize: ty.body,
                      fontWeight: 600,
                      cursor: canAddPreferredDate ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {s.step3.addDateBtn}
                  </button>
                ) : null}
                <div style={{ ...fieldHint, marginTop: 8, marginBottom: 0 }}>{s.step3.maxDates}</div>
              </div>
            )}
            </div>

            {!showCoachSection ? (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setShowCoachSection(true) }}
                  style={{
                    padding: 0, border: 'none', background: 'none',
                    color: T.muted, fontSize: ty.body, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  {s.step3.addCoach}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={optionalSectionLabel}>{s.step3.designateCoach}</div>
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
              </div>
            )}

            <BookContextTips step={3} form={form} pickTimePref={pickTimePref} coachSectionOpen={showCoachSection} />

            <BookStaffHint step={3} form={form} coaches={coaches} pickDate={pickDate} pickTimePref={pickTimePref} lineUserId={lineUserId} memberId={member?.id} />
          </div>
        )}

        {/* Step 4: 確認 */}
        {step === 4 && (
          <>
            <div style={bookCard}>
              {estimate && <BookEstimateCard key="est-4" estimate={estimate} defaultExpanded />}

              <div style={bookFieldGroup}>
                {isBothActivities(form.activity) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <BookBothIcons size={32} style={{ margin: 0 }} />
                    <div style={{ fontSize: ty.title, fontWeight: 700, color: T.ink }}>{s.step1.bothShort}</div>
                  </div>
                ) : selectedActivity ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <BookActivityIcon code={selectedActivity.code} size={40} style={{ margin: 0 }} />
                    <div style={{ fontSize: ty.title, fontWeight: 700, color: T.ink }}>{activityTitleLabel(selectedActivity.code, locale)}</div>
                  </div>
                ) : null}
                <div style={{ fontSize: ty.body, lineHeight: 1.85, color: T.inkSoft }}>
                  <div>
                    {form.headcount} {s.step4.people} · {s.step2.experienceSummary(form.headcount, form.beginnerCount)}
                    {form.followBoatCount > 0 ? ` · ${s.step4.followBoatSummary(form.followBoatCount)}` : ''}
                  </div>
                  {form.followBoatCount > 0 ? (
                    <div>{s.step4.onBoatTotal}：{s.step4.onBoatTotalSummary(form.headcount, form.followBoatCount)}</div>
                  ) : null}
                  {form.activity ? (
                    <div>{s.step4.boat}: {boatLayoutLabel(form.activity, form.headcount, form.boatPreference, locale, form.followBoatCount)}</div>
                  ) : null}
                  <div>
                    {(form.preferredDates.length ? form.preferredDates : commitSchedule()).map(p =>
                      `${p.date.slice(5).replace('-', '/')} ${p.timePreference === 'morning' ? s.step3.morning : s.step3.afternoon}`,
                    ).join(locale === 'zh' ? '、' : ', ')}
                  </div>
                  <div>
                    {s.step4.coach}: {form.coachChoice === 'designated' ? coaches.find(c => c.id === form.coachId)?.name ?? '—' : s.step4.coachNone}
                  </div>
                </div>
                {estimate ? (
                  <p style={{ fontSize: ty.caption, color: T.muted, margin: '10px 0 0', lineHeight: 1.5 }}>
                    {s.step4.confirmNote}
                  </p>
                ) : null}
              </div>

              <div style={{ ...bookFieldGroup, marginBottom: 0 }}>
                <div style={fieldLabel}>{s.step4.contact}</div>
                {member ? (
                  <div style={{ fontSize: ty.caption, color: T.muted, marginBottom: 10 }}>{s.step4.memberPrefill}</div>
                ) : null}
                <input
                  value={form.contactName}
                  onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                  placeholder={s.step4.namePh}
                  style={{ ...bookInput, marginBottom: 10 }}
                />
                <input
                  type="tel"
                  value={form.contactPhone}
                  onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder={s.step4.phonePh}
                  style={{ ...bookInput, marginBottom: 10 }}
                />
                <input
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={form.activity === 'BOTH' ? s.step4.notesPhBoth : s.step4.notesPh}
                  style={bookInput}
                />
              </div>
            </div>

            <p style={{ fontSize: ty.caption, color: T.muted, margin: '0 0 10px', lineHeight: 1.5, textAlign: 'center' }}>
              {s.step4.submitHint}
            </p>

            <p style={{ fontSize: ty.caption, color: T.mutedLight, textAlign: 'center', margin: '0 0 12px' }}>
              <a href={OFFICIAL_INFO_URL} target="_blank" rel="noopener noreferrer" style={{ color: T.muted }}>
                {s.step4.attireLink}
              </a>
            </p>

            {desktopMessage && (
              <div style={bookCard}>
                <p style={{ fontSize: ty.body, margin: '0 0 8px' }}>{s.step4.desktopCopy}</p>
                <textarea readOnly value={desktopMessage} rows={6} style={{ width: '100%', fontSize: ty.body, boxSizing: 'border-box' }} />
              </div>
            )}
          </>
        )}
      </main>

      <footer style={{ ...stickyFooter, flexDirection: 'column', alignItems: 'stretch' }}>
        {blockReason ? (
          <div style={footerBlockHint} role="status">{blockReason}</div>
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
              style={{ ...linePrimaryBtn, opacity: stepReady ? 1 : 0.4 }}
              disabled={!stepReady}
              onClick={handleSubmit}
            >
              {s.footer.submitLine}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}