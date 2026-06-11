/** 公開 book / guide 輕量入口的 Suspense fallback（不拉 LIFF 樣式） */
export function PublicBootScreen({ label = '載入中…' }: { label?: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f5f7',
        color: '#666',
        fontSize: 14,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang TC', 'Microsoft JhengHei', sans-serif",
      }}
    >
      {label}
    </div>
  )
}
