import React from 'react'
import { designSystem } from '../../styles/designSystem'

export type BookingStatus = 'confirmed' | 'pending' | 'checked_in' | 'completed' | 'cancelled'

interface StatusBadgeProps {
  status: BookingStatus
  showLabel?: boolean
  size?: 'small' | 'medium'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showLabel = false,
  size = 'medium',
}) => {
  const statusConfig: Record<BookingStatus, { color: string; label: string; bg: string }> = {
    confirmed: {
      color: designSystem.colors.success[500],
      label: '已確認',
      bg: designSystem.colors.success[50],
    },
    pending: {
      color: designSystem.colors.warning[500],
      label: '未付款',
      bg: designSystem.colors.warning[50],
    },
    checked_in: {
      color: designSystem.colors.info[500],
      label: '已報到',
      bg: designSystem.colors.info[50],
    },
    completed: {
      color: designSystem.colors.secondary[600],
      label: '已完成',
      bg: designSystem.colors.secondary[100],
    },
    cancelled: {
      color: designSystem.colors.danger[500],
      label: '已取消',
      bg: designSystem.colors.danger[50],
    },
  }

  const config = statusConfig[status]
  const dotSize = size === 'small' ? '8px' : '10px'

  if (!showLabel) {
    // 只顯示圓點（用於卡片右上角）
    return (
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: config.color,
          boxShadow: `0 0 0 2px white, 0 0 4px ${config.color}`,
          zIndex: 10,
        }}
        title={config.label}
      />
    )
  }

  // 顯示完整標籤
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: designSystem.spacing.xs,
        padding: size === 'small' ? '2px 8px' : '4px 10px',
        borderRadius: designSystem.borderRadius.full,
        background: config.bg,
        color: config.color,
        fontSize: size === 'small' ? '11px' : '12px',
        fontWeight: '600',
        border: `1px solid ${config.color}`,
      }}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: config.color,
        }}
      />
      {config.label}
    </span>
  )
}

