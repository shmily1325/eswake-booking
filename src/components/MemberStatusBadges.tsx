import { getBadgeStyle } from '../styles/designSystem'
import {
  getBoardExpiryAlertStatus,
  getMembershipExpiryAlertStatus,
  getMembershipTypeBadgeVariant,
  getMembershipTypeLabel,
  type ExpiryAlertStatus,
} from '../utils/membership'

interface MemberStatusBadgesProps {
  membershipType: string | null | undefined
  membershipEndDate?: string | null
  boardExpiryDates?: Array<string | null | undefined> | null
  /** 預設顯示會員類型；僅要到期小標時可關閉 */
  showType?: boolean
}

function expiryBadgeLabel(kind: '會籍' | '置板', status: ExpiryAlertStatus): string {
  return `${kind}${status === 'expired' ? '已過期' : '即將到期'}`
}

/** 會員類型＋會籍／置板到期小標（待處理扣款、會員、儲值共用） */
export function MemberStatusBadges({
  membershipType,
  membershipEndDate,
  boardExpiryDates,
  showType = true,
}: MemberStatusBadgesProps) {
  const membershipExpiry = getMembershipExpiryAlertStatus(membershipType, membershipEndDate)
  const boardExpiry = getBoardExpiryAlertStatus(boardExpiryDates)

  return (
    <>
      {showType && membershipType != null && membershipType !== '' && (
        <span style={getBadgeStyle(getMembershipTypeBadgeVariant(membershipType), 'small')}>
          {getMembershipTypeLabel(membershipType)}
        </span>
      )}
      {membershipExpiry && (
        <span style={getBadgeStyle(membershipExpiry === 'expired' ? 'danger' : 'warning', 'small')}>
          {expiryBadgeLabel('會籍', membershipExpiry)}
        </span>
      )}
      {boardExpiry && (
        <span style={getBadgeStyle(boardExpiry === 'expired' ? 'danger' : 'warning', 'small')}>
          {expiryBadgeLabel('置板', boardExpiry)}
        </span>
      )}
    </>
  )
}
