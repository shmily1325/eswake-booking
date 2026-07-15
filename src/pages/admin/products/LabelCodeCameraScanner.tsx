import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useResponsive } from '../../../hooks/useResponsive'
import { getFontSize } from '../../../styles/designSystem'

const SCANNER_Z_INDEX = 2100
/** 同一組代碼重新觸發的最短間隔；搭配解鎖狀態避免手持不動時狂加 */
const SAME_CODE_COOLDOWN_MS = 900
/** 同一碼離開視野一小段時間才解鎖，讓「移開再掃」成為可預期節奏 */
const SAME_CODE_RELEASE_GAP_MS = 350
/** 需連續讀到同一碼的幀數才確認，過濾單幀誤讀（提升準確度） */
const SCAN_CONFIRM_COUNT = 2

interface LabelCodeCameraScannerProps {
  open: boolean
  onClose: () => void
  onScan: (labelCode: string) => void | Promise<void>
  busy?: boolean
  statusMessage?: string | null
}

export function LabelCodeCameraScanner({
  open,
  onClose,
  onScan,
  busy = false,
  statusMessage = null,
}: LabelCodeCameraScannerProps) {
  const { isMobile } = useResponsive()
  const regionId = useId().replace(/:/g, '')
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null)
  const startingRef = useRef(false)
  const lastScanRef = useRef<{ code: string; at: number; released: boolean } | null>(null)
  const lastDecodedAtRef = useRef(0)
  const pendingRef = useRef<{ code: string; count: number } | null>(null)
  const onScanRef = useRef(onScan)
  const busyRef = useRef(busy)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [manualCode, setManualCode] = useState('')

  onScanRef.current = onScan
  busyRef.current = busy

  useEffect(() => {
    if (open) setManualCode('')
  }, [open])

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
    } catch {
      // ignore stop errors during teardown
    }
    try {
      scanner.clear()
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!open) {
      setCameraError(null)
      setCameraReady(false)
      lastScanRef.current = null
      lastDecodedAtRef.current = 0
      pendingRef.current = null
      void stopCamera()
      return
    }

    let cancelled = false

    const start = async () => {
      if (startingRef.current) return
      startingRef.current = true
      setCameraError(null)
      setCameraReady(false)

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
        if (cancelled) return

        const scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128],
          // 支援的裝置改用瀏覽器原生 BarcodeDetector，解碼比 JS ZXing 準且快
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(Math.min(viewfinderWidth * 0.92, viewfinderWidth))
              const height = Math.floor(Math.min(viewfinderHeight * 0.45, 180))
              return { width, height }
            },
            disableFlip: false,
          },
          (decodedText) => {
            const code = decodedText.trim().toUpperCase()
            if (!code || busyRef.current) return
            const now = Date.now()
            lastDecodedAtRef.current = now

            const last = lastScanRef.current
            if (last && last.code === code && !last.released) return

            // 需連續讀到同一碼 SCAN_CONFIRM_COUNT 幀才確認，過濾單幀誤讀
            const pending = pendingRef.current
            if (pending && pending.code === code) {
              pending.count += 1
            } else {
              pendingRef.current = { code, count: 1 }
              return
            }
            if (pending.count < SCAN_CONFIRM_COUNT) return

            if (last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS) return
            lastScanRef.current = { code, at: now, released: false }
            pendingRef.current = null

            void onScanRef.current(code)
          },
          () => {
            const last = lastScanRef.current
            if (!last || last.released) return
            if (Date.now() - lastDecodedAtRef.current >= SAME_CODE_RELEASE_GAP_MS) {
              lastScanRef.current = { ...last, released: true }
              pendingRef.current = null
            }
          },
        )

        if (!cancelled) setCameraReady(true)
      } catch (err: unknown) {
        if (cancelled) return
        setCameraError(cameraStartErrorMessage(err))
      } finally {
        startingRef.current = false
      }
    }

    void start()

    return () => {
      cancelled = true
      void stopCamera()
    }
  }, [open, regionId, stopCamera])

  if (!open) return null

  const dialogTitle = '掃描商品標籤'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dialogTitle}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: SCANNER_Z_INDEX,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          width: '100%',
          maxWidth: 480,
          borderRadius: isMobile ? '16px 16px 0 0' : 16,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile
              ? 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px'
              : '16px 20px 12px',
            borderBottom: '1px solid #eee',
          }}
        >
          <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>{dialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉掃描"
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 24,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#666',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: getFontSize('bodySmall', isMobile), color: '#666', lineHeight: 1.45 }}>
            對準標籤條碼，或直接輸入標籤編號。
          </p>

          <div
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#111',
              minHeight: 220,
            }}
          >
            <div id={regionId} style={{ width: '100%' }} />
            {!cameraReady && !cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: getFontSize('body', isMobile),
                  background: 'rgba(0,0,0,0.35)',
                }}
              >
                啟動相機中…
              </div>
            )}
          </div>

          {cameraError && (
            <p style={{ margin: '10px 0 0', fontSize: getFontSize('bodySmall', isMobile), color: '#c62828', lineHeight: 1.45 }}>
              {cameraError}
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const code = manualCode.trim()
              if (!code || busy) return
              void onScanRef.current(code)
            }}
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
            }}
          >
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="輸入標籤編號"
              autoCapitalize="none"
              autoCorrect="off"
              disabled={busy}
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: 44,
                padding: '9px 12px',
                border: '1px solid #ccc',
                borderRadius: 8,
                fontSize: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={busy || !manualCode.trim()}
              style={{
                minHeight: 44,
                padding: '9px 16px',
                border: 'none',
                borderRadius: 8,
                background: '#111',
                color: '#fff',
                fontWeight: 600,
                fontSize: getFontSize('button', isMobile),
                cursor: busy || !manualCode.trim() ? 'default' : 'pointer',
                opacity: busy || !manualCode.trim() ? 0.5 : 1,
              }}
            >
              確認
            </button>
          </form>

          {statusMessage && (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: getFontSize('bodySmall', isMobile),
                color: busy ? '#2563eb' : '#333',
                lineHeight: 1.45,
              }}
            >
              {statusMessage}
            </p>
          )}
        </div>

        <div
          style={{
            padding: isMobile
              ? '0 16px calc(12px + env(safe-area-inset-bottom, 0px))'
              : '0 20px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: isMobile ? '12px 18px' : '10px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              minHeight: isMobile ? 44 : undefined,
              fontSize: getFontSize('button', isMobile),
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function cameraStartErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const msg = err instanceof Error ? err.message : String(err)
  if (name === 'NotAllowedError' || /permission/i.test(msg)) {
    return '無法使用相機：請在瀏覽器設定中允許相機權限後再試。'
  }
  if (name === 'NotFoundError' || /not found/i.test(msg)) {
    return '找不到相機裝置。'
  }
  if (/secure context|https/i.test(msg)) {
    return '相機需在 HTTPS 安全連線下使用。'
  }
  return `無法啟動相機：${msg || '請稍後再試'}`
}
