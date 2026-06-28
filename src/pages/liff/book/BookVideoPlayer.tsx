import { useEffect, useState, type CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { isMobileDevice } from '../../shop/lib/lineDeepLink'
import { useBookLocale } from './BookLocaleContext'
import { openYoutubeVideo, youtubeEmbedUrl, youtubeThumbnailUrl } from './bookMedia'
import { BOOK_PUBLIC_COLUMN_MAX_WIDTH } from '../../book/BookLayout'

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
}

const backdrop: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.55)',
}

const sheet: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: BOOK_PUBLIC_COLUMN_MAX_WIDTH,
  background: '#111',
  borderRadius: '16px 16px 0 0',
  padding: '12px 12px calc(12px + env(safe-area-inset-bottom, 0px))',
  maxHeight: '88vh',
}

const closeBtn: CSSProperties = {
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 2,
  width: 32,
  height: 32,
  border: 'none',
  borderRadius: '50%',
  background: 'rgba(0, 0, 0, 0.55)',
  color: 'white',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
}

const embedWrap: CSSProperties = {
  position: 'relative',
  paddingBottom: '56.25%',
  height: 0,
  borderRadius: 10,
  overflow: 'hidden',
  background: '#000',
}

const fallbackLink: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 10,
  padding: 0,
  border: 'none',
  background: 'none',
  color: '#aaa',
  fontSize: 12,
  textAlign: 'center',
  textDecoration: 'underline',
  cursor: 'pointer',
}

const compactThumb: CSSProperties = {
  position: 'relative',
  display: 'block',
  width: '100%',
  marginTop: 0,
  padding: 0,
  border: 'none',
  borderRadius: 12,
  overflow: 'hidden',
  cursor: 'pointer',
  background: '#fff',
  boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
}

const playBadge: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.28)',
  color: 'white',
  fontSize: 22,
}

interface BookVideoPlayerProps {
  videoId: string
  title: string
  /** step 1 用小縮圖；須知用文字連結 */
  variant?: 'compact' | 'link'
  label?: string
  /** 自訂封面（優先於 YouTube 預設縮圖） */
  posterSrc?: string
  posterSrcSet?: string
}

export function BookVideoPlayer({
  videoId,
  title,
  variant = 'link',
  label,
  posterSrc,
  posterSrcSet,
}: BookVideoPlayerProps) {
  const { s } = useBookLocale()
  const playLabel = label ?? s.video.playLabel
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const isMobile = isMobileDevice()

  const openSheet = () => {
    triggerHaptic('light')
    if (!isMobile) {
      openYoutubeVideo(videoId)
      return
    }
    setOpen(true)
  }

  return (
    <>
      {variant === 'compact' ? (
        <button type="button" style={compactThumb} onClick={openSheet} aria-label={s.video.playAria(title)}>
          <img
            src={posterSrc ?? youtubeThumbnailUrl(videoId)}
            srcSet={posterSrcSet}
            alt=""
            loading="lazy"
            style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }}
          />
          <span style={playBadge} aria-hidden>▶</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openSheet}
          style={{
            marginTop: 8,
            padding: 0,
            border: 'none',
            background: 'none',
            color: '#666',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          ▶ {playLabel}
        </button>
      )}

      {open && isMobile && (
        <div style={overlay} role="dialog" aria-modal="true" aria-label={title}>
          <button type="button" style={backdrop} aria-label={s.video.close} onClick={() => setOpen(false)} />
          <div style={sheet}>
            <button type="button" style={closeBtn} aria-label={s.video.close} onClick={() => setOpen(false)}>
              ×
            </button>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 600, marginBottom: 8, paddingRight: 36 }}>
              {title}
            </div>
            <div style={embedWrap}>
              <iframe
                title={title}
                src={youtubeEmbedUrl(videoId, true)}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <button
              type="button"
              style={fallbackLink}
              onClick={() => openYoutubeVideo(videoId)}
            >
              {s.video.cantPlay}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
