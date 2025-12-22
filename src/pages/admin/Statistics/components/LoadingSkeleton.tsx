import { useResponsive } from '../../../../hooks/useResponsive'

export function LoadingSkeleton() {
  const { isMobile } = useResponsive()

  const skeletonStyle = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '8px'
  }

  return (
    <>
      <style>
        {`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}
      </style>
      
      {/* 摘要卡片骨架 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            ...skeletonStyle,
            height: '100px',
            padding: '16px'
          }}>
            <div style={{ ...skeletonStyle, width: '60%', height: '14px', marginBottom: '12px' }} />
            <div style={{ ...skeletonStyle, width: '40%', height: '28px', marginBottom: '8px' }} />
            <div style={{ ...skeletonStyle, width: '30%', height: '12px' }} />
          </div>
        ))}
      </div>

      {/* 圖表/卡片骨架 */}
      <div style={{
        ...skeletonStyle,
        height: isMobile ? '250px' : '300px',
        marginBottom: '24px'
      }} />

      {/* 排行榜骨架 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ ...skeletonStyle, width: '200px', height: '20px', marginBottom: '16px' }} />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ marginBottom: '12px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px' 
            }}>
              <div style={{ ...skeletonStyle, width: '120px', height: '14px' }} />
              <div style={{ ...skeletonStyle, width: '80px', height: '14px' }} />
            </div>
            <div style={{ ...skeletonStyle, height: '8px' }} />
          </div>
        ))}
      </div>
    </>
  )
}

