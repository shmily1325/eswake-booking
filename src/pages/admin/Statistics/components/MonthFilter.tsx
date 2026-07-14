import { getFilterChipStyle, getFontSize, designSystem } from '../../../../styles/designSystem'

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

export function MonthFilter({
  options,
  selected,
  onSelect,
  showAll = true,
  allLabel = '全部',
  allCount
}: MonthFilterProps) {
  const buttonStyle = (isActive: boolean) => ({
    ...getFilterChipStyle(isActive, 'info'),
    padding: '8px 16px',
    fontSize: getFontSize('button', false),
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '4px',
    transition: 'all 0.2s'
  })

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {showAll && (
        <button
          data-track="dashboard_filter_all"
          onClick={() => onSelect('all')}
          style={buttonStyle(selected === 'all')}
        >
          {allLabel}
          {allCount !== undefined && (
            <span style={{ 
              fontSize: getFontSize('caption', true), 
              fontWeight: 700,
              background: selected === 'all'
                ? `${designSystem.colors.info[500]}22`
                : designSystem.colors.background.hover,
              color: selected === 'all'
                ? designSystem.colors.info[700]
                : designSystem.colors.text.secondary,
              padding: '1px 5px',
              borderRadius: designSystem.borderRadius.sm
            }}>
              {allCount}
            </span>
          )}
        </button>
      )}
      {options.map(option => (
        <button
          key={option.value}
          data-track={`dashboard_filter_${option.value}`}
          onClick={() => onSelect(option.value)}
          style={buttonStyle(selected === option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span style={{ 
              fontSize: getFontSize('caption', true), 
              fontWeight: 700,
              background: selected === option.value
                ? `${designSystem.colors.info[500]}22`
                : designSystem.colors.background.hover,
              color: selected === option.value
                ? designSystem.colors.info[700]
                : designSystem.colors.text.secondary,
              padding: '1px 5px',
              borderRadius: designSystem.borderRadius.sm
            }}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
