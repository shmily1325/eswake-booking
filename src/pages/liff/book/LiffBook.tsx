import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { getLocalDateString } from '../../../utils/date'
import { triggerHaptic } from '../../../utils/haptic'
import { useLiffMember } from '../useLiffMember'
import { ErrorView, LoadingSkeleton, LiffStyles } from '../components'
import { BookBindingGate } from './BookBindingGate'
import { BookInfoHub } from './BookInfoHub'
import { activityBoatLine, BookContextTips } from './BookContextTips'
import type {
  CoachOption,
  LiffBookingFormState,
  SkillLevel,
  TimePreference,
} from './types'
import {
  ACTIVITY_OPTIONS,
  beginnerCountOptions,
  formatBeginnerCount,
  HEADCOUNT_OPTIONS,
  MAX_PREFERRED_DATES,
  SKILL_OPTIONS,
  TIME_PREFERENCE_OPTIONS,
  activityDisplayName,
  getActivityInfo,
  isLiffBookEnabled,
} from './liffBookingConfig'
import { BOOKING_WIZARD_STEPS } from './liffBookingSteps'
import { computePriceEstimate } from './liffBookingPricing'
import { activityPriceTeaser, firstTimeUnitPrice, isMemberForPricing } from './liffBookingPrices'
import { buildBookingInquiry, launchBookingInquiry } from './liffBookingMessage'
import {
  bigActivityBtn,
  bookCard,
  bookHeader,
  bookPage,
  chipBtn,
  dateChip,
  dateScrollRow,
  fieldLabel,
  infoBox,
  primaryBtn,
  progressBar,
  progressFill,
  secondaryBtn,
  stickyFooter,
} from './bookStyles'
import { liffTrack } from '../track'

const INITIAL_STATE: LiffBookingFormState = {
  activity: null,
  skillLevel: null,
  headcount: 1,
  beginnerCount: null,
  coachChoice: 'none',
  coachId: null,
  preferredDates: [],
  contactName: '',
  contactPhone: '',
  notes: '',
}

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'] as const

function YoutubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden', marginTop: 10 }}>
      <iframe
        title="起滑影片"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

function NotEnabledView() {
  return (
    <div style={{ ...bookPage, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ ...bookCard, maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏄</div>
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
  const [showActivityHelp, setShowActivityHelp] = useState(false)
  const [showInfoHub, setShowInfoHub] = useState(false)
  const [showCoachSection, setShowCoachSection] = useState(false)
  const [pickDate, setPickDate] = useState('')
  const [pickTimePref, setPickTimePref] = useState<TimePreference>('any')

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
  const stepMeta = BOOKING_WIZARD_STEPS[step - 1]
  const progressPct = (step / totalSteps) * 100

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
      case 2: return form.skillLevel != null && form.beginnerCount != null
      case 3: {
        if (!pickDate && form.preferredDates.length === 0) return false
        if (showCoachSection && form.coachChoice === 'designated' && !form.coachId) return false
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

  const selectedActivity = form.activity ? getActivityInfo(form.activity) : null
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

  const headerPriceText = estimate
    ? `約 ${estimate.totalLabel}（${estimate.tierLabel}）`
    : selectedActivity
      ? `${selectedActivity.labelZh} 初次 $${firstTimeUnitPrice(selectedActivity.code).toLocaleString()} 起`
      : null

  return (
    <div style={bookPage}>
      <LiffStyles />
      <header style={bookHeader}>
        <div style={{ fontSize: 12, opacity: 0.85 }}>{step} / {totalSteps}</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '6px 0 2px' }}>{stepMeta.title}</h1>
        <p style={{ fontSize: 13, margin: 0, opacity: 0.85 }}>{stepMeta.subtitle}</p>
        <div style={progressBar}><div style={progressFill(progressPct)} /></div>
        {headerPriceText && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
          }}>
            💰 {headerPriceText}
          </div>
        )}
      </header>

      <main style={{ padding: 16 }}>
        {/* Step 1: 玩什麼 */}
        {step === 1 && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {ACTIVITY_OPTIONS.map(opt => {
                const teaser = activityPriceTeaser(opt.code, memberRate)
                return (
                <button
                  key={opt.code}
                  type="button"
                  style={bigActivityBtn(form.activity === opt.code)}
                  onClick={() => {
                    triggerHaptic('light')
                    setForm(prev => ({ ...prev, activity: opt.code }))
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{opt.emoji}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{opt.labelZh}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{opt.tagline}</div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 8, lineHeight: 1.5 }}>
                    {teaser.firstTimeLine}<br />{teaser.sessionLine}
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>{activityBoatLine(opt.code)}</div>
                </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setShowActivityHelp(v => !v) }}
              style={{
                width: '100%', padding: 12, border: '1px dashed #ccc', borderRadius: 10,
                background: 'white', color: '#666', fontSize: 14, cursor: 'pointer',
              }}
            >
              {showActivityHelp ? '▲ 收合說明' : '？ 不確定？看差異與影片'}
            </button>

            {showActivityHelp && (
              <div style={{ ...bookCard, marginTop: 12 }}>
                {ACTIVITY_OPTIONS.map(opt => (
                  <div key={opt.code} style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                      {opt.emoji} {opt.labelZh}
                    </div>
                    <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: '0 0 8px' }}>{opt.summary}</p>
                    <YoutubeEmbed videoId={opt.youtubeVideoId} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Step 2: 誰要滑 */}
        {step === 2 && (
          <div style={bookCard}>
            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabel}>程度</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {SKILL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    style={{ ...chipBtn(form.skillLevel === opt.value), flex: 1, padding: '14px 8px' }}
                    onClick={() => setForm(prev => ({ ...prev, skillLevel: opt.value as SkillLevel }))}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={fieldLabel}>幾人</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {HEADCOUNT_OPTIONS.map(n => (
                  <button
                    key={n}
                    type="button"
                    style={{ ...chipBtn(form.headcount === n), flex: '1 1 calc(20% - 8px)', minWidth: 52, padding: '12px 0' }}
                    onClick={() => setForm(prev => {
                      const headcount = n
                      const beginnerCount =
                        prev.beginnerCount != null && prev.beginnerCount > headcount
                          ? headcount
                          : prev.beginnerCount
                      return { ...prev, headcount, beginnerCount }
                    })}
                  >
                    {n} 人
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={fieldLabel}>幾初（幾位初學）</div>
              <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 10px' }}>團體中有幾位是第一次滑</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {beginnerCountOptions(form.headcount).map(n => (
                  <button
                    key={n}
                    type="button"
                    style={chipBtn(form.beginnerCount === n)}
                    onClick={() => setForm(prev => ({ ...prev, beginnerCount: n }))}
                  >
                    {formatBeginnerCount(n)}
                  </button>
                ))}
              </div>
            </div>

            {estimate && (
              <div style={{ ...infoBox, marginTop: 12, marginBottom: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>目前估算 · {estimate.tierLabel}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>約 {estimate.totalLabel}</div>
                {estimate.detailLines.map(line => (
                  <div key={line} style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>{line}</div>
                ))}
              </div>
            )}

            <BookContextTips step={2} form={form} pickTimePref={pickTimePref} showCoachSection={showCoachSection} />
          </div>
        )}

        {/* Step 3: 什麼時候 + 教練選填 */}
        {step === 3 && (
          <>
            <div style={bookCard}>
              <div style={fieldLabel}>希望日期（可左右滑）</div>
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

              {form.preferredDates.length > 1 && (
                <p style={{ fontSize: 12, color: '#888', margin: '12px 0 0' }}>
                  已選 {form.preferredDates.length} 天（最多 {MAX_PREFERRED_DATES} 天）
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setShowCoachSection(v => !v) }}
              style={{
                width: '100%', padding: 14, marginBottom: 12, border: '1px solid #e8e8e8',
                borderRadius: 12, background: 'white', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontWeight: 600 }}>指定教練</span>
              <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>選填 · {showCoachSection ? '▲' : '▼'}</span>
            </button>

            {showCoachSection && (
              <div style={bookCard}>
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
                    指定教練
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

            <BookContextTips step={3} form={form} pickTimePref={pickTimePref} showCoachSection={showCoachSection} />
          </>
        )}

        {/* Step 4: 確認 */}
        {step === 4 && (
          <>
            <div style={{ ...bookCard, border: '2px solid #4a4a4a' }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>預約摘要</div>
              {selectedActivity && (
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
                  {selectedActivity.emoji} {activityDisplayName(selectedActivity.code)}
                </div>
              )}
              <div style={{ fontSize: 14, lineHeight: 2, color: '#333' }}>
                <div>
                  {form.skillLevel === 'first_time' ? '第一次體驗' : '已經滑過'} · {form.headcount} 人
                  {form.beginnerCount != null ? ` · ${formatBeginnerCount(form.beginnerCount)}` : ''}
                </div>
                <div>
                  📅 {(form.preferredDates.length ? form.preferredDates : commitSchedule()).map(p =>
                    `${p.date.slice(5).replace('-', '/')} ${TIME_PREFERENCE_OPTIONS.find(o => o.value === p.timePreference)?.label}`,
                  ).join('、')}
                </div>
                <div>
                  教練：{form.coachChoice === 'designated' ? coaches.find(c => c.id === form.coachId)?.name ?? '—' : '不指定'}
                </div>
              </div>
              {estimate && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eee' }}>
                  <div style={{ fontSize: 13, color: '#888' }}>費用估算 · {estimate.tierLabel}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#222' }}>約 {estimate.totalLabel}</div>
                  {estimate.detailLines.map(line => (
                    <div key={line} style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{line}</div>
                  ))}
                  <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>{estimate.disclaimer}</div>
                  {member && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      已綁定會員{member.membership_type === 'guest' ? '（非會員價）' : ''}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={bookCard}>
              <div style={fieldLabel}>聯絡資料</div>
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

            <BookContextTips step={4} form={form} pickTimePref={pickTimePref} showCoachSection={showCoachSection} />

            {desktopMessage && (
              <div style={bookCard}>
                <p style={{ fontSize: 13, margin: '0 0 8px' }}>請複製訊息到 LINE 官方帳號：</p>
                <textarea readOnly value={desktopMessage} rows={6} style={{ width: '100%', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setShowInfoHub(v => !v) }}
          style={infoHubBtnStyle}
        >
          {showInfoHub ? '▲ 收合預約須知' : '📖 預約須知 · 價目 · 船型'}
        </button>

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
