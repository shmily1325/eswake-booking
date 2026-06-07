import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'

const ASK_MESSAGE = '你好，我想了解預約，有幾個問題想請教：'

function buildAskUrl(): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(getOaId())}/?${encodeURIComponent(ASK_MESSAGE)}`
}

/** 鼓勵先看頁面理解，仍保留直接問小編的入口 */
export function BookStaffHint() {
  const handleAsk = () => {
    if (isMobileDevice()) {
      window.location.href = buildAskUrl()
      return
    }
    window.open(buildAskUrl(), '_blank', 'noopener,noreferrer')
  }

  return (
    <p style={{
      fontSize: 12,
      color: '#888',
      textAlign: 'center',
      margin: '12px 0 0',
      lineHeight: 1.55,
    }}>
      看完還有不確定？
      <button
        type="button"
        onClick={handleAsk}
        style={{
          margin: '0 4px',
          padding: 0,
          border: 'none',
          background: 'none',
          color: '#00b900',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        先問小編
      </button>
      也可以填表單，送出後我們會在 LINE 確認
    </p>
  )
}
