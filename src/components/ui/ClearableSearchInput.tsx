import {
  useRef,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react'
import { designSystem, getInputStyle } from '../../styles/designSystem'

interface ClearableSearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'style' | 'type' | 'value'> {
  value: string
  onValueChange: (value: string) => void
  isMobile: boolean
  inputStyle?: CSSProperties
  containerStyle?: CSSProperties
  dataTrack?: string
  clearDataTrack?: string
  showSearchIcon?: boolean
  onClear?: () => void
}

export function ClearableSearchInput({
  value,
  onValueChange,
  isMobile,
  inputStyle,
  containerStyle,
  dataTrack,
  clearDataTrack,
  showSearchIcon = true,
  onClear,
  onKeyDown,
  inputMode = 'search',
  enterKeyHint = 'search',
  ...inputProps
}: ClearableSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const searchIconVisible = showSearchIcon && value.length === 0

  const clear = () => {
    onValueChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault()
      clear()
    }
    onKeyDown?.(event)
  }

  return (
    <div
      style={{
        position: 'relative',
        minWidth: 0,
        ...containerStyle,
      }}
    >
      {searchIconVisible && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: isMobile ? 16 : 13,
            top: '50%',
            transform: 'translateY(-50%)',
            color: designSystem.colors.text.disabled,
            display: 'flex',
            pointerEvents: 'none',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        value={value}
        data-track={dataTrack}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          ...getInputStyle(isMobile),
          ...inputStyle,
          width: '100%',
          boxSizing: 'border-box',
          paddingLeft: showSearchIcon ? (isMobile ? 48 : 40) : undefined,
          paddingRight: value ? (isMobile ? 52 : 42) : undefined,
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="清除搜尋"
          data-track={clearDataTrack}
          onClick={clear}
          style={{
            position: 'absolute',
            right: isMobile ? 2 : 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: isMobile ? 44 : 32,
            height: isMobile ? 44 : 32,
            padding: 0,
            border: 'none',
            borderRadius: designSystem.borderRadius.full,
            background: 'transparent',
            color: designSystem.colors.text.secondary,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? 17 : 15,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
