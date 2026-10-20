/**
 * 方案權益管理
 *
 * Design thinking (docs/design.md):
 * - Primary task: 處理尚未套用的置板或本次賽事兌換
 * - Secondary context: 方案購買與既有處理紀錄
 * - Rare/destructive actions: 刪除收在購買紀錄內，維持低調
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import {
  applyVoucherPackageBoardBenefit,
  createVoucherPackageRequestKey,
  deleteVoucherPackageBenefitRedemption,
  deleteVoucherPackagePurchase,
  getMemberVoucherPackageDetail,
  redeemVoucherPackageBenefit,
  undoVoucherPackageBoardApplication,
  VOUCHER_PACKAGE_CATEGORY_LABEL,
  type VoucherPackageCategory,
  type VoucherPackageDetail,
  type VoucherPackagePurchase,
} from '../lib/voucherPackages'
import { addYearsToDate } from '../utils/date'
import {
  designSystem,
  getBookingChoiceStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
} from '../styles/designSystem'
import { ToastContainer, useToast } from './ui'

interface BoardRecipient {
  id: string
  name: string
  nickname: string | null
}

interface VoucherPackageManagementDialogProps {
  open: boolean
  member: {
    id: string
    name: string
    nickname: string | null
  }
  voucherYear: number
  category: VoucherPackageCategory
  onClose: () => void
  onChanged: () => void
}

const emptyDetail: VoucherPackageDetail = {
  purchases: [],
  redemptions: [],
  board_applications: [],
  boards: [],
}

function formatMoney(value: number): string {
  return `$${Number(value).toLocaleString()}`
}

function purchaseLabel(purchase: VoucherPackagePurchase): string {
  return `${purchase.package_hours}小時 × ${purchase.book_count}本`
}

function purchaseHasUsedBenefits(purchase: VoucherPackagePurchase): boolean {
  return (
    purchase.board_years_applied > 0 ||
    purchase.benefit_minutes_used > 0 ||
    purchase.competition_uses_used > 0
  )
}

export function VoucherPackageManagementDialog({
  open,
  member,
  voucherYear,
  category,
  onClose,
  onChanged,
}: VoucherPackageManagementDialogProps) {
  const { isMobile } = useResponsive()
  const navigate = useNavigate()
  const toast = useToast()
  const [detail, setDetail] = useState<VoucherPackageDetail>(emptyDetail)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [benefitType, setBenefitType] = useState<'activity' | 'competition'>('activity')
  const [benefitMinutes, setBenefitMinutes] = useState('60')
  const [benefitNote, setBenefitNote] = useState('')
  const [boardRecipientMode, setBoardRecipientMode] =
    useState<'self' | 'other'>('self')
  const [boardRecipient, setBoardRecipient] = useState<BoardRecipient | null>({
    id: member.id,
    name: member.name,
    nickname: member.nickname,
  })
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientResults, setRecipientResults] = useState<BoardRecipient[]>([])
  const [recipientBoards, setRecipientBoards] = useState<
    VoucherPackageDetail['boards']
  >([])
  const [recipientBoardsLoading, setRecipientBoardsLoading] = useState(false)
  const [pendingBoardApply, setPendingBoardApply] = useState<{
    boardId: number
    slotNumber: number
    oldExpiresAt: string
    beneficiaryMemberId: string
    beneficiaryName: string
  } | null>(null)
  const [boardTargetExpiresAt, setBoardTargetExpiresAt] = useState('')

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(
        await getMemberVoucherPackageDetail({
          memberId: member.id,
          voucherYear,
          category,
        }),
      )
    } catch (error) {
      console.error('載入方案資料失敗:', error)
      toast.error(error instanceof Error ? error.message : '載入方案資料失敗')
      setDetail(emptyDetail)
    } finally {
      setLoading(false)
    }
  }, [category, member.id, toast, voucherYear])

  useEffect(() => {
    if (!open) return
    setBenefitType('activity')
    setBenefitMinutes('60')
    setBenefitNote('')
    setBoardRecipientMode('self')
    setBoardRecipient({
      id: member.id,
      name: member.name,
      nickname: member.nickname,
    })
    setRecipientSearch('')
    setRecipientResults([])
    setRecipientBoards([])
    setPendingBoardApply(null)
    void loadDetail()
  }, [open, loadDetail, member.id, member.name, member.nickname])

  useEffect(() => {
    if (!open || !boardRecipient || boardRecipient.id === member.id) {
      setRecipientBoards([])
      setRecipientBoardsLoading(false)
      return
    }

    let cancelled = false
    setRecipientBoardsLoading(true)
    void getMemberVoucherPackageDetail({
      memberId: boardRecipient.id,
      voucherYear,
      category,
    })
      .then((recipientDetail) => {
        if (!cancelled) setRecipientBoards(recipientDetail.boards)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('載入受贈會員置板失敗:', error)
        toast.error(error instanceof Error ? error.message : '載入受贈會員置板失敗')
        setRecipientBoards([])
      })
      .finally(() => {
        if (!cancelled) setRecipientBoardsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [boardRecipient, category, member.id, open, toast, voucherYear])

  const summary = useMemo(() => {
    return detail.purchases.reduce(
      (result, purchase) => {
        if (purchase.package_hours === 10) result.books10 += purchase.book_count
        else result.books20 += purchase.book_count
        result.boardGranted += Number(purchase.board_years_granted || 0)
        result.boardApplied += Number(purchase.board_years_applied || 0)
        result.benefitMinutesGranted += Number(
          purchase.benefit_minutes_granted || 0,
        )
        result.benefitMinutesUsed += Number(purchase.benefit_minutes_used || 0)
        result.competitionGranted += Number(
          purchase.competition_uses_granted || 0,
        )
        result.competitionUsed += Number(purchase.competition_uses_used || 0)
        return result
      },
      {
        books10: 0,
        books20: 0,
        boardGranted: 0,
        boardApplied: 0,
        benefitMinutesGranted: 0,
        benefitMinutesUsed: 0,
        competitionGranted: 0,
        competitionUsed: 0,
      },
    )
  }, [detail.purchases])

  const boardPending = summary.boardGranted - summary.boardApplied
  const benefitMinutesRemaining =
    summary.benefitMinutesGranted - summary.benefitMinutesUsed
  const competitionUsesRemaining =
    summary.competitionGranted - summary.competitionUsed

  const refreshAfterAction = async () => {
    await loadDetail()
    onChanged()
  }

  const openBoardApplyConfirmation = (
    boardId: number,
    slotNumber: number,
    oldExpiresAt: string,
  ) => {
    if (!boardRecipient) return
    setPendingBoardApply({
      boardId,
      slotNumber,
      oldExpiresAt,
      beneficiaryMemberId: boardRecipient.id,
      beneficiaryName: boardRecipient.nickname || boardRecipient.name,
    })
    setBoardTargetExpiresAt(addYearsToDate(oldExpiresAt, 1))
  }

  const handleApplyBoardYear = async () => {
    if (!pendingBoardApply || !boardTargetExpiresAt) return
    if (boardTargetExpiresAt < pendingBoardApply.oldExpiresAt) {
      toast.warning('套用後到期日不可早於目前到期日')
      return
    }
    const key = `board-${pendingBoardApply.boardId}`
    setSavingKey(key)
    try {
      await applyVoucherPackageBoardBenefit({
        requestKey: createVoucherPackageRequestKey(),
        memberId: member.id,
        voucherYear,
        category,
        beneficiaryMemberId: pendingBoardApply.beneficiaryMemberId,
        boardStorageId: pendingBoardApply.boardId,
        expectedExpiresAt: pendingBoardApply.oldExpiresAt,
        targetExpiresAt: boardTargetExpiresAt,
      })
      toast.success('已使用置板 1 年權益')
      setPendingBoardApply(null)
      await refreshAfterAction()
    } catch (error) {
      console.error('置板套用失敗:', error)
      toast.error(error instanceof Error ? error.message : '置板套用失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const searchBoardRecipients = async (query: string) => {
    setRecipientSearch(query)
    if (!query.trim()) {
      setRecipientResults([])
      return
    }
    const { data, error } = await supabase
      .from('members')
      .select('id, name, nickname')
      .or(`name.ilike.%${query}%,nickname.ilike.%${query}%`)
      .eq('status', 'active')
      .limit(8)
    if (error) {
      console.error('搜尋置板會員失敗:', error)
      return
    }
    setRecipientResults(
      ((data || []) as BoardRecipient[]).filter((candidate) => candidate.id !== member.id),
    )
  }

  const openBoardManagementForRecipient = () => {
    if (!boardRecipient) return
    const params = new URLSearchParams({
      packageOwnerId: member.id,
      packageCategory: category,
      boardRecipientId: boardRecipient.id,
      voucherYear: String(voucherYear),
    })
    onClose()
    navigate(`/boards?${params.toString()}`)
  }

  const handleRedeemBenefit = async () => {
    const minutes = Number(benefitMinutes)
    if (!benefitNote.trim()) {
      toast.warning('請輸入活動／賽事備註')
      return
    }
    if (!Number.isInteger(minutes) || minutes <= 0) {
      toast.warning('請輸入正確的贈送分鐘')
      return
    }
    if (minutes > benefitMinutesRemaining) {
      toast.warning(`最多可贈送 ${benefitMinutesRemaining.toLocaleString()} 分`)
      return
    }
    if (benefitType === 'competition' && competitionUsesRemaining <= 0) {
      toast.warning('目前沒有可使用的賽事資格')
      return
    }
    setSavingKey('benefit')
    try {
      const result = await redeemVoucherPackageBenefit({
        requestKey: createVoucherPackageRequestKey(),
        memberId: member.id,
        voucherYear,
        category,
        redemptionType: benefitType,
        minutes,
        note: benefitNote.trim(),
      })
      toast.success(`已增加 ${Number(result.minutes_added || minutes).toLocaleString()} 分`)
      setBenefitMinutes('60')
      setBenefitNote('')
      await refreshAfterAction()
    } catch (error) {
      console.error('活動／賽事贈送失敗:', error)
      toast.error(error instanceof Error ? error.message : '活動／賽事贈送失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const handleDeletePurchase = async (purchase: VoucherPackagePurchase) => {
    if (
      !window.confirm(
        `確定刪除「${purchaseLabel(purchase)}」嗎？\n船券分鐘會扣回，已扣儲值會加回。`,
      )
    ) {
      return
    }

    setSavingKey(`purchase-${purchase.id}`)
    try {
      await deleteVoucherPackagePurchase({
        purchaseId: purchase.id,
        memberId: member.id,
      })
      toast.success('方案已刪除')
      await refreshAfterAction()
    } catch (error) {
      console.error('刪除方案失敗:', error)
      toast.error(error instanceof Error ? error.message : '刪除方案失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const handleDeleteRedemption = async (redemptionId: string, minutes: number) => {
    if (
      !window.confirm(
        `確定刪除這筆活動／賽事贈送嗎？\n系統會扣回 ${minutes.toLocaleString()} 分。`,
      )
    ) {
      return
    }
    setSavingKey(`redemption-${redemptionId}`)
    try {
      await deleteVoucherPackageBenefitRedemption({
        redemptionId,
        memberId: member.id,
      })
      toast.success('活動／賽事贈送已刪除')
      await refreshAfterAction()
    } catch (error) {
      console.error('刪除活動／賽事贈送失敗:', error)
      toast.error(error instanceof Error ? error.message : '刪除活動／賽事贈送失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const handleUndoBoardApplication = async (
    applicationId: string,
    applicationKind: 'extend' | 'create',
  ) => {
    const message =
      applicationKind === 'create'
        ? '確定撤銷嗎？若置板沒有後續修改，該格位會一併移除並退回 1 年權益。'
        : '確定撤銷嗎？到期日會恢復，並退回 1 年置板權益。'
    if (!window.confirm(message)) return

    setSavingKey(`board-undo-${applicationId}`)
    try {
      await undoVoucherPackageBoardApplication({
        applicationId,
        memberId: member.id,
      })
      toast.success('置板權益已撤銷')
      await refreshAfterAction()
    } catch (error) {
      console.error('撤銷置板權益失敗:', error)
      toast.error(error instanceof Error ? error.message : '撤銷置板權益失敗')
    } finally {
      setSavingKey(null)
    }
  }

  if (!open) return null

  const availableRecipientBoards =
    boardRecipient?.id === member.id ? detail.boards : recipientBoards

  const sectionStyle: React.CSSProperties = {
    padding: isMobile ? '20px 16px' : '22px 24px',
    borderTop: `1px solid ${designSystem.colors.border.main}`,
  }

  const quietTextStyle: React.CSSProperties = {
    fontSize: getFontSize('bodySmall', isMobile),
    color: designSystem.colors.text.secondary,
    lineHeight: 1.55,
  }

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: getFontSize('h3', isMobile),
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: designSystem.colors.text.primary,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: designSystem.zIndex.modal,
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
        padding: isMobile ? 0 : '20px',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? '100%' : '620px',
          maxHeight: isMobile ? '92dvh' : '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: designSystem.colors.background.card,
          borderRadius: isMobile
            ? `${designSystem.borderRadius.lg} ${designSystem.borderRadius.lg} 0 0`
            : designSystem.borderRadius.lg,
          border: `1px solid ${designSystem.colors.border.main}`,
          boxShadow: designSystem.shadows.lg,
        }}
      >
        <div
          style={{
            padding: isMobile ? '18px 16px' : '22px 24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: designSystem.spacing.md,
            borderBottom: `1px solid ${designSystem.colors.border.main}`,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: getFontSize('h2', isMobile),
                fontWeight: 700,
                color: designSystem.colors.text.primary,
              }}
            >
              {member.nickname || member.name}
            </h2>
            <div style={{ ...quietTextStyle, marginTop: designSystem.spacing.xs }}>
              {voucherYear} {VOUCHER_PACKAGE_CATEGORY_LABEL[category]} 方案
            </div>
          </div>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.full,
              background: designSystem.colors.background.main,
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('h2', isMobile),
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={getEmptyStateStyle(isMobile)}>載入中…</div>
          ) : detail.purchases.length === 0 &&
            detail.redemptions.length === 0 &&
            detail.board_applications.length === 0 ? (
            <div style={getEmptyStateStyle(isMobile)}>目前沒有方案紀錄</div>
          ) : (
            <>
              <div
                style={{
                  ...sectionStyle,
                  borderTop: 'none',
                  background: designSystem.colors.background.main,
                }}
              >
                <h3 style={{ ...sectionTitleStyle, marginBottom: 10 }}>
                  方案權益
                </h3>
                <div
                  style={{
                    fontSize: getFontSize('bodyLarge', isMobile),
                    fontWeight: 650,
                    color: designSystem.colors.text.primary,
                  }}
                >
                  {detail.purchases.length === 0
                    ? '已無有效方案，以下保留已使用紀錄。'
                    : (
                      <>
                        {summary.books10 > 0 ? `10小時 × ${summary.books10}本` : null}
                        {summary.books10 > 0 && summary.books20 > 0 ? ' · ' : null}
                        {summary.books20 > 0 ? `20小時 × ${summary.books20}本` : null}
                      </>
                    )}
                </div>
                {summary.books20 > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: designSystem.spacing.lg,
                      marginTop: designSystem.spacing.lg,
                      paddingTop: designSystem.spacing.md,
                      borderTop: `1px solid ${designSystem.colors.border.main}`,
                    }}
                  >
                    <div>
                      <div style={quietTextStyle}>置板</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: getFontSize('bodyLarge', isMobile),
                          fontWeight: 700,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {summary.boardApplied}/{summary.boardGranted} 年
                      </div>
                    </div>
                    <div>
                      <div style={quietTextStyle}>贈送分鐘</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: getFontSize('bodyLarge', isMobile),
                          fontWeight: 700,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {summary.benefitMinutesUsed}/{summary.benefitMinutesGranted} 分
                      </div>
                    </div>
                    <div>
                      <div style={quietTextStyle}>賽事</div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: getFontSize('bodyLarge', isMobile),
                          fontWeight: 700,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {summary.competitionUsed}/{summary.competitionGranted} 次
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {summary.boardGranted > 0 ? (
                <section style={sectionStyle}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: designSystem.spacing.md,
                      marginBottom: designSystem.spacing.md,
                    }}
                  >
                    <h3 style={sectionTitleStyle}>
                      置板
                    </h3>
                    <span
                      style={{
                        ...quietTextStyle,
                        color:
                          boardPending > 0
                            ? designSystem.colors.warning[700]
                            : designSystem.colors.success[700],
                        fontWeight: 650,
                      }}
                    >
                      待處理 {boardPending} 年
                    </span>
                  </div>
                  {boardPending <= 0 ? (
                    <div style={quietTextStyle}>已全部處理</div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: designSystem.spacing.sm,
                          marginBottom: designSystem.spacing.md,
                        }}
                      >
                        <button
                          type="button"
                          aria-pressed={boardRecipientMode === 'self'}
                          onClick={() => {
                            setBoardRecipientMode('self')
                            setBoardRecipient({
                              id: member.id,
                              name: member.name,
                              nickname: member.nickname,
                            })
                            setRecipientSearch('')
                            setRecipientResults([])
                          }}
                          style={{
                            ...getBookingChoiceStyle(boardRecipientMode === 'self'),
                            minHeight: 42,
                            cursor: 'pointer',
                          }}
                        >
                          本人
                        </button>
                        <button
                          type="button"
                          aria-pressed={boardRecipientMode === 'other'}
                          onClick={() => {
                            setBoardRecipientMode('other')
                            setBoardRecipient(null)
                            setRecipientSearch('')
                            setRecipientResults([])
                          }}
                          style={{
                            ...getBookingChoiceStyle(boardRecipientMode === 'other'),
                            minHeight: 42,
                            cursor: 'pointer',
                          }}
                        >
                          其他會員
                        </button>
                      </div>

                      {boardRecipientMode === 'other' ? (
                        <div style={{ marginBottom: designSystem.spacing.md }}>
                          {boardRecipient ? (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: designSystem.spacing.md,
                                padding: '10px 12px',
                                border: `1px solid ${designSystem.colors.border.light}`,
                                borderRadius: designSystem.borderRadius.lg,
                                background: designSystem.colors.background.main,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: getFontSize('body', isMobile),
                                    fontWeight: 650,
                                    color: designSystem.colors.text.primary,
                                  }}
                                >
                                  {boardRecipient.nickname || boardRecipient.name}
                                </div>
                                {boardRecipient.nickname ? (
                                  <div style={quietTextStyle}>{boardRecipient.name}</div>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setBoardRecipient(null)
                                  setRecipientSearch('')
                                  setRecipientResults([])
                                }}
                                style={getButtonStyle('ghost', 'small', isMobile)}
                              >
                                重選
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="search"
                                value={recipientSearch}
                                onChange={(event) =>
                                  void searchBoardRecipients(event.target.value)
                                }
                                placeholder="搜尋會員"
                                style={{
                                  ...getInputStyle(isMobile),
                                  boxSizing: 'border-box',
                                }}
                              />
                              {recipientResults.length > 0 ? (
                                <div
                                  style={{
                                    marginTop: designSystem.spacing.xs,
                                    border: `1px solid ${designSystem.colors.border.light}`,
                                    borderRadius: designSystem.borderRadius.lg,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {recipientResults.map((candidate) => (
                                    <button
                                      key={candidate.id}
                                      type="button"
                                      onClick={() => {
                                        setBoardRecipient(candidate)
                                        setRecipientSearch('')
                                        setRecipientResults([])
                                      }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: 'none',
                                        borderTop: `1px solid ${designSystem.colors.border.light}`,
                                        background: designSystem.colors.background.card,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: getFontSize('body', isMobile),
                                          fontWeight: 600,
                                          color: designSystem.colors.text.primary,
                                        }}
                                      >
                                        {candidate.nickname || candidate.name}
                                      </span>
                                      {candidate.nickname ? (
                                        <span
                                          style={{
                                            ...quietTextStyle,
                                            marginLeft: designSystem.spacing.sm,
                                          }}
                                        >
                                          {candidate.name}
                                        </span>
                                      ) : null}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}

                      {!boardRecipient ? null : recipientBoardsLoading ? (
                        <div style={quietTextStyle}>載入置板中…</div>
                      ) : availableRecipientBoards.length === 0 ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: designSystem.spacing.md,
                          }}
                        >
                          <span style={quietTextStyle}>
                            目前沒有置板
                          </span>
                          <button
                            type="button"
                            onClick={openBoardManagementForRecipient}
                            style={getButtonStyle('secondary', 'small', isMobile)}
                          >
                            選擇格位
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {availableRecipientBoards.map((board) => (
                        <div
                          key={board.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: designSystem.spacing.md,
                            padding: '10px 0',
                            borderTop: `1px solid ${designSystem.colors.border.main}`,
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: getFontSize('body', isMobile),
                                fontWeight: 600,
                                color: designSystem.colors.text.primary,
                              }}
                            >
                              格位 #{board.slot_number}
                            </div>
                            <div style={quietTextStyle}>
                              到期 {board.expires_at || '未設定'}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={
                              savingKey !== null ||
                              !board.expires_at ||
                              boardPending <= 0
                            }
                            onClick={() => {
                              if (!board.expires_at) return
                              openBoardApplyConfirmation(
                                board.id,
                                board.slot_number,
                                board.expires_at,
                              )
                            }}
                            style={{
                              ...getButtonStyle('secondary', 'small', isMobile),
                              opacity:
                                savingKey !== null || !board.expires_at ? 0.5 : 1,
                            }}
                          >
                            {savingKey === `board-${board.id}`
                              ? '處理中…'
                              : '使用 1 年'}
                          </button>
                        </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              ) : null}

              {summary.benefitMinutesGranted > 0 ? (
                <section style={sectionStyle}>
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                    活動／賽事贈送
                  </h3>
                  {benefitMinutesRemaining > 0 ? (
                    <>
                      <div
                        style={{
                          ...quietTextStyle,
                          marginBottom: designSystem.spacing.md,
                        }}
                      >
                        尚可贈送 {benefitMinutesRemaining.toLocaleString()} 分
                        {' · '}
                        賽事剩餘 {competitionUsesRemaining} 次
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile
                            ? 'minmax(92px, 0.4fr) minmax(0, 1fr)'
                            : '120px minmax(0, 1fr)',
                          gap: designSystem.spacing.sm,
                          marginBottom: designSystem.spacing.xs,
                        }}
                      >
                        <span style={quietTextStyle}>贈送分鐘</span>
                        <span style={quietTextStyle}>備註</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                          gap: designSystem.spacing.sm,
                          marginBottom: designSystem.spacing.md,
                        }}
                      >
                        {(['activity', 'competition'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            aria-pressed={benefitType === type}
                            onClick={() => setBenefitType(type)}
                            style={{
                              ...getBookingChoiceStyle(benefitType === type),
                              minHeight: 42,
                              cursor: 'pointer',
                            }}
                          >
                            {type === 'activity' ? '活動' : '賽事'}
                          </button>
                        ))}
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile
                            ? 'minmax(92px, 0.4fr) minmax(0, 1fr)'
                            : '120px minmax(0, 1fr)',
                          gap: designSystem.spacing.sm,
                          marginBottom: designSystem.spacing.sm,
                        }}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label="贈送分鐘"
                          value={benefitMinutes}
                          onChange={(event) =>
                            setBenefitMinutes(
                              event.target.value.replace(/\D/g, '').slice(0, 6),
                            )
                          }
                          placeholder="60"
                          style={getInputStyle(isMobile)}
                        />
                        <input
                          type="text"
                          value={benefitNote}
                          onChange={(event) => setBenefitNote(event.target.value)}
                          placeholder={`${benefitType === 'activity' ? '活動' : '賽事'}備註`}
                          style={getInputStyle(isMobile)}
                        />
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: designSystem.spacing.md,
                        }}
                      >
                        <span style={quietTextStyle}>
                          預設 60 分，可依本次內容調整
                        </span>
                        <button
                          type="button"
                          disabled={
                            savingKey !== null ||
                            (benefitType === 'competition' &&
                              competitionUsesRemaining <= 0)
                          }
                          onClick={() => void handleRedeemBenefit()}
                          style={{
                            ...getButtonStyle('info', 'medium', isMobile),
                            minWidth: isMobile ? 108 : 124,
                            opacity:
                              savingKey !== null ||
                              (benefitType === 'competition' &&
                                competitionUsesRemaining <= 0)
                                ? 0.55
                                : 1,
                          }}
                        >
                          {savingKey === 'benefit' ? '處理中…' : '確認贈送'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={quietTextStyle}>贈送分鐘已全部使用</div>
                  )}
                </section>
              ) : null}

              {detail.purchases.length > 0 ? <section style={sectionStyle}>
                <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                  購買紀錄
                </h3>
                {detail.purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: designSystem.spacing.md,
                      padding: '12px 0',
                      borderTop: `1px solid ${designSystem.colors.border.main}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: getFontSize('body', isMobile),
                          fontWeight: 600,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {purchaseLabel(purchase)}
                      </div>
                      <div style={quietTextStyle}>
                        {purchase.transaction_date}
                        {' · '}
                        {formatMoney(purchase.total_price)}
                        {purchase.balance_deduction > 0
                          ? ` · 扣儲值 ${formatMoney(purchase.balance_deduction)}`
                          : ''}
                      </div>
                      {purchase.notes ? (
                        <div style={{ ...quietTextStyle, marginTop: 2 }}>
                          {purchase.notes}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={savingKey !== null || purchaseHasUsedBenefits(purchase)}
                      title={
                        purchaseHasUsedBenefits(purchase)
                          ? '請先撤銷置板與活動／賽事贈送'
                          : undefined
                      }
                      onClick={() => void handleDeletePurchase(purchase)}
                      style={{
                        ...getButtonStyle('ghost', 'small', isMobile),
                        color: designSystem.colors.danger[700],
                        opacity:
                          savingKey !== null || purchaseHasUsedBenefits(purchase)
                            ? 0.45
                            : 1,
                      }}
                    >
                      {savingKey === `purchase-${purchase.id}`
                        ? '刪除中…'
                        : purchaseHasUsedBenefits(purchase)
                          ? '先撤銷權益'
                          : '刪除'}
                    </button>
                  </div>
                ))}
              </section> : null}

              {detail.redemptions.length > 0 ? (
                <section style={sectionStyle}>
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                    活動／賽事紀錄
                  </h3>
                  {detail.redemptions.map((redemption) => (
                    <div
                      key={redemption.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: designSystem.spacing.md,
                        padding: '10px 0',
                        borderTop: `1px solid ${designSystem.colors.border.main}`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.primary,
                          }}
                        >
                          {redemption.redemption_type === 'activity' ? '活動' : '賽事'}
                          {' · '}
                          +{redemption.minutes_added.toLocaleString()}分
                          {' · '}
                          {redemption.note}
                        </div>
                        <div style={quietTextStyle}>
                          {redemption.redeemed_at.slice(0, 10)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingKey !== null}
                        onClick={() =>
                          void handleDeleteRedemption(
                            redemption.id,
                            redemption.minutes_added,
                          )
                        }
                        style={{
                          ...getButtonStyle('ghost', 'small', isMobile),
                          color: designSystem.colors.danger[700],
                          opacity: savingKey !== null ? 0.5 : 1,
                        }}
                      >
                        {savingKey === `redemption-${redemption.id}`
                          ? '刪除中…'
                          : '刪除'}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}

              {detail.board_applications.length > 0 ? (
                <section style={sectionStyle}>
                  <h3 style={{ ...sectionTitleStyle, marginBottom: 8 }}>
                    置板紀錄
                  </h3>
                  {detail.board_applications.map((application) => (
                    <div
                      key={application.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: designSystem.spacing.md,
                        padding: '10px 0',
                        borderTop: `1px solid ${designSystem.colors.border.main}`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.primary,
                          }}
                        >
                          格位 #{application.slot_number}
                          {' · '}
                          {application.application_kind === 'create'
                            ? '新增並使用 1 年'
                            : '使用 1 年權益'}
                          {application.beneficiary_member_id &&
                          application.beneficiary_member_id !== member.id
                            ? ` · 贈送給 ${application.beneficiary_name}`
                            : ''}
                        </div>
                        <div style={quietTextStyle}>
                          {application.old_expires_at} → {application.new_expires_at}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={savingKey !== null}
                        onClick={() =>
                          void handleUndoBoardApplication(
                            application.id,
                            application.application_kind,
                          )
                        }
                        style={{
                          ...getButtonStyle('ghost', 'small', isMobile),
                          color: designSystem.colors.danger[700],
                          opacity: savingKey !== null ? 0.5 : 1,
                        }}
                      >
                        {savingKey === `board-undo-${application.id}`
                          ? '撤銷中…'
                          : '撤銷'}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}
            </>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            paddingBottom: isMobile
              ? 'max(20px, calc(env(safe-area-inset-bottom, 0px) + 12px))'
              : '20px',
            borderTop: `1px solid ${designSystem.colors.border.main}`,
            background: designSystem.colors.background.card,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ ...getButtonStyle('secondary', 'medium', isMobile), width: '100%' }}
          >
            完成
          </button>
        </div>
      </div>
      {pendingBoardApply ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: designSystem.zIndex.modal + 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0,0,0,0.46)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              padding: isMobile ? '20px' : '24px',
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.main}`,
              background: designSystem.colors.background.card,
              boxShadow: designSystem.shadows.lg,
            }}
          >
            <h3 style={{ ...sectionTitleStyle, fontSize: getFontSize('h2', isMobile) }}>
              使用置板 1 年
            </h3>
            <div style={{ ...quietTextStyle, marginTop: designSystem.spacing.xs }}>
              格位 #{pendingBoardApply.slotNumber}
              {' · '}
              目前到期 {pendingBoardApply.oldExpiresAt}
            </div>
            {pendingBoardApply.beneficiaryMemberId !== member.id ? (
              <div style={{ ...quietTextStyle, marginTop: designSystem.spacing.xs }}>
                給 {pendingBoardApply.beneficiaryName}
              </div>
            ) : null}
            <label
              style={{
                display: 'block',
                marginTop: designSystem.spacing.lg,
                marginBottom: designSystem.spacing.xs,
                fontSize: getFontSize('bodySmall', isMobile),
                color: designSystem.colors.text.secondary,
              }}
            >
              新到期日
            </label>
            <input
              type="date"
              min={pendingBoardApply.oldExpiresAt}
              value={boardTargetExpiresAt}
              onChange={(event) => setBoardTargetExpiresAt(event.target.value)}
              style={{ ...getInputStyle(isMobile), boxSizing: 'border-box' }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: designSystem.spacing.sm,
                marginTop: designSystem.spacing.xl,
              }}
            >
              <button
                type="button"
                disabled={savingKey !== null}
                onClick={() => setPendingBoardApply(null)}
                style={getButtonStyle('secondary', 'medium', isMobile)}
              >
                取消
              </button>
              <button
                type="button"
                disabled={savingKey !== null || !boardTargetExpiresAt}
                onClick={() => void handleApplyBoardYear()}
                style={{
                  ...getButtonStyle('primary', 'medium', isMobile),
                  opacity: savingKey !== null || !boardTargetExpiresAt ? 0.55 : 1,
                }}
              >
                {savingKey ? '處理中…' : '確認'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
