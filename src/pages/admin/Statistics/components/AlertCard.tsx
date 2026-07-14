import { useState } from 'react'
import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getCardStyle, getFontSize } from '../../../../styles/designSystem'
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
    background: designSystem.colors.warning[50],
    borderColor: designSystem.colors.warning[500],
    iconBg: designSystem.colors.warning[50],
    textColor: designSystem.colors.warning[700]
  },
  info: {
    background: designSystem.colors.info[50],
    borderColor: designSystem.colors.info[500],
    iconBg: designSystem.colors.info[50],
    textColor: designSystem.colors.info[700]
  },
  success: {
    background: designSystem.colors.success[50],
    borderColor: designSystem.colors.success[500],
    iconBg: designSystem.colors.success[50],
    textColor: designSystem.colors.success[700]
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
          {hasExpandableContent && (
            <span style={{
              fontSize: getFontSize('caption', isMobile),
              color: expanded ? styles.borderColor : designSystem.colors.text.disabled,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>
              ▶
            </span>
          )}
          <span style={{
            fontSize: getFontSize('h2', isMobile),
            background: styles.iconBg,
            border: `1px solid ${styles.borderColor}33`,
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
              fontSize: getFontSize('bodyLarge', isMobile),
              fontWeight: '600',
              color: styles.textColor,
              marginBottom: '2px'
            }}>
              {title}
            </div>
            <div style={{
              fontSize: getFontSize('bodySmall', isMobile),
              color: designSystem.colors.text.secondary
            }}>
              {count} 筆預約 · {formatDuration(minutes)}
            </div>
          </div>
        </div>
        {children}
      </div>

      {hasExpandableContent && expanded && (
        <div style={{
          borderTop: `1px solid ${styles.borderColor}33`,
          background: 'white',
          padding: isMobile ? '14px' : '16px'
        }}>
          {expandedContent || (contactStats && contactStats.length > 0 && (
            <div>
              <div style={{
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
                marginBottom: '10px',
                fontWeight: '500'
              }}>
                會員時數分布：
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
                      background: designSystem.colors.background.hover,
                      borderRadius: designSystem.borderRadius.md
                    }}
                  >
                    <span style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      color: designSystem.colors.text.primary
                    }}>
                      {idx + 1}. {contact.contactName}
                      <span style={{
                        color: designSystem.colors.text.disabled,
                        marginLeft: '8px'
                      }}>
                        ({contact.count} 筆)
                      </span>
                    </span>
                    <span style={{
                      fontSize: getFontSize('bodySmall', isMobile),
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
