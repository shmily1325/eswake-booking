/**
 * 方案權益管理
 *
 * Design thinking (docs/design.md):
 * - Primary task: 處理尚未套用的置板或本次賽事兌換
 * - Secondary context: 方案購買與既有處理紀錄
 * - Rare/destructive actions: 刪除收在購買紀錄內，維持低調
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useResponsive } from '../hooks/useResponsive'
import {
  applyVoucherPackageBoardYears,
  createVoucherPackageRequestKey,
  deleteVoucherPackageCompetitionRedemption,
  deleteVoucherPackagePurchase,
  getMemberVoucherPackageDetail,
  redeemVoucherPackageCompetition,
  VOUCHER_PACKAGE_CATEGORY_LABEL,
  type VoucherPackageCategory,
  type VoucherPackageDetail,
  type VoucherPackagePurchase,
} from '../lib/voucherPackages'
import {
  designSystem,
  getButtonStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
} from '../styles/designSystem'
import { ToastContainer, useToast } from './ui'

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

export function VoucherPackageManagementDialog({
  open,
  member,
  voucherYear,
  category,
  onClose,
  onChanged,
}: VoucherPackageManagementDialogProps) {
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [detail, setDetail] = useState<VoucherPackageDetail>(emptyDetail)
  const [loading, setLoading] = useState(false)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [competitionNote, setCompetitionNote] = useState('')

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
    setCompetitionNote('')
    void loadDetail()
  }, [open, loadDetail])

  const summary = useMemo(() => {
    return detail.purchases.reduce(
      (result, purchase) => {
        if (purchase.package_hours === 10) result.books10 += purchase.book_count
        else result.books20 += purchase.book_count
        result.boardGranted += purchase.board_years_granted
        result.boardApplied += purchase.board_years_applied
        result.competitionGranted += purchase.competition_uses_granted
        result.competitionUsed += purchase.competition_uses_used
        result.booksAvailableThisCompetition += Math.min(
          purchase.book_count,
          purchase.competition_uses_granted - purchase.competition_uses_used,
        )
        return result
      },
      {
        books10: 0,
        books20: 0,
        boardGranted: 0,
        boardApplied: 0,
        competitionGranted: 0,
        competitionUsed: 0,
        booksAvailableThisCompetition: 0,
      },
    )
  }, [detail.purchases])

  const boardPending = summary.boardGranted - summary.boardApplied
  const competitionMinutes = summary.booksAvailableThisCompetition * 60

  const refreshAfterAction = async () => {
    await loadDetail()
    onChanged()
  }

  const handleApplyBoardYear = async (boardId: number) => {
    const key = `board-${boardId}`
    setSavingKey(key)
    try {
      await applyVoucherPackageBoardYears({
        requestKey: createVoucherPackageRequestKey(),
        memberId: member.id,
        voucherYear,
        category,
        boardStorageId: boardId,
        years: 1,
      })
      toast.success('已增加置板 1 年')
      await refreshAfterAction()
    } catch (error) {
      console.error('置板套用失敗:', error)
      toast.error(error instanceof Error ? error.message : '置板套用失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const handleRedeemCompetition = async () => {
    if (!competitionNote.trim()) {
      toast.warning('請輸入賽事備註')
      return
    }
    setSavingKey('competition')
    try {
      await redeemVoucherPackageCompetition({
        requestKey: createVoucherPackageRequestKey(),
        memberId: member.id,
        voucherYear,
        category,
        note: competitionNote.trim(),
      })
      toast.success(`已增加 ${competitionMinutes.toLocaleString()} 分`)
      setCompetitionNote('')
      await refreshAfterAction()
    } catch (error) {
      console.error('賽事兌換失敗:', error)
      toast.error(error instanceof Error ? error.message : '賽事兌換失敗')
    } finally {
      setSavingKey(null)
    }
  }

  const handleDeletePurchase = async (purchase: VoucherPackagePurchase) => {
    const used: string[] = []
    if (purchase.board_years_applied > 0) {
      used.push(`已套用置板 ${purchase.board_years_applied} 年不會自動改回`)
    }
    if (purchase.competition_uses_used > 0) {
      used.push(`已兌換賽事 ${purchase.competition_uses_used} 次不會自動扣回`)
    }
    const warning = used.length ? `\n\n${used.join('\n')}` : ''
    if (
      !window.confirm(
        `確定刪除「${purchaseLabel(purchase)}」嗎？\n船券分鐘會扣回，已扣儲值會加回。${warning}`,
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
        `確定刪除這筆賽事兌換嗎？\n系統會扣回 ${minutes.toLocaleString()} 分。`,
      )
    ) {
      return
    }
    setSavingKey(`redemption-${redemptionId}`)
    try {
      await deleteVoucherPackageCompetitionRedemption({
        redemptionId,
        memberId: member.id,
      })
      toast.success('賽事兌換已刪除')
      await refreshAfterAction()
    } catch (error) {
      console.error('刪除賽事兌換失敗:', error)
      toast.error(error instanceof Error ? error.message : '刪除賽事兌換失敗')
    } finally {
      setSavingKey(null)
    }
  }

  if (!open) return null

  const sectionStyle: React.CSSProperties = {
    padding: isMobile ? '16px' : '18px 20px',
    borderTop: `1px solid ${designSystem.colors.border.light}`,
  }

  const quietTextStyle: React.CSSProperties = {
    fontSize: getFontSize('bodySmall', isMobile),
    color: designSystem.colors.text.secondary,
    lineHeight: 1.55,
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
          border: `1px solid ${designSystem.colors.border.light}`,
          boxShadow: designSystem.shadows.lg,
        }}
      >
        <div
          style={{
            padding: isMobile ? '16px' : '20px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: designSystem.spacing.md,
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
              border: 'none',
              background: 'transparent',
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('h2', isMobile),
              cursor: 'pointer',
              padding: '0 8px',
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
              <div style={sectionStyle}>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: getFontSize('h3', isMobile),
                    color: designSystem.colors.text.primary,
                  }}
                >
                  方案權益
                </h3>
                <div style={quietTextStyle}>
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
                  <div style={{ ...quietTextStyle, marginTop: 4 }}>
                    置板 {summary.boardApplied}/{summary.boardGranted} 年
                    {' · '}
                    賽事 {summary.competitionUsed}/{summary.competitionGranted} 次
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
                    <h3
                      style={{
                        margin: 0,
                        fontSize: getFontSize('h3', isMobile),
                        color: designSystem.colors.text.primary,
                      }}
                    >
                      置板
                    </h3>
                    <span style={quietTextStyle}>待處理 {boardPending} 年</span>
                  </div>
                  {boardPending <= 0 ? (
                    <div style={quietTextStyle}>已全部處理</div>
                  ) : detail.boards.length === 0 ? (
                    <div style={quietTextStyle}>目前沒有有效置板，可稍後再處理。</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {detail.boards.map((board) => (
                        <div
                          key={board.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: designSystem.spacing.md,
                            padding: '10px 0',
                            borderTop: `1px solid ${designSystem.colors.border.light}`,
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
                            onClick={() => void handleApplyBoardYear(board.id)}
                            style={{
                              ...getButtonStyle('outline', 'small', isMobile),
                              opacity:
                                savingKey !== null || !board.expires_at ? 0.5 : 1,
                            }}
                          >
                            {savingKey === `board-${board.id}`
                              ? '處理中…'
                              : '增加 1 年'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {summary.competitionGranted > 0 ? (
                <section style={sectionStyle}>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: getFontSize('h3', isMobile),
                      color: designSystem.colors.text.primary,
                    }}
                  >
                    賽事兌換
                  </h3>
                  {summary.booksAvailableThisCompetition > 0 ? (
                    <>
                      <div style={{ ...quietTextStyle, marginBottom: 10 }}>
                        本次可增加 {competitionMinutes.toLocaleString()} 分
                      </div>
                      <input
                        type="text"
                        value={competitionNote}
                        onChange={(event) => setCompetitionNote(event.target.value)}
                        placeholder="賽事備註"
                        style={getInputStyle(isMobile)}
                      />
                      <button
                        type="button"
                        disabled={savingKey !== null}
                        onClick={() => void handleRedeemCompetition()}
                        style={{
                          ...getButtonStyle('primary', 'medium', isMobile),
                          width: '100%',
                          marginTop: designSystem.spacing.sm,
                          opacity: savingKey !== null ? 0.55 : 1,
                        }}
                      >
                        {savingKey === 'competition' ? '兌換中…' : '確認兌換'}
                      </button>
                    </>
                  ) : (
                    <div style={quietTextStyle}>目前沒有可兌換的次數</div>
                  )}
                </section>
              ) : null}

              {detail.purchases.length > 0 ? <section style={sectionStyle}>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: getFontSize('h3', isMobile),
                    color: designSystem.colors.text.primary,
                  }}
                >
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
                      borderTop: `1px solid ${designSystem.colors.border.light}`,
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
                      disabled={savingKey !== null}
                      onClick={() => void handleDeletePurchase(purchase)}
                      style={{
                        ...getButtonStyle('ghost', 'small', isMobile),
                        color: designSystem.colors.danger[700],
                        opacity: savingKey !== null ? 0.5 : 1,
                      }}
                    >
                      {savingKey === `purchase-${purchase.id}` ? '刪除中…' : '刪除'}
                    </button>
                  </div>
                ))}
              </section> : null}

              {detail.redemptions.length > 0 ? (
                <section style={sectionStyle}>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: getFontSize('h3', isMobile),
                      color: designSystem.colors.text.primary,
                    }}
                  >
                    賽事紀錄
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
                        borderTop: `1px solid ${designSystem.colors.border.light}`,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: getFontSize('body', isMobile),
                            color: designSystem.colors.text.primary,
                          }}
                        >
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
                  <h3
                    style={{
                      margin: '0 0 8px',
                      fontSize: getFontSize('h3', isMobile),
                      color: designSystem.colors.text.primary,
                    }}
                  >
                    置板紀錄
                  </h3>
                  {detail.board_applications.map((application) => (
                    <div
                      key={application.id}
                      style={{
                        padding: '10px 0',
                        borderTop: `1px solid ${designSystem.colors.border.light}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: getFontSize('body', isMobile),
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        格位 #{application.slot_number} +{application.years_applied}年
                      </div>
                      <div style={quietTextStyle}>
                        {application.old_expires_at} → {application.new_expires_at}
                      </div>
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
            borderTop: `1px solid ${designSystem.colors.border.light}`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{ ...getButtonStyle('outline', 'medium', isMobile), width: '100%' }}
          >
            完成
          </button>
        </div>
      </div>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}
