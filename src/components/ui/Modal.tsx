import React, { useEffect } from 'react'
import { designSystem } from '../../styles/designSystem'
import { useResponsive } from '../../hooks/useResponsive'
import { Button } from './index'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'small' | 'medium' | 'large' | 'fullscreen'
  variant?: 'default' | 'glass'
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  variant = 'default',
  closeOnOverlayClick = true,
  showCloseButton = true,
}) => {
  const { isMobile } = useResponsive()

  // 防止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeStyles = {
    small: { maxWidth: '400px' },
    medium: { maxWidth: '600px' },
    large: { maxWidth: '800px' },
    fullscreen: { 
      maxWidth: '100%', 
      width: '100%', 
      height: '100%', 
      margin: 0,
      borderRadius: 0,
    },
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: designSystem.zIndex.modal,
    padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
    animation: 'fadeIn 0.2s ease-out',
  }

  const modalBaseStyle: React.CSSProperties = {
    background: designSystem.colors.background.card,
    borderRadius: designSystem.borderRadius.lg,
    boxShadow: designSystem.shadows.elevation[24],
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    animation: 'slideUp 0.3s ease-out',
    ...sizeStyles[size],
  }

  const glassStyle: React.CSSProperties = variant === 'glass' ? {
    background: designSystem.glass.background,
    backdropFilter: designSystem.glass.blur,
    WebkitBackdropFilter: designSystem.glass.blur,
    border: designSystem.glass.border,
  } : {}

  const modalStyle: React.CSSProperties = {
    ...modalBaseStyle,
    ...glassStyle,
  }

  const headerStyle: React.CSSProperties = {
    padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
    borderBottom: `1px solid ${designSystem.colors.border.light}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const bodyStyle: React.CSSProperties = {
    padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
    overflowY: 'auto',
    flex: 1,
  }

  const footerStyle: React.CSSProperties = {
    padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
    borderTop: `1px solid ${designSystem.colors.border.light}`,
    display: 'flex',
    gap: designSystem.spacing.sm,
    justifyContent: 'flex-end',
  }

  const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: isMobile ? '12px' : '16px',
    right: isMobile ? '12px' : '16px',
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: designSystem.colors.text.secondary,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: designSystem.borderRadius.sm,
    transition: designSystem.transitions.normal,
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div
        style={overlayStyle}
        onClick={(e) => {
          if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose()
          }
        }}
      >
        <div style={modalStyle}>
          {showCloseButton && !title && (
            <button
              style={closeButtonStyle}
              onClick={onClose}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = designSystem.colors.background.hover
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              ×
            </button>
          )}

          {title && (
            <div style={headerStyle}>
              <h2
                style={{
                  margin: 0,
                  fontSize: designSystem.fontSize.h2[isMobile ? 'mobile' : 'desktop'],
                  fontWeight: '600',
                  color: designSystem.colors.text.primary,
                }}
              >
                {title}
              </h2>
              {showCloseButton && (
                <button
                  style={{
                    ...closeButtonStyle,
                    position: 'relative',
                    top: 'auto',
                    right: 'auto',
                  }}
                  onClick={onClose}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = designSystem.colors.background.hover
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div style={bodyStyle}>{children}</div>

          {footer && <div style={footerStyle}>{footer}</div>}
        </div>
      </div>
    </>
  )
}

// 預設的確認對話框
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning'
  isLoading?: boolean
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '確認操作',
  message,
  confirmText = '確定',
  cancelText = '取消',
  variant = 'default',
  isLoading = false,
}) => {
  const confirmVariant = variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, lineHeight: '1.6' }}>{message}</p>
    </Modal>
  )
}

