import { useEffect, useRef, useState } from 'react'
import { designSystem, getButtonStyle, getFontSize, getInputStyle } from '../styles/designSystem'
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
  const [hasGiftEntries, setHasGiftEntries] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const loadedKeyRef = useRef<string | null>(null)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const memberId = participant.member_id
  const eligible = participant.lesson_type === 'designated_free' && !!memberId

  useEffect(() => {
    if (!eligible || !memberId) return
    const loadKey = `${coachId}:${memberId}:${participant.id}`
    if (loadedKeyRef.current === loadKey) return
    loadedKeyRef.current = loadKey
    setShouldShow(true)
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const context = await fetchCoachDesignatedMemberContext(
          coachId,
          memberId,
          participant.id > 0 ? participant.id : null,
        )
        if (cancelled) return
        setBalance(context.balance)
        setRegularBalance(context.regular_balance)
        setGiftBalance(context.gift_balance)
        setHasGiftEntries(context.has_gift_entries)
        setShouldShow(shouldShowCoachDesignatedControl(context.has_entries, false))

        if (!participant.designated_hours_initialized) {
          const existingDeduction = context.deduction_minutes
          const defaultToGift = existingDeduction == null
            && context.regular_balance === 0
            && context.gift_balance !== 0
          const regularMinutes = context.deduction_regular_minutes
            ?? (defaultToGift ? 0 : participant.duration_min)
          const giftMinutes = context.deduction_gift_minutes
            ?? (defaultToGift ? participant.duration_min : 0)
          onUpdateRef.current(
            participantIndex,
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
            participantIndex,
            'designated_hours_minutes',
            existingDeduction ?? participant.duration_min,
          )
          onUpdateRef.current(
            participantIndex,
            'designated_hours_regular_minutes',
            regularMinutes,
          )
          onUpdateRef.current(
            participantIndex,
            'designated_hours_gift_minutes',
            giftMinutes,
          )
          onUpdateRef.current(participantIndex, 'designated_hours_initialized', true)
        }
      } catch (error) {
        console.error('載入指定課時數失敗:', error)
        if (!cancelled) {
          setShouldShow(shouldShowCoachDesignatedControl(false, true))
          setLoadError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    coachId,
    eligible,
    memberId,
    participant.designated_hours_initialized,
    participant.id,
    participant.duration_min,
    participantIndex,
    reloadToken,
  ])

  if (!eligible || !shouldShow) return null

  const deduct = participant.designated_hours_deduct === true
  const regularMinutes = participant.designated_hours_regular_minutes
    ?? participant.designated_hours_minutes
    ?? participant.duration_min
  const giftMinutes = participant.designated_hours_gift_minutes ?? 0
  const minutes = regularMinutes + giftMinutes
  const after = balance - (deduct ? minutes : 0)
  const showGift = hasGiftEntries || giftBalance !== 0 || giftMinutes > 0
  const split = regularMinutes > 0 && giftMinutes > 0

  const setAllocation = (regular: number, gift: number) => {
    onUpdate(participantIndex, 'designated_hours_regular_minutes', regular)
    onUpdate(participantIndex, 'designated_hours_gift_minutes', gift)
    onUpdate(participantIndex, 'designated_hours_minutes', regular + gift)
  }

  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.lg,
        background: designSystem.colors.background.card,
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
          minHeight: isMobile ? 48 : 44,
          padding: '10px 12px',
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
        <span style={{ fontWeight: 600 }}>指定課時數</span>
        <span
          style={{
            flex: 1,
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
              : `剩 ${balance} 分${giftBalance !== 0 ? `（指定課 ${regularBalance}・贈送 ${giftBalance}）` : ''}｜${deduct ? `本次扣 ${minutes} 分` : '本次不扣'} ${expanded ? '收合' : '展開'}`}
        </span>
      </button>

      {expanded && !loading && !loadError && (
        <div
          style={{
            padding: '12px',
            borderTop: `1px solid ${designSystem.colors.border.light}`,
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
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button
                    type="button"
                    data-track="coach_designated_source_regular"
                    onClick={() => setAllocation(minutes || participant.duration_min, 0)}
                    style={{
                      ...getButtonStyle(!split && giftMinutes === 0 ? 'primary' : 'outline', 'small', isMobile),
                      flex: 1,
                    }}
                  >
                    指定課 {regularBalance} 分
                  </button>
                  <button
                    type="button"
                    data-track="coach_designated_source_gift"
                    onClick={() => setAllocation(0, minutes || participant.duration_min)}
                    style={{
                      ...getButtonStyle(!split && giftMinutes > 0 ? 'primary' : 'outline', 'small', isMobile),
                      flex: 1,
                    }}
                  >
                    贈送 {giftBalance} 分
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
              {showGift && !split && minutes > 1 && (
                <button
                  type="button"
                  data-track="coach_designated_source_split"
                  onClick={() => {
                    const gift = Math.max(
                      1,
                      Math.min(Math.max(giftBalance, 0), Math.floor(minutes / 2)),
                    )
                    setAllocation(minutes - gift, gift)
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: designSystem.colors.primary[600],
                    padding: '8px 0 0',
                    cursor: 'pointer',
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  分開扣
                </button>
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
                扣除後總剩餘 {after} 分鐘
                {showGift && (
                  <span>
                    {' '}（指定課 {regularBalance - regularMinutes}・贈送 {giftBalance - giftMinutes}）
                  </span>
                )}
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
            onClick={() => {
              loadedKeyRef.current = null
              setReloadToken((value) => value + 1)
            }}
            style={getButtonStyle('outline', 'small', isMobile)}
          >
            重新載入
          </button>
        </div>
      )}
    </div>
  )
}
