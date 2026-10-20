import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { triggerHaptic } from '../../utils/haptic'
import { BindingForm } from './components/BindingForm'
import { ErrorView } from './components/ErrorView'
import { LiffBootScreen } from './LiffBootScreen'
import { resolveRuntimeLiffId } from './liffUrl'
import { useLiffMember } from './useLiffMember'

const MING_MEMBER_ID = '3ba83648-1f69-418a-8939-76a83e7014cb'
const BACKGROUND = '#050505'
const ACCENT = '#ffffff'
const CYAN = '#37d9f0'
const PANEL_COUNT = 6

const wrapped = {
  year: 2026,
  name: 'MING',
  title: 'ES 地縛靈',
  titleCopy: '我們合理懷疑，你住在這裡。',
  waterMinutes: 4940,
  landMinutes: 1530,
  sessions: 127,
  waterSessions: 102,
  waterHours: 82,
  waterRemainingMinutes: 20,
  coaches: ['阿寶', 'ED', 'Jerry'],
  boat: 'G21',
  boatMinutes: 3830,
  boatPercent: 78,
  peakMonth: 'SEPTEMBER',
  peakMinutes: 1085,
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('無法產生分享圖片'))
    }, 'image/png')
  })
}

interface WrappedCardOptions {
  photoUrl?: string | null
  photoOffsetY?: number
}

function splitWrappedTitle(title: string): string[] {
  const normalized = title.trim().replace(/\s+/g, ' ')
  const compact = normalized.replace(/\s/g, '')
  if (compact.length <= 5 || (normalized.includes(' ') && compact.length <= 7)) {
    return [normalized]
  }

  const naturalEndings = ['營業中', '收藏家', '練習生', '兩棲類']
  const ending = naturalEndings.find(candidate => compact.endsWith(candidate))
  if (ending && compact.length > ending.length) {
    return [
      compact.slice(0, -ending.length),
      ending,
    ]
  }

  const breakAt = Math.ceil(compact.length / 2)
  return [
    compact.slice(0, breakAt),
    compact.slice(breakAt),
  ]
}

function drawWrappedTitle(
  context: CanvasRenderingContext2D,
  lines: string[],
  options: {
    bottomY: number
    fontSize: number
    lineHeight: number
    maxWidth: number
    x: number
  },
) {
  let fontSize = options.fontSize
  context.font = `900 ${fontSize}px Arial, "Noto Sans TC", sans-serif`
  while (
    fontSize > 72
    && lines.some(line => context.measureText(line).width > options.maxWidth)
  ) {
    fontSize -= 4
    context.font = `900 ${fontSize}px Arial, "Noto Sans TC", sans-serif`
  }

  const lineHeight = fontSize * options.lineHeight
  const firstBaseline = options.bottomY - lineHeight * (lines.length - 1)
  lines.forEach((line, index) => {
    context.fillText(line, options.x, firstBaseline + index * lineHeight)
  })
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

async function createWrappedCard(options: WrappedCardOptions = {}): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) throw new Error('瀏覽器不支援圖片產生')

  await document.fonts?.ready

  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)

  const hasPhoto = Boolean(options.photoUrl)
  if (options.photoUrl) {
    const photo = await loadImage(options.photoUrl)
    const scale = Math.max(canvas.width / photo.naturalWidth, canvas.height / photo.naturalHeight) * 1.1
    const width = photo.naturalWidth * scale
    const height = photo.naturalHeight * scale
    const x = (canvas.width - width) / 2
    const y = (canvas.height - height) / 2 + (options.photoOffsetY ?? 0) * canvas.height * 0.05

    context.save()
    context.filter = 'saturate(.96) contrast(1.04) brightness(.9)'
    context.drawImage(photo, x, y, width, height)
    context.restore()

    const overlay = context.createLinearGradient(0, 0, 0, canvas.height)
    overlay.addColorStop(0, 'rgba(0,0,0,.52)')
    overlay.addColorStop(.28, 'rgba(0,0,0,.08)')
    overlay.addColorStop(.48, 'rgba(0,0,0,.03)')
    overlay.addColorStop(.68, 'rgba(0,0,0,.34)')
    overlay.addColorStop(1, 'rgba(0,0,0,.96)')
    context.fillStyle = overlay
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  if (!hasPhoto) {
    context.lineWidth = 4
    for (let radius = 180, index = 0; radius <= 700; radius += 104, index += 1) {
      context.strokeStyle = `rgba(55, 217, 240, ${Math.max(.07, .2 - index * .025)})`
      context.beginPath()
      context.arc(970, 360, radius, 0, Math.PI * 2)
      context.stroke()
    }
  }

  context.fillStyle = ACCENT
  context.font = '700 27px Arial, sans-serif'
  context.fillText('ES WAKE · 2026', 70, 111)

  try {
    const logo = new Image()
    logo.src = ES_BRAND.logoWhite
    await logo.decode()
    context.drawImage(logo, 910, 76, 100, 100)
  } catch {
    context.fillStyle = ACCENT
    context.font = '800 32px Arial, sans-serif'
    context.fillText('ES WAKE', 846, 112)
  }

  const titleLines = splitWrappedTitle(wrapped.title)

  if (hasPhoto) {
    const titleFontSize = titleLines.length > 1 ? 100 : 116
    const titleTopY = 1490 - titleFontSize * .92 * (titleLines.length - 1)

    context.fillStyle = 'rgba(255,255,255,.76)'
    context.font = '800 29px Arial, "Noto Sans TC", sans-serif'
    context.fillText(`${wrapped.name} · ${wrapped.year}`, 72, titleTopY - 66)

    context.fillStyle = CYAN
    drawWrappedTitle(context, titleLines, {
      x: 70,
      bottomY: 1490,
      fontSize: titleFontSize,
      lineHeight: .92,
      maxWidth: 940,
    })

    context.fillStyle = ACCENT
    context.font = '900 168px Arial, sans-serif'
    context.fillText(wrapped.waterMinutes.toLocaleString('en-US'), 62, 1700)
    context.fillStyle = 'rgba(255,255,255,0.66)'
    context.font = '700 27px Arial, sans-serif'
    context.fillText('MINUTES ON THE WATER', 72, 1754)
  } else {
    context.fillStyle = ACCENT
    context.font = '900 108px Arial, "Noto Sans TC", sans-serif'
    context.fillText(wrapped.name, 70, 310)

    context.fillStyle = CYAN
    drawWrappedTitle(context, titleLines, {
      x: 70,
      bottomY: titleLines.length > 1 ? 590 : 500,
      fontSize: titleLines.length > 1 ? 124 : 142,
      lineHeight: .9,
      maxWidth: 940,
    })

    context.fillStyle = ACCENT
    context.font = '900 220px Arial, sans-serif'
    context.fillText(wrapped.waterMinutes.toLocaleString('en-US'), 58, 900)
    context.fillStyle = 'rgba(255,255,255,0.64)'
    context.font = '700 34px Arial, sans-serif'
    context.fillText('MINUTES ON THE WATER', 72, 960)

    const stats = [
      { label: 'WATER SESSIONS', value: String(wrapped.waterSessions) },
      { label: 'COACHES', value: String(wrapped.coaches.length) },
      { label: 'YOUR BOAT', value: wrapped.boat },
    ]
    stats.forEach((stat, index) => {
      const x = 72 + index * 320
      context.fillStyle = ACCENT
      context.font = '900 60px Arial, "Noto Sans TC", sans-serif'
      context.fillText(stat.value, x, 1165)
      context.fillStyle = 'rgba(255,255,255,0.58)'
      context.font = '700 22px Arial, sans-serif'
      context.fillText(stat.label, x, 1218)
    })

    context.fillStyle = ACCENT
    context.font = '800 42px Arial, "Noto Sans TC", sans-serif'
    context.fillText(wrapped.titleCopy, 72, 1630)
    context.fillStyle = 'rgba(255,255,255,0.54)'
    context.font = '700 27px Arial, "Noto Sans TC", sans-serif'
    context.fillText('RIDE TOGETHER.  ES WAKE SCHOOL', 72, 1700)
  }

  return canvasToBlob(canvas)
}

function BrandMark() {
  return (
    <div className="wrapped-brand">
      <img src={ES_BRAND.logoWhite} alt="ES Wake" />
      <span>ES WAKE SCHOOL</span>
    </div>
  )
}

function useCountUp(target: number, enabled: boolean, duration = 1100) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!enabled) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [duration, enabled, target])

  return value
}

function ScrollHint({
  onNext,
  initial = false,
}: {
  onNext: () => void
  initial?: boolean
}) {
  return (
    <button
      className={`wrapped-scroll-hint ${initial ? 'is-initial' : ''}`}
      type="button"
      onClick={onNext}
      aria-label="前往下一頁"
    >
      {initial ? (
        <>
          <b aria-hidden="true">↑</b>
          <em>SWIPE UP</em>
        </>
      ) : (
        <>
          <span />
          <b aria-hidden="true">↓</b>
        </>
      )}
    </button>
  )
}

function WrappedStory() {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareStyle, setShareStyle] = useState<'type' | 'photo'>('type')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoOffsetY, setPhotoOffsetY] = useState(0)
  const [activePanel, setActivePanel] = useState(0)
  const panelRefs = useRef<Array<HTMLElement | null>>([])
  const photoDragRef = useRef<{
    pointerId: number
    startY: number
    startOffset: number
  } | null>(null)
  const animatedMinutes = useCountUp(wrapped.waterMinutes, activePanel === 1)
  const titleLines = splitWrappedTitle(wrapped.title)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      const index = Number((visible.target as HTMLElement).dataset.panelIndex)
      if (Number.isInteger(index)) setActivePanel(index)
    }, { threshold: [0.55, 0.72] })

    panelRefs.current.forEach(panel => {
      if (panel) observer.observe(panel)
    })
    return () => observer.disconnect()
  }, [])

  function panelRef(index: number) {
    return (element: HTMLElement | null) => {
      panelRefs.current[index] = element
    }
  }

  function goToPanel(index: number) {
    triggerHaptic('light')
    panelRefs.current[index]?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  async function buildPreview(): Promise<{ blob: Blob; url: string }> {
    if (shareStyle === 'photo' && !photoUrl) {
      throw new Error('請先從手機選擇一張照片。')
    }
    const blob = await createWrappedCard({
      photoUrl: shareStyle === 'photo' ? photoUrl : null,
      photoOffsetY,
    })
    const url = URL.createObjectURL(blob)
    setPreviewBlob(blob)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return url
    })
    return { blob, url }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setPhotoUrl(reader.result)
      setPhotoOffsetY(0)
      setShareStyle('photo')
      setShareMessage(null)
    }
    reader.onerror = () => setShareMessage('照片讀取失敗，請重新選擇。')
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function handlePhotoPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (shareStyle !== 'photo' || !photoUrl) return
    event.currentTarget.setPointerCapture(event.pointerId)
    photoDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: photoOffsetY,
    }
  }

  function handlePhotoPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = photoDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const height = Math.max(event.currentTarget.getBoundingClientRect().height, 1)
    const nextOffset = drag.startOffset + ((event.clientY - drag.startY) / height) * 4
    setPhotoOffsetY(Math.max(-1, Math.min(1, nextOffset)))
  }

  function handlePhotoPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (photoDragRef.current?.pointerId !== event.pointerId) return
    photoDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  async function openNativeShare(blob: Blob): Promise<boolean> {
    const file = new File([blob], `es-wake-${wrapped.year}-ming.png`, { type: 'image/png' })
    const shareData = {
      files: [file],
      title: `Ming's ${wrapped.year} ES Wake`,
      text: `我的 ${wrapped.year} ES Wake 年度稱號：${wrapped.title}`,
    }
    if (typeof navigator.share !== 'function' || !navigator.canShare?.(shareData)) return false
    await navigator.share(shareData)
    return true
  }

  async function handlePreview() {
    triggerHaptic('light')
    setGenerating(true)
    setShareMessage(null)
    try {
      await buildPreview()
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : '產生圖片失敗')
    } finally {
      setGenerating(false)
    }
  }

  async function handleShare() {
    triggerHaptic('medium')
    setGenerating(true)
    setShareMessage(null)
    try {
      const { blob } = await buildPreview()
      if (!await openNativeShare(blob)) {
        setShareMessage('此瀏覽器不支援直接分享，請長按圖片儲存。')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareMessage(error instanceof Error ? error.message : '分享失敗，請改用儲存圖片。')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveFromPreview() {
    if (!previewBlob) return
    triggerHaptic('light')
    setShareMessage(null)
    try {
      if (!await openNativeShare(previewBlob)) {
        setShareMessage('請長按上方圖片，選擇「儲存圖片」。')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareMessage('請長按上方圖片，選擇「儲存圖片」。')
    }
  }

  return (
    <main className="wrapped-root">
      <style>{`
        .wrapped-root {
          --wrapped-bg: ${BACKGROUND};
          --wrapped-accent: ${ACCENT};
          --wrapped-cyan: ${CYAN};
          background: var(--wrapped-bg);
          color: #fff;
          font-family: var(--font-ui);
          min-height: 100svh;
          overflow-x: hidden;
          scroll-snap-type: y proximity;
        }
        .wrapped-progress {
          position: fixed;
          z-index: 50;
          top: calc(10px + var(--safe-area-inset-top, 0px));
          left: 18px;
          right: 18px;
          display: grid;
          grid-template-columns: repeat(${PANEL_COUNT}, 1fr);
          gap: 5px;
        }
        .wrapped-progress button {
          height: 3px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(255,255,255,.2);
          overflow: hidden;
        }
        .wrapped-progress button::after {
          content: "";
          display: block;
          width: 100%;
          height: 100%;
          background: var(--wrapped-cyan);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform .35s ease;
        }
        .wrapped-progress button[data-complete="true"]::after { transform: scaleX(1); }
        .wrapped-panel {
          min-height: 100svh;
          padding: calc(30px + var(--safe-area-inset-top, 0px)) 24px
            calc(42px + var(--safe-area-inset-bottom, 0px));
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          scroll-snap-align: start;
          overflow: hidden;
        }
        .wrapped-panel [data-reveal] {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
        }
        .wrapped-panel[data-active="true"] [data-reveal] {
          animation: wrapped-reveal .58s cubic-bezier(.2,.8,.2,1) both;
        }
        .wrapped-panel[data-active="true"] [data-reveal="late"] {
          animation-delay: .16s;
        }
        @keyframes wrapped-reveal {
          from { opacity: 0; transform: translate3d(0, 18px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .wrapped-panel::after {
          content: "";
          position: absolute;
          width: 440px;
          height: 440px;
          border: 1px solid rgba(55,217,240,.22);
          border-radius: 50%;
          right: -260px;
          top: 18%;
          box-shadow:
            0 0 0 74px rgba(55,217,240,.045),
            0 0 0 148px rgba(55,217,240,.022);
          pointer-events: none;
        }
        .wrapped-brand {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          font: 800 11px/1 Arial, sans-serif;
          letter-spacing: .13em;
        }
        .wrapped-brand img { width: 34px; height: 34px; object-fit: contain; }
        .wrapped-kicker {
          color: var(--wrapped-accent);
          font: 800 12px/1.2 Arial, sans-serif;
          letter-spacing: .14em;
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .wrapped-display {
          position: relative;
          z-index: 1;
          font-family: Arial Black, Arial, var(--font-ui);
          font-size: clamp(62px, 22vw, 108px);
          font-weight: 900;
          letter-spacing: -.075em;
          line-height: .82;
          margin: 0;
          overflow-wrap: anywhere;
        }
        .wrapped-display.small { font-size: clamp(52px, 18vw, 88px); }
        .wrapped-subtitle {
          position: relative;
          z-index: 1;
          margin: 24px 0 0;
          max-width: 320px;
          color: rgba(255,255,255,.66);
          font-size: 17px;
          line-height: 1.55;
        }
        .wrapped-footnote {
          display: block;
          margin-top: 24px;
          color: rgba(255,255,255,.4);
          font: 700 11px/1.4 Arial, sans-serif;
          letter-spacing: .12em;
        }
        .wrapped-crew-secondary {
          display: block;
          margin-top: 14px;
          color: rgba(255,255,255,.62);
          font-size: .42em;
          letter-spacing: -.02em;
          line-height: 1.1;
        }
        .wrapped-accent { color: var(--wrapped-accent); }
        .wrapped-cyan { color: var(--wrapped-cyan); }
        .wrapped-water-panel .wrapped-accent { color: var(--wrapped-cyan); }
        .wrapped-boat-panel {
          background:
            radial-gradient(circle at 100% 25%, rgba(55,217,240,.07), transparent 42%),
            var(--wrapped-bg);
        }
        .wrapped-scroll-hint {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 64px;
          padding: 20px 0 4px;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: rgba(255,255,255,.38);
          font: 700 9px/1 Arial, sans-serif;
          letter-spacing: .16em;
        }
        .wrapped-scroll-hint b {
          font-size: 14px;
          font-weight: 500;
        }
        .wrapped-scroll-hint em {
          font: 800 9px/1 Arial, sans-serif;
          font-style: normal;
          letter-spacing: .16em;
        }
        .wrapped-scroll-hint.is-initial {
          color: rgba(255,255,255,.68);
        }
        .wrapped-scroll-hint.is-initial b {
          color: var(--wrapped-cyan);
          animation: wrapped-swipe-up 1.5s cubic-bezier(.2,.8,.2,1) infinite;
        }
        .wrapped-scroll-hint span {
          width: 42px;
          height: 1px;
          background: currentColor;
          animation: wrapped-pulse 1.6s ease-in-out infinite;
          transform-origin: left;
        }
        @keyframes wrapped-pulse {
          0%, 100% { transform: scaleX(.45); opacity: .45; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes wrapped-swipe-up {
          0%, 100% { transform: translate3d(0, 4px, 0); opacity: .45; }
          50% { transform: translate3d(0, -3px, 0); opacity: 1; }
        }
        .wrapped-ratio {
          position: relative;
          z-index: 1;
          width: min(100%, 360px);
          margin-top: 32px;
        }
        .wrapped-ratio-line {
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.12);
          overflow: hidden;
          margin-bottom: 12px;
        }
        .wrapped-ratio-line span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: var(--wrapped-accent);
        }
        .wrapped-ratio-label {
          display: flex;
          justify-content: space-between;
          color: rgba(255,255,255,.56);
          font: 700 12px/1 Arial, sans-serif;
          letter-spacing: .08em;
        }
        .wrapped-final { background: #080808; }
        .wrapped-final-card {
          position: relative;
          z-index: 1;
          width: min(82vw, 350px);
          aspect-ratio: 9 / 16;
          margin: 22px auto;
          border: 1px solid rgba(255,255,255,.17);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at 90% 19%,
              transparent 0 57px,
              rgba(55,217,240,.16) 58px 59px,
              transparent 60px 91px,
              rgba(55,217,240,.13) 92px 93px,
              transparent 94px 125px,
              rgba(55,217,240,.1) 126px 127px,
              transparent 128px 159px,
              rgba(55,217,240,.08) 160px 161px,
              transparent 162px 193px,
              rgba(55,217,240,.06) 194px 195px,
              transparent 196px
            ),
            var(--wrapped-bg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,.5);
          overflow: hidden;
        }
        .wrapped-final-card > :not(.wrapped-final-photo) { position: relative; z-index: 1; }
        .wrapped-final-photo {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(.96) contrast(1.04) brightness(.9);
          z-index: 0;
        }
        .wrapped-final-card::after {
          content: "";
          position: absolute;
          inset: 0;
          background: transparent;
          pointer-events: none;
          z-index: 0;
        }
        .wrapped-final-card.has-photo::after {
          background: linear-gradient(
            to bottom,
            rgba(0,0,0,.52),
            rgba(0,0,0,.08) 28%,
            rgba(0,0,0,.03) 48%,
            rgba(0,0,0,.34) 68%,
            rgba(0,0,0,.96)
          );
        }
        .wrapped-final-card.has-photo {
          cursor: grab;
          touch-action: none;
          user-select: none;
        }
        .wrapped-final-card.has-photo:active { cursor: grabbing; }
        .wrapped-final-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .wrapped-final-card-header span {
          color: #fff;
          font: 800 10px/1 Arial, sans-serif;
          letter-spacing: .1em;
        }
        .wrapped-final-card-header img {
          width: 32px;
          height: 32px;
          object-fit: contain;
        }
        .wrapped-final-name {
          margin-top: 14%;
          font: 900 clamp(38px, 12vw, 58px)/.9 Arial Black, Arial, sans-serif;
          letter-spacing: -.07em;
        }
        .wrapped-final-award {
          color: var(--wrapped-cyan);
          font-family: Arial Black, Arial, var(--font-ui);
          font-size: clamp(38px, 12vw, 50px);
          font-weight: 900;
          letter-spacing: -.055em;
          line-height: .9;
          margin-top: 18px;
        }
        .wrapped-final-award span {
          display: block;
        }
        .wrapped-final-award[data-lines="2"] {
          font-size: clamp(32px, 10.5vw, 44px);
        }
        .wrapped-final-minutes {
          margin-top: auto;
          color: var(--wrapped-accent);
          font: 900 clamp(48px, 15vw, 76px)/.9 Arial Black, Arial, sans-serif;
          letter-spacing: -.07em;
        }
        .wrapped-final-label {
          margin-top: 8px;
          color: rgba(255,255,255,.55);
          font: 700 10px/1 Arial, sans-serif;
          letter-spacing: .13em;
        }
        .wrapped-final-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 22px;
          padding: 0;
        }
        .wrapped-final-stats strong { display: block; font-size: 20px; line-height: 1; }
        .wrapped-final-stats span { display: block; margin-top: 6px; color: rgba(255,255,255,.48); font-size: 9px; letter-spacing: .1em; }
        .wrapped-final-signoff {
          margin-top: 12px;
          color: rgba(255,255,255,.74);
          font: 800 10px/1 Arial, sans-serif;
          letter-spacing: .14em;
        }
        .wrapped-final-copy {
          margin-top: 16px;
          color: rgba(255,255,255,.78);
          font-size: 11px;
          font-weight: 750;
          line-height: 1.45;
        }
        .wrapped-final-photo-content {
          position: relative;
          z-index: 1;
          margin-top: auto;
        }
        .wrapped-final-photo-kicker {
          color: rgba(255,255,255,.74);
          font: 800 11px/1 Arial, sans-serif;
          letter-spacing: .12em;
        }
        .wrapped-final-photo-content .wrapped-final-award {
          margin-top: 13px;
          font-size: clamp(29px, 9.5vw, 40px);
        }
        .wrapped-final-photo-content .wrapped-final-award[data-lines="2"] {
          font-size: clamp(26px, 8.5vw, 35px);
        }
        .wrapped-final-photo-content .wrapped-final-minutes {
          margin-top: 20px;
          font-size: clamp(46px, 14vw, 64px);
        }
        .wrapped-final-card:not(.has-photo) .wrapped-final-award {
          opacity: 0;
          clip-path: inset(0 0 100% 0);
          transform: translate3d(0, 12px, 0);
        }
        .wrapped-panel[data-active="true"] .wrapped-final-card:not(.has-photo) .wrapped-final-award {
          animation: wrapped-poster-title .42s .12s cubic-bezier(.16,.8,.24,1) both;
        }
        .wrapped-final-card:not(.has-photo) .wrapped-final-minutes {
          opacity: 0;
          transform: translate3d(0, 10px, 0);
        }
        .wrapped-panel[data-active="true"] .wrapped-final-card:not(.has-photo) .wrapped-final-minutes {
          animation: wrapped-poster-number .34s .27s cubic-bezier(.2,.8,.2,1) both;
        }
        @keyframes wrapped-poster-title {
          from {
            opacity: 0;
            clip-path: inset(0 0 100% 0);
            transform: translate3d(0, 12px, 0);
          }
          to {
            opacity: 1;
            clip-path: inset(0 0 0 0);
            transform: translate3d(0, 0, 0);
          }
        }
        @keyframes wrapped-poster-number {
          from { opacity: 0; transform: translate3d(0, 10px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .wrapped-share-editor {
          position: relative;
          z-index: 2;
          width: min(100%, 390px);
          margin: 0 auto 12px;
        }
        .wrapped-photo-position-hint {
          margin: 0 0 9px;
          color: rgba(255,255,255,.48);
          text-align: center;
          font-size: 11px;
          letter-spacing: .03em;
        }
        .wrapped-photo-controls {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .wrapped-photo-picker {
          display: block;
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px;
          color: #fff;
          text-align: center;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
        }
        .wrapped-photo-picker input { display: none; }
        .wrapped-photo-controls > :only-child { grid-column: 1 / -1; }
        .wrapped-photo-remove {
          padding: 10px 14px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px;
          background: transparent;
          color: #fff;
          font-size: 12px;
          font-weight: 750;
        }
        .wrapped-title-panel {
          background: var(--wrapped-bg);
          color: #fff;
        }
        .wrapped-title-panel::after {
          border-color: rgba(55,217,240,.38);
          box-shadow:
            0 0 0 74px rgba(55,217,240,.07),
            0 0 0 148px rgba(55,217,240,.035);
        }
        .wrapped-title-panel .wrapped-kicker { color: rgba(255,255,255,.58); }
        .wrapped-title-panel .wrapped-cyan { color: var(--wrapped-cyan); }
        .wrapped-title-panel .wrapped-subtitle { color: rgba(255,255,255,.68); }
        .wrapped-title-panel .wrapped-subtitle strong { color: #fff; }
        .wrapped-title-panel .wrapped-scroll-hint { color: rgba(255,255,255,.38); }
        .wrapped-title-word {
          clip-path: inset(0 0 100% 0);
          transform: translate3d(0, 18px, 0);
        }
        .wrapped-title-panel[data-active="true"] .wrapped-title-word {
          animation: wrapped-title-reveal .68s .12s cubic-bezier(.16,.8,.24,1) both;
        }
        @keyframes wrapped-title-reveal {
          from { clip-path: inset(0 0 100% 0); transform: translate3d(0, 18px, 0); }
          to { clip-path: inset(0 0 0 0); transform: translate3d(0, 0, 0); }
        }
        .wrapped-actions {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: min(100%, 390px);
          margin: 0 auto;
        }
        .wrapped-action {
          min-height: 48px;
          border: 1px solid rgba(255,255,255,.18);
          border-radius: 999px;
          background: transparent;
          color: #fff;
          font-weight: 800;
        }
        .wrapped-action.primary { background: var(--wrapped-accent); color: #050505; border-color: var(--wrapped-accent); }
        .wrapped-action:disabled { opacity: .55; }
        .wrapped-back {
          position: relative;
          z-index: 1;
          display: block;
          margin: 18px auto 0;
          color: rgba(255,255,255,.48);
          text-align: center;
          text-decoration: none;
          font-size: 12px;
        }
        .wrapped-message { margin: 10px 0 0; color: rgba(255,255,255,.6); text-align: center; font-size: 12px; }
        .wrapped-preview {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: rgba(0,0,0,.94);
          padding: calc(20px + var(--safe-area-inset-top, 0px)) 20px
            calc(20px + var(--safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .wrapped-preview img {
          max-width: min(82vw, 380px);
          max-height: 78svh;
          border-radius: 18px;
          box-shadow: 0 16px 70px rgba(0,0,0,.7);
        }
        .wrapped-preview p { color: rgba(255,255,255,.65); font-size: 13px; margin: 12px 0; }
        .wrapped-preview-actions { display: flex; gap: 10px; }
        .wrapped-preview-actions a, .wrapped-preview-actions button {
          border-radius: 999px;
          padding: 11px 20px;
          border: 1px solid rgba(255,255,255,.22);
          background: #fff;
          color: #050505;
          text-decoration: none;
          font-weight: 800;
          font-size: 13px;
        }
        @media (prefers-reduced-motion: reduce) {
          .wrapped-panel [data-reveal] {
            opacity: 1;
            transform: none;
          }
          .wrapped-panel[data-active="true"] [data-reveal],
          .wrapped-title-panel[data-active="true"] .wrapped-title-word,
          .wrapped-panel[data-active="true"] .wrapped-final-card:not(.has-photo) .wrapped-final-award,
          .wrapped-panel[data-active="true"] .wrapped-final-card:not(.has-photo) .wrapped-final-minutes,
          .wrapped-scroll-hint.is-initial b,
          .wrapped-scroll-hint span {
            animation: none;
          }
          .wrapped-title-word {
            clip-path: none;
            transform: none;
          }
          .wrapped-final-card:not(.has-photo) .wrapped-final-award,
          .wrapped-final-card:not(.has-photo) .wrapped-final-minutes {
            opacity: 1;
            clip-path: none;
            transform: none;
          }
          .wrapped-progress button::after { transition: none; }
        }
      `}</style>

      <nav className="wrapped-progress" aria-label="年度回顧頁面進度">
        {Array.from({ length: PANEL_COUNT }, (_, index) => (
          <button
            key={index}
            type="button"
            data-complete={activePanel >= index}
            aria-label={`前往第 ${index + 1} 頁`}
            aria-current={activePanel === index ? 'step' : undefined}
            onClick={() => goToPanel(index)}
          />
        ))}
      </nav>

      <section
        ref={panelRef(0)}
        data-panel-index="0"
        data-active={activePanel === 0}
        className="wrapped-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">ES Wake · 2026</div>
          <h1 className="wrapped-display">
            MING’S<br />
            YEAR ON<br />
            <span className="wrapped-cyan">THE WATER.</span>
          </h1>
        </div>
        <div data-reveal="late"><ScrollHint initial onNext={() => goToPanel(1)} /></div>
      </section>

      <section
        ref={panelRef(1)}
        data-panel-index="1"
        data-active={activePanel === 1}
        className="wrapped-panel wrapped-water-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Time on the water</div>
          <h2 className="wrapped-display wrapped-accent">
            {animatedMinutes.toLocaleString('en-US')}
          </h2>
          <p className="wrapped-subtitle">
            MINUTES<br />
            <strong style={{ color: '#fff' }}>
              {wrapped.waterHours} HOURS · {wrapped.waterRemainingMinutes} MINUTES
            </strong>
            <span className="wrapped-footnote">
              LAND TRAINING / {wrapped.landMinutes.toLocaleString('en-US')} MIN
            </span>
          </p>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(2)} /></div>
      </section>

      <section
        ref={panelRef(2)}
        data-panel-index="2"
        data-active={activePanel === 2}
        className="wrapped-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">You didn’t ride alone.</div>
          <h2 className="wrapped-display wrapped-cyan">
            {wrapped.coaches[0]}
            <span className="wrapped-crew-secondary">
              {wrapped.coaches.slice(1).join(' · ')}
            </span>
          </h2>
          <p className="wrapped-subtitle">YOUR 2026 COACHES</p>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(3)} /></div>
      </section>

      <section
        ref={panelRef(3)}
        data-panel-index="3"
        data-active={activePanel === 3}
        className="wrapped-panel wrapped-boat-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Your ride</div>
          <h2 className="wrapped-display">{wrapped.boat}</h2>
          <p className="wrapped-subtitle">
            <strong style={{ color: '#fff' }}>
              {wrapped.boatMinutes.toLocaleString('en-US')} MINUTES
            </strong>
            <span className="wrapped-footnote">
              {wrapped.boatPercent}% OF YOUR WATER TIME
            </span>
          </p>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(4)} /></div>
      </section>

      <section
        ref={panelRef(4)}
        data-panel-index="4"
        data-active={activePanel === 4}
        className="wrapped-panel wrapped-title-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Your 2026 title</div>
          <h2 className="wrapped-display small wrapped-cyan wrapped-title-word" style={{ whiteSpace: 'pre-line' }}>
            {wrapped.title.replace(' ', '\n')}
          </h2>
          <p className="wrapped-subtitle">
            <strong>{wrapped.titleCopy}</strong>
            <span className="wrapped-footnote">
              {wrapped.sessions} TRAINING SESSIONS
            </span>
          </p>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(5)} /></div>
      </section>

      <section
        ref={panelRef(5)}
        data-panel-index="5"
        data-active={activePanel === 5}
        className="wrapped-panel wrapped-final"
      >
        <BrandMark />
        <div
          className={`wrapped-final-card ${shareStyle === 'photo' && photoUrl ? 'has-photo' : ''}`}
          onPointerDown={handlePhotoPointerDown}
          onPointerMove={handlePhotoPointerMove}
          onPointerUp={handlePhotoPointerEnd}
          onPointerCancel={handlePhotoPointerEnd}
        >
          {shareStyle === 'photo' && photoUrl && (
            <img
              className="wrapped-final-photo"
              src={photoUrl}
              alt=""
              draggable={false}
              style={{
                transform: `translate3d(0, ${photoOffsetY * 5}%, 0) scale(1.1)`,
              }}
            />
          )}
          <div className="wrapped-final-card-header">
            <span>ES WAKE · {wrapped.year}</span>
            <img src={ES_BRAND.logoWhite} alt="ES Wake" />
          </div>
          {shareStyle === 'photo' && photoUrl ? (
            <div className="wrapped-final-photo-content">
              <div className="wrapped-final-photo-kicker">{wrapped.name} · {wrapped.year}</div>
              <div className="wrapped-final-award" data-lines={titleLines.length}>
                {titleLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
              </div>
              <div className="wrapped-final-minutes">
                {wrapped.waterMinutes.toLocaleString('en-US')}
              </div>
              <div className="wrapped-final-label">MINUTES ON THE WATER</div>
            </div>
          ) : (
            <>
              <div className="wrapped-final-name">{wrapped.name}</div>
              <div className="wrapped-final-award" data-lines={titleLines.length}>
                {titleLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
              </div>
              <div className="wrapped-final-minutes">
                {wrapped.waterMinutes.toLocaleString('en-US')}
              </div>
              <div className="wrapped-final-label">MINUTES ON THE WATER</div>
              <div className="wrapped-final-stats">
                <div><strong>{wrapped.waterSessions}</strong><span>WATER SESSIONS</span></div>
                <div><strong>{wrapped.coaches.length}</strong><span>COACHES</span></div>
                <div><strong>{wrapped.boat}</strong><span>YOUR BOAT</span></div>
              </div>
              <div className="wrapped-final-copy">{wrapped.titleCopy}</div>
              <div className="wrapped-final-signoff">RIDE TOGETHER.</div>
            </>
          )}
        </div>
        <div data-reveal="late">
          <div className="wrapped-share-editor">
            {photoUrl && (
              <p className="wrapped-photo-position-hint">上下拖曳照片調整位置</p>
            )}
            <div className="wrapped-photo-controls">
              <label className="wrapped-photo-picker">
                {photoUrl ? '更換照片' : '加入照片'}
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
              </label>
              {photoUrl && (
                <button
                  className="wrapped-photo-remove"
                  type="button"
                  onClick={() => {
                    setPhotoUrl(null)
                    setPhotoOffsetY(0)
                    setShareStyle('type')
                    setShareMessage(null)
                  }}
                >
                  使用純文字版
                </button>
              )}
            </div>
          </div>
          <div className="wrapped-actions">
            <button className="wrapped-action primary" type="button" disabled={generating} onClick={() => void handleShare()}>
              {generating ? '產生中…' : '分享打卡卡片'}
            </button>
            <button className="wrapped-action" type="button" disabled={generating} onClick={() => void handlePreview()}>
              預覽／儲存
            </button>
          </div>
          {shareMessage && <p className="wrapped-message">{shareMessage}</p>}
          <Link className="wrapped-back" to="/liff">返回會員專區</Link>
        </div>
      </section>

      {previewUrl && (
        <div className="wrapped-preview" role="dialog" aria-modal="true" aria-label="年度打卡卡片預覽">
          <img src={previewUrl} alt="Ming 的 2026 ES Wake 年度打卡卡片" />
          <p>可長按圖片儲存，或開啟手機的分享／儲存選單。</p>
          <div className="wrapped-preview-actions">
            <button type="button" onClick={() => void handleSaveFromPreview()}>儲存／分享</button>
            <button type="button" onClick={() => setPreviewUrl(null)}>關閉</button>
          </div>
          {shareMessage && <p className="wrapped-message">{shareMessage}</p>}
        </div>
      )}
    </main>
  )
}

function UnavailableView() {
  return (
    <main style={{
      minHeight: '100svh',
      background: '#050505',
      color: '#fff',
      display: 'grid',
      placeItems: 'center',
      padding: 28,
      textAlign: 'center',
    }}>
      <div>
        <img src={ES_BRAND.logoWhite} alt="ES Wake" style={{ width: 62, height: 62 }} />
        <h1 style={{ marginTop: 24, fontSize: 28 }}>年度回顧尚未開放</h1>
        <p style={{ color: 'rgba(255,255,255,.58)' }}>目前僅提供指定帳號測試。</p>
        <Link to="/liff" style={{ color: ACCENT, fontWeight: 800 }}>返回會員專區</Link>
      </div>
    </main>
  )
}

export function MingWrappedDemoBanner({ memberId }: { memberId: string }) {
  const location = useLocation()
  if (memberId !== MING_MEMBER_ID) return null

  return (
    <Link
      to={{
        pathname: '/liff/wrapped',
        search: location.search,
        hash: location.hash,
      }}
      aria-label="開啟 Ming 的 2026 年度回顧"
      style={{
        display: 'block',
        position: 'relative',
        overflow: 'hidden',
        margin: '18px 18px 0',
        padding: '22px 22px 24px',
        borderRadius: 22,
        border: `1px solid rgba(55,217,240,.28)`,
        background: `radial-gradient(circle at 100% 0%, rgba(55,217,240,.17), transparent 46%), ${BACKGROUND}`,
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 14px 36px rgba(0,0,0,.2)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 178,
          height: 178,
          border: '1px solid rgba(55,217,240,.2)',
          borderRadius: '50%',
          right: -92,
          top: -86,
          boxShadow: '0 0 0 42px rgba(55,217,240,.04), 0 0 0 84px rgba(55,217,240,.02)',
        }}
      />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
        <img
          src={ES_BRAND.logoWhite}
          alt=""
          style={{ width: 28, height: 28, objectFit: 'contain' }}
        />
        <div style={{ color: CYAN, font: '800 10px/1 Arial, sans-serif', letterSpacing: '.14em' }}>
          ES WRAPPED · 2026
        </div>
      </div>
      <div style={{ position: 'relative', marginTop: 20, fontSize: 29, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-.05em' }}>
        MING’S YEAR<br />ON THE WATER.
      </div>
      <div
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          marginTop: 22,
          padding: '11px 16px',
          borderRadius: 999,
          background: CYAN,
          color: BACKGROUND,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: '.03em',
        }}
      >
        開啟年度回顧 <span aria-hidden="true">→</span>
      </div>
    </Link>
  )
}

export function WrappedDemo() {
  const liffId = resolveRuntimeLiffId(
    import.meta.env.VITE_LIFF_ID as string | undefined,
    import.meta.env.VITE_LIFF_MIGRATION_ID as string | undefined,
  )
  const {
    loading,
    error,
    member,
    shouldShowBindingForm,
    bindingFormProps,
    retryInit,
  } = useLiffMember({
    trackIconId: 'liff_wrapped_demo_open',
    lightMember: true,
    liffId,
  })

  if (error) return <ErrorView error={error} onRetry={() => void retryInit()} />
  if (loading) return <LiffBootScreen label="準備年度回顧…" />
  if (shouldShowBindingForm) return <BindingForm {...bindingFormProps} />
  if (!member || member.id !== MING_MEMBER_ID) return <UnavailableView />

  return <WrappedStory />
}
