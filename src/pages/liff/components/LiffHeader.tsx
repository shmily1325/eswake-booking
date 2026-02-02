// LIFF 頁首組件

import type { Member } from '../types'

interface LiffHeaderProps {
  member: Member | null
  refreshing: boolean
  onRefresh: () => void
}

export function LiffHeader({ member, refreshing, onRefresh }: LiffHeaderProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
      padding: '20px',
      paddingTop: 'calc(20px + var(--safe-area-inset-top, 0px))',
      color: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px'
      }}>
        <h1 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: 0
        }}>
          我的預約
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                display: 'inline-block',
                animation: refreshing ? 'spin 1s linear infinite' : 'none'
              }}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
          <img 
            src="/logo_circle (white).png" 
            alt="ES Wake Logo" 
            style={{ 
              width: '40px', 
              height: '40px',
              objectFit: 'contain'
            }} 
          />
        </div>
      </div>
      <div style={{
        fontSize: '14px',
        opacity: 0.9
      }}>
        {member?.nickname || member?.name} 您好！
      </div>
    </div>
  )
}

