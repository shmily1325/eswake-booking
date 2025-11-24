import React, { useState, useRef, useEffect } from 'react'
import { designSystem } from '../../styles/designSystem'

interface TooltipProps {
  content: string
  children: React.ReactElement
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const childRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (childRef.current) {
        const rect = childRef.current.getBoundingClientRect()
        const tooltipOffset = 8
        
        let top = 0
        let left = 0

        switch (position) {
          case 'top':
            top = rect.top - tooltipOffset
            left = rect.left + rect.width / 2
            break
          case 'bottom':
            top = rect.bottom + tooltipOffset
            left = rect.left + rect.width / 2
            break
          case 'left':
            top = rect.top + rect.height / 2
            left = rect.left - tooltipOffset
            break
          case 'right':
            top = rect.top + rect.height / 2
            left = rect.right + tooltipOffset
            break
        }

        setCoords({ top, left })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${coords.top}px`,
    left: `${coords.left}px`,
    transform: getTransform(position),
    background: designSystem.colors.secondary[900],
    color: 'white',
    padding: `${designSystem.spacing.xs} ${designSystem.spacing.sm}`,
    borderRadius: designSystem.borderRadius.sm,
    fontSize: '12px',
    lineHeight: '1.4',
    maxWidth: '200px',
    zIndex: designSystem.zIndex.tooltip,
    pointerEvents: 'none',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 0.2s ease',
    boxShadow: designSystem.shadows.elevation[8],
    whiteSpace: 'nowrap',
  }

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    ...getArrowStyle(position),
  }

  return (
    <>
      <div
        ref={childRef}
        style={{ display: 'inline-block' }}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
      >
        {children}
      </div>
      {isVisible && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          {content}
        </div>
      )}
    </>
  )
}

function getTransform(position: string): string {
  switch (position) {
    case 'top':
      return 'translate(-50%, -100%)'
    case 'bottom':
      return 'translate(-50%, 0)'
    case 'left':
      return 'translate(-100%, -50%)'
    case 'right':
      return 'translate(0, -50%)'
    default:
      return 'translate(-50%, -100%)'
  }
}

function getArrowStyle(position: string): React.CSSProperties {
  const arrowSize = 4
  const arrowColor = designSystem.colors.secondary[900]

  switch (position) {
    case 'top':
      return {
        bottom: `-${arrowSize}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
        borderColor: `${arrowColor} transparent transparent transparent`,
      }
    case 'bottom':
      return {
        top: `-${arrowSize}px`,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent ${arrowColor} transparent`,
      }
    case 'left':
      return {
        right: `-${arrowSize}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent transparent ${arrowColor}`,
      }
    case 'right':
      return {
        left: `-${arrowSize}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
        borderColor: `transparent ${arrowColor} transparent transparent`,
      }
    default:
      return {}
  }
}

