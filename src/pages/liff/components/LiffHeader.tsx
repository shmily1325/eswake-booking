// LIFF 頁首：品牌 lockup 為主視覺；問候次之；刷新用 emoji 確保可見

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
              background: 'rgba(255,255,255,0.22)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              opacity: refreshing ? 0.7 : 1,
            }}
          >
            <span
              style={{
                fontSize: 18,
                display: 'inline-block',
                lineHeight: 1,
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }}
            >
              🔄
            </span>
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
