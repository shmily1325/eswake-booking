// LIFF 頁首：品牌舞台；名字主、歡迎回來次；刷新用 emoji

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
        padding: '24px 20px 20px',
        paddingTop: 'calc(24px + var(--safe-area-inset-top, 0px))',
        color: 'white',
        borderBottom: ES_BRAND.headerBorderBottom,
      }}
    >
      <EsBrandLockup
        subtitle={ES_BRAND.memberAreaLabel}
        logoSize={42}
        brandFontSize={17}
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
        style={{ marginBottom: 14 }}
      />
      <div>
        {hiName ? (
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.3,
            }}
          >
            {hiName}
          </div>
        ) : null}
        <div
          style={{
            marginTop: hiName ? 4 : 0,
            fontSize: 13,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.35,
          }}
        >
          歡迎回來
        </div>
      </div>
    </div>
  )
}
