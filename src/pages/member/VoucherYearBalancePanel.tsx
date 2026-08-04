/**
 * 儲值 · 年度細帳
 *
 * Design thinking (docs/design.md):
 * - Primary task: who still has remaining in a given year × voucher type
 * - Click opens member 歷史 with category + year filter (tagged credits only)
 * - Quiet chrome; no instructional copy under the title
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
  /** 點清冊列時帶入，開啟細帳歷史用 */
  category?: LotCategory
}

interface PersonRemaining {
  memberId: string
  nickname: string
  name: string
  remaining: number
}

interface VoucherYearBalancePanelProps {
  onOpenMember: (member: YearBalanceMemberRef) => void
  /** 變更時重新載入 lots（例如細帳成功後） */
  refreshKey?: number
}

const CATEGORY_ORDER: LotCategory[] = [
  'boat_voucher_g21_panther',
  'boat_voucher_g23',
  'vip_voucher',
]

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

export function VoucherYearBalancePanel({ onOpenMember, refreshKey = 0 }: VoucherYearBalancePanelProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lots, setLots] = useState<LotRow[]>([])
  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [hideZero, setHideZero] = useState(true)
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
      console.error('載入年度細帳失敗:', err)
      setError('載入年度細帳失敗')
      setLots([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLots()
  }, [loadLots, refreshKey])

  const availableYears = useMemo(() => {
    return [...new Set(lots.map((l) => l.voucher_year))].sort((a, b) => a - b)
  }, [lots])

  // Default to latest year (usually 2026), like opening the current Excel tab
  useEffect(() => {
    if (availableYears.length === 0) return
    if (yearFilter !== null && availableYears.includes(yearFilter)) return
    setYearFilter(availableYears[availableYears.length - 1])
  }, [availableYears, yearFilter])

  const sections = useMemo(() => {
    if (yearFilter === null) return []

    const q = searchTerm.trim().toLowerCase()
    const yearLots = lots.filter((l) => l.voucher_year === yearFilter)

    return CATEGORY_ORDER.map((category) => {
      const peopleMap = new Map<string, PersonRemaining>()

      for (const lot of yearLots) {
        if (lot.category !== category) continue
        const member = lot.members
        if (!member) continue
        const nickname = member.nickname || member.name || '—'
        const name = member.name || ''
        if (q) {
          const hay = `${nickname} ${name}`.toLowerCase()
          if (!hay.includes(q)) continue
        }
        const remaining = Number(lot.remaining)
        if (hideZero && remaining === 0) continue

        peopleMap.set(lot.member_id, {
          memberId: lot.member_id,
          nickname,
          name,
          remaining,
        })
      }

      const people = [...peopleMap.values()].sort((a, b) =>
        a.nickname.localeCompare(b.nickname, 'zh-Hant')
      )

      return { category, label: CATEGORY_LABEL[category], people }
    }).filter((section) => section.people.length > 0)
  }, [lots, yearFilter, searchTerm, hideZero])

  const totalPeople = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sections) for (const p of s.people) ids.add(p.memberId)
    return ids.size
  }, [sections])

  return (
    <div>
      <div style={{ marginBottom: designSystem.spacing.lg }}>
        <h2
          style={{
            margin: 0,
            fontSize: getFontSize('h2', isMobile),
            fontWeight: 650,
            letterSpacing: '-0.02em',
            color: designSystem.colors.text.primary,
          }}
        >
          年度細帳
        </h2>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: designSystem.spacing.sm,
          marginBottom: designSystem.spacing.md,
          alignItems: 'center',
        }}
      >
        {availableYears.map((y) => {
          const selected = yearFilter === y
          return (
            <button
              key={y}
              type="button"
              data-track={`voucher_year_filter_${y}`}
              aria-pressed={selected}
              onClick={() => setYearFilter(y)}
              style={{
                ...getBookingChoiceStyle(selected),
                padding: isMobile ? '10px 14px' : '10px 16px',
                fontSize: getFontSize('button', isMobile),
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: 44,
              }}
            >
              {y}
            </button>
          )
        })}

        <button
          type="button"
          data-track="voucher_year_hide_zero"
          aria-pressed={hideZero}
          onClick={() => setHideZero((v) => !v)}
          style={{
            ...getBookingChoiceStyle(hideZero),
            marginLeft: isMobile ? 0 : 'auto',
            padding: isMobile ? '10px 14px' : '10px 16px',
            fontSize: getFontSize('button', isMobile),
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 44,
          }}
        >
          只看有剩餘
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: designSystem.spacing.lg }}>
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

      {loading ? (
        <div
          style={{
            ...getEmptyStateStyle(isMobile),
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.xl,
            boxShadow: designSystem.shadows.sm,
            padding: 48,
          }}
        >
          載入中…
        </div>
      ) : error ? (
        <div
          style={{
            ...getEmptyStateStyle(isMobile),
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.xl,
            boxShadow: designSystem.shadows.sm,
            padding: 48,
            color: designSystem.colors.danger[700],
          }}
        >
          {error}
        </div>
      ) : sections.length === 0 ? (
        <div
          style={{
            ...getEmptyStateStyle(isMobile),
            background: designSystem.colors.background.card,
            borderRadius: designSystem.borderRadius.xl,
            boxShadow: designSystem.shadows.sm,
            padding: 48,
          }}
        >
          {lots.length === 0
            ? '尚無資料'
            : hideZero
              ? '此年沒有剩餘'
              : '沒有符合的資料'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.xl }}>
          {sections.map((section) => (
            <section key={section.category}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: designSystem.spacing.md,
                  marginBottom: designSystem.spacing.sm,
                  padding: isMobile ? '0 2px' : '0 4px',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: getFontSize('h3', isMobile),
                    fontWeight: 650,
                    color: designSystem.colors.text.primary,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {section.label}
                </h3>
                <span
                  style={{
                    fontSize: getFontSize('caption', isMobile),
                    color: designSystem.colors.text.secondary,
                  }}
                >
                  {section.people.length} 人
                </span>
              </div>

              <div
                style={{
                  background: designSystem.colors.background.card,
                  borderRadius: designSystem.borderRadius.xl,
                  boxShadow: designSystem.shadows.sm,
                  overflow: 'hidden',
                }}
              >
                {!isMobile ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: designSystem.spacing.md,
                      padding: '12px 20px',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                      fontSize: getFontSize('caption', isMobile),
                      color: designSystem.colors.text.secondary,
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                    }}
                  >
                    <div>會員</div>
                    <div style={{ textAlign: 'right', minWidth: 96 }}>剩餘</div>
                  </div>
                ) : null}

                {section.people.map((person, index) => (
                  <button
                    key={`${section.category}-${person.memberId}`}
                    type="button"
                    data-track="voucher_year_open_member"
                    onClick={() =>
                      onOpenMember({
                        id: person.memberId,
                        nickname: person.nickname,
                        name: person.name,
                        category: section.category,
                      })
                    }
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: designSystem.spacing.md,
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: isMobile ? '14px 16px' : '14px 20px',
                      borderTop:
                        index === 0
                          ? undefined
                          : `1px solid ${designSystem.colors.border.light}`,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: getFontSize('bodyLarge', isMobile),
                          fontWeight: 650,
                          color: designSystem.colors.text.primary,
                        }}
                      >
                        {person.nickname}
                      </div>
                      {person.name && person.name !== person.nickname ? (
                        <div
                          style={{
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                            marginTop: 2,
                          }}
                        >
                          {person.name}
                        </div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: getFontSize('bodyLarge', isMobile),
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                        color: designSystem.colors.text.primary,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAmount(section.category, person.remaining)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && yearFilter !== null && sections.length > 0 ? (
        <p
          style={{
            margin: `${designSystem.spacing.lg} 0 0`,
            fontSize: getFontSize('caption', isMobile),
            color: designSystem.colors.text.secondary,
          }}
        >
          {yearFilter} 年｜{totalPeople} 位會員
        </p>
      ) : null}
    </div>
  )
}
