// 儲值卡片組件

interface BalanceCardProps {
  label: string
  emoji: string
  value: number | undefined
  unit: '元' | '分'
  color: string
  category: string
  onClick: (category: string) => void
}

export function BalanceCard({
  label,
  emoji,
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
        background: '#f8f9fa',
        borderRadius: '8px',
        padding: '16px',
        border: `2px solid ${color}`,
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
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
        {emoji} {label}
      </div>
      <div style={{ 
        fontSize: unit === '元' ? '22px' : '20px', 
        fontWeight: unit === '元' ? '700' : '600', 
        color 
      }}>
        {formattedValue}
      </div>
    </div>
  )
}

