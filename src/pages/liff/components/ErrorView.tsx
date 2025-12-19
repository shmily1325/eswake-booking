// 錯誤顯示組件

interface ErrorViewProps {
  error: string
}

export function ErrorView({ error }: ErrorViewProps) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
        <div style={{ fontSize: '18px', color: '#d32f2f', fontWeight: '600', marginBottom: '8px' }}>
          發生錯誤
        </div>
        <div style={{ fontSize: '14px', color: '#666' }}>
          {error}
        </div>
      </div>
    </div>
  )
}

