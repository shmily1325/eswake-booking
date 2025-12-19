// 載入骨架屏組件

export function LoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '16px'
    }}>
      {/* 頭部骨架屏 */}
      <div style={{ marginBottom: '20px' }}>
        <div className="skeleton-pulse" style={{ 
          width: '150px', 
          height: '28px', 
          background: '#e0e0e0', 
          borderRadius: '6px',
          marginBottom: '12px'
        }} />
        <div className="skeleton-pulse" style={{ 
          width: '100%', 
          height: '48px', 
          background: 'white', 
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }} />
      </div>

      {/* 預約列表骨架屏 */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className="skeleton-pulse"
          style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div className="skeleton-pulse" style={{ width: '60px', height: '18px', background: '#e0e0e0', borderRadius: '4px' }} />
            <div className="skeleton-pulse" style={{ flex: 1, height: '18px', background: '#e0e0e0', borderRadius: '4px' }} />
          </div>
          <div className="skeleton-pulse" style={{ width: '80%', height: '16px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '8px' }} />
          <div className="skeleton-pulse" style={{ width: '60%', height: '14px', background: '#f0f0f0', borderRadius: '4px' }} />
        </div>
      ))}

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }

          .skeleton-pulse {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        `}
      </style>
    </div>
  )
}

