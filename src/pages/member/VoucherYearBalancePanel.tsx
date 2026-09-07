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

type SortMode = 'remaining_desc' | 'remaining_asc'

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

const PREFERENCES_KEY = 'voucher-year-balance-preferences'

interface YearBalancePreferences {
  year?: number
  sortMode?: SortMode
}

function loadPreferences(): YearBalancePreferences {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || '{}') as YearBalancePreferences
  } catch {
    return {}
  }
}

function formatAmount(category: LotCategory, value: number): string {
  if (category === 'vip_voucher') {
    return `$${value.toLocaleString()}`
  }
  return `${value.toLocaleString()}分`
}

export function VoucherYearBalancePanel({ onOpenMember, refreshKey = 0 }: VoucherYearBalancePanelProps) {
  const { isMobile } = useResponsive()
  const [initialPreferences] = useState(loadPreferences)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lots, setLots] = useState<LotRow[]>([])
  const [yearFilter, setYearFilter] = useState<number | null>(initialPreferences.year ?? null)
  const [sortMode, setSortMode] = useState<SortMode>(
    initialPreferences.sortMode === 'remaining_asc' ? 'remaining_asc' : 'remaining_desc'
  )
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ year: yearFilter, sortMode })
    )
  }, [yearFilter, sortMode])

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

        peopleMap.set(lot.member_id, {
          memberId: lot.member_id,
          nickname,
          name,
          remaining,
        })
      }

      const people = [...peopleMap.values()].sort((a, b) => {
        const remainingComparison = a.remaining - b.remaining
        if (remainingComparison !== 0) {
          return sortMode === 'remaining_asc' ? remainingComparison : -remainingComparison
        }
        return a.nickname.localeCompare(b.nickname, 'zh-Hant')
      })

      return { category, label: CATEGORY_LABEL[category], people }
    }).filter((section) => section.people.length > 0)
  }, [lots, yearFilter, searchTerm, sortMode])

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
          年度餘額明細
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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: designSystem.spacing.sm,
            width: isMobile ? '100%' : 'auto',
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
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: designSystem.spacing.sm,
          marginBottom: designSystem.spacing.lg,
        }}
      >
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="搜尋會員（姓名、暱稱）"
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
        <button
          type="button"
          data-track="voucher_year_toggle_sort"
          aria-label={
            sortMode === 'remaining_desc'
              ? '目前餘額由高至低，點擊改為由低至高'
              : '目前餘額由低至高，點擊改為由高至低'
          }
          title={
            sortMode === 'remaining_desc'
              ? '目前由高至低，點擊改為由低至高'
              : '目前由低至高，點擊改為由高至低'
          }
          onClick={() =>
            setSortMode((current) =>
              current === 'remaining_desc' ? 'remaining_asc' : 'remaining_desc'
            )
          }
          style={{
            ...getBookingChoiceStyle(false),
            minWidth: isMobile ? 116 : 148,
            minHeight: 44,
            padding: isMobile ? '10px 12px' : '10px 16px',
            fontSize: getFontSize('button', isMobile),
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: designSystem.shadows.xs,
          }}
        >
          {sortMode === 'remaining_desc' ? '餘額 高→低' : '餘額 低→高'}
        </button>
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
            : searchTerm.trim()
              ? '沒有符合的會員'
              : '此年沒有餘額資料'}
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
                  padding: isMobile ? '8px 2px' : '8px 4px',
                  position: 'sticky',
                  top: isMobile ? 0 : 84,
                  zIndex: 10,
                  background: designSystem.colors.background.main,
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
                }}
              >
                {!isMobile ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 16px',
                      gap: designSystem.spacing.md,
                      padding: '12px 20px',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                      fontSize: getFontSize('caption', isMobile),
                      color: designSystem.colors.text.secondary,
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      position: 'sticky',
                      top: 128,
                      zIndex: 9,
                      background: designSystem.colors.background.card,
                      borderRadius: `${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl} 0 0`,
                    }}
                  >
                    <div>會員</div>
                    <div style={{ textAlign: 'right', minWidth: 96 }}>
                      {section.category === 'vip_voucher' ? '剩餘金額' : '剩餘點數'}
                    </div>
                    <div aria-hidden="true" />
                  </div>
                ) : null}

                {section.people.map((person, index) => (
                  <button
                    key={`${section.category}-${person.memberId}`}
                    type="button"
                    data-track="voucher_year_open_member"
                    aria-label={`查看 ${person.nickname} 的${section.label}餘額明細`}
                    title="查看會員餘額明細"
                    onClick={() =>
                      onOpenMember({
                        id: person.memberId,
                        nickname: person.nickname,
                        name: person.name,
                        category: section.category,
                      })
                    }
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = designSystem.colors.background.hover
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent'
                    }}
                    onFocus={(event) => {
                      event.currentTarget.style.background = designSystem.colors.background.hover
                    }}
                    onBlur={(event) => {
                      event.currentTarget.style.background = 'transparent'
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 16px',
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
                      borderRadius:
                        index === section.people.length - 1
                          ? `0 0 ${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl}`
                          : undefined,
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
                        color:
                          person.remaining < 0
                            ? designSystem.colors.danger[700]
                            : person.remaining === 0
                              ? designSystem.colors.text.secondary
                              : designSystem.colors.text.primary,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatAmount(section.category, person.remaining)}
                    </div>
                    <span
                      aria-hidden="true"
                      style={{
                        color: designSystem.colors.text.secondary,
                        fontSize: getFontSize('bodyLarge', isMobile),
                        lineHeight: 1,
                      }}
                    >
                      ›
                    </span>
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
