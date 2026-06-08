import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { getLocalDateString } from '../../../utils/date'
import { triggerHaptic } from '../../../utils/haptic'
import { useLiffMember } from '../useLiffMember'
import { ErrorView, LoadingSkeleton, LiffStyles } from '../components'
import { BookBindingGate } from './BookBindingGate'
import { BookEssentialsPanel } from './BookEssentialsPanel'
import { BookEstimateCard } from './BookEstimateCard'
import { BookInfoHub } from './BookInfoHub'
import { BookStepHeader } from './BookStepHeader'
import { BookContextTips } from './BookContextTips'
import { BookVideoPlayer } from './BookVideoPlayer'
import { BookStaffHint } from './BookStaffHint'
import type {
  CoachOption,
  LiffBookingFormState,
  TimePreference,
} from './types'
import {
  ACTIVITY_OPTIONS,
  beginnerCountOptions,
  formatBeginnerCount,
  HEADCOUNT_OPTIONS,
  MAX_PREFERRED_DATES,
  syncBookingPeople,
  TIME_PREFERENCE_OPTIONS,
  getActivityInfo,
  isBothActivities,
  BOTH_ACTIVITY_SHORT,
  BEGINNER_LESSON_NOTE,
  isLiffBookEnabled,
} from './liffBookingConfig'
import { BOOKING_WIZARD_STEPS } from './liffBookingSteps'
import { computePriceEstimate } from './liffBookingPricing'
import { isMemberForPricing } from './liffBookingPrices'
import { buildBookingInquiry, launchBookingInquiry } from './liffBookingMessage'
import {
  bigActivityBtn,
  bookCard,
  bookPage,
  chipBtn,
  dateChip,
  dateScrollRow,
  fieldLabel,
  primaryBtn,
  secondaryBtn,
  stickyFooter,
} from './bookStyles'
import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { liffTrack } from '../track'

const INITIAL_STATE: LiffBookingFormState = {
  activity: null,
  skillLevel: 'first_time',
  headcount: 1,
  beginnerCount: 1,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [],
  contactName: '',
  contactPhone: '',
  notes: '',
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const

function NotEnabledView() {
  return (
    <div style={{ ...bookPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...bookCard, maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12, fontWeight: 700, color: '#444' }}>ES</div>
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>預約表單尚未開放</h1>
        <p style={{ fontSize: 14, color: '#666', margin: 0 }}>請繼續使用 LINE 官方帳號填寫預約資訊。</p>
      </div>
    </div>
  )
}

function formatDateChip(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`)
  return { wd: WEEKDAY[d.getDay()], md: `${d.getMonth() + 1}/${d.getDate()}` }
}

export function LiffBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff/book'])

  const {
    loading: liffLoading,
    error: liffError,
    member,
    lineUserId,
    shouldShowBindingForm,
    bindingFormProps,
    skipBinding,
    retryInit,
  } = useLiffMember({ requireBinding: false, trackIconId: 'liff_book_open' })

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<LiffBookingFormState>(INITIAL_STATE)
  const [coaches, setCoaches] = useState<CoachOption[]>([])
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set())
  const [desktopMessage, setDesktopMessage] = useState<string | null>(null)
  const [showInfoHub, setShowInfoHub] = useState(false)
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
    let cancelled = false
    async function load() {
      try {
        const [coachRes, restrictRes] = await Promise.all([
          supabase.from('coaches').select('id, name, designated_lesson_price_30min').eq('status', 'active').order('name'),
          supabase.from('reservation_restrictions').select('start_date, end_date, is_active').eq('is_active', true),
        ])
        if (cancelled) return
        setCoaches(coachRes.data ?? [])
        const blocked = new Set<string>()
        for (const r of restrictRes.data ?? []) {
          const d0 = new Date(`${r.start_date}T12:00:00`)
          const d1 = new Date(`${r.end_date}T12:00:00`)
          for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
            blocked.add(getLocalDateString(d))
          }
        }
        setBlockedDates(blocked)
      } catch {
        // 估算可 fallback，不阻擋流程
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const estimate = useMemo(() => computePriceEstimate(form, coaches, member), [form, coaches, member])

  const totalSteps = BOOKING_WIZARD_STEPS.length

  const upcomingDates = useMemo(() => {
    const out: string[] = []
    const today = new Date()
    for (let i = 0; i < 21; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      out.push(getLocalDateString(d))
    }
    return out
  }, [])

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
      case 1: return form.activity != null
      case 2: return form.beginnerCount != null
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
    const payload = buildBookingInquiry(form, coaches, member)
    if (payload.stillTooLong) {
      alert('訊息過長，請精簡備註後再試')
      return
    }
    liffTrack({ icon_id: 'liff_book_submit', line_user_id: lineUserId, member_id: member?.id })
    const result = launchBookingInquiry(payload)
    if (result.mode === 'desktop-fallback') setDesktopMessage(result.message)
  }

  if (!isLiffBookEnabled()) return <NotEnabledView />
  if (liffError) return <ErrorView error={liffError} onRetry={() => void retryInit()} />
  if (liffLoading) return <LoadingSkeleton />
  if (shouldShowBindingForm) {
    return <BookBindingGate {...bindingFormProps} onSkip={skipBinding} />
  }

  const selectedActivity =
    form.activity && !isBothActivities(form.activity) ? getActivityInfo(form.activity) : null
  const memberRate = isMemberForPricing(member?.membership_type)
  const nextLabel = step === totalSteps ? '用 LINE 送出' : step === 3 ? '確認' : '下一步'

  const infoHubBtnStyle = {
    width: '100%',
    padding: 12,
    marginTop: 4,
    border: '1px solid #e0e0e0',
    borderRadius: 10,
    background: 'white',
    color: '#444',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  } as const

  const headerPriceText = estimate && step >= 2
    ? `約 ${estimate.totalLabel}`
    : null

  return (
    <div style={bookPage}>
      <LiffStyles />
      <BookStepHeader
        step={step}
        priceHint={headerPriceText}
        memberHint={memberRate && step >= 2}
      />

      <main style={{ padding: 16 }}>
        {/* Step 1: 玩什麼 */}
        {step === 1 && (
          <>
            <BookEssentialsPanel memberRate={memberRate} selectedActivity={form.activity} />

            <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              {ACTIVITY_OPTIONS.map(opt => {
                const selected = form.activity === opt.code
                return (
                  <div key={opt.code} style={bigActivityBtn(selected)}>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light')
                        setForm(prev => ({ ...prev, activity: opt.code }))
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '4px 0 0',
                        textAlign: 'center',
                        width: '100%',
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{opt.labelZh}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.35 }}>{opt.tagline}</div>
                    </button>
                    <BookVideoPlayer
                      variant="compact"
                      videoId={opt.youtubeVideoId}
                      title={opt.labelZh}
                    />
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              style={{
                ...chipBtn(form.activity === 'BOTH'),
                width: '100%',
                padding: '14px 16px',
                marginBottom: 8,
                textAlign: 'center',
              }}
              onClick={() => {
                triggerHaptic('light')
                setForm(prev => ({ ...prev, activity: 'BOTH' }))
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>{BOTH_ACTIVITY_SHORT}</div>
              <div style={{ fontSize: 11, color: form.activity === 'BOTH' ? 'rgba(255,255,255,0.85)' : '#888', marginTop: 4 }}>
                快艇衝浪 + 寬板滑水 · 需大船
              </div>
            </button>
          </>
        )}

        {/* Step 2: 誰要滑 */}
        {step === 2 && (
          <div style={bookCard}>
            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabel}>幾人</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {HEADCOUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    style={{ ...chipBtn(form.headcount === n), flex: '1 1 calc(20% - 8px)', minWidth: 52, padding: '12px 0' }}
                    onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { headcount: n }) }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={fieldLabel}>其中幾位初學</div>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>{BEGINNER_LESSON_NOTE}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {beginnerCountOptions(form.headcount).map(n => (
                  <button
                    key={n}
                    type="button"
                    style={chipBtn(form.beginnerCount === n)}
                    onClick={() => setForm(prev => ({ ...prev, ...syncBookingPeople(prev, { beginnerCount: n }) }))}
                  >
                    {n === form.headcount ? '全部' : n === 0 ? '無' : formatBeginnerCount(n)}
                  </button>
                ))}
              </div>
            </div>

            {estimate && <BookEstimateCard estimate={estimate} />}

            <BookContextTips step={2} form={form} pickTimePref={pickTimePref} />
          </div>
        )}

        {/* Step 3: 什麼時候 + 教練選填 */}
        {step === 3 && (
          <div style={bookCard}>
            <div style={fieldLabel}>日期</div>
            <div style={dateScrollRow}>
              {upcomingDates.map(ymd => {
                const blocked = blockedDates.has(ymd)
                const { wd, md } = formatDateChip(ymd)
                const selected = pickDate === ymd
                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={blocked}
                    style={dateChip(selected, blocked)}
                    onClick={() => { triggerHaptic('light'); setPickDate(ymd) }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.9 }}>{wd}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{md}</div>
                  </button>
                )
              })}
            </div>

            <div style={{ ...fieldLabel, marginTop: 16 }}>時段</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIME_PREFERENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  style={{ ...chipBtn(pickTimePref === opt.value), flex: 1, padding: '12px 0' }}
                  onClick={() => setPickTimePref(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {!showCoachSection ? (
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowCoachSection(true) }}
                style={{
                  marginTop: 16, padding: 0, border: 'none', background: 'none',
                  color: '#888', fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                ＋ 指定教練（選填）
              </button>
            ) : (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ ...fieldLabel, marginBottom: 8 }}>指定教練</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    style={{ ...chipBtn(form.coachChoice === 'none'), flex: 1 }}
                    onClick={() => setForm(prev => ({ ...prev, coachChoice: 'none', coachId: null }))}
                  >
                    不指定
                  </button>
                  <button
                    type="button"
                    style={{ ...chipBtn(form.coachChoice === 'designated'), flex: 1 }}
                    onClick={() => setForm(prev => ({ ...prev, coachChoice: 'designated' }))}
                  >
                    指定
                  </button>
                </div>
                {form.coachChoice === 'designated' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {coaches.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        style={chipBtn(form.coachId === c.id)}
                        onClick={() => setForm(prev => ({ ...prev, coachId: c.id }))}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
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
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
                  {BOTH_ACTIVITY_SHORT}
                </div>
              ) : selectedActivity ? (
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
                  {selectedActivity.labelZh}
                </div>
              ) : null}
              <div style={{ fontSize: 14, lineHeight: 1.9, color: '#444' }}>
                <div>{form.headcount} 人 · {form.beginnerCount != null ? (form.beginnerCount === form.headcount ? '全部初學' : form.beginnerCount === 0 ? '無初學' : formatBeginnerCount(form.beginnerCount)) : '—'}</div>
                <div>
                  {(form.preferredDates.length ? form.preferredDates : commitSchedule()).map(p =>
                    `${p.date.slice(5).replace('-', '/')} ${TIME_PREFERENCE_OPTIONS.find(o => o.value === p.timePreference)?.label}`,
                  ).join('、')}
                </div>
                <div>
                  教練：{form.coachChoice === 'designated' ? coaches.find(c => c.id === form.coachId)?.name ?? '—' : '不指定'}
                </div>
              </div>
              {estimate && (
                <>
                  <BookEstimateCard estimate={estimate} defaultExpanded />
                  <p style={{ fontSize: 11, color: '#999', margin: '8px 0 0' }}>{estimate.disclaimer}</p>
                </>
              )}
            </div>

            <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', lineHeight: 1.5, textAlign: 'center' }}>
              送出後小編會在 LINE 回覆確認，尚未保留時段
            </p>

            <div style={bookCard}>
              <div style={fieldLabel}>姓名與電話</div>
              <input
                value={form.contactName}
                onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="姓名"
                style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', marginBottom: 10 }}
              />
              <input
                type="tel"
                value={form.contactPhone}
                onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="電話"
                style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box', marginBottom: 10 }}
              />
              <input
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="備註（選填）"
                style={{ width: '100%', padding: 14, border: '1px solid #ddd', borderRadius: 10, fontSize: 16, boxSizing: 'border-box' }}
              />
            </div>

            {desktopMessage && (
              <div style={bookCard}>
                <p style={{ fontSize: 13, margin: '0 0 8px' }}>請複製訊息到 LINE 官方帳號：</p>
                <textarea readOnly value={desktopMessage} rows={6} style={{ width: '100%', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
          </>
        )}

        <BookStaffHint />

        {step <= 2 ? (
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setShowInfoHub(v => !v) }}
            style={infoHubBtnStyle}
          >
            {showInfoHub ? '▲ 收合' : '更多：G23 · FAQ'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setShowInfoHub(v => !v) }}
            style={{
              display: 'block', width: '100%', marginTop: 4, padding: 8,
              border: 'none', background: 'none', color: '#999', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {showInfoHub ? '收合須知' : '查價目與須知'}
          </button>
        )}

        {showInfoHub && (
          <div style={{ ...bookCard, marginTop: 12 }}>
            <BookInfoHub />
          </div>
        )}
      </main>

      <footer style={stickyFooter}>
        {step > 1 && (
          <button type="button" style={secondaryBtn} onClick={goBack}>返回</button>
        )}
        {step < totalSteps ? (
          <button
            type="button"
            style={{ ...primaryBtn, opacity: canNext() ? 1 : 0.4 }}
            disabled={!canNext()}
            onClick={goNext}
          >
            {nextLabel}
          </button>
        ) : (
          <button
            type="button"
            style={{ ...primaryBtn, background: '#00b900', opacity: canNext() ? 1 : 0.4 }}
            disabled={!canNext()}
            onClick={handleSubmit}
          >
            用 LINE 送出
          </button>
        )}
      </footer>
    </div>
  )
}
