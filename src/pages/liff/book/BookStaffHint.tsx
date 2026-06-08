import { getOaId, isMobileDevice } from '../../shop/lib/lineDeepLink'

const ASK_MESSAGE = '你好，我想了解預約，有幾個問題想請教：'

function buildAskUrl(): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(getOaId())}/?${encodeURIComponent(ASK_MESSAGE)}`
}

export function BookStaffHint() {
  const handleAsk = () => {
    if (isMobileDevice()) {
      window.location.href = buildAskUrl()
      return
    }
    window.open(buildAskUrl(), '_blank', 'noopener,noreferrer')
  }

  return (
    <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', margin: '12px 0 4px' }}>
      不懂？
      <button
        type="button"
        onClick={handleAsk}
        style={{
          margin: '0 3px', padding: 0, border: 'none', background: 'none',
          color: '#00b900', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        問小編
      </button>
    </p>
  )
}
