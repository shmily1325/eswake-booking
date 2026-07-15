import { getFontSize, designSystem } from '../../../../styles/designSystem'
import { useResponsive } from '../../../../hooks/useResponsive'

interface MonthOption {
  value: string
  label: string
  count?: number
}

interface MonthFilterProps {
  options: MonthOption[]
  selected: string
  onSelect: (value: string) => void
  showAll?: boolean
  allLabel?: string
  allCount?: number
}

/** Dashboard 期間 chip：選中近黑，與月報／年報一致 */
function chipStyle(isActive: boolean, isMobile: boolean) {
  return {
    padding: '8px 16px',
    borderRadius: designSystem.borderRadius.md,
    border: isActive
      ? 'none'
      : `1px solid ${designSystem.colors.border.main}`,
    background: isActive
      ? designSystem.colors.primary[500]
      : designSystem.colors.background.card,
    color: isActive ? '#ffffff' : designSystem.colors.text.secondary,
    fontSize: getFontSize('button', isMobile),
    fontWeight: isActive ? 600 : 500,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
    transition: 'all 0.2s',
    boxShadow: isActive ? designSystem.shadows.sm : 'none',
  }
}

function countBadgeStyle(isActive: boolean, isMobile: boolean) {
  return {
    fontSize: getFontSize('caption', isMobile),
    fontWeight: 700 as const,
    background: isActive
      ? 'rgba(255,255,255,0.2)'
      : designSystem.colors.background.hover,
    color: isActive ? '#ffffff' : designSystem.colors.text.secondary,
    padding: '1px 5px',
    borderRadius: designSystem.borderRadius.sm,
  }
}

export function MonthFilter({
  options,
  selected,
  onSelect,
  showAll = true,
  allLabel = '全部',
  allCount
}: MonthFilterProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {showAll && (
        <button
          type="button"
          data-track="dashboard_filter_all"
          onClick={() => onSelect('all')}
          style={chipStyle(selected === 'all', isMobile)}
        >
          {allLabel}
          {allCount !== undefined && (
            <span style={countBadgeStyle(selected === 'all', isMobile)}>
              {allCount}
            </span>
          )}
        </button>
      )}
      {options.map(option => (
        <button
          type="button"
          key={option.value}
          data-track={`dashboard_filter_${option.value}`}
          onClick={() => onSelect(option.value)}
          style={chipStyle(selected === option.value, isMobile)}
        >
          {option.label}
          {option.count !== undefined && (
            <span style={countBadgeStyle(selected === option.value, isMobile)}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
