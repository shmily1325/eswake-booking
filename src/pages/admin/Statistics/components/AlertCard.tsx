/**
 * Design thinking: alerts should signal status with sparse tone, not emoji circles
 * or large colored warning blocks. Expandable detail stays for the decision.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useResponsive } from '../../../../hooks/useResponsive'
import { designSystem, getFontSize } from '../../../../styles/designSystem'
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
    borderColor: designSystem.colors.warning[500],
    textColor: designSystem.colors.warning[700],
  },
  info: {
    borderColor: designSystem.colors.info[500],
    textColor: designSystem.colors.info[700],
  },
  success: {
    borderColor: designSystem.colors.success[500],
    textColor: designSystem.colors.success[700],
  }
}

export function AlertCard({
  variant,
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
      background: designSystem.colors.background.card,
      borderRadius: designSystem.borderRadius.lg,
      border: `1px solid ${designSystem.colors.border.light}`,
      borderLeft: `3px solid ${styles.borderColor}`,
      marginBottom: designSystem.spacing.md,
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasExpandableContent && (
            <span style={{
              fontSize: getFontSize('caption', isMobile),
              color: expanded ? styles.textColor : designSystem.colors.text.disabled,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
            }}>
              ▶
            </span>
          )}
          <div>
            <div style={{
              fontSize: getFontSize('body', isMobile),
              fontWeight: '600',
              color: designSystem.colors.text.primary,
              marginBottom: '2px'
            }}>
              {title}
            </div>
            <div style={{
              fontSize: getFontSize('caption', isMobile),
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
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          background: designSystem.colors.background.card,
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
                會員時數分布
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contactStats.map((contact, idx) => (
                  <div
                    key={contact.contactName}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
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
                      color: designSystem.colors.text.primary,
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
