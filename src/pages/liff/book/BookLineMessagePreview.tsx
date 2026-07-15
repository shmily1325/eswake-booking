import { useState } from 'react'
import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

const toggleBtn: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 16,
  padding: '12px 0 0',
  border: 'none',
  borderTop: `1px solid ${T.borderSubtle}`,
  background: 'none',
  color: T.estimateAccent,
  fontSize: ty.caption,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  textAlign: 'center',
}

const messageBox: CSSProperties = {
  marginTop: 10,
  padding: '12px 14px',
  borderRadius: T.smallRadius,
  background: T.surfaceMuted,
  fontSize: ty.caption,
  lineHeight: 1.55,
  color: T.inkSoft,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'inherit',
}

interface BookLineMessagePreviewProps {
  message: string
}

export function BookLineMessagePreview({ message }: BookLineMessagePreviewProps) {
  const { s } = useBookLocale()
  const [open, setOpen] = useState(false)

  const toggle = () => {
    triggerHaptic('light')
    setOpen(v => !v)
  }

  return (
    <div>
      <button type="button" onClick={toggle} style={toggleBtn}>
        {open ? s.step4.messagePreviewCollapse : s.step4.messagePreviewExpand}
      </button>
      {open ? <div style={messageBox}>{message}</div> : null}
    </div>
  )
}
