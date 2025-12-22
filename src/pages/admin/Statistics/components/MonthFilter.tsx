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
    padding: '8px 16px',
    background: isActive ? '#4a90e2' : 'white',
    color: isActive ? 'white' : '#666',
    border: isActive ? 'none' : '1px solid #e0e0e0',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500' as const,
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.2s'
  })

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {showAll && (
        <button
          onClick={() => onSelect('all')}
          style={buttonStyle(selected === 'all')}
        >
          {allLabel}
          {allCount !== undefined && (
            <span style={{ 
              fontSize: '11px', 
              opacity: 0.8,
              background: selected === 'all' ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
              padding: '1px 5px',
              borderRadius: '4px'
            }}>
              {allCount}
            </span>
          )}
        </button>
      )}
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          style={buttonStyle(selected === option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span style={{ 
              fontSize: '11px', 
              opacity: 0.8,
              background: selected === option.value ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
              padding: '1px 5px',
              borderRadius: '4px'
            }}>
              {option.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

