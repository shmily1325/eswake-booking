import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  createVipVoucherBalanceConversion,
  createVipVoucherConversionRequestKey,
  deleteVipVoucherBalanceConversion,
  updateVipVoucherBalanceConversion,
  type VipVoucherBalanceConversion,
} from '../lib/vipVoucherConversions'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'

interface VipVoucherConversionDialogProps {
  open: boolean
  member: {
    id: string
    name: string
    nickname?: string | null
  }
  voucherYear: number
  conversion?: VipVoucherBalanceConversion | null
  onClose: () => void
  onSuccess: () => void | Promise<void>
}

interface CurrentBalances {
  lotRemaining: number
  vipTotal: number
  memberBalance: number
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知錯誤')
}

export function VipVoucherConversionDialog({
  open,
  member,
  voucherYear,
  conversion = null,
  onClose,
  onSuccess,
}: VipVoucherConversionDialogProps) {
  const { isMobile } = useResponsive()
  const editing = Boolean(conversion)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<CurrentBalances | null>(null)
  const [amount, setAmount] = useState('')
  const [transactionDate, setTransactionDate] = useState(getLocalDateString())
  const [notes, setNotes] = useState('')
  const requestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setBalances(null)
    if (!conversion && requestKeyRef.current === null) {
      requestKeyRef.current = createVipVoucherConversionRequestKey()
    }
    setAmount(conversion ? String(conversion.amount) : '')
    setTransactionDate(conversion?.transaction_date ?? getLocalDateString())
    setNotes(conversion?.notes ?? '')

    void Promise.all([
      supabase
        .from('credit_lots')
        .select('remaining')
        .eq('member_id', member.id)
        .eq('category', 'vip_voucher')
        .eq('voucher_year', voucherYear)
        .maybeSingle(),
      supabase
        .from('members')
        .select('balance, vip_voucher_amount')
        .eq('id', member.id)
        .maybeSingle(),
    ]).then(([lotResult, memberResult]) => {
      if (cancelled) return
      if (lotResult.error) throw lotResult.error
      if (memberResult.error) throw memberResult.error
      if (!lotResult.data || !memberResult.data) throw new Error('找不到目前餘額')
      const current = {
        lotRemaining: Number(lotResult.data.remaining),
        vipTotal: Number(memberResult.data.vip_voucher_amount || 0),
        memberBalance: Number(memberResult.data.balance || 0),
      }
      setBalances(current)
      if (!conversion) setAmount(String(Math.abs(current.lotRemaining)))
    }).catch((cause) => {
      if (!cancelled) setError(errorMessage(cause))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, member.id, voucherYear, conversion])

  useEffect(() => {
    if (!open) requestKeyRef.current = null
  }, [open])

  const direction = conversion?.direction
    ?? (balances && balances.lotRemaining < 0 ? 'balance_to_vip' : 'vip_to_balance')
  const parsedAmount = Number(amount)
  const originalLotBeforeConversion = useMemo(() => {
    if (!balances) return 0
    if (!conversion) return balances.lotRemaining
    return balances.lotRemaining + (
      conversion.direction === 'vip_to_balance'
        ? conversion.amount
        : -conversion.amount
    )
  }, [balances, conversion])
  const originalVipBeforeConversion = useMemo(() => {
    if (!balances) return 0
    if (!conversion) return balances.vipTotal
    return balances.vipTotal + (
      conversion.direction === 'vip_to_balance'
        ? conversion.amount
        : -conversion.amount
    )
  }, [balances, conversion])
  const originalBalanceBeforeConversion = useMemo(() => {
    if (!balances) return 0
    if (!conversion) return balances.memberBalance
    return balances.memberBalance + (
      conversion.direction === 'vip_to_balance'
        ? -conversion.amount
        : conversion.amount
    )
  }, [balances, conversion])
  const maxAmount = conversion
    ? conversion.amount + (
        conversion.direction === 'vip_to_balance'
          ? Math.max(balances?.lotRemaining ?? 0, 0)
          : Math.max(-(balances?.lotRemaining ?? 0), 0)
      )
    : Math.abs(originalLotBeforeConversion)
  const vipDelta = direction === 'vip_to_balance' ? -parsedAmount : parsedAmount
  const balanceDelta = -vipDelta
  const previewLotAfter =
    originalLotBeforeConversion + (Number.isFinite(vipDelta) ? vipDelta : 0)
  const previewVipAfter =
    originalVipBeforeConversion + (Number.isFinite(vipDelta) ? vipDelta : 0)
  const previewBalanceAfter =
    originalBalanceBeforeConversion + (Number.isFinite(balanceDelta) ? balanceDelta : 0)
  const valid =
    Number.isInteger(parsedAmount)
    && parsedAmount > 0
    && parsedAmount <= maxAmount
    && Boolean(transactionDate)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      if (conversion) {
        await updateVipVoucherBalanceConversion({
          conversionId: conversion.id,
          memberId: member.id,
          amount: parsedAmount,
          transactionDate,
          notes,
        })
      } else {
        const requestKey =
          requestKeyRef.current ?? createVipVoucherConversionRequestKey()
        requestKeyRef.current = requestKey
        await createVipVoucherBalanceConversion({
          requestKey,
          memberId: member.id,
          voucherYear,
          amount: parsedAmount,
          transactionDate,
          notes,
        })
      }
      await onSuccess()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!conversion || deleting) return
    if (!window.confirm('確定取消這次轉換嗎？VIP 票券與儲值會一起還原。')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteVipVoucherBalanceConversion({
        conversionId: conversion.id,
        memberId: member.id,
      })
      await onSuccess()
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  const title = direction === 'vip_to_balance' ? 'VIP轉儲值' : '儲值補VIP'
  const displayName = member.nickname || member.name

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: isMobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      padding: isMobile ? 0 : 20,
    }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vip-voucher-conversion-title"
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: isMobile ? '92dvh' : '90vh',
          overflowY: 'auto',
          background: designSystem.colors.background.card,
          borderRadius: isMobile
            ? `${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl} 0 0`
            : designSystem.borderRadius.xl,
          boxShadow: designSystem.shadows.lg,
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          padding: isMobile ? 16 : 20,
          borderBottom: `1px solid ${designSystem.colors.border.light}`,
        }}>
          <div>
            <h2
              id="vip-voucher-conversion-title"
              style={{
                margin: 0,
                color: designSystem.colors.text.primary,
                fontSize: getFontSize('h2', isMobile),
              }}
            >
              {editing ? '修改' : title}
            </h2>
            <div style={{
              marginTop: 4,
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
            }}>
              {displayName} · {voucherYear} VIP
            </div>
          </div>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            disabled={saving || deleting}
            style={{
              border: 0,
              background: 'transparent',
              fontSize: getFontSize('h2', isMobile),
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: designSystem.colors.text.secondary }}>
            載入中…
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: isMobile ? 16 : 20 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={getLabelStyle(isMobile)}>轉換金額</label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                style={getInputStyle(isMobile)}
              />
              <div style={{
                marginTop: 6,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
              }}>
                VIP 與儲值等值轉換 · 最多 ${maxAmount.toLocaleString()}
              </div>
            </div>

            <div style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
              background: designSystem.colors.background.main,
              display: 'grid',
              gap: 8,
              fontSize: getFontSize('body', isMobile),
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{voucherYear} VIP</span>
                <strong>
                  ${originalLotBeforeConversion.toLocaleString()} → ${previewLotAfter.toLocaleString()}
                </strong>
              </div>
              {originalVipBeforeConversion !== originalLotBeforeConversion ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>VIP 總額</span>
                  <strong>
                    ${originalVipBeforeConversion.toLocaleString()} → ${previewVipAfter.toLocaleString()}
                  </strong>
                </div>
              ) : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>儲值</span>
                <strong style={{
                  color: previewBalanceAfter < 0
                    ? designSystem.colors.danger[700]
                    : designSystem.colors.text.primary,
                }}>
                  ${originalBalanceBeforeConversion.toLocaleString()} → ${previewBalanceAfter.toLocaleString()}
                </strong>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={getLabelStyle(isMobile)}>交易日期</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
                style={getInputStyle(isMobile)}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={getLabelStyle(isMobile)}>備註</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                style={{
                  ...getInputStyle(isMobile),
                  minHeight: 72,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {error ? (
              <div style={{
                marginBottom: 16,
                color: designSystem.colors.danger[700],
                fontSize: getFontSize('bodySmall', isMobile),
              }}>
                {error}
              </div>
            ) : null}

            {!valid && !error ? (
              <div style={{
                marginBottom: 16,
                color: designSystem.colors.warning[700],
                fontSize: getFontSize('bodySmall', isMobile),
              }}>
                請確認金額與日期
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 10 }}>
              {conversion ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  style={{ ...getButtonStyle('danger', 'large', isMobile), flex: 1 }}
                >
                  {deleting ? '取消中…' : '取消轉換'}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!valid || saving || deleting}
                style={{
                  ...getButtonStyle('primary', 'large', isMobile),
                  flex: 2,
                  opacity: !valid || saving || deleting ? 0.55 : 1,
                }}
              >
                {saving ? '儲存中…' : editing ? '儲存' : title}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
