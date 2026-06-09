/** 餘額／會員等分頁背景載入中的 inline 骨架 */
export function TabPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton-pulse"
          style={{
            height: 48,
            background: i === 0 ? '#e8e8e8' : '#f0f0f0',
            borderRadius: 8,
            marginBottom: i < rows - 1 ? 10 : 0,
          }}
        />
      ))}
    </div>
  )
}
