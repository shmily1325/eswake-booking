import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useResponsive } from '../../../hooks/useResponsive'

const SCANNER_Z_INDEX = 2100
const DUPLICATE_SCAN_MS = 2000

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
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)
  const onScanRef = useRef(onScan)
  const busyRef = useRef(busy)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  onScanRef.current = onScan
  busyRef.current = busy

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
          verbose: false,
        })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(Math.min(viewfinderWidth * 0.92, viewfinderWidth))
              const height = Math.floor(Math.min(viewfinderHeight * 0.38, 140))
              return { width, height }
            },
            disableFlip: false,
          },
          (decodedText) => {
            const code = decodedText.trim().toUpperCase()
            if (!code || busyRef.current) return

            const now = Date.now()
            const last = lastScanRef.current
            if (last && last.code === code && now - last.at < DUPLICATE_SCAN_MS) return
            lastScanRef.current = { code, at: now }

            void onScanRef.current(code)
          },
          () => {
            // per-frame decode miss; ignore
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="掃描商品標籤條碼"
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
          <h3 style={{ margin: 0, fontSize: isMobile ? 17 : 18 }}>掃描標籤條碼</h3>
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
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#666', lineHeight: 1.45 }}>
            對準商品標籤上的 Code128 條碼；掃到會自動加入訂單，可連續掃多項。
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
                  fontSize: 14,
                  background: 'rgba(0,0,0,0.35)',
                }}
              >
                啟動相機中…
              </div>
            )}
          </div>

          {cameraError && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#c62828', lineHeight: 1.45 }}>
              {cameraError}
            </p>
          )}

          {statusMessage && (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: 13,
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
