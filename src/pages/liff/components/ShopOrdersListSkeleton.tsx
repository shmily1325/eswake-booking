import { liffContentPanel, LIFF_THEME } from '../liffUiStyles'

/** 商品分頁 inline 骨架（對齊分組列表） */
export function ShopOrdersListSkeleton() {
  return (
    <div style={liffContentPanel}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse"
          style={{
            padding: '16px 0',
            borderBottom: i < 2 ? `1px solid ${LIFF_THEME.rowDivider}` : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ width: 88, height: 16, background: '#e0e0e0', borderRadius: 4 }} />
            <div style={{ width: 48, height: 14, background: '#e8e8e8', borderRadius: 4 }} />
          </div>
          <div style={{ width: '55%', height: 12, background: '#f0f0f0', borderRadius: 4, marginBottom: 10 }} />
          <div style={{ width: '80%', height: 14, background: '#e0e0e0', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: '40%', height: 12, background: '#ececec', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
