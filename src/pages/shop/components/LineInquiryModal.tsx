import { useEffect, useRef, useState } from 'react'
import { buildOaHomeUrl, getOaId } from '../lib/lineDeepLink'

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
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="line-inquiry-title"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between">
          <h2
            id="line-inquiry-title"
            className="text-base font-bold text-zinc-900"
          >
            用 LINE 詢問
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 -m-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 overflow-y-auto flex-1 space-y-3">
          <textarea
            ref={textareaRef}
            value={message}
            readOnly
            rows={Math.min(10, message.split('\n').length + 1)}
            className="w-full text-xs border border-gray-200 rounded-md p-2 bg-gray-50 font-mono resize-none focus:outline-none focus:border-black"
          />

          <button
            type="button"
            onClick={handleCopy}
            className={
              'w-full text-sm font-medium px-3 py-2 rounded-md transition-colors ' +
              (copied
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
            }
          >
            {copied ? '✓ 已複製' : '📋 複製訊息'}
          </button>

          <a
            href={oaHomeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-4 py-2.5 rounded-md bg-[#06C755] text-white font-semibold hover:bg-[#05a847] transition-colors"
          >
            開啟 LINE 對話（{oaId}）
          </a>

          <p className="text-xs text-gray-500 text-center">
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
