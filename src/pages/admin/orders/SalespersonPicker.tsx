import {
  designSystem,
  getBookingChoiceStyle,
  getFontSize,
} from '../../../styles/designSystem'
import type { SalespersonCoach } from './api'

interface Props {
  coaches: SalespersonCoach[]
  selectedCoachId: string | null | undefined
  selectedName: string | null | undefined
  disabled?: boolean
  isMobile: boolean
  onChange: (coach: SalespersonCoach | null) => void
  onApplyAll?: () => void
}

export function SalespersonPicker({
  coaches,
  selectedCoachId,
  selectedName,
  disabled = false,
  isMobile,
  onChange,
  onApplyAll,
}: Props) {
  const selectedCoach = coaches.find((coach) => coach.id === selectedCoachId)
  const choices = selectedCoachId && !selectedCoach
    ? [{ id: selectedCoachId, name: selectedName || '已停用教練' }, ...coaches]
    : coaches

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: 500,
          }}
        >
          銷售人員
        </span>
        {!disabled && onApplyAll && selectedCoachId && (
          <button
            type="button"
            onClick={onApplyAll}
            style={{
              border: 'none',
              padding: '4px 0',
              background: 'transparent',
              color: designSystem.colors.primary[600],
              fontSize: getFontSize('caption', isMobile),
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            套用至全部商品
          </button>
        )}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(82px, 1fr))',
          gap: 8,
        }}
      >
        <button
          type="button"
          disabled={disabled}
          aria-pressed={!selectedCoachId}
          onClick={() => onChange(null)}
          style={{
            ...getBookingChoiceStyle(!selectedCoachId),
            minHeight: 42,
            padding: '8px 10px',
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: !selectedCoachId ? 700 : 500,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.7 : 1,
          }}
        >
          未指定
        </button>
        {choices.map((coach) => {
          const selected = coach.id === selectedCoachId
          return (
            <button
              key={coach.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(coach)}
              style={{
                ...getBookingChoiceStyle(selected),
                minHeight: 42,
                padding: '8px 10px',
                fontSize: getFontSize('bodySmall', isMobile),
                fontWeight: selected ? 700 : 500,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.7 : 1,
              }}
            >
              {coach.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
