import { useState } from 'react'
import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
import { formatDuration, getRankIcon, getProgressPercent } from '../utils'

interface RankingItem {
  id: string
  name: string
  value: number // 主要數值（用於排序和進度條）
  count?: number // 次數
  isWarning?: boolean // 是否為警告項目（如未指派）
  badge?: string // 額外標籤
}

interface RankingCardProps {
  title: string
  icon: string
  subtitle?: string
  items: RankingItem[]
  accentColor?: string // 進度條顏色
  warningColor?: string // 警告項目顏色
  renderDetail?: (item: RankingItem) => ReactNode
  emptyText?: string
  showRank?: boolean // 是否顯示排名
}

export function RankingCard({
  title,
  icon,
  subtitle,
  items,
  accentColor = '#4a90e2',
  warningColor = '#ff9800',
  renderDetail,
  emptyText = '暫無資料',
  showRank = true
}: RankingCardProps) {
  const { isMobile } = useResponsive()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const maxValue = Math.max(...items.map(item => item.value), 1)

  // 計算非警告項目的排名
  let rank = 0

  return (
    <div style={{
      ...getCardStyle(isMobile),
      padding: isMobile ? '14px' : '20px'
    }}>
      {/* 標題區 */}
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: isMobile ? '15px' : '17px',
        fontWeight: '700',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '4px' : '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '4px',
            height: '20px',
            background: accentColor,
            borderRadius: '2px',
            display: 'inline-block'
          }} />
          {icon} {title}
        </div>
        {subtitle && (
          <span style={{
            fontSize: isMobile ? '11px' : '13px',
            color: '#999',
            fontWeight: '400',
            marginLeft: isMobile ? '12px' : '0'
          }}>
            {subtitle}
          </span>
        )}
      </h3>

      {/* 排行列表 */}
      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => {
            // 計算排名（跳過警告項目）
            const displayRank = item.isWarning ? null : ++rank
            const isExpanded = expandedId === item.id
            const isHovered = hoveredId === item.id
            const hasDetail = renderDetail && !item.isWarning
            const itemColor = item.isWarning ? warningColor : accentColor
            const progressPercent = getProgressPercent(item.value, maxValue)

            return (
              <div key={item.id}>
                {/* 項目列 */}
                <div
                  onClick={() => hasDetail && setExpandedId(isExpanded ? null : item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '12px',
                    background: isExpanded 
                      ? '#e3f2fd' 
                      : isHovered && hasDetail 
                        ? '#f0f4f8' 
                        : item.isWarning 
                          ? '#fff8e1'
                          : displayRank && displayRank <= 3
                            ? '#fffbeb'
                            : '#f8f9fa',
                    borderRadius: isExpanded ? '8px 8px 0 0' : '8px',
                    cursor: hasDetail ? 'pointer' : 'default',
                    transition: 'background 0.2s',
                    borderLeft: item.isWarning ? `3px solid ${warningColor}` : 'none'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* 展開箭頭 */}
                      {hasDetail && (
                        <span style={{
                          fontSize: '12px',
                          color: isExpanded ? accentColor : '#999',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}>
                          ▶
                        </span>
                      )}
                      {/* 排名/圖示 */}
                      <span style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        {showRank && (displayRank === null ? '⚠️' : getRankIcon(displayRank))}
                        {' '}{item.name}
                      </span>
                      {/* 標籤 */}
                      {item.badge && (
                        <span style={{
                          marginLeft: '4px',
                          fontSize: '11px',
                          color: item.isWarning ? warningColor : '#666',
                          background: item.isWarning ? '#fff3e0' : '#e3f2fd',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {/* 數值 */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {item.count !== undefined && (
                        <span style={{ color: '#666', fontSize: '13px' }}>
                          {item.count} 筆
                        </span>
                      )}
                      <span style={{ color: itemColor, fontSize: '14px', fontWeight: '600' }}>
                        {formatDuration(item.value)}
                      </span>
                    </div>
                  </div>

                  {/* 進度條 */}
                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: item.isWarning ? '#ffecb3' : '#e3f2fd',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: item.isWarning
                        ? `linear-gradient(90deg, ${warningColor}, #f57c00)`
                        : `linear-gradient(90deg, ${accentColor}, #1976d2)`,
                      borderRadius: '4px',
                      transition: 'width 0.3s'
                    }} />
                    {/* 進度條上的數字 */}
                    {progressPercent > 25 && (
                      <span style={{
                        position: 'absolute',
                        right: `${100 - progressPercent + 2}%`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '9px',
                        color: 'white',
                        fontWeight: '600',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}>
                        {Math.round(progressPercent)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* 展開詳情 */}
                {isExpanded && hasDetail && renderDetail && (
                  <div style={{
                    background: 'white',
                    border: '1px solid #e3f2fd',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    padding: '12px'
                  }}>
                    {renderDetail(item)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#999'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
          {emptyText}
        </div>
      )}
    </div>
  )
}

