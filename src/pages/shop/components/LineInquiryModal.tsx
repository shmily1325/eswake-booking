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
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2
            id="line-inquiry-title"
            className="text-lg font-bold text-zinc-900"
          >
            透過 LINE 詢問購買
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 -m-1"
            aria-label="關閉"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            您在電腦上瀏覽。建議
            <strong className="text-zinc-900">用手機開啟 LINE</strong>
            獲得最佳體驗；若要在電腦上完成，請依下方步驟：
          </p>

          {/* Step 1: 訊息 + 複製 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                ① 詢問訊息
              </h3>
              <button
                type="button"
                onClick={handleCopy}
                className={
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-colors ' +
                  (copied
                    ? 'bg-green-100 text-green-700'
                    : 'bg-orange-500 text-white hover:bg-orange-600')
                }
              >
                {copied ? '✓ 已複製' : '📋 複製訊息'}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={message}
              readOnly
              rows={Math.min(12, message.split('\n').length + 1)}
              className="w-full text-xs border border-gray-200 rounded-md p-2 bg-gray-50 font-mono resize-none focus:outline-none focus:border-orange-400"
            />
          </section>

          {/* Step 2: 開 LINE */}
          <section>
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">
              ② 開啟 LINE 並貼上訊息
            </h3>
            <a
              href={oaHomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-4 py-2.5 rounded-md bg-[#06C755] text-white font-semibold hover:bg-[#05a847] transition-colors"
            >
              開啟 LINE 對話（{oaId}）
            </a>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              開啟後加我們為好友，回到對話框
              <strong>貼上</strong>剛剛複製的訊息再送出即可。
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-zinc-900"
          >
            關閉
          </button>
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
