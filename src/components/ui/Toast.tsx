import React, { useEffect, useState } from 'react'
import { designSystem } from '../../styles/designSystem'
import { toast as globalToast } from '../../utils/toast'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastProps {
  message: ToastMessage
  onClose: (id: string) => void
}

const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const duration = message.duration || 3000
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onClose(message.id), 300) // 等待动画完成
    }, duration)

    return () => clearTimeout(timer)
  }, [message, onClose])

  const typeConfig = {
    success: {
      bg: designSystem.colors.success[50],
      color: designSystem.colors.success[700],
      icon: '✓',
      border: designSystem.colors.success[500],
    },
    error: {
      bg: designSystem.colors.danger[50],
      color: designSystem.colors.danger[700],
      icon: '✕',
      border: designSystem.colors.danger[500],
    },
    warning: {
      bg: designSystem.colors.warning[50],
      color: designSystem.colors.warning[700],
      icon: '⚠',
      border: designSystem.colors.warning[500],
    },
    info: {
      bg: designSystem.colors.info[50],
      color: designSystem.colors.info[700],
      icon: 'ℹ',
      border: designSystem.colors.info[500],
    },
  }

  const config = typeConfig[message.type]

  const toastStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: designSystem.spacing.sm,
    padding: `${designSystem.spacing.md} ${designSystem.spacing.lg}`,
    background: config.bg,
    color: config.color,
    borderLeft: `4px solid ${config.border}`,
    borderRadius: designSystem.borderRadius.md,
    boxShadow: designSystem.shadows.elevation[6],
    marginBottom: designSystem.spacing.sm,
    minWidth: '300px',
    maxWidth: '500px',
    animation: isExiting ? 'slideOut 0.3s ease-out' : 'slideIn 0.3s ease-out',
    cursor: 'pointer',
  }

  const iconStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0,
  }

  const messageStyle: React.CSSProperties = {
    flex: 1,
    fontSize: '14px',
    lineHeight: '1.5',
  }

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }
      `}</style>
      <div style={toastStyle} onClick={() => onClose(message.id)}>
        <span style={iconStyle}>{config.icon}</span>
        <span style={messageStyle}>{message.message}</span>
      </div>
    </>
  )
}

interface ToastContainerProps {
  messages: ToastMessage[]
  onClose: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  messages,
  onClose,
  position = 'top-right',
}) => {
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
  }

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: designSystem.zIndex.notification,
    display: 'flex',
    flexDirection: 'column',
    ...positionStyles[position],
  }

  if (messages.length === 0) return null

  return (
    <div style={containerStyle}>
      {messages.map((message) => (
        <Toast key={message.id} message={message} onClose={onClose} />
      ))}
    </div>
  )
}

// Toast Manager Hook
export const useToast = () => {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  // 連接到全局 toast 管理器
  useEffect(() => {
    const unsubscribe = globalToast.subscribe((event) => {
      const id = `toast-${Date.now()}-${Math.random()}`
      setMessages((prev) => [...prev, { id, type: event.type, message: event.message, duration: event.duration }])
    })

    return unsubscribe
  }, [])

  const showToast = (type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setMessages((prev) => [...prev, { id, type, message, duration }])
  }

  const closeToast = (id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id))
  }

  return {
    messages,
    showToast,
    closeToast,
    success: (message: string, duration?: number) => showToast('success', message, duration),
    error: (message: string, duration?: number) => showToast('error', message, duration),
    warning: (message: string, duration?: number) => showToast('warning', message, duration),
    info: (message: string, duration?: number) => showToast('info', message, duration),
  }
}

