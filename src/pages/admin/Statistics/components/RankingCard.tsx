import { useState } from 'react'
import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'
import { formatDuration, getRankIcon, getProgressPercent } from '../utils'

interface RankingItem {
  id: string
  name: string
  value: number
  count?: number
  isWarning?: boolean
  badge?: string
}

interface RankingCardProps {
  title: string
  /** Optional; emoji decoration discouraged — prefer plain title. */
  icon?: string
  subtitle?: string
  items: RankingItem[]
  accentColor?: string
  warningColor?: string
  renderDetail?: (item: RankingItem) => ReactNode
  emptyText?: string
  showRank?: boolean
}

export function RankingCard({
  title,
  subtitle,
  items,
  accentColor = designSystem.colors.primary[500],
  warningColor = designSystem.colors.warning[500],
  renderDetail,
  emptyText = '暫無資料',
  showRank = true
}: RankingCardProps) {
  const { isMobile } = useResponsive()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const maxValue = Math.max(...items.map(item => item.value), 1)

  let rank = 0

  return (
    <div style={{
      ...getCardStyle(isMobile),
      padding: isMobile ? '14px' : '20px'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: getFontSize('h3', isMobile),
        fontWeight: '700',
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '4px' : '8px',
        color: designSystem.colors.text.primary
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {title}
        </div>
        {subtitle && (
          <span style={{
            fontSize: getFontSize('bodySmall', isMobile),
            color: designSystem.colors.text.disabled,
            fontWeight: '400',
            marginLeft: isMobile ? '12px' : '0'
          }}>
            {subtitle}
          </span>
        )}
      </h3>

      {items.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => {
            const displayRank = item.isWarning ? null : ++rank
            const isExpanded = expandedId === item.id
            const isHovered = hoveredId === item.id
            const hasDetail = renderDetail && !item.isWarning
            const itemColor = item.isWarning ? warningColor : accentColor
            const progressPercent = getProgressPercent(item.value, maxValue)

            return (
              <div key={item.id}>
                <div
                  onClick={() => hasDetail && setExpandedId(isExpanded ? null : item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '12px',
                    background: isExpanded 
                      ? designSystem.colors.info[50]
                      : isHovered && hasDetail 
                        ? designSystem.colors.background.hover
                        : item.isWarning 
                          ? designSystem.colors.warning[50]
                          : displayRank && displayRank <= 3
                            ? designSystem.colors.warning[50]
                            : designSystem.colors.background.hover,
                    borderRadius: isExpanded
                      ? `${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg} 0 0`
                      : designSystem.borderRadius.lg,
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
                      {hasDetail && (
                        <span style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: isExpanded ? accentColor : designSystem.colors.text.disabled,
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}>
                          ▶
                        </span>
                      )}
                      <span style={{
                        fontWeight: '600',
                        color: designSystem.colors.text.primary,
                        fontSize: getFontSize('body', isMobile)
                      }}>
                        {showRank && (displayRank === null ? '⚠️' : getRankIcon(displayRank))}
                        {' '}{item.name}
                      </span>
                      {item.badge && (
                        <span style={{
                          marginLeft: '4px',
                          fontSize: getFontSize('caption', true),
                          color: item.isWarning
                            ? designSystem.colors.warning[700]
                            : designSystem.colors.text.secondary,
                          background: item.isWarning
                            ? designSystem.colors.warning[50]
                            : designSystem.colors.info[50],
                          border: `1px solid ${item.isWarning ? designSystem.colors.warning[500] : designSystem.colors.info[500]}33`,
                          padding: '2px 6px',
                          borderRadius: designSystem.borderRadius.sm
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {item.count !== undefined && (
                        <span style={{
                          color: designSystem.colors.text.secondary,
                          fontSize: getFontSize('bodySmall', isMobile)
                        }}>
                          {item.count} 筆
                        </span>
                      )}
                      <span style={{
                        color: itemColor,
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: '600'
                      }}>
                        {formatDuration(item.value)}
                      </span>
                    </div>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '8px',
                    background: item.isWarning
                      ? `${designSystem.colors.warning[500]}33`
                      : designSystem.colors.info[50],
                    borderRadius: designSystem.borderRadius.sm,
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: itemColor,
                      borderRadius: designSystem.borderRadius.sm,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {isExpanded && hasDetail && renderDetail && (
                  <div style={{
                    background: 'white',
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderTop: 'none',
                    borderRadius: `0 0 ${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg}`,
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
          padding: '24px',
          color: designSystem.colors.text.disabled
        }}>
          {emptyText}
        </div>
      )}
    </div>
  )
}
