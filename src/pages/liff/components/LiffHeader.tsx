// LIFF 頁首：品牌 lockup 為主視覺；問候次之；刷新不搶戲

import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { displayNameForLiff } from '../../../utils/liffMemberDisplay'
import type { Member } from '../types'

interface LiffHeaderProps {
  member: Member | null
  /** LINE 顯示名稱；會員資料未到時先問候用 */
  lineDisplayName?: string | null
  refreshing: boolean
  onRefresh: () => void
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{
        display: 'block',
        animation: spinning ? 'spin 1s linear infinite' : 'none',
      }}
    >
      <path
        d="M20 6v5h-5M4 18v-5h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.3 9.2A7 7 0 0 1 18.5 8M17.7 14.8A7 7 0 0 1 5.5 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LiffHeader({ member, lineDisplayName, refreshing, onRefresh }: LiffHeaderProps) {
  const hiName = member ? displayNameForLiff(member) : (lineDisplayName?.trim() || '')
  return (
    <div
      style={{
        background: ES_BRAND.headerBg,
        padding: '22px 20px 18px',
        paddingTop: 'calc(22px + var(--safe-area-inset-top, 0px))',
        color: 'white',
        borderBottom: ES_BRAND.headerBorderBottom,
      }}
    >
      <EsBrandLockup
        subtitle={ES_BRAND.memberAreaLabel}
        logoSize={40}
        trailing={(
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="重新整理"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              color: 'rgba(255,255,255,0.9)',
              transition: 'opacity 0.2s',
              opacity: refreshing ? 0.65 : 1,
            }}
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        )}
        style={{ marginBottom: 10 }}
      />
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '0.01em',
          color: 'rgba(255,255,255,0.88)',
        }}
      >
        {hiName ? `${hiName} 您好` : '您好'}
      </div>
    </div>
  )
}
