/**
 * Design thinking:
 * Current feel: blue/gray gradients, Material settle CTA colors, and emoji chrome.
 * Hierarchy: order identity → payment choice → lines → one primary settle action.
 * Primary task: confirm payment method and settle pending bill lines.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../components/ui'
import { DecimalTextInput, MoneyInput } from '../../../components/ui/numericInputs'
import { useAuthUser } from '../../../contexts/AuthContext'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { designSystem, getButtonStyle, getBookingChoiceStyle, getFontSize } from '../../../styles/designSystem'
import { formatAttributes } from '../products/schema'
import { settleShopOrder, shopOrderErrorMessage } from './api'
import {
  applyDiscountToSubtotal,
  buildDefaultSettleDescription,
  listSubtotal,
  tryParseDiscountFactor,
} from './settleUtils'
import type { OrderPaymentMethod, ShopOrderWithItems } from './types'

const { colors, borderRadius, shadows, spacing } = designSystem

interface SettleLineState {
  item_id: string
  qty: number
  unit_price: number
  line_total: number
  label: string
  thumb_src: string | null
  description: string
  discountInput: string
}

interface Props {
  order: ShopOrderWithItems
  isMobile: boolean
  onComplete: () => void
}

const PAYMENT_OPTIONS: { value: OrderPaymentMethod; label: string }[] = [
  { value: 'balance', label: '扣儲值' },
  { value: 'transfer', label: '匯款' },
  { value: 'cash', label: '現金' },
]

function buildLineStates(order: ShopOrderWithItems): SettleLineState[] {
  return order.items
    .filter((it) => it.qty_pending_bill > 0)
    .map((it): SettleLineState => {
      const p = it.variant?.product
      const label = p
        ? `${p.brand} ${p.model} · ${formatAttributes(p.category, it.variant!.attributes)}`
        : '商品'
      const qty = it.qty_pending_bill
      const unit_price = it.unit_price
      return {
        item_id: it.id,
        qty,
        unit_price,
        line_total: listSubtotal(qty, unit_price),
        label,
        thumb_src: it.variant.image_url || it.variant.cover_image_url || null,
        description: buildDefaultSettleDescription(label, order.order_no),
        discountInput: '',
      }
    })
}

function memberLabel(m: { nickname: string | null; name: string }) {
  return m.nickname || m.name
}

export function PendingOrderSettleItem({ order, isMobile, onComplete }: Props) {
  const user = useAuthUser()
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('balance')
  const [chargeMemberId, setChargeMemberId] = useState<string | null>(order.member_id)
  const [chargeMemberName, setChargeMemberName] = useState(order.contact_name)
  const [memberBalance, setMemberBalance] = useState<number | null>(null)
  const [globalDiscountInput, setGlobalDiscountInput] = useState('')
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [hasCheckedBillingRelation, setHasCheckedBillingRelation] = useState(false)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const proxySearch = useMemberSearch()

  const pendingLines = useMemo(() => buildLineStates(order), [order])
  const [lines, setLines] = useState<SettleLineState[]>(pendingLines)

  const isProxyCharge =
    paymentMethod === 'balance' &&
    chargeMemberId != null &&
    (order.member_id == null || chargeMemberId !== order.member_id)

  useEffect(() => {
    setLines(pendingLines)
    setGlobalDiscountInput('')
  }, [pendingLines])

  useEffect(() => {
    if (!order.member_id || proxySearch.members.length === 0) return
    const member = proxySearch.members.find((m) => m.id === order.member_id)
    if (member) {
      proxySearch.selectMember(member)
      setChargeMemberId(member.id)
      setChargeMemberName(memberLabel(member))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.member_id, proxySearch.members])

  useEffect(() => {
    if (!chargeMemberId || paymentMethod !== 'balance') {
      setMemberBalance(null)
      return
    }
    void supabase
      .from('members')
      .select('balance')
      .eq('id', chargeMemberId)
      .single()
      .then(({ data }) => setMemberBalance(data?.balance ?? 0))
  }, [chargeMemberId, paymentMethod])

  useEffect(() => {
    if (!expanded || paymentMethod !== 'balance') {
      if (!expanded) setHasCheckedBillingRelation(false)
      return
    }
    if (hasCheckedBillingRelation) return

    const name = order.contact_name?.trim()
    if (!name) {
      setHasCheckedBillingRelation(true)
      return
    }

    let cancelled = false
    void (async () => {
      setHasCheckedBillingRelation(true)
      try {
        const { data, error } = await supabase
          .from('billing_relations')
          .select('billing_member_id, members:billing_member_id(id, name, nickname)')
          .eq('participant_name', name)
          .maybeSingle()

        if (cancelled || error || !data?.billing_member_id) return
        if (order.member_id && data.billing_member_id === order.member_id) return

        const member = data.members as { id: string; name: string; nickname: string | null } | null
        if (!member) return

        setChargeMemberId(data.billing_member_id)
        setChargeMemberName(memberLabel(member))
        proxySearch.selectMember({ id: member.id, name: member.name, nickname: member.nickname, phone: null })
      } catch {
        /* 無代扣設定時略過 */
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proxySearch 物件不穩定
  }, [expanded, paymentMethod, hasCheckedBillingRelation, order.contact_name, order.member_id])

  useEffect(() => {
    if (!previewSrc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewSrc(null)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [previewSrc])

  const total = lines.reduce((s, l) => s + l.line_total, 0)
  const listTotal = lines.reduce((s, l) => s + listSubtotal(l.qty, l.unit_price), 0)
  const projectedBalance =
    paymentMethod === 'balance' && memberBalance !== null ? memberBalance - total : null
  const projectedBalanceInsufficient = projectedBalance !== null && projectedBalance < 0
  const updateLine = (idx: number, patch: Partial<SettleLineState>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const applyDiscountToLine = (idx: number) => {
    const line = lines[idx]
    const factor = tryParseDiscountFactor(line.discountInput)
    if (factor === null) {
      toast.error('請填 9 或 85')
      return
    }
    updateLine(idx, {
      line_total: applyDiscountToSubtotal(listSubtotal(line.qty, line.unit_price), factor),
    })
  }

  const applyGlobalDiscount = () => {
    const factor = tryParseDiscountFactor(globalDiscountInput)
    if (factor === null) {
      toast.error('請填 9 或 85')
      return
    }
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        line_total: applyDiscountToSubtotal(listSubtotal(l.qty, l.unit_price), factor),
      })),
    )
  }

  const resetChargeToOrderMember = () => {
    if (order.member_id) {
      const member = proxySearch.members.find((m) => m.id === order.member_id)
      if (member) {
        proxySearch.selectMember(member)
        setChargeMemberId(member.id)
        setChargeMemberName(memberLabel(member))
        return
      }
    }
    setChargeMemberId(order.member_id)
    setChargeMemberName(order.contact_name)
    setHasCheckedBillingRelation(true)
    proxySearch.reset()
  }

  const selectChargeMember = (m: { id: string; name: string; nickname: string | null; phone: string | null }) => {
    proxySearch.selectMember(m)
    setChargeMemberId(m.id)
    setChargeMemberName(memberLabel(m))
    setShowMemberSearch(false)
    proxySearch.reset()
  }

  const settleLabel =
    paymentMethod === 'cash' ? '現金結清' : paymentMethod === 'transfer' ? '匯款結清' : '確認扣款'

  const handleSettle = async () => {
    if (paymentMethod === 'balance' && !chargeMemberId) {
      toast.error('請選扣款會員')
      return
    }
    for (const line of lines) {
      if (!line.description.trim()) {
        toast.error('請填入帳說明')
        return
      }
    }

    if (isProxyCharge && chargeMemberName) {
      if (!confirm(`由 ${chargeMemberName} 代扣 $${total.toLocaleString()}？`)) return
    } else if (!confirm(`${order.order_no} 結帳 $${total.toLocaleString()}？`)) {
      return
    }

    setLoading(true)
    try {
      await settleShopOrder(
        order.id,
        lines.map((l) => ({
          item_id: l.item_id,
          qty: l.qty,
          unit_price: l.unit_price,
          line_total: l.line_total,
          description: l.description.trim(),
        })),
        paymentMethod,
        paymentMethod === 'balance' ? chargeMemberId : null,
        user?.id,
        null,
        user?.email ?? null,
      )
      toast.success('已結帳')
      onComplete()
    } catch (e: unknown) {
      toast.error(shopOrderErrorMessage(e, '結帳失敗'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.md,
        boxShadow: shadows.elevation[1],
        border: expanded
          ? `1.5px solid ${colors.primary[500]}`
          : `1px solid ${colors.border.light}`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        data-track="product_order_settle_toggle"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded((v) => !v)
          }
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: getFontSize('body', isMobile),
              fontWeight: 600,
              marginBottom: 6,
              color: colors.text.primary,
            }}
          >
            {expanded ? '▼' : '▶'} {order.contact_name}
            <span
              style={{
                fontWeight: 400,
                color: colors.text.disabled,
                fontSize: getFontSize('caption', isMobile),
              }}
            >
              {' '}
              · {order.order_no}
            </span>
          </div>
          <div style={{ fontSize: getFontSize('bodySmall', isMobile), color: colors.text.secondary }}>
            {lines.length} 品項 · ${listTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
            borderTop: `1px solid ${colors.border.light}`,
          }}
        >
          <div style={{ marginBottom: spacing.lg, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {PAYMENT_OPTIONS.map((opt) => {
              const active = paymentMethod === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-track={`product_order_settle_payment_${opt.value}`}
                  onClick={() => setPaymentMethod(opt.value)}
                  style={{
                    ...getBookingChoiceStyle(active),
                    padding: '6px 12px',
                    fontSize: getFontSize('bodySmall', isMobile),
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {paymentMethod === 'balance' && (
            <div
              style={{
                marginBottom: spacing.lg,
                padding: spacing.md,
                background: isProxyCharge ? colors.warning[50] : colors.secondary[50],
                borderRadius: borderRadius.md,
                border: isProxyCharge
                  ? `1px solid ${colors.warning[500]}`
                  : `1px solid ${colors.border.light}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: getFontSize('bodySmall', isMobile),
                      color: colors.text.secondary,
                      marginBottom: 4,
                    }}
                  >
                    扣款帳戶：
                  </div>
                  <div style={{ fontSize: getFontSize('body', isMobile), fontWeight: 600 }}>
                    {isProxyCharge ? (
                      <div>
                        <span style={{ color: colors.warning[700] }}>
                          {chargeMemberName}
                          <span
                            style={{
                              fontSize: getFontSize('caption', isMobile),
                              color: colors.text.disabled,
                              marginLeft: 8,
                              fontWeight: 400,
                            }}
                          >
                            (代扣 {order.contact_name} 的費用)
                          </span>
                        </span>
                        {memberBalance !== null && (
                          <div
                            style={{
                              fontSize: getFontSize('caption', isMobile),
                              color: colors.text.secondary,
                              marginTop: 4,
                              fontWeight: 400,
                            }}
                          >
                            儲值 ${memberBalance.toLocaleString()}
                            {projectedBalance !== null && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: projectedBalanceInsufficient
                                    ? colors.danger[700]
                                    : colors.success[700],
                                  fontWeight: 600,
                                }}
                              >
                                → 扣後 {projectedBalanceInsufficient ? '-' : ''}$
                                {Math.abs(projectedBalance).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span>{chargeMemberName || order.contact_name}</span>
                        {memberBalance !== null && (
                          <div
                            style={{
                              fontSize: getFontSize('caption', isMobile),
                              color: colors.text.secondary,
                              marginTop: 4,
                              fontWeight: 400,
                            }}
                          >
                            儲值 ${memberBalance.toLocaleString()}
                            {projectedBalance !== null && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  color: projectedBalanceInsufficient
                                    ? colors.danger[700]
                                    : colors.success[700],
                                  fontWeight: 600,
                                }}
                              >
                                → 扣後 {projectedBalanceInsufficient ? '-' : ''}$
                                {Math.abs(projectedBalance).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isProxyCharge ? (
                    <button
                      type="button"
                      data-track="product_order_settle_reset_charge"
                      onClick={resetChargeToOrderMember}
                      style={{
                        ...getButtonStyle('secondary', 'small', isMobile),
                      }}
                    >
                      取消代扣
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-track="product_order_settle_switch_charge"
                      onClick={() => setShowMemberSearch(true)}
                      style={{
                        ...getButtonStyle('warning', 'small', isMobile),
                      }}
                    >
                      切換扣款會員
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {lines.length > 1 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                marginBottom: 14,
                padding: '8px 10px',
                background: colors.secondary[50],
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.border.light}`,
              }}
            >
              <span
                style={{
                  fontSize: getFontSize('bodySmall', isMobile),
                  color: colors.text.primary,
                  fontWeight: 500,
                }}
              >
                整單
              </span>
              <DecimalTextInput
                compact
                value={globalDiscountInput}
                onChange={setGlobalDiscountInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyGlobalDiscount()
                  }
                }}
              />
              <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>
                折
              </span>
              <button
                type="button"
                data-track="product_order_settle_apply_discount"
                onClick={applyGlobalDiscount}
                style={{
                  ...getButtonStyle('secondary', 'small', isMobile),
                  padding: '6px 10px',
                }}
              >
                套用
              </button>
            </div>
          )}

          <div
            style={{
              fontSize: getFontSize('body', isMobile),
              fontWeight: 600,
              marginBottom: spacing.md,
              color: colors.text.primary,
            }}
          >
            結帳品項：
          </div>

          {lines.map((line, idx) => (
            <SettleLineRow
              key={line.item_id}
              index={idx + 1}
              line={line}
              isMobile={isMobile}
              showDescription={paymentMethod === 'balance'}
              onUpdate={(patch) => updateLine(idx, patch)}
              onApplyDiscount={() => applyDiscountToLine(idx)}
              onOpenPreview={(src) => setPreviewSrc(src)}
            />
          ))}

          <div
            style={{
              paddingTop: spacing.lg,
              marginTop: spacing.lg,
              borderTop: `1px solid ${colors.border.main}`,
            }}
          >
            <div
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                background: colors.secondary[50],
                borderRadius: borderRadius.lg,
                border: `1px solid ${colors.border.light}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: getFontSize('body', isMobile),
                  fontWeight: 600,
                  color: colors.text.primary,
                }}
              >
                合計
              </span>
              <div style={{ textAlign: 'right' }}>
                {listTotal !== total && (
                  <div
                    style={{
                      fontSize: getFontSize('caption', isMobile),
                      color: colors.text.secondary,
                      textDecoration: 'line-through',
                    }}
                  >
                    ${listTotal.toLocaleString()}
                  </div>
                )}
                <div
                  style={{
                    fontSize: getFontSize('h2', isMobile),
                    fontWeight: 700,
                    color: colors.text.primary,
                  }}
                >
                  ${total.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={loading || (paymentMethod === 'balance' && !chargeMemberId)}
              data-track="product_order_settle_confirm"
              onClick={() => void handleSettle()}
              style={{
                ...getButtonStyle(
                  paymentMethod === 'balance'
                    ? isProxyCharge
                      ? 'warning'
                      : 'success'
                    : 'primary',
                  'medium',
                  isMobile,
                ),
                width: '100%',
                opacity: loading || (paymentMethod === 'balance' && !chargeMemberId) ? 0.6 : 1,
                cursor:
                  loading || (paymentMethod === 'balance' && !chargeMemberId)
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {loading
                ? '處理中…'
                : isProxyCharge && chargeMemberName
                  ? `${settleLabel}（${chargeMemberName}）`
                  : settleLabel}
            </button>
          </div>
        </div>
      )}

      {previewSrc && (
        <div
          role="presentation"
          onClick={() => setPreviewSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            boxSizing: 'border-box',
            cursor: 'pointer',
          }}
        >
          <img
            src={previewSrc}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      )}

      {showMemberSearch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => {
            setShowMemberSearch(false)
            proxySearch.reset()
          }}
        >
          <div
            style={{
              background: colors.background.card,
              borderRadius: borderRadius.lg,
              maxWidth: 400,
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: shadows.elevation[3],
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: spacing.lg,
                borderBottom: `1px solid ${colors.border.light}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: getFontSize('bodyLarge', isMobile), color: colors.text.primary }}>
                選擇代扣會員
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowMemberSearch(false)
                  proxySearch.reset()
                }}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: getFontSize('h2', isMobile),
                  cursor: 'pointer',
                  color: colors.text.secondary,
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                padding: '12px 16px',
                background: colors.warning[50],
                fontSize: getFontSize('bodySmall', isMobile),
                color: colors.warning[700],
              }}
            >
              從所選會員扣款，訂單仍記在 {order.contact_name} 名下。
            </div>
            <div style={{ padding: spacing.lg }}>
              <input
                type="text"
                value={proxySearch.searchTerm}
                onChange={(e) => proxySearch.handleSearchChange(e.target.value)}
                placeholder="搜尋會員姓名、暱稱或電話…"
                autoFocus
                style={{
                  width: '100%',
                  padding: spacing.md,
                  border: `1px solid ${colors.border.main}`,
                  borderRadius: borderRadius.md,
                  fontSize: getFontSize('bodyLarge', isMobile),
                  boxSizing: 'border-box',
                  color: colors.text.primary,
                }}
              />
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', borderTop: `1px solid ${colors.border.light}` }}>
              {proxySearch.filteredMembers.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: 'center',
                    color: colors.text.disabled,
                    fontSize: getFontSize('body', isMobile),
                  }}
                >
                  {proxySearch.searchTerm.trim() ? '找不到會員' : '輸入關鍵字搜尋'}
                </div>
              ) : (
                proxySearch.filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-track="product_order_settle_pick_member"
                    onClick={() => selectChargeMember(m)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: 'none',
                      borderBottom: `1px solid ${colors.border.light}`,
                      background: colors.background.card,
                      cursor: 'pointer',
                      fontSize: getFontSize('body', isMobile),
                      color: colors.text.primary,
                    }}
                  >
                    {memberLabel(m)}
                    {m.phone ? (
                      <span style={{ color: colors.text.disabled, marginLeft: 8 }}>{m.phone}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettleLineRow({
  index,
  line,
  isMobile,
  showDescription,
  onUpdate,
  onApplyDiscount,
  onOpenPreview,
}: {
  index: number
  line: SettleLineState
  isMobile: boolean
  showDescription: boolean
  onUpdate: (patch: Partial<SettleLineState>) => void
  onApplyDiscount: () => void
  onOpenPreview: (src: string) => void
}) {
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const subtotal = listSubtotal(line.qty, line.unit_price)
  const hasDiscount = line.line_total !== subtotal

  return (
    <div
      style={{
        background: colors.background.card,
        borderRadius: borderRadius.lg,
        padding: 14,
        marginBottom: 10,
        border: `1px solid ${colors.border.light}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${colors.border.light}`,
        }}
      >
        <span
          style={{
            fontSize: getFontSize('caption', isMobile),
            fontWeight: 500,
            color: colors.text.disabled,
            background: colors.secondary[100],
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {index}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: getFontSize('body', isMobile),
              fontWeight: 600,
              lineHeight: 1.4,
              color: colors.text.primary,
            }}
          >
            {line.label}
          </div>
          <div
            style={{
              fontSize: getFontSize('bodySmall', isMobile),
              color: colors.text.secondary,
              marginTop: 2,
            }}
          >
            × {line.qty}
          </div>
        </div>
        {!isMobile && line.thumb_src && (
          <button
            type="button"
            data-track="product_order_settle_image_preview"
            onClick={() => onOpenPreview(line.thumb_src!)}
            style={{
              width: 34,
              height: 46,
              border: `1px solid ${colors.border.light}`,
              borderRadius: borderRadius.sm,
              background: colors.secondary[50],
              overflow: 'hidden',
              padding: 0,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <img
              src={line.thumb_src}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </button>
        )}
      </div>

      <div style={{ marginBottom: showDescription ? 12 : 0 }}>
        <div
          style={{
            fontSize: getFontSize('bodySmall', isMobile),
            color: colors.text.secondary,
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          扣款金額：
        </div>
        <MoneyInput
          value={line.line_total}
          onChange={(line_total) => onUpdate({ line_total })}
        />
        <div
          style={{
            marginTop: 8,
            fontSize: getFontSize('bodySmall', isMobile),
            color: colors.text.secondary,
            background: colors.secondary[50],
            padding: '8px 12px',
            borderRadius: borderRadius.md,
            lineHeight: 1.5,
          }}
        >
          <div>
            ${line.unit_price.toLocaleString()} × {line.qty} = <strong>${subtotal.toLocaleString()}</strong>
            {hasDiscount && (
              <>
                {' '}
                → 折後 <strong>${line.line_total.toLocaleString()}</strong>
              </>
            )}
          </div>
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px dashed ${colors.border.main}`,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <DecimalTextInput
              compact
              value={line.discountInput}
              onChange={(v) => onUpdate({ discountInput: v })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onApplyDiscount()
                }
              }}
            />
            <span style={{ fontSize: getFontSize('caption', isMobile), color: colors.text.secondary }}>
              折
            </span>
            <button
              type="button"
              data-track="product_order_settle_line_discount"
              onClick={onApplyDiscount}
              style={{
                ...getButtonStyle('secondary', 'small', isMobile),
                padding: '6px 10px',
              }}
            >
              套用
            </button>
          </div>
        </div>
      </div>

      {showDescription && (
        <div style={{ marginBottom: 0 }}>
          <div
            style={{
              fontSize: getFontSize('bodySmall', isMobile),
              color: colors.text.secondary,
              marginBottom: 8,
              fontWeight: 500,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>說明：</span>
            <button
              type="button"
              data-track="product_order_settle_edit_description"
              onClick={() => setIsEditingDescription((v) => !v)}
              style={{
                padding: '4px 10px',
                background: colors.background.card,
                border: `1px solid ${colors.border.light}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('caption', isMobile),
                color: colors.text.secondary,
                cursor: 'pointer',
              }}
            >
              {isEditingDescription ? '收起' : '編輯'}
            </button>
          </div>
          {isEditingDescription ? (
            <textarea
              value={line.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="輸入說明…"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: colors.background.card,
                border: `1px solid ${colors.border.main}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('body', isMobile),
                minHeight: 56,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                color: colors.text.primary,
              }}
            />
          ) : (
            <div
              style={{
                padding: '10px 12px',
                background: colors.secondary[50],
                border: `1px solid ${colors.border.light}`,
                borderRadius: borderRadius.md,
                fontSize: getFontSize('body', isMobile),
                color: colors.text.secondary,
                lineHeight: 1.45,
              }}
            >
              {line.description}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
