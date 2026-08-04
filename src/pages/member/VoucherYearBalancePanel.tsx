/**
 * 儲值 · 年度餘額
 *
 * Design thinking (docs/design.md):
 * - Dashboard smells to avoid: spreadsheet chrome, stat cards, emoji decoration
 * - Hierarchy: year first → who has remaining → amounts; click opens 細帳
 * - Primary task: scan voucher year remainders like Excel year tabs
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useResponsive } from '../../hooks/useResponsive'
import {
  designSystem,
  getBookingChoiceStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
} from '../../styles/designSystem'

type LotCategory =
  | 'vip_voucher'
  | 'boat_voucher_g23'
  | 'boat_voucher_g21_panther'

interface LotRow {
  member_id: string
  category: LotCategory
  voucher_year: number
  remaining: number
  members: {
    id: string
    nickname: string | null
    name: string | null
  } | null
}

export interface YearBalanceMemberRef {
  id: string
  nickname: string | null
  name: string | null
}

interface MemberYearBalance {
  memberId: string
  nickname: string
  name: string
  g21: number | null
  g23: number | null
  vip: number | null
  years: number[]
}

interface VoucherYearBalancePanelProps {
  onOpenMember: (member: YearBalanceMemberRef) => void
}

const CATEGORY_LABEL: Record<LotCategory, string> = {
  boat_voucher_g21_panther: 'G21／黑豹',
  boat_voucher_g23: 'G23',
  vip_voucher: 'VIP',
}

function formatAmount(category: LotCategory, value: number): string {
  if (category === 'vip_voucher') {
    return `$${value.toLocaleString()}`
  }
  return `${value.toLocaleString()}分`
}

function AmountCell({
  category,
  value,
  isMobile,
}: {
  category: LotCategory
  value: number | null
  isMobile: boolean
}) {
  if (value === null) {
    return (
      <span style={{ color: designSystem.colors.text.secondary }}>
        —
      </span>
    )
  }
  const depleted = value === 0
  return (
    <span
      style={{
        fontSize: getFontSize('bodyLarge', isMobile),
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: depleted
          ? designSystem.colors.text.secondary
          : designSystem.colors.text.primary,
      }}
    >
      {depleted ? '用完' : formatAmount(category, value)}
    </span>
  )
}

export function VoucherYearBalancePanel({ onOpenMember }: VoucherYearBalancePanelProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lots, setLots] = useState<LotRow[]>([])
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const loadLots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: qError } = await supabase
        .from('credit_lots')
        .select(
          `
          member_id,
          category,
          voucher_year,
          remaining,
          members:member_id ( id, nickname, name )
        `
        )
        .order('voucher_year', { ascending: true })

      if (qError) throw qError
      setLots((data || []) as unknown as LotRow[])
    } catch (err) {
      console.error('載入年度餘額失敗:', err)
      setError('載入年度餘額失敗')
      setLots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLots()
  }, [loadLots])

  const availableYears = useMemo(() => {
    const years = [...new Set(lots.map((l) => l.voucher_year))].sort((a, b) => a - b)
    return years
  }, [lots])

  const rows = useMemo(() => {
    const filteredLots =
      yearFilter === 'all'
        ? lots
        : lots.filter((l) => l.voucher_year === yearFilter)

    const byMember = new Map<string, MemberYearBalance>()

    for (const lot of filteredLots) {
      const member = lot.members
      if (!member) continue
      const existing = byMember.get(lot.member_id) || {
        memberId: lot.member_id,
        nickname: member.nickname || member.name || '—',
        name: member.name || '',
        g21: null,
        g23: null,
        vip: null,
        years: [],
      }

      const rem = Number(lot.remaining)
      if (lot.category === 'boat_voucher_g21_panther') existing.g21 = rem
      if (lot.category === 'boat_voucher_g23') existing.g23 = rem
      if (lot.category === 'vip_voucher') existing.vip = rem
      if (!existing.years.includes(lot.voucher_year)) {
        existing.years.push(lot.voucher_year)
      }
      byMember.set(lot.member_id, existing)
    }

    let list = [...byMember.values()]
    const q = searchTerm.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.nickname.toLowerCase().includes(q) ||
          r.name.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => a.nickname.localeCompare(b.nickname, 'zh-Hant'))
    return list
  }, [lots, yearFilter, searchTerm])

  const yearChip = (year: number | 'all', label: string) => {
    const selected = yearFilter === year
    return (
      <button
        key={String(year)}
        type="button"
        data-track={`voucher_year_filter_${year}`}
        aria-pressed={selected}
        onClick={() => setYearFilter(year)}
        style={{
          ...getBookingChoiceStyle(selected),
          padding: isMobile ? '10px 14px' : '10px 16px',
          fontSize: getFontSize('button', isMobile),
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: designSystem.spacing.lg }}>
        <h2
          style={{
            margin: `0 0 ${designSystem.spacing.xs}`,
            fontSize: getFontSize('h2', isMobile),
            fontWeight: 650,
            letterSpacing: '-0.02em',
            color: designSystem.colors.text.primary,
          }}
        >
          年度餘額
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: getFontSize('body', isMobile),
            color: designSystem.colors.text.secondary,
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          已與 Excel／流水對齊的 G21、G23、VIP 分年剩餘。點會員可看細帳。
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: designSystem.spacing.sm,
          marginBottom: designSystem.spacing.md,
        }}
      >
        {yearChip('all', '全部')}
        {availableYears.map((y) => yearChip(y, String(y)))}
      </div>

      <div style={{ position: 'relative', marginBottom: designSystem.spacing.md }}>
        <input
          type="text"
          placeholder="搜尋會員"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            ...getInputStyle(isMobile),
            width: '100%',
            boxSizing: 'border-box',
            paddingRight: searchTerm ? 40 : undefined,
          }}
        />
        {searchTerm ? (
          <button
            type="button"
            aria-label="清除搜尋"
            onClick={() => setSearchTerm('')}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: designSystem.colors.text.secondary,
              color: '#fff',
              width: 24,
              height: 24,
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: getFontSize('caption', isMobile),
            }}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div
        style={{
          background: designSystem.colors.background.card,
          borderRadius: designSystem.borderRadius.xl,
          boxShadow: designSystem.shadows.sm,
          overflow: 'hidden',
        }}
      >
        {!isMobile && !loading && rows.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 1.4fr) repeat(3, minmax(100px, 1fr))',
              gap: designSystem.spacing.md,
              padding: '14px 20px',
              borderBottom: `1px solid ${designSystem.colors.border.light}`,
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            <div>會員</div>
            <div style={{ textAlign: 'right' }}>{CATEGORY_LABEL.boat_voucher_g21_panther}</div>
            <div style={{ textAlign: 'right' }}>{CATEGORY_LABEL.boat_voucher_g23}</div>
            <div style={{ textAlign: 'right' }}>{CATEGORY_LABEL.vip_voucher}</div>
          </div>
        ) : null}

        {loading ? (
          <div style={{ ...getEmptyStateStyle(isMobile), padding: 48 }}>載入中…</div>
        ) : error ? (
          <div style={{ ...getEmptyStateStyle(isMobile), padding: 48, color: designSystem.colors.danger[700] }}>
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div style={{ ...getEmptyStateStyle(isMobile), padding: 48 }}>
            {lots.length === 0
              ? '尚無已對齊的年度餘額'
              : '沒有符合的會員'}
          </div>
        ) : (
          rows.map((row, index) => (
            <button
              key={row.memberId}
              type="button"
              data-track="voucher_year_open_member"
              onClick={() =>
                onOpenMember({
                  id: row.memberId,
                  nickname: row.nickname,
                  name: row.name,
                })
              }
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: isMobile ? '16px 16px' : '16px 20px',
                borderTop:
                  index === 0
                    ? undefined
                    : `1px solid ${designSystem.colors.border.light}`,
                boxSizing: 'border-box',
              }}
            >
              {isMobile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div
                      style={{
                        fontSize: getFontSize('bodyLarge', isMobile),
                        fontWeight: 650,
                        color: designSystem.colors.text.primary,
                      }}
                    >
                      {row.nickname}
                    </div>
                    {row.name && row.name !== row.nickname ? (
                      <div
                        style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginTop: 2,
                        }}
                      >
                        {row.name}
                      </div>
                    ) : null}
                    {yearFilter === 'all' && row.years.length > 0 ? (
                      <div
                        style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginTop: 4,
                        }}
                      >
                        {row.years.join(' · ')}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 8,
                    }}
                  >
                    {(
                      [
                        ['g21', 'boat_voucher_g21_panther', row.g21],
                        ['g23', 'boat_voucher_g23', row.g23],
                        ['vip', 'vip_voucher', row.vip],
                      ] as const
                    ).map(([key, cat, val]) => (
                      <div key={key}>
                        <div
                          style={{
                            fontSize: getFontSize('caption', isMobile),
                            color: designSystem.colors.text.secondary,
                            marginBottom: 2,
                          }}
                        >
                          {CATEGORY_LABEL[cat]}
                        </div>
                        <AmountCell category={cat} value={val} isMobile={isMobile} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.4fr) repeat(3, minmax(100px, 1fr))',
                    gap: designSystem.spacing.md,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: getFontSize('bodyLarge', isMobile),
                        fontWeight: 650,
                        color: designSystem.colors.text.primary,
                      }}
                    >
                      {row.nickname}
                    </div>
                    {row.name && row.name !== row.nickname ? (
                      <div
                        style={{
                          fontSize: getFontSize('bodySmall', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginTop: 2,
                        }}
                      >
                        {row.name}
                      </div>
                    ) : null}
                    {yearFilter === 'all' && row.years.length > 0 ? (
                      <div
                        style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                          marginTop: 4,
                        }}
                      >
                        {row.years.join(' · ')}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <AmountCell
                      category="boat_voucher_g21_panther"
                      value={row.g21}
                      isMobile={isMobile}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <AmountCell
                      category="boat_voucher_g23"
                      value={row.g23}
                      isMobile={isMobile}
                    />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <AmountCell category="vip_voucher" value={row.vip} isMobile={isMobile} />
                  </div>
                </div>
              )}
            </button>
          ))
        )}
      </div>

      {!loading && lots.length > 0 ? (
        <p
          style={{
            margin: `${designSystem.spacing.md} 0 0`,
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
          }}
        >
          共 {rows.length} 位｜僅列已建 lot 者；未對齊者不顯示
        </p>
      ) : null}
    </div>
  )
}
