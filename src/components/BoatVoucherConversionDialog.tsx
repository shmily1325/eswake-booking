import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateBoatVoucherConversionAmount,
  createBoatVoucherBalanceConversion,
  createBoatVoucherConversionRequestKey,
  deleteBoatVoucherBalanceConversion,
  getBoatVoucherCategoryLabel,
  getBoatVoucherConversionRate,
  updateBoatVoucherBalanceConversion,
  type BoatVoucherBalanceConversion,
  type BoatVoucherCategory,
  type BoatVoucherConversionRate,
  type BoatVoucherPackageHours,
} from '../lib/boatVoucherConversions'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import {
  designSystem,
  getBookingChoiceStyle,
  getButtonStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'

interface BoatVoucherConversionDialogProps {
  open: boolean
  member: {
    id: string
    name: string
    nickname?: string | null
  }
  category: BoatVoucherCategory
  voucherYear: number
  conversion?: BoatVoucherBalanceConversion | null
  onClose: () => void
  onSuccess: () => void | Promise<void>
}

interface CurrentBalances {
  lotRemaining: number
  memberBalance: number
  voucherTotal: number
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || '未知錯誤')
}

export function BoatVoucherConversionDialog({
  open,
  member,
  category,
  voucherYear,
  conversion = null,
  onClose,
  onSuccess,
}: BoatVoucherConversionDialogProps) {
  const { isMobile } = useResponsive()
  const editing = Boolean(conversion)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<CurrentBalances | null>(null)
  const [packageHours, setPackageHours] = useState<BoatVoucherPackageHours>(20)
  const [rate, setRate] = useState<BoatVoucherConversionRate | null>(null)
  const [minutes, setMinutes] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [amountCustomized, setAmountCustomized] = useState(false)
  const [transactionDate, setTransactionDate] = useState(getLocalDateString())
  const [notes, setNotes] = useState('')
  const preserveInitialAmount = useRef(false)
  const requestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setBalances(null)
    if (!conversion && requestKeyRef.current === null) {
      requestKeyRef.current = createBoatVoucherConversionRequestKey()
    }
    const initialHours = conversion?.package_hours ?? 20
    setPackageHours(initialHours)
    setTransactionDate(conversion?.transaction_date ?? getLocalDateString())
    setNotes(conversion?.notes ?? '')
    preserveInitialAmount.current = true

    void Promise.all([
      supabase
        .from('credit_lots')
        .select('remaining')
        .eq('member_id', member.id)
        .eq('category', category)
        .eq('voucher_year', voucherYear)
        .maybeSingle(),
      supabase
        .from('members')
        .select('balance, boat_voucher_g23_minutes, boat_voucher_g21_panther_minutes')
        .eq('id', member.id)
        .maybeSingle(),
      conversion
        ? Promise.resolve<BoatVoucherConversionRate>({
            effective_year: conversion.rate_effective_year,
            category: conversion.category,
            package_hours: conversion.package_hours,
            package_minutes: conversion.package_minutes,
            package_price: conversion.package_price,
          })
        : getBoatVoucherConversionRate({
            voucherYear,
            category,
            packageHours: initialHours,
          }),
    ]).then(([lotResult, memberResult, initialRate]) => {
      if (cancelled) return
      if (lotResult.error) throw lotResult.error
      if (memberResult.error) throw memberResult.error
      if (!lotResult.data || !memberResult.data) throw new Error('找不到目前餘額')
      const current = {
        lotRemaining: Number(lotResult.data.remaining),
        memberBalance: Number(memberResult.data.balance || 0),
        voucherTotal: Number(
          category === 'boat_voucher_g23'
            ? memberResult.data.boat_voucher_g23_minutes
            : memberResult.data.boat_voucher_g21_panther_minutes,
        ),
      }
      const initialMinutes = conversion?.minutes ?? Math.abs(current.lotRemaining)
      const suggested = calculateBoatVoucherConversionAmount(initialMinutes, initialRate)
      const initialAmount = conversion?.balance_amount ?? suggested
      setBalances(current)
      setRate(initialRate)
      setMinutes(String(initialMinutes))
      setBalanceAmount(String(initialAmount))
      setAmountCustomized(Boolean(conversion && initialAmount !== suggested))
    }).catch((cause) => {
      if (!cancelled) setError(errorMessage(cause))
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, member.id, category, voucherYear, conversion])

  useEffect(() => {
    if (!open) requestKeyRef.current = null
  }, [open])

  useEffect(() => {
    if (!open || loading) return
    if (preserveInitialAmount.current) {
      preserveInitialAmount.current = false
      return
    }
    let cancelled = false
    void getBoatVoucherConversionRate({ voucherYear, category, packageHours })
      .then((nextRate) => {
        if (cancelled) return
        setRate(nextRate)
        const qty = Number(minutes)
        setBalanceAmount(String(calculateBoatVoucherConversionAmount(qty, nextRate)))
        setAmountCustomized(false)
      })
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause))
      })
    return () => {
      cancelled = true
    }
    // minutes is deliberately handled by its input so changing quantity updates immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, voucherYear, category, packageHours])

  const direction = conversion?.direction
    ?? (balances && balances.lotRemaining < 0 ? 'balance_to_voucher' : 'voucher_to_balance')
  const parsedMinutes = Number(minutes)
  const parsedAmount = Number(balanceAmount)
  const originalLotBeforeConversion = useMemo(() => {
    if (!balances) return 0
    if (!conversion) return balances.lotRemaining
    return balances.lotRemaining + (
      conversion.direction === 'voucher_to_balance'
        ? conversion.minutes
        : -conversion.minutes
    )
  }, [balances, conversion])
  const maxMinutes = Math.abs(originalLotBeforeConversion)
  const voucherDelta = direction === 'voucher_to_balance' ? -parsedMinutes : parsedMinutes
  const balanceDelta = direction === 'voucher_to_balance' ? parsedAmount : -parsedAmount
  const previewLotAfter = originalLotBeforeConversion + (Number.isFinite(voucherDelta) ? voucherDelta : 0)
  const previewBalanceBase = balances
    ? balances.memberBalance + (
      conversion
        ? conversion.direction === 'voucher_to_balance'
          ? -conversion.balance_amount
          : conversion.balance_amount
        : 0
    )
    : 0
  const previewBalanceAfter = previewBalanceBase + (Number.isFinite(balanceDelta) ? balanceDelta : 0)
  const suggestedAmount = rate
    ? calculateBoatVoucherConversionAmount(parsedMinutes, rate)
    : 0
  const isAdjusted = parsedAmount !== suggestedAmount
  const valid =
    Number.isInteger(parsedMinutes)
    && parsedMinutes > 0
    && parsedMinutes <= maxMinutes
    && Number.isInteger(parsedAmount)
    && parsedAmount > 0
    && Boolean(transactionDate)

  const updateMinutes = (raw: string) => {
    const digits = raw.replace(/\D/g, '')
    setMinutes(digits)
    const qty = Number(digits)
    if (rate) {
      setBalanceAmount(String(calculateBoatVoucherConversionAmount(qty, rate)))
      setAmountCustomized(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || saving) return
    setSaving(true)
    setError(null)
    try {
      if (conversion) {
        await updateBoatVoucherBalanceConversion({
          conversionId: conversion.id,
          memberId: member.id,
          packageHours,
          minutes: parsedMinutes,
          balanceAmount: parsedAmount,
          transactionDate,
          notes,
        })
      } else {
        const requestKey =
          requestKeyRef.current ?? createBoatVoucherConversionRequestKey()
        requestKeyRef.current = requestKey
        await createBoatVoucherBalanceConversion({
          requestKey,
          memberId: member.id,
          category,
          voucherYear,
          packageHours,
          minutes: parsedMinutes,
          balanceAmount: parsedAmount,
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
    if (!window.confirm('確定取消這次轉換嗎？船券與儲值會一起還原。')) return
    setDeleting(true)
    setError(null)
    try {
      await deleteBoatVoucherBalanceConversion({
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

  const title = direction === 'voucher_to_balance' ? '船券轉儲值' : '儲值補船券'
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
      <div style={{
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="boat-voucher-conversion-title"
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
            <h2 style={{
              margin: 0,
              color: designSystem.colors.text.primary,
              fontSize: getFontSize('h2', isMobile),
            }} id="boat-voucher-conversion-title">
              {editing ? '修改' : title}
            </h2>
            <div style={{
              marginTop: 4,
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
            }}>
              {displayName} · {voucherYear} {getBoatVoucherCategoryLabel(category)}
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
              <label style={getLabelStyle(isMobile)}>換算方式</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([20, 10] as const).map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    aria-pressed={packageHours === hours}
                    onClick={() => {
                      preserveInitialAmount.current = false
                      setPackageHours(hours)
                    }}
                    style={{
                      ...getBookingChoiceStyle(packageHours === hours),
                      minHeight: 44,
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    {hours} 小時
                  </button>
                ))}
              </div>
              {rate ? (
                <div style={{
                  marginTop: 7,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('caption', isMobile),
                }}>
                  套用 {rate.effective_year} 方案：{rate.package_minutes.toLocaleString()}分／${rate.package_price.toLocaleString()}
                </div>
              ) : null}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={getLabelStyle(isMobile)}>換算分鐘</label>
              <input
                value={minutes}
                onChange={(event) => updateMinutes(event.target.value)}
                inputMode="numeric"
                style={getInputStyle(isMobile)}
              />
              <div style={{
                marginTop: 6,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
              }}>
                最多 {maxMinutes.toLocaleString()} 分
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={getLabelStyle(isMobile)}>儲值金額</label>
              <input
                value={balanceAmount}
                onChange={(event) => {
                  setBalanceAmount(event.target.value.replace(/\D/g, ''))
                  setAmountCustomized(true)
                }}
                inputMode="numeric"
                style={getInputStyle(isMobile)}
              />
              <div style={{
                marginTop: 6,
                color: isAdjusted || amountCustomized
                  ? designSystem.colors.warning[700]
                  : designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
              }}>
                建議 ${suggestedAmount.toLocaleString()}
                {isAdjusted ? ' · 已調整' : ''}
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
                <span>{voucherYear} 船券</span>
                <strong>{originalLotBeforeConversion.toLocaleString()} → {previewLotAfter.toLocaleString()}分</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>儲值</span>
                <strong style={{
                  color: previewBalanceAfter < 0
                    ? designSystem.colors.danger[700]
                    : designSystem.colors.text.primary,
                }}>
                  ${previewBalanceBase.toLocaleString()} → ${previewBalanceAfter.toLocaleString()}
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
                請確認分鐘、金額與日期
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
