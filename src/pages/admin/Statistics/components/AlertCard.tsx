import { useState } from 'react'
import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { getCardStyle } from '../../../../styles/designSystem'
import { formatDuration } from '../utils'

interface ContactStat {
  contactName: string
  minutes: number
  count: number
}

interface AlertCardProps {
  variant: 'warning' | 'info' | 'success'
  icon?: string
  title: string
  count: number
  minutes: number
  children?: ReactNode
  expandable?: boolean
  expandedContent?: ReactNode
  contactStats?: ContactStat[]
}

const variantStyles = {
  warning: {
    background: '#fff8e1',
    borderColor: '#ff9800',
    iconBg: '#fff3e0',
    textColor: '#e65100'
  },
  info: {
    background: '#e3f2fd',
    borderColor: '#2196f3',
    iconBg: '#bbdefb',
    textColor: '#1565c0'
  },
  success: {
    background: '#e8f5e9',
    borderColor: '#4caf50',
    iconBg: '#c8e6c9',
    textColor: '#2e7d32'
  }
}

export function AlertCard({
  variant,
  icon = '⚠️',
  title,
  count,
  minutes,
  children,
  expandable = false,
  expandedContent,
  contactStats
}: AlertCardProps) {
  const { isMobile } = useResponsive()
  const [expanded, setExpanded] = useState(false)
  const styles = variantStyles[variant]

  // 判斷是否有可展開的內容
  const hasExpandableContent = expandable && (expandedContent || (contactStats && contactStats.length > 0))

  return (
    <div style={{
      ...getCardStyle(isMobile),
      background: styles.background,
      borderLeft: `4px solid ${styles.borderColor}`,
      marginBottom: '16px',
      padding: 0,
      overflow: 'hidden'
    }}>
      {/* 主要內容區 */}
      <div 
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: isMobile ? '14px' : '16px',
          cursor: hasExpandableContent ? 'pointer' : 'default',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 展開箭頭 */}
          {hasExpandableContent && (
            <span style={{
              fontSize: '12px',
              color: expanded ? styles.borderColor : '#999',
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>
              ▶
            </span>
          )}
          <span style={{
            fontSize: '24px',
            background: styles.iconBg,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {icon}
          </span>
          <div>
            <div style={{
              fontSize: '15px',
              fontWeight: '600',
              color: styles.textColor,
              marginBottom: '2px'
            }}>
              {title}
            </div>
            <div style={{ fontSize: '13px', color: '#666' }}>
              {count} 筆預約 · {formatDuration(minutes)}
            </div>
          </div>
        </div>
        {children}
      </div>

      {/* 展開內容 - 使用 contactStats 或自訂 expandedContent */}
      {hasExpandableContent && expanded && (
        <div style={{
          borderTop: `1px solid ${styles.borderColor}`,
          background: 'white',
          padding: isMobile ? '14px' : '16px'
        }}>
          {expandedContent || (contactStats && contactStats.length > 0 && (
            <div>
              <div style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                👥 會員時數分布：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contactStats.map((contact, idx) => (
                  <div
                    key={contact.contactName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#fafafa',
                      borderRadius: '6px'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#333' }}>
                      {idx + 1}. {contact.contactName}
                      <span style={{ color: '#999', marginLeft: '8px' }}>
                        ({contact.count} 筆)
                      </span>
                    </span>
                    <span style={{
                      fontSize: '13px',
                      color: styles.textColor,
                      fontWeight: '600',
                      flexShrink: 0,
                      marginLeft: '12px'
                    }}>
                      {formatDuration(contact.minutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

