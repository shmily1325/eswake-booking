// 儲值卡片組件

interface BalanceCardProps {
  label: string
  value: number | undefined
  unit: '元' | '分'
  color: string
  category: string
  onClick: (category: string) => void
}

export function BalanceCard({
  label,
  value,
  unit,
  color,
  category,
  onClick
}: BalanceCardProps) {
  const displayValue = value || 0
  const formattedValue = unit === '元' ? `$${displayValue}` : `${displayValue}分`

  return (
    <div 
      onClick={() => onClick(category)}
      style={{
        background: 'white',
        borderRadius: '8px',
        padding: '16px',
        border: `2px solid ${color}15`,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)'
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <div style={{ fontSize: '13px', color: '#999', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ 
        fontSize: unit === '元' ? '24px' : '22px', 
        fontWeight: '700', 
        color
      }}>
        {formattedValue}
      </div>
    </div>
  )
}

