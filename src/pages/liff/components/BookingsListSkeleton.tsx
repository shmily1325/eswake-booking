import { liffContentPanel } from '../liffUiStyles'

/** 預約分頁 inline 骨架（專區 shell 已顯示時用） */
export function BookingsListSkeleton() {
  return (
    <div style={liffContentPanel}>
      <div className="skeleton-pulse" style={{
        width: '70%',
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
            padding: '14px 0',
            borderTop: i > 0 ? '1px solid #f0f0f0' : undefined,
          }}
        >
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 56, height: 16, background: '#e0e0e0', borderRadius: 4 }} />
            <div style={{ flex: 1, height: 16, background: '#e0e0e0', borderRadius: 4 }} />
          </div>
          <div style={{ width: '85%', height: 14, background: '#f0f0f0', borderRadius: 4, marginBottom: 6 }} />
          <div style={{ width: '55%', height: 14, background: '#f0f0f0', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
