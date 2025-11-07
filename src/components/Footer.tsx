import { useResponsive } from '../hooks/useResponsive'

export function Footer() {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      textAlign: 'center',
      marginTop: '40px',
      paddingTop: '30px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      color: '#666',
      fontSize: isMobile ? '12px' : '14px'
    }}>
      <p style={{ margin: '0 0 8px 0' }}>
        © {new Date().getFullYear()} ES Wake. All Rights Reserved.
      </p>
      <p style={{ margin: 0, fontSize: isMobile ? '11px' : '12px', opacity: 0.7 }}>
        滑水預約管理系統
      </p>
    </div>
  )
}

