import React from 'react'
import { designSystem } from '../../styles/designSystem'

interface LoadingProps {
  size?: 'small' | 'medium' | 'large'
  color?: string
  fullScreen?: boolean
  text?: string
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  color = designSystem.colors.primary[500],
  fullScreen = false,
  text,
}) => {
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 60,
  }

  const spinnerSize = sizeMap[size]

  const spinnerStyle: React.CSSProperties = {
    width: `${spinnerSize}px`,
    height: `${spinnerSize}px`,
    border: `${Math.max(2, spinnerSize / 10)}px solid ${color}20`,
    borderTop: `${Math.max(2, spinnerSize / 10)}px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: designSystem.zIndex.modal,
        gap: designSystem.spacing.md,
      }
    : {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: designSystem.spacing.sm,
      }

  const textStyle: React.CSSProperties = {
    color: designSystem.colors.text.secondary,
    fontSize: designSystem.fontSize.body.desktop,
    marginTop: designSystem.spacing.sm,
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={containerStyle}>
        <div style={spinnerStyle} />
        {text && <div style={textStyle}>{text}</div>}
      </div>
    </>
  )
}

// Skeleton Loading Component
interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  count?: number
  style?: React.CSSProperties
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = designSystem.borderRadius.md,
  count = 1,
  style,
}) => {
  const skeletonStyle: React.CSSProperties = {
    width,
    height,
    borderRadius,
    background: `linear-gradient(90deg, ${designSystem.colors.secondary[100]} 25%, ${designSystem.colors.secondary[200]} 50%, ${designSystem.colors.secondary[100]} 75%)`,
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style,
  }

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.sm }}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} style={skeletonStyle} />
        ))}
      </div>
    </>
  )
}

// Inline Spinner (for buttons, etc.)
interface SpinnerProps {
  size?: number
  color?: string
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 16,
  color = 'currentColor',
}) => {
  const spinnerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    border: `2px solid ${color}30`,
    borderTop: `2px solid ${color}`,
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block',
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={spinnerStyle} />
    </>
  )
}

// 預約卡片骨架屏
interface BookingCardSkeletonProps {
  isMobile?: boolean
}

export const BookingCardSkeleton: React.FC<BookingCardSkeletonProps> = ({ isMobile = false }) => {
  return (
    <div style={{
      background: 'white',
      padding: isMobile ? '12px' : '16px',
      borderRadius: designSystem.borderRadius.lg,
      boxShadow: designSystem.shadows.sm,
      marginBottom: isMobile ? designSystem.spacing.sm : designSystem.spacing.md,
    }}>
      <div style={{ display: 'flex', gap: designSystem.spacing.md, alignItems: 'flex-start' }}>
        {/* 時間區域 */}
        <div style={{ minWidth: isMobile ? '60px' : '80px' }}>
          <Skeleton width={isMobile ? '60px' : '70px'} height="18px" />
          <div style={{ marginTop: '4px' }}>
            <Skeleton width={isMobile ? '50px' : '60px'} height="14px" />
          </div>
        </div>

        {/* 內容區域 */}
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '8px' }}>
            <Skeleton width="80%" height="20px" />
          </div>
          <div style={{ marginBottom: '6px' }}>
            <Skeleton width="60%" height="16px" />
          </div>
          <Skeleton width="40%" height="14px" />
        </div>

        {/* 操作按鈕區域 */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
            <Skeleton width="60px" height="32px" borderRadius={designSystem.borderRadius.md} />
            <Skeleton width="60px" height="32px" borderRadius={designSystem.borderRadius.md} />
          </div>
        )}
      </div>
    </div>
  )
}

// 列表骨架屏（多個卡片）
interface BookingListSkeletonProps {
  count?: number
  isMobile?: boolean
}

export const BookingListSkeleton: React.FC<BookingListSkeletonProps> = ({ 
  count = 5, 
  isMobile = false 
}) => {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <BookingCardSkeleton key={i} isMobile={isMobile} />
      ))}
    </div>
  )
}

// 時間軸骨架屏
interface TimelineSkeletonProps {
  isMobile?: boolean
}

export const TimelineSkeleton: React.FC<TimelineSkeletonProps> = ({ isMobile = false }) => {
  return (
    <div style={{ 
      display: 'flex', 
      gap: isMobile ? designSystem.spacing.sm : designSystem.spacing.lg,
      overflowX: 'auto',
      padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg
    }}>
      {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
        <div 
          key={i}
          style={{
            minWidth: isMobile ? '140px' : '200px',
            background: 'white',
            borderRadius: designSystem.borderRadius.lg,
            padding: isMobile ? designSystem.spacing.md : designSystem.spacing.lg,
            boxShadow: designSystem.shadows.sm
          }}
        >
          <div style={{ marginBottom: designSystem.spacing.md }}>
            <Skeleton width="100%" height="24px" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.sm }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton 
                key={j} 
                width="100%" 
                height={isMobile ? '50px' : '60px'} 
                borderRadius={designSystem.borderRadius.md} 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// 統計卡片骨架屏
export const StatCardSkeleton: React.FC = () => {
  return (
    <div style={{
      background: 'white',
      padding: designSystem.spacing.lg,
      borderRadius: designSystem.borderRadius.lg,
      boxShadow: designSystem.shadows.sm,
    }}>
      <div style={{ marginBottom: designSystem.spacing.md }}>
        <Skeleton width="60%" height="16px" />
      </div>
      <Skeleton width="40%" height="32px" />
    </div>
  )
}

// 表格骨架屏
interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div style={{ background: 'white', borderRadius: designSystem.borderRadius.lg, overflow: 'hidden' }}>
      {/* 表頭 */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: designSystem.spacing.lg,
        padding: designSystem.spacing.lg,
        borderBottom: `1px solid ${designSystem.colors.secondary[200]}`
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="80%" height="16px" />
        ))}
      </div>

      {/* 表格內容 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i}
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: designSystem.spacing.lg,
            padding: designSystem.spacing.lg,
            borderBottom: i < rows - 1 ? `1px solid ${designSystem.colors.secondary[100]}` : 'none'
          }}
        >
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} width="70%" height="14px" />
          ))}
        </div>
      ))}
    </div>
  )
}
