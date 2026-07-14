/**
 * Design thinking:
 * Current feel: shadow-2xl and emoji copy labels make a simple desktop fallback feel heavier than needed.
 * Hierarchy: message preview → copy → LINE deep-link CTA → quiet tip.
 * Primary task: copy the inquiry text and open LINE OA — LINE green only on the LINE action.
 */
import { useEffect, useRef, useState } from 'react'
import { buildOaHomeUrl, getOaId } from '../lib/lineDeepLink'
import { designSystem, getFontSize } from '../../../styles/designSystem'

interface LineInquiryModalProps {
  /** 預填的詢問訊息（多行文字）；falsy = 不顯示 modal */
  message: string | null
  onClose: () => void
}

/**
 * 桌機 fallback：當客人在電腦上按「LINE 詢問」時用。
 *
 * 為什麼需要：
 * - LINE 的 `oaMessage` deep link 是為手機 LINE app 設計
 * - 桌機沒裝 LINE Desktop 時，瀏覽器會跳到 LINE 行銷首頁，客人完全看不到自己的詢問內容
 *
 * 這個 modal 提供：
 * 1. 完整的預填訊息（可一鍵複製）
 * 2. 開啟 LINE OA 主頁（加好友 / 開對話）的連結
 * 3. 「請用手機操作」的提示
 *
 * 手機版不會用到（前端會直接跳 deep link）。
 */
export function LineInquiryModal({ message, onClose }: LineInquiryModalProps) {
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // 進場時自動嘗試一次 clipboard 複製（提升 UX，省一個點擊）
  useEffect(() => {
    if (!message) return
    setCopied(false)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(message)
        .then(() => setCopied(true))
        .catch(() => {
          /* 某些瀏覽器（無痕、舊版）不允許 auto copy，需要使用者按按鈕 */
        })
    }
  }, [message])

  // ESC 關閉
  useEffect(() => {
    if (!message) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [message, onClose])

  if (!message) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
    } catch {
      // fallback：選取 textarea 文字讓使用者手動 Ctrl+C
      textareaRef.current?.select()
    }
  }

  const oaHomeUrl = buildOaHomeUrl()
  const oaId = getOaId()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-inquiry-title"
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.lg,
          border: `1px solid ${designSystem.colors.border.light}`,
          boxShadow: designSystem.shadows.md,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${designSystem.colors.border.light}` }}
        >
          <h2
            id="line-inquiry-title"
            style={{
              margin: 0,
              fontSize: getFontSize('h3', false),
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: designSystem.colors.text.primary,
            }}
          >
            用 LINE 詢問
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -m-1 leading-none"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: designSystem.colors.text.secondary,
              fontSize: designSystem.fontSize.h1.desktop,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-3">
          <textarea
            ref={textareaRef}
            value={message}
            readOnly
            rows={Math.min(10, message.split('\n').length + 1)}
            className="w-full font-mono resize-none focus:outline-none"
            style={{
              fontSize: getFontSize('caption', false),
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              padding: designSystem.spacing.sm,
              background: designSystem.colors.background.main,
              color: designSystem.colors.text.primary,
            }}
          />

          <button
            type="button"
            onClick={handleCopy}
            className="w-full transition-colors"
            style={{
              fontSize: getFontSize('button', false),
              fontWeight: 500,
              padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
              borderRadius: designSystem.borderRadius.md,
              border: `1px solid ${designSystem.colors.border.main}`,
              cursor: 'pointer',
              background: copied
                ? designSystem.colors.success[50]
                : designSystem.colors.background.main,
              color: copied
                ? designSystem.colors.success[700]
                : designSystem.colors.text.primary,
            }}
          >
            {copied ? '已複製' : '複製訊息'}
          </button>

          <a
            href={oaHomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center transition-colors hover:opacity-90"
            style={{
              padding: '10px 16px',
              borderRadius: designSystem.borderRadius.md,
              background: '#06C755',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: getFontSize('button', false),
              textDecoration: 'none',
            }}
          >
            開啟 LINE 對話（{oaId}）
          </a>

          <p
            className="text-center"
            style={{
              margin: 0,
              fontSize: getFontSize('caption', false),
              color: designSystem.colors.text.secondary,
            }}
          >
            加好友後，回對話框貼上訊息送出即可
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
