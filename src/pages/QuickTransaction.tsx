import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'

interface QuickTransactionProps {
  user: User
}

export function QuickTransaction({ user }: QuickTransactionProps) {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="💳 快速記帳" user={user} showBaoLink={true} />

      {/* 即將推出提示 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          fontSize: isMobile ? '80px' : '120px',
          marginBottom: '20px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          🚧
        </div>
        
        <h2 style={{
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '15px',
          margin: 0
        }}>
          預留功能
        </h2>
        
        <p style={{
          fontSize: isMobile ? '16px' : '18px',
          color: '#666',
          maxWidth: '600px',
          lineHeight: '1.6',
          margin: '15px 0'
        }}>
          此功能為未來擴展預留
        </p>
      </div>

      <Footer />

      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  )
}
