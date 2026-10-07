import { useEffect, useState } from 'react'
import { designSystem, getButtonStyle, getFontSize, getInputStyle } from '../styles/designSystem'
import {
  fetchCoachDesignatedMemberContext,
  syncCoachDesignatedReportDeductions,
} from '../pages/coach/designatedHours/api'
import { defaultCoachDesignatedDeduction } from '../pages/coach/designatedHours/deductionDefaults'
import { useToast } from './ui'

interface Props {
  participantId: number
  coachId: string | null
  memberId: string | null
  lessonType?: string | null
  durationMin: number
  isMobile: boolean
}

export function AdminCoachDesignatedDeductionControl({
  participantId,
  coachId,
  memberId,
  lessonType,
  durationMin,
  isMobile,
}: Props) {
  const toast = useToast()
  const [balance, setBalance] = useState(0)
  const [deduct, setDeduct] = useState(false)
  const [minutes, setMinutes] = useState(durationMin)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const eligible = !!coachId && !!memberId && lessonType === 'designated_free'

  useEffect(() => {
    if (!expanded || loaded || !eligible || !coachId || !memberId) return
    let cancelled = false
    setLoading(true)
    fetchCoachDesignatedMemberContext(coachId, memberId, participantId)
      .then((context) => {
        if (cancelled) return
        setBalance(context.balance)
        setDeduct(defaultCoachDesignatedDeduction(
          context.balance,
          context.deduction_minutes,
          context.deduction_decided,
        ))
        setMinutes(context.deduction_minutes ?? durationMin)
        setLoaded(true)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) toast.error('無法載入指定課時數')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [coachId, durationMin, eligible, expanded, loaded, memberId, participantId, toast])

  if (!eligible || !coachId) return null

  const save = async () => {
    if (deduct && minutes <= 0) {
      toast.warning('扣除分鐘必須大於 0')
      return
    }
    setLoading(true)
    try {
      await syncCoachDesignatedReportDeductions(coachId, [{
        participant_id: participantId,
        deduct,
        minutes,
      }])
      const context = await fetchCoachDesignatedMemberContext(
        coachId,
        memberId!,
        participantId,
      )
      setBalance(context.balance)
      setDeduct(defaultCoachDesignatedDeduction(
        context.balance,
        context.deduction_minutes,
        context.deduction_decided,
      ))
      setMinutes(context.deduction_minutes ?? durationMin)
      toast.success('指定課扣除已更新')
    } catch (error) {
      console.error(error)
      toast.error('指定課扣除更新失敗')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: designSystem.borderRadius.lg,
        border: `1px solid ${designSystem.colors.border.light}`,
        background: designSystem.colors.background.main,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10 }}>
        {loaded
          ? `指定課時數 剩餘 ${balance} 分｜${deduct ? `本次扣 ${minutes} 分` : '本次未扣'}`
          : '指定課扣除'}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          style={{
            marginLeft: 8,
            border: 0,
            padding: 0,
            color: designSystem.colors.primary[600],
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          {expanded ? '收合' : '修正'}
        </button>
      </div>
      {expanded && loading && !loaded && (
        <div style={{ color: designSystem.colors.text.secondary }}>載入中...</div>
      )}
      {expanded && loaded && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40 }}>
          <input
            type="checkbox"
            checked={deduct}
            onChange={(event) => setDeduct(event.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          本次扣除
        </label>
        {deduct && (
          <input
            aria-label="管理員修正指定課扣除分鐘"
            type="text"
            inputMode="numeric"
            value={minutes || ''}
            onChange={(event) => setMinutes(Number(event.target.value.replace(/\D/g, '')) || 0)}
            style={{ ...getInputStyle(isMobile), width: 110 }}
          />
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void save()}
          style={getButtonStyle('outline', 'small', isMobile)}
        >
          {loading ? '儲存中...' : '更新扣除'}
        </button>
      </div>}
      {expanded && loaded && <div style={{ marginTop: 8, color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
        此處只調整教練指定課時數，不影響原本扣款。
      </div>}
    </div>
  )
}
