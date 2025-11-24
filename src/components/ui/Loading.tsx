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

