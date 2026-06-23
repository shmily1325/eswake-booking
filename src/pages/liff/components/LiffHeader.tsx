// LIFF 頁首：品牌 lockup + 問候；分頁名稱僅在 LiffTabs，內容區不重複標題

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
    <div style={{
      background: ES_BRAND.headerBg,
      padding: '20px',
      paddingTop: 'calc(20px + var(--safe-area-inset-top, 0px))',
      color: 'white',
      borderBottom: ES_BRAND.headerBorderBottom,
    }}>
      <EsBrandLockup
        subtitle={ES_BRAND.memberAreaLabel}
        logoSize={36}
        trailing={(
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="重新整理"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span style={{
              fontSize: '18px',
              display: 'inline-block',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}>
              🔄
            </span>
          </button>
        )}
        style={{ marginBottom: '8px' }}
      />
      <div style={{
        fontSize: '14px',
        opacity: 0.9,
      }}>
        {hiName ? `${hiName} 您好！` : '您好！'}
      </div>
    </div>
  )
}
