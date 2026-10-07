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
        setShouldShow(shouldShowCoachDesignatedControl(context.has_entries, false))

        if (!participant.designated_hours_initialized) {
          const existingDeduction = context.deduction_minutes
          onUpdateRef.current(
            participantIndex,
            'designated_hours_deduct',
            defaultCoachDesignatedDeduction(
              context.balance,
              existingDeduction,
              context.deduction_decided,
            ),
          )
          onUpdateRef.current(
            participantIndex,
            'designated_hours_minutes',
            existingDeduction ?? participant.duration_min,
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
  const minutes = participant.designated_hours_minutes ?? participant.duration_min
  const after = balance - (deduct ? minutes : 0)

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
        <span style={{ color: loadError ? designSystem.colors.danger[700] : designSystem.colors.text.secondary }}>
          {loading
            ? '載入中'
            : loadError
              ? '無法載入'
              : `剩 ${balance} 分｜${deduct ? `本次扣 ${minutes} 分` : '本次不扣'} ${expanded ? '收合' : '展開'}`}
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
              <input
                type="text"
                inputMode="numeric"
                aria-label="本次扣除分鐘"
                value={minutes || ''}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, '')
                  onUpdate(
                    participantIndex,
                    'designated_hours_minutes',
                    value === '' ? 0 : Number(value),
                  )
                }}
                style={getInputStyle(isMobile)}
              />
              <div
                style={{
                  marginTop: 8,
                  fontSize: getFontSize('bodySmall', isMobile),
                  color: after < 0
                    ? designSystem.colors.warning[700]
                    : designSystem.colors.text.secondary,
                }}
              >
                扣除後 {after} 分鐘
              </div>
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
