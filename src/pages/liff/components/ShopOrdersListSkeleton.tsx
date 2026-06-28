import { liffContentPanel, LIFF_THEME } from '../liffUiStyles'

/** 商品分頁 inline 骨架（對齊 liffCard 結構） */
export function ShopOrdersListSkeleton() {
  return (
    <div style={liffContentPanel}>
      <div className="skeleton-pulse" style={{
        width: '55%',
        height: 14,
        background: '#e8e8e8',
        borderRadius: 4,
        marginBottom: 16,
      }} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse"
          style={{
            padding: '16px',
            marginBottom: i < 2 ? 12 : 0,
            borderRadius: LIFF_THEME.cardRadius,
            border: LIFF_THEME.cardBorder,
            boxShadow: LIFF_THEME.cardShadow,
            borderLeft: '4px solid #e0e0e0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ width: 88, height: 16, background: '#e0e0e0', borderRadius: 4 }} />
            <div style={{ width: 56, height: 24, background: '#e8e8e8', borderRadius: 6 }} />
          </div>
          <div style={{ width: '70%', height: 12, background: '#f0f0f0', borderRadius: 4, marginBottom: 10 }} />
          <div style={{
            padding: '12px',
            background: LIFF_THEME.surfaceInset,
            borderRadius: 12,
          }}>
            <div style={{ width: '90%', height: 14, background: '#e0e0e0', borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: '45%', height: 12, background: '#ececec', borderRadius: 4, marginBottom: 8 }} />
            <div style={{ width: 48, height: 20, background: '#e8e8e8', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
