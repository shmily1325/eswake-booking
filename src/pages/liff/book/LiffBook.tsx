import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { buildAllDayBlockedDates } from './liffBookingDates'
import { triggerHaptic } from '../../../utils/haptic'
import { useLiffMember } from '../useLiffMember'
import { ErrorView, LiffStyles } from '../components'
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
  TimePreference,
} from './types'
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
  bookInput,
  bookPage,
  chipBtn,
  fieldLabel,
  fieldHint,
  linePrimaryBtn,
  primaryBtn,
  secondaryBtn,
  stickyFooter,
} from './bookStyles'
import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { liffTrack } from '../track'
import { OFFICIAL_INFO_URL } from './liffBookingContent'

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
    shouldShowBindingForm,
    bindingFormProps,
    skipBinding,
    retryInit,
  } = useLiffMember({
    requireBinding: false,
    trackIconId: 'liff_book_open',
    liffId: resolveLiffBookId(),
    nonBlockingBinding: true,
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
    if (member) {
      setForm(prev => ({
        ...prev,
        contactName: prev.contactName || member.name,
        contactPhone: prev.contactPhone || member.phone?.replace(/\D/g, '') || '',
      }))
    }
  }, [member])

  useEffect(() => {
    if (form.coachChoice !== 'designated' || !form.coachId || !form.activity) return
    const coach = coaches.find(c => c.id === form.coachId)
    if (!coach || designatedCoachPrice20(coach, form.activity) == null) {
      setForm(prev => ({ ...prev, coachId: null }))
    }
  }, [form.activity, form.coachChoice, form.coachId, coaches])

  useEffect(() => {
    let cancelled = false
    async function load() {
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
    void load()
    return () => { cancelled = true }
  }, [])

  const estimate = useMemo(
    () => computePriceEstimate(form, coaches, member, locale),
    [form, coaches, member, locale],
  )

  const totalSteps = s.steps.length

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
        return form.contactName.trim().length > 0 && form.contactPhone.replace(/\D/g, '').length >= 8
      default: return false
    }
  }

  const goNext = () => {
    if (!canNext()) return
    triggerHaptic('light')
    if (lineUserId) {
      liffTrack({ icon_id: `liff_book_step_${step}_next`, line_user_id: lineUserId, member_id: member?.id })
    }
    if (step === 3) {
      const dates = commitSchedule()
      setForm(prev => ({ ...prev, preferredDates: dates }))
    }
    setStep(s => Math.min(totalSteps, s + 1))
  }

  const goBack = () => {
    triggerHaptic('light')
    setStep(s => Math.max(1, s - 1))
  }

  const handleSubmit = () => {
    if (!canNext()) return
    triggerHaptic('medium')
    const payload = buildBookingInquiry(form, coaches, member, locale)
    if (payload.stillTooLong) {
      alert(locale === 'en' ? 'Message too long — shorten notes and try again.' : '訊息過長，請精簡備註後再試')
      return
    }
    liffTrack({ icon_id: 'liff_book_submit', line_user_id: lineUserId, member_id: member?.id })
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

  const headerPriceText = estimate && step >= 2
    ? `${s.estimate.about} ${estimate.totalLabel}`
    : null

  return (
    <div style={bookPage}>
      <LiffStyles />
      <BookPageStyles />
      <BookStepHeader
        step={step}
        priceHint={headerPriceText}
        memberHint={memberRate && step >= 2 && (form.beginnerCount ?? 0) < form.headcount}
      />

      <main style={{ padding: 16 }}>
        {/* Step 1: 玩什麼 */}
        {step === 1 && (
          <BookEssentialsPanel
            memberRate={memberRate}
            value={form.activity}
            onChange={code => setForm(prev => ({ ...prev, ...syncActivityChoice(code) }))}
          />
        )}

        {/* Step 2: 誰要滑 */}
        {step === 2 && (
          <div style={bookCard}>
            <div style={{ marginBottom: 20 }}>
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
              <div style={{ marginBottom: 20 }}>
                <BookBoatPicker
                  variant={wbNeedsLargeGroupBoatChoice(form.activity, form.headcount, form.followBoatCount) ? 'largeGroup' : 'step1'}
                  value={form.boatPreference}
                  headcount={onBoatTotal(form.headcount, form.followBoatCount)}
                  onChange={pref => setForm(prev => ({ ...prev, boatPreference: pref }))}
                />
              </div>
            )}

            <div>
              {form.headcount === 1 ? (
                <>
                  <div style={fieldLabel}>{s.step2.experienceSingle}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="book-chip-btn"
                      style={{ ...chipBtn(form.beginnerCount === 1), flex: 1, padding: '10px 0' }}
                      onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: 1 }) }))}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.step2.firstTime}</div>
                      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{s.step2.firstTimeNote}</div>
                    </button>
                    <button
                      type="button"
                      className="book-chip-btn"
                      style={{ ...chipBtn(form.beginnerCount === 0), flex: 1, padding: '10px 0' }}
                      onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: 0 }) }))}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.step2.experienced}</div>
                      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{s.step2.experiencedNote}</div>
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

            <BookFollowBoatPanel
              riders={form.headcount}
              value={form.followBoatCount}
              onChange={count => setForm(prev => ({ ...prev, followBoatCount: count }))}
            />

            {estimate && <BookEstimateCard estimate={estimate} />}

            <BookContextTips step={2} form={form} pickTimePref={pickTimePref} />
          </div>
        )}

        {/* Step 3: 什麼時候 + 教練選填 */}
        {step === 3 && (
          <div style={bookCard}>
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

            {!showCoachSection ? (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setShowCoachSection(true) }}
                  style={{
                    padding: 0, border: 'none', background: 'none',
                    color: '#888', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  {s.step3.addCoach}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ ...fieldLabel, marginBottom: 8 }}>{s.step3.designateCoach}</div>
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

            <BookContextTips step={3} form={form} pickTimePref={pickTimePref} />
          </div>
        )}

        {/* Step 4: 確認 */}
        {step === 4 && (
          <>
            <div style={{ ...bookCard, border: '2px solid #4a4a4a' }}>
              {isBothActivities(form.activity) ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <BookBothIcons size={32} style={{ margin: 0 }} />
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{s.step1.bothShort}</div>
                </div>
              ) : selectedActivity ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <BookActivityIcon code={selectedActivity.code} size={40} style={{ margin: 0 }} />
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{activityTitleLabel(selectedActivity.code, locale)}</div>
                </div>
              ) : null}
              <div style={{ fontSize: 14, lineHeight: 1.9, color: '#444' }}>
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
              {estimate && (
                <>
                  <BookEstimateCard estimate={estimate} defaultExpanded />
                  <p style={{ fontSize: 11, color: '#999', margin: '8px 0 0', lineHeight: 1.5 }}>
                    {s.step4.confirmNote}
                  </p>
                </>
              )}
            </div>

            <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5, textAlign: 'center' }}>
              {s.step4.submitHint}
            </p>

            <div style={bookCard}>
              <div style={fieldLabel}>{s.step4.contact}</div>
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

            <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', margin: '10px 0 0' }}>
              <a href={OFFICIAL_INFO_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#999' }}>
                {s.step4.attireLink}
              </a>
            </p>

            {desktopMessage && (
              <div style={bookCard}>
                <p style={{ fontSize: 13, margin: '0 0 8px' }}>{s.step4.desktopCopy}</p>
                <textarea readOnly value={desktopMessage} rows={6} style={{ width: '100%', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
          </>
        )}

        <BookStaffHint step={step} form={form} coaches={coaches} pickDate={pickDate} pickTimePref={pickTimePref} />
      </main>

      <footer style={stickyFooter}>
        {step > 1 && (
          <button type="button" style={secondaryBtn} onClick={goBack}>{s.footer.back}</button>
        )}
        {step < totalSteps ? (
          <button
            type="button"
            className="book-primary-btn"
            style={{ ...primaryBtn, opacity: canNext() ? 1 : 0.4 }}
            disabled={!canNext()}
            onClick={goNext}
          >
            {nextLabel}
          </button>
        ) : (
          <button
            type="button"
            className="book-primary-btn"
            style={{ ...linePrimaryBtn, opacity: canNext() ? 1 : 0.4 }}
            disabled={!canNext()}
            onClick={handleSubmit}
          >
            {s.footer.submitLine}
          </button>
        )}
      </footer>
    </div>
  )
}