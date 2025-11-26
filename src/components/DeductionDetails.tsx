interface Transaction {
  id: number
  category: string
  amount?: number | null
  minutes?: number | null
  description?: string | null
  notes?: string | null
}

interface DeductionDetailsProps {
  transactions: Transaction[]
  paymentMethod: string
  notes?: string | null
}

// 扣款类别配置
const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; type: 'amount' | 'minutes' }> = {
  balance: { emoji: '💰', label: '儲值', type: 'amount' },
  vip_voucher: { emoji: '💎', label: 'VIP票券', type: 'amount' },
  boat_voucher_g23: { emoji: '🚤', label: 'G23船券', type: 'minutes' },
  boat_voucher_g21_panther: { emoji: '⛵', label: 'G21/黑豹券', type: 'minutes' },
  designated_lesson: { emoji: '🎓', label: '指定課時數', type: 'minutes' },
  plan: { emoji: '⭐', label: '方案', type: 'amount' },
  gift_boat_hours: { emoji: '🎁', label: '贈送時數', type: 'minutes' }
}

export function DeductionDetails({ transactions, notes }: DeductionDetailsProps) {

  // 如果是现金/汇款结清，直接显示结清信息
  if (notes && (notes.includes('[現金結清]') || notes.includes('[匯款結清]') || notes.includes('[指定課不收費]'))) {
    // 提取结清类型并去掉方括号
    let settlementText = ''
    let emoji = '💵'
    
    if (notes.includes('[現金結清]')) {
      settlementText = '現金結清'
      emoji = '💵'
    } else if (notes.includes('[匯款結清]')) {
      settlementText = '匯款結清'
      emoji = '🏦'
    } else if (notes.includes('[指定課不收費]')) {
      settlementText = '指定課不收費'
      emoji = '🎓'
    }
    
    return (
      <div style={{ 
        color: '#28a745', 
        fontSize: '12px',
        marginTop: '4px',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span>{emoji}</span>
        <span>{settlementText}</span>
      </div>
    )
  }

  // 如果没有交易记录，不显示
  if (!transactions || transactions.length === 0) {
    return null
  }

  // 分析交易记录
  const deductionItems = transactions.map(tx => {
    const config = CATEGORY_CONFIG[tx.category]
    if (!config) return null

    // 提取方案名称（从 notes 字段）
    let planName = ''
    if (tx.category === 'plan' && tx.notes) {
      planName = tx.notes.split(' - ')[0] // 取第一部分作为方案名称
    }

    // 判断是否为指定课扣款（从 description 判断）
    const isDesignatedLesson = tx.description?.includes('【指定課】')
    
    // 如果是指定课扣款，使用特殊标签
    let displayLabel = config.label
    let displayEmoji = config.emoji
    if (isDesignatedLesson && tx.category === 'balance') {
      displayLabel = '指定課'
      displayEmoji = '🎓'
    }

    return {
      emoji: displayEmoji,
      label: displayLabel,
      value: config.type === 'amount' 
        ? (tx.amount ? `$${Math.abs(tx.amount).toLocaleString()}` : '$0')
        : (tx.minutes ? `${Math.abs(tx.minutes)}分` : '0分'),
      isPlan: tx.category === 'plan',
      planName,
      description: tx.description,
      isDesignatedLesson
    }
  }).filter(Boolean)

  if (deductionItems.length === 0) {
    return null
  }

  // 单笔扣款 - 简洁显示
  if (deductionItems.length === 1) {
    const item = deductionItems[0]
    if (!item) return null
    
    // 方案扣款
    if (item.isPlan) {
      return (
        <div style={{ 
          fontSize: '12px',
          marginTop: '4px',
          color: '#b35900',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>{item.emoji}</span>
          <span>{item.planName || '方案'}</span>
          <span style={{ color: '#999', fontSize: '11px' }}>(不扣款)</span>
        </div>
      )
    }

    // 一般扣款
    return (
      <div style={{ 
        fontSize: '12px',
        marginTop: '4px',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span>{item.emoji}</span>
        <span>{item.label}：</span>
        <span style={{ fontWeight: '600', color: '#333' }}>{item.value}</span>
      </div>
    )
  }

  // 多笔扣款 - 用 + 号连接显示在同一行
  const deductionText = deductionItems.map(item => {
    if (!item) return ''
    if (item.isPlan) {
      return `${item.emoji} ${item.planName || '方案'}`
    }
    return `${item.emoji} ${item.label} ${item.value}`
  }).filter(Boolean).join(' + ')

  return (
    <div style={{ 
      fontSize: '12px',
      marginTop: '4px',
      color: '#666',
      paddingLeft: '2px'
    }}>
      {deductionText}
    </div>
  )
}

