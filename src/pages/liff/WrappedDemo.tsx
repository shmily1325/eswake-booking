import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ES_BRAND } from '../../lib/esBrandTokens'
import { triggerHaptic } from '../../utils/haptic'
import { BindingForm } from './components/BindingForm'
import { ErrorView } from './components/ErrorView'
import { LiffBootScreen } from './LiffBootScreen'
import { resolveRuntimeLiffId } from './liffUrl'
import { useLiffMember } from './useLiffMember'

const MING_MEMBER_ID = '3ba83648-1f69-418a-8939-76a83e7014cb'
const ACCENT = '#c8ff34'
const CYAN = '#59e6ff'
const PANEL_COUNT = 6

const wrapped = {
  year: 2026,
  name: 'MING',
  title: '地縛靈',
  totalMinutes: 6470,
  sessions: 127,
  hours: 107,
  remainingMinutes: 50,
  coach: '阿寶',
  coachMinutes: 6250,
  coachPercent: 97,
  boat: 'G21',
  boatMinutes: 3830,
  boatPercent: 59,
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

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

async function createWrappedCard(): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1920
  const context = canvas.getContext('2d')
  if (!context) throw new Error('瀏覽器不支援圖片產生')

  await document.fonts?.ready

  context.fillStyle = '#050505'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = 'rgba(200, 255, 52, 0.25)'
  context.lineWidth = 4
  for (let radius = 180; radius <= 700; radius += 104) {
    context.beginPath()
    context.arc(970, 360, radius, 0, Math.PI * 2)
    context.stroke()
  }

  context.fillStyle = ACCENT
  roundedRect(context, 70, 72, 250, 58, 29)
  context.fill()
  context.fillStyle = '#050505'
  context.font = '700 27px Arial, sans-serif'
  context.fillText('2026 SO FAR', 104, 111)

  try {
    const logo = new Image()
    logo.src = ES_BRAND.logoWhite
    await logo.decode()
    context.drawImage(logo, 894, 68, 116, 116)
  } catch {
    context.fillStyle = '#ffffff'
    context.font = '800 32px Arial, sans-serif'
    context.fillText('ES WAKE', 846, 112)
  }

  context.fillStyle = '#ffffff'
  context.font = '900 118px Arial, "Noto Sans TC", sans-serif'
  context.fillText(wrapped.name, 70, 350)

  context.fillStyle = CYAN
  context.font = '800 54px Arial, "Noto Sans TC", sans-serif'
  context.fillText(`年度稱號｜${wrapped.title}`, 76, 438)

  context.fillStyle = '#ffffff'
  context.font = '900 230px Arial, sans-serif'
  context.fillText(wrapped.totalMinutes.toLocaleString('en-US'), 58, 790)
  context.fillStyle = 'rgba(255,255,255,0.64)'
  context.font = '700 38px Arial, sans-serif'
  context.fillText('MINUTES ON THE WATER', 76, 862)

  context.fillStyle = 'rgba(255,255,255,0.12)'
  roundedRect(context, 70, 1010, 940, 360, 42)
  context.fill()

  const stats = [
    { label: 'SESSIONS', value: String(wrapped.sessions) },
    { label: 'TOP COACH', value: wrapped.coach },
    { label: 'YOUR BOAT', value: wrapped.boat },
  ]
  stats.forEach((stat, index) => {
    const x = 112 + index * 300
    context.fillStyle = index === 1 ? CYAN : ACCENT
    context.font = '900 65px Arial, "Noto Sans TC", sans-serif'
    context.fillText(stat.value, x, 1172)
    context.fillStyle = 'rgba(255,255,255,0.58)'
    context.font = '700 25px Arial, sans-serif'
    context.fillText(stat.label, x, 1234)
  })

  context.fillStyle = '#ffffff'
  context.font = '800 44px Arial, "Noto Sans TC", sans-serif'
  context.fillText('我們合理懷疑，你住在這裡。', 72, 1548)
  context.fillStyle = 'rgba(255,255,255,0.54)'
  context.font = '500 31px Arial, "Noto Sans TC", sans-serif'
  context.fillText('RIDE TOGETHER.  ES WAKE SCHOOL', 72, 1620)

  context.fillStyle = ACCENT
  context.fillRect(70, 1760, 940, 12)
  context.fillStyle = '#ffffff'
  context.font = '700 27px Arial, sans-serif'
  context.fillText('ES WAKE · 2026 WRAPPED', 70, 1830)

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

function ScrollHint({ onNext }: { onNext: () => void }) {
  return (
    <button className="wrapped-scroll-hint" type="button" onClick={onNext} aria-label="前往下一頁">
      <span />
      NEXT
    </button>
  )
}

function WrappedStory() {
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState(0)
  const panelRefs = useRef<Array<HTMLElement | null>>([])
  const animatedMinutes = useCountUp(wrapped.totalMinutes, activePanel === 1)

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
    const blob = await createWrappedCard()
    const url = URL.createObjectURL(blob)
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return url
    })
    return { blob, url }
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
      const file = new File([blob], `es-wake-${wrapped.year}-ming.png`, { type: 'image/png' })
      const shareData = {
        files: [file],
        title: `Ming's ${wrapped.year} ES Wake`,
        text: `我的 ${wrapped.year} ES Wake 年度稱號：${wrapped.title}`,
      }
      if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        setShareMessage('此瀏覽器不支援直接分享，請長按圖片儲存。')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareMessage(error instanceof Error ? error.message : '分享失敗，請改用儲存圖片。')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <main className="wrapped-root">
      <style>{`
        .wrapped-root {
          --wrapped-accent: ${ACCENT};
          --wrapped-cyan: ${CYAN};
          background: #050505;
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
          background: var(--wrapped-accent);
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
          transform: translate3d(0, 30px, 0);
        }
        .wrapped-panel[data-active="true"] [data-reveal] {
          animation: wrapped-reveal .72s cubic-bezier(.2,.8,.2,1) both;
        }
        .wrapped-panel[data-active="true"] [data-reveal="late"] {
          animation-delay: .16s;
        }
        @keyframes wrapped-reveal {
          from { opacity: 0; transform: translate3d(0, 30px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .wrapped-panel::after {
          content: "";
          position: absolute;
          width: 440px;
          height: 440px;
          border: 1px solid rgba(200,255,52,.2);
          border-radius: 50%;
          right: -260px;
          top: 18%;
          box-shadow: 0 0 0 70px rgba(200,255,52,.04), 0 0 0 140px rgba(200,255,52,.025);
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
        .wrapped-accent { color: var(--wrapped-accent); }
        .wrapped-cyan { color: var(--wrapped-cyan); }
        .wrapped-scroll-hint {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          padding: 10px 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: rgba(255,255,255,.38);
          font: 700 9px/1 Arial, sans-serif;
          letter-spacing: .16em;
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
          border-radius: 24px;
          background:
            radial-gradient(circle at 95% 15%, rgba(200,255,52,.2), transparent 32%),
            #050505;
          padding: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,.5);
        }
        .wrapped-final-card .wrapped-brand img { width: 28px; height: 28px; }
        .wrapped-final-name {
          margin-top: 22%;
          font: 900 clamp(44px, 14vw, 70px)/.9 Arial Black, Arial, sans-serif;
          letter-spacing: -.07em;
        }
        .wrapped-final-title {
          color: var(--wrapped-cyan);
          font-size: 18px;
          font-weight: 800;
          margin-top: 14px;
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
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid rgba(255,255,255,.15);
        }
        .wrapped-final-stats strong { display: block; font-size: 20px; line-height: 1; }
        .wrapped-final-stats span { display: block; margin-top: 6px; color: rgba(255,255,255,.48); font-size: 9px; letter-spacing: .1em; }
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
          .wrapped-scroll-hint span {
            animation: none;
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
          <div className="wrapped-kicker">2026 · So far</div>
          <h1 className="wrapped-display">
            MING’S<br />
            YEAR ON<br />
            <span className="wrapped-accent">THE WATER.</span>
          </h1>
          <p className="wrapped-subtitle">你今年留下的，不只是浪花。</p>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(1)} /></div>
      </section>

      <section
        ref={panelRef(1)}
        data-panel-index="1"
        data-active={activePanel === 1}
        className="wrapped-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Your time</div>
          <h2 className="wrapped-display wrapped-accent">
            {animatedMinutes.toLocaleString('en-US')}
          </h2>
          <p className="wrapped-subtitle">
            MINUTES<br />
            <strong style={{ color: '#fff' }}>
              {wrapped.hours} 小時 {wrapped.remainingMinutes} 分鐘
            </strong>
            <br />都留在你喜歡的地方。
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
          <div className="wrapped-kicker">Your #1 coach</div>
          <h2 className="wrapped-display wrapped-cyan">{wrapped.coach}</h2>
          <p className="wrapped-subtitle">
            一起訓練 {wrapped.coachMinutes.toLocaleString('en-US')} 分鐘，默契占了全年
            {' '}<strong style={{ color: '#fff' }}>{wrapped.coachPercent}%</strong>。
          </p>
          <div className="wrapped-ratio">
            <div className="wrapped-ratio-line">
              <span style={{ width: `${wrapped.coachPercent}%`, background: CYAN }} />
            </div>
            <div className="wrapped-ratio-label"><span>TOGETHER</span><span>{wrapped.coachPercent}%</span></div>
          </div>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(3)} /></div>
      </section>

      <section
        ref={panelRef(3)}
        data-panel-index="3"
        data-active={activePanel === 3}
        className="wrapped-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Your boat</div>
          <h2 className="wrapped-display">{wrapped.boat}</h2>
          <p className="wrapped-subtitle">
            {wrapped.boatMinutes.toLocaleString('en-US')} 分鐘。你的年度命定船隻，占總時數
            {' '}<strong className="wrapped-accent">{wrapped.boatPercent}%</strong>。
          </p>
          <div className="wrapped-ratio">
            <div className="wrapped-ratio-line"><span style={{ width: `${wrapped.boatPercent}%` }} /></div>
            <div className="wrapped-ratio-label"><span>G21 TIME</span><span>{wrapped.boatPercent}%</span></div>
          </div>
        </div>
        <div data-reveal="late"><ScrollHint onNext={() => goToPanel(4)} /></div>
      </section>

      <section
        ref={panelRef(4)}
        data-panel-index="4"
        data-active={activePanel === 4}
        className="wrapped-panel"
      >
        <BrandMark />
        <div data-reveal>
          <div className="wrapped-kicker">Your 2026 title</div>
          <h2 className="wrapped-display small wrapped-cyan">ES<br />地縛靈</h2>
          <p className="wrapped-subtitle">
            {wrapped.sessions} 次紀錄，最投入的月份是 {wrapped.peakMonth}。
            <br /><strong style={{ color: '#fff' }}>我們合理懷疑，你住在這裡。</strong>
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
        <div className="wrapped-final-card" data-reveal>
          <BrandMark />
          <div className="wrapped-final-name">{wrapped.name}</div>
          <div className="wrapped-final-title">年度稱號｜{wrapped.title}</div>
          <div className="wrapped-final-minutes">
            {wrapped.totalMinutes.toLocaleString('en-US')}
          </div>
          <div className="wrapped-final-label">MINUTES ON THE WATER</div>
          <div className="wrapped-final-stats">
            <div><strong>{wrapped.sessions}</strong><span>SESSIONS</span></div>
            <div><strong>{wrapped.boat}</strong><span>YOUR BOAT</span></div>
          </div>
        </div>
        <div data-reveal="late">
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
          <p>可長按圖片儲存，或使用下方按鈕下載。</p>
          <div className="wrapped-preview-actions">
            <a href={previewUrl} download={`es-wake-${wrapped.year}-ming.png`}>下載圖片</a>
            <button type="button" onClick={() => setPreviewUrl(null)}>關閉</button>
          </div>
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
      style={{
        display: 'block',
        margin: '18px 18px 0',
        padding: '22px',
        borderRadius: 22,
        background: '#050505',
        color: '#fff',
        textDecoration: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,.16)',
      }}
    >
      <div style={{ color: ACCENT, font: '800 11px/1 Arial, sans-serif', letterSpacing: '.14em' }}>
        2026 SO FAR
      </div>
      <div style={{ marginTop: 13, fontSize: 27, fontWeight: 900, lineHeight: 1.08, letterSpacing: '-.04em' }}>
        MING’S YEAR<br />ON THE WATER.
      </div>
      <div style={{ marginTop: 18, color: 'rgba(255,255,255,.62)', fontSize: 13 }}>
        查看你的年度回顧 <span style={{ color: ACCENT }}>→</span>
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
