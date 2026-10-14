import { useEffect, useRef, useState } from 'react'
import {
  designSystem,
  getBookingChoiceStyle,
  getButtonStyle,
  getFontSize,
  getInputStyle,
} from '../styles/designSystem'
import type { Participant } from '../types/booking'
import { fetchCoachDesignatedMemberContext } from '../pages/coach/designatedHours/api'
import {
  defaultCoachDesignatedDeduction,
  shouldShowCoachDesignatedControl,
} from '../pages/coach/designatedHours/deductionDefaults'

interface CoachDesignatedDeductionControlProps {
  coachId: string
  participant: Participant
  participantIndex: number
  isMobile: boolean
  onUpdate: (index: number, field: keyof Participant, value: unknown) => void
}

export function CoachDesignatedDeductionControl({
  coachId,
  participant,
  participantIndex,
  isMobile,
  onUpdate,
}: CoachDesignatedDeductionControlProps) {
  const [expanded, setExpanded] = useState(false)
  const [balance, setBalance] = useState(0)
  const [regularBalance, setRegularBalance] = useState(0)
  const [giftBalance, setGiftBalance] = useState(0)
  const [originalRegularDeduction, setOriginalRegularDeduction] = useState(0)
  const [originalGiftDeduction, setOriginalGiftDeduction] = useState(0)
  const [hasGiftEntries, setHasGiftEntries] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const [showLoadingHint, setShowLoadingHint] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const expansionInitializedKeyRef = useRef<string | null>(null)
  const activeLoadKeyRef = useRef<string | null>(null)
  const deductionEditedRef = useRef(false)
  const previousDurationRef = useRef<number | null>(null)
  const participantRef = useRef(participant)
  participantRef.current = participant
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const participantIndexRef = useRef(participantIndex)
  participantIndexRef.current = participantIndex

  const memberId = participant.member_id
  const eligible = participant.lesson_type === 'designated_free' && !!memberId
  const currentLoadKey = eligible && memberId
    ? `${coachId}:${memberId}:${participant.id}`
    : null

  useEffect(() => {
    if (!eligible || !memberId || !currentLoadKey) {
      activeLoadKeyRef.current = null
      setShouldShow(false)
      setShowLoadingHint(false)
      setLoadError(false)
      return
    }
    const loadKey = currentLoadKey
    if (activeLoadKeyRef.current !== loadKey) {
      activeLoadKeyRef.current = loadKey
      deductionEditedRef.current = false
      previousDurationRef.current = participantRef.current.duration_min
      setShouldShow(false)
    }
    setOriginalRegularDeduction(0)
    setOriginalGiftDeduction(0)
    let cancelled = false
    let loadingHintTimer: number | null = null

    const load = async () => {
      setLoading(true)
      setLoadError(false)
      setShowLoadingHint(false)
      loadingHintTimer = window.setTimeout(() => {
        if (!cancelled) setShowLoadingHint(true)
      }, 300)
      let lastError: unknown = null
      try {
        let context: Awaited<ReturnType<typeof fetchCoachDesignatedMemberContext>> | null = null
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            context = await fetchCoachDesignatedMemberContext(
              coachId,
              memberId,
              participantRef.current.id > 0 ? participantRef.current.id : null,
            )
            break
          } catch (error) {
            lastError = error
            if (attempt === 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 600))
              if (cancelled) return
            }
          }
        }
        if (!context) throw lastError
        if (cancelled) return
        const currentParticipant = participantRef.current
        const currentIndex = participantIndexRef.current
        setBalance(context.balance)
        setRegularBalance(context.regular_balance)
        setGiftBalance(context.gift_balance)
        setHasGiftEntries(context.has_gift_entries)
        setOriginalRegularDeduction(
          context.deduction_regular_minutes
          ?? context.deduction_minutes
          ?? 0,
        )
        setOriginalGiftDeduction(context.deduction_gift_minutes ?? 0)
        deductionEditedRef.current = context.deduction_minutes != null
        setShouldShow(shouldShowCoachDesignatedControl(context.has_entries, false))
        if (
          context.has_entries
          && expansionInitializedKeyRef.current !== loadKey
        ) {
          expansionInitializedKeyRef.current = loadKey
          setExpanded(true)
        }

        if (!currentParticipant.designated_hours_initialized) {
          const existingDeduction = context.deduction_minutes
          const defaultToGift = existingDeduction == null
            && context.regular_balance === 0
            && context.gift_balance !== 0
          const regularMinutes = context.deduction_regular_minutes
            ?? (defaultToGift ? 0 : currentParticipant.duration_min)
          const giftMinutes = context.deduction_gift_minutes
            ?? (defaultToGift ? currentParticipant.duration_min : 0)
          onUpdateRef.current(
            currentIndex,
            'designated_hours_deduct',
            defaultCoachDesignatedDeduction(
              context.regular_balance !== 0 || context.gift_balance !== 0
                ? (context.balance || 1)
                : 0,
              existingDeduction,
              context.deduction_decided,
            ),
          )
          onUpdateRef.current(
            currentIndex,
            'designated_hours_minutes',
            existingDeduction ?? currentParticipant.duration_min,
          )
          onUpdateRef.current(
            currentIndex,
            'designated_hours_regular_minutes',
            regularMinutes,
          )
          onUpdateRef.current(
            currentIndex,
            'designated_hours_gift_minutes',
            giftMinutes,
          )
          onUpdateRef.current(currentIndex, 'designated_hours_initialized', true)
        }
      } catch (error) {
        console.error('載入指定課時數失敗:', error)
        if (!cancelled) {
          setShouldShow(shouldShowCoachDesignatedControl(false, true))
          setLoadError(true)
        }
      } finally {
        if (loadingHintTimer != null) window.clearTimeout(loadingHintTimer)
        if (!cancelled) {
          setShowLoadingHint(false)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (loadingHintTimer != null) window.clearTimeout(loadingHintTimer)
    }
  }, [
    coachId,
    currentLoadKey,
    eligible,
    memberId,
    participant.id,
    reloadToken,
  ])

  useEffect(() => {
    const duration = Number(participant.duration_min)
    const previousDuration = previousDurationRef.current
    previousDurationRef.current = duration
    if (
      !eligible
      || previousDuration == null
      || previousDuration === duration
      || participant.designated_hours_initialized !== true
      || deductionEditedRef.current
    ) return

    const currentGift = participant.designated_hours_gift_minutes ?? 0
    const useGift = currentGift > 0
      && (participant.designated_hours_regular_minutes ?? 0) === 0
    onUpdateRef.current(
      participantIndexRef.current,
      'designated_hours_regular_minutes',
      useGift ? 0 : duration,
    )
    onUpdateRef.current(
      participantIndexRef.current,
      'designated_hours_gift_minutes',
      useGift ? duration : 0,
    )
    onUpdateRef.current(
      participantIndexRef.current,
      'designated_hours_minutes',
      duration,
    )
  }, [
    eligible,
    participant.designated_hours_gift_minutes,
    participant.designated_hours_initialized,
    participant.designated_hours_regular_minutes,
    participant.duration_min,
  ])

  if (
    !eligible
    || activeLoadKeyRef.current !== currentLoadKey
    || (!shouldShow && !showLoadingHint && !loadError)
  ) return null

  const deduct = participant.designated_hours_deduct === true
  const regularMinutes = participant.designated_hours_regular_minutes
    ?? participant.designated_hours_minutes
    ?? participant.duration_min
  const giftMinutes = participant.designated_hours_gift_minutes ?? 0
  const minutes = regularMinutes + giftMinutes
  const regularAfter = regularBalance
    + originalRegularDeduction
    - (deduct ? regularMinutes : 0)
  const giftAfter = giftBalance
    + originalGiftDeduction
    - (deduct ? giftMinutes : 0)
  const after = regularAfter + giftAfter
  const showGift = hasGiftEntries || giftBalance !== 0 || giftMinutes > 0
  const split = regularMinutes > 0 && giftMinutes > 0

  const setAllocation = (regular: number, gift: number) => {
    deductionEditedRef.current = true
    onUpdate(participantIndex, 'designated_hours_regular_minutes', regular)
    onUpdate(participantIndex, 'designated_hours_gift_minutes', gift)
    onUpdate(participantIndex, 'designated_hours_minutes', regular + gift)
  }

  return (
    <div
      style={{
        marginBottom: 12,
        border: `1.5px solid ${
          loadError
            ? designSystem.colors.danger[500]
            : `${designSystem.colors.info[500]}66`
        }`,
        borderRadius: designSystem.borderRadius.lg,
        background: loadError
          ? designSystem.colors.danger[50]
          : designSystem.colors.info[50],
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        data-track="coach_designated_report_toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          minHeight: isMobile ? 58 : 52,
          padding: isMobile ? '11px 13px' : '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          border: 0,
          background: 'transparent',
          color: designSystem.colors.text.primary,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: getFontSize('body', isMobile),
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 9,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              color: loadError
                ? designSystem.colors.danger[700]
                : designSystem.colors.info[700],
            }}
          >
            指定課
          </span>
          {!loading && !loadError && (
            <span
              style={{
                color: designSystem.colors.text.primary,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              剩餘 {balance} 分
            </span>
          )}
        </span>
        <span
          style={{
            flexShrink: 0,
            minWidth: 0,
            textAlign: 'right',
            lineHeight: 1.4,
            fontSize: getFontSize('bodySmall', isMobile),
            color: loadError ? designSystem.colors.danger[700] : designSystem.colors.text.secondary,
          }}
        >
          {loading
            ? '載入中'
            : loadError
              ? '無法載入'
              : `${deduct ? `本次扣 ${minutes} 分` : '本次不扣'} · ${expanded ? '收合' : '展開'}`}
        </span>
      </button>

      {expanded && !loading && !loadError && (
        <div
          style={{
            padding: '12px',
            borderTop: `1px solid ${designSystem.colors.border.light}`,
            background: designSystem.colors.background.card,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              cursor: 'pointer',
              fontSize: getFontSize('body', isMobile),
            }}
          >
            <input
              type="checkbox"
              data-track="coach_designated_report_deduct_toggle"
              checked={deduct}
              onChange={(event) => {
                onUpdate(participantIndex, 'designated_hours_deduct', event.target.checked)
              }}
              style={{ width: 20, height: 20, accentColor: designSystem.colors.primary[500] }}
            />
            本次扣除時數
          </label>

          {deduct && (
            <div style={{ marginTop: 8 }}>
              {showGift && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <button
                    type="button"
                    data-track="coach_designated_source_regular"
                    aria-pressed={!split && giftMinutes === 0}
                    onClick={() => setAllocation(minutes || participant.duration_min, 0)}
                    style={{
                      ...getBookingChoiceStyle(!split && giftMinutes === 0),
                      minHeight: 48,
                      padding: '6px 4px',
                      cursor: 'pointer',
                      fontSize: getFontSize('button', isMobile),
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'block' }}>指定課</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: getFontSize('caption', isMobile), fontWeight: 500 }}>
                      {regularBalance} 分
                    </span>
                  </button>
                  <button
                    type="button"
                    data-track="coach_designated_source_gift"
                    aria-pressed={!split && giftMinutes > 0}
                    onClick={() => setAllocation(0, minutes || participant.duration_min)}
                    style={{
                      ...getBookingChoiceStyle(!split && giftMinutes > 0),
                      minHeight: 48,
                      padding: '6px 4px',
                      cursor: 'pointer',
                      fontSize: getFontSize('button', isMobile),
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ display: 'block' }}>贈送</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: getFontSize('caption', isMobile), fontWeight: 500 }}>
                      {giftBalance} 分
                    </span>
                  </button>
                  <button
                    type="button"
                    data-track="coach_designated_source_split"
                    aria-pressed={split}
                    onClick={() => {
                      const gift = Math.max(
                        1,
                        Math.min(Math.max(giftBalance, 0), Math.floor(minutes / 2)),
                      )
                      setAllocation(minutes - gift, gift)
                    }}
                    disabled={minutes <= 1}
                    style={{
                      ...getBookingChoiceStyle(split),
                      minHeight: 48,
                      padding: '6px 4px',
                      cursor: minutes > 1 ? 'pointer' : 'not-allowed',
                      opacity: minutes > 1 ? 1 : 0.55,
                      fontSize: getFontSize('button', isMobile),
                      fontWeight: 600,
                    }}
                  >
                    分開扣
                  </button>
                </div>
              )}
              {split ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <label style={{ fontSize: getFontSize('bodySmall', isMobile) }}>
                    指定課
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="指定課扣除分鐘"
                      value={regularMinutes || ''}
                      onChange={(event) => setAllocation(
                        Number(event.target.value.replace(/\D/g, '')) || 0,
                        giftMinutes,
                      )}
                      style={{ ...getInputStyle(isMobile), marginTop: 5 }}
                    />
                  </label>
                  <label style={{ fontSize: getFontSize('bodySmall', isMobile) }}>
                    贈送
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="贈送指定課扣除分鐘"
                      value={giftMinutes || ''}
                      onChange={(event) => setAllocation(
                        regularMinutes,
                        Number(event.target.value.replace(/\D/g, '')) || 0,
                      )}
                      style={{ ...getInputStyle(isMobile), marginTop: 5 }}
                    />
                  </label>
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="本次扣除分鐘"
                  value={minutes || ''}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/\D/g, '')) || 0
                    setAllocation(giftMinutes > 0 ? 0 : next, giftMinutes > 0 ? next : 0)
                  }}
                  style={getInputStyle(isMobile)}
                />
              )}
              <div
                style={{
                  marginTop: 8,
                  fontSize: getFontSize('bodySmall', isMobile),
                  color: after < 0
                    ? designSystem.colors.warning[700]
                    : designSystem.colors.text.secondary,
                }}
              >
                扣除後剩餘 {after} 分
              </div>
              {minutes > participant.duration_min && (
                <div
                  style={{
                    marginTop: 5,
                    color: designSystem.colors.warning[700],
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  預約 {participant.duration_min} 分，本次扣除 {minutes} 分
                </div>
              )}
            </div>
          )}
          {!deduct && originalRegularDeduction + originalGiftDeduction > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
              }}
            >
              取消後剩餘 {after} 分
            </div>
          )}
        </div>
      )}
      {loadError && (
        <div
          style={{
            padding: 12,
            borderTop: `1px solid ${designSystem.colors.border.light}`,
          }}
        >
          <button
            type="button"
            data-track="coach_designated_report_retry_load"
            onClick={() => setReloadToken((value) => value + 1)}
            style={getButtonStyle('outline', 'small', isMobile)}
          >
            重新載入
          </button>
        </div>
      )}
    </div>
  )
}
