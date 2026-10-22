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
import { ClearableSearchInput, HighlightedText } from '../../components/ui'
import {
  designSystem,
  getBookingChoiceStyle,
  getEmptyStateStyle,
  getFontSize,
} from '../../styles/designSystem'
import {
  getVoucherPackageYearOverview,
  VOUCHER_PACKAGE_YEAR,
  type VoucherPackageCategory,
  type VoucherPackageOverviewRow,
} from '../../lib/voucherPackages'
import type { BoatVoucherCategory } from '../../lib/boatVoucherConversions'

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
  voucherYear?: number
}

interface PersonRemaining {
  memberId: string
  nickname: string
  name: string
  remaining: number
  packageSummary?: VoucherPackageOverviewRow
}

type SortMode = 'remaining_desc' | 'remaining_asc'

interface VoucherYearBalancePanelProps {
  onOpenMember: (member: YearBalanceMemberRef) => void
  onOpenPackage: (target: {
    member: YearBalanceMemberRef
    voucherYear: number
    category: VoucherPackageCategory
  }) => void
  onConvert: (target: {
    member: YearBalanceMemberRef
    voucherYear: number
    category: BoatVoucherCategory
  }) => void
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

export function VoucherYearBalancePanel({
  onOpenMember,
  onOpenPackage,
  onConvert,
  refreshKey = 0,
}: VoucherYearBalancePanelProps) {
  const { isMobile } = useResponsive()
  const [initialPreferences] = useState(loadPreferences)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lots, setLots] = useState<LotRow[]>([])
  const [packageRows, setPackageRows] = useState<VoucherPackageOverviewRow[]>([])
  const [yearFilter, setYearFilter] = useState<number | null>(initialPreferences.year ?? null)
  const [sortMode, setSortMode] = useState<SortMode>(
    initialPreferences.sortMode === 'remaining_asc' ? 'remaining_asc' : 'remaining_desc'
  )
  const [searchTerm, setSearchTerm] = useState('')

  const loadLots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lotsResult, packageOverview] = await Promise.all([
        supabase
          .from('credit_lots')
          .select(
            `
          member_id,
          category,
          voucher_year,
          remaining,
          members:member_id ( id, nickname, name )
        `,
          )
          .order('voucher_year', { ascending: true }),
        getVoucherPackageYearOverview(VOUCHER_PACKAGE_YEAR).catch((packageError) => {
          console.warn('載入方案摘要失敗，保留原年度餘額畫面:', packageError)
          return []
        }),
      ])

      if (lotsResult.error) throw lotsResult.error
      setLots((lotsResult.data || []) as unknown as LotRow[])
      setPackageRows(packageOverview)
    } catch (err) {
      console.error('載入年度細帳失敗:', err)
      setError('載入年度細帳失敗')
      setLots([])
      setPackageRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadLots()
  }, [loadLots, refreshKey])

  const availableYears = useMemo(() => {
    const years = new Set(lots.map((l) => l.voucher_year))
    if (packageRows.length > 0) years.add(VOUCHER_PACKAGE_YEAR)
    return [...years].sort((a, b) => a - b)
  }, [lots, packageRows])

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
    const yearPackageRows =
      yearFilter === VOUCHER_PACKAGE_YEAR ? packageRows : []

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

      for (const packageRow of yearPackageRows) {
        if (packageRow.category !== category) continue
        const nickname = packageRow.display_name || packageRow.name || '—'
        const name = packageRow.name || ''
        if (q) {
          const hay = `${nickname} ${name}`.toLowerCase()
          if (!hay.includes(q)) continue
        }
        const existing = peopleMap.get(packageRow.member_id)
        peopleMap.set(packageRow.member_id, {
          memberId: packageRow.member_id,
          nickname: existing?.nickname || nickname,
          name: existing?.name || name,
          remaining: existing?.remaining || 0,
          packageSummary: packageRow,
        })
      }

      const people = [...peopleMap.values()].sort((a, b) => {
        const remainingComparison = a.remaining - b.remaining
        if (remainingComparison !== 0) {
          return sortMode === 'remaining_asc' ? remainingComparison : -remainingComparison
        }
        return a.nickname.localeCompare(b.nickname, 'zh-Hant')
      })

      const books10 = people.reduce(
        (total, person) => total + Number(person.packageSummary?.books_10h || 0),
        0,
      )
      const books20 = people.reduce(
        (total, person) => total + Number(person.packageSummary?.books_20h || 0),
        0,
      )

      return {
        category,
        label: CATEGORY_LABEL[category],
        people,
        books10,
        books20,
      }
    }).filter((section) => section.people.length > 0)
  }, [lots, packageRows, yearFilter, searchTerm, sortMode])

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
        <ClearableSearchInput
          value={searchTerm}
          onValueChange={setSearchTerm}
          isMobile={isMobile}
          placeholder="搜尋會員（姓名、暱稱）"
          aria-label="搜尋會員餘額"
          clearDataTrack="voucher_year_search_clear"
        />
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
                  {section.books10 > 0 || section.books20 > 0
                    ? [
                        section.books10 > 0 ? `10小時 ${section.books10}本` : '',
                        section.books20 > 0 ? `20小時 ${section.books20}本` : '',
                      ].filter(Boolean).join(' · ')
                    : `${section.people.length} 人`}
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
                      gridTemplateColumns: '1fr auto minmax(72px, auto)',
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

                {section.people.map((person, index) => {
                  const canConvert =
                    section.category !== 'vip_voucher' && person.remaining !== 0
                  const openDetail = () => {
                    const memberRef = {
                      id: person.memberId,
                      nickname: person.nickname,
                      name: person.name,
                      category: section.category,
                      voucherYear: yearFilter ?? undefined,
                    }
                    if (
                      yearFilter === VOUCHER_PACKAGE_YEAR &&
                      person.packageSummary &&
                      section.category !== 'vip_voucher'
                    ) {
                      onOpenPackage({
                        member: memberRef,
                        voucherYear: yearFilter,
                        category: section.category,
                      })
                    } else {
                      onOpenMember(memberRef)
                    }
                  }

                  return (
                  <div
                    key={`${section.category}-${person.memberId}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto minmax(72px, auto)',
                      alignItems: 'center',
                      width: '100%',
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
                    <button
                      type="button"
                      data-track="voucher_year_open_member"
                      aria-label={`查看 ${person.nickname} 的${section.label}餘額明細`}
                      title="查看會員餘額明細"
                      onClick={openDetail}
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
                        gridColumn: canConvert ? '1 / 3' : '1 / 4',
                        display: 'grid',
                        gridTemplateColumns: canConvert ? '1fr auto' : '1fr auto 16px',
                        gap: designSystem.spacing.md,
                        alignItems: 'center',
                        width: '100%',
                        minHeight: 64,
                        padding: isMobile ? '14px 16px' : '14px 20px',
                        border: 'none',
                        background: 'transparent',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
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
                        <HighlightedText text={person.nickname} query={searchTerm} />
                      </div>
                      {person.name && person.name !== person.nickname ? (
                        <div
                          style={{
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                            marginTop: 2,
                          }}
                        >
                          <HighlightedText text={person.name} query={searchTerm} />
                        </div>
                      ) : null}
                      {person.packageSummary ? (
                        <div
                          style={{
                            fontSize: getFontSize('bodySmall', isMobile),
                            color: designSystem.colors.text.secondary,
                            marginTop: 4,
                          }}
                        >
                          {[
                            Number(person.packageSummary.books_10h || 0) > 0
                              ? `10小時×${Number(person.packageSummary.books_10h)}`
                              : '',
                            Number(person.packageSummary.books_20h || 0) > 0
                              ? `20小時×${Number(person.packageSummary.books_20h)}`
                              : '',
                            Number(person.packageSummary.board_years_granted || 0) > 0
                              ? `置板 ${Number(person.packageSummary.board_years_applied || 0)}/${Number(person.packageSummary.board_years_granted)}年`
                              : '',
                            Number(person.packageSummary.benefit_minutes_granted || 0) > 0
                              ? `贈送 ${Number(person.packageSummary.benefit_minutes_used || 0)}/${Number(person.packageSummary.benefit_minutes_granted)}分`
                              : '',
                            Number(person.packageSummary.competition_uses_granted || 0) > 0
                              ? `賽事 ${Number(person.packageSummary.competition_uses_used || 0)}/${Number(person.packageSummary.competition_uses_granted)}次`
                              : '',
                          ].filter(Boolean).join(' · ') || '歷史方案明細'}
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
                    {!canConvert ? (
                      <span
                        aria-hidden="true"
                        style={{
                          color: designSystem.colors.text.secondary,
                          fontSize: getFontSize('bodyLarge', isMobile),
                          lineHeight: 1,
                          textAlign: 'center',
                        }}
                      >
                        ›
                      </span>
                    ) : null}
                    </button>
                    {canConvert ? (
                      <button
                        type="button"
                        data-track="voucher_year_convert"
                        onClick={() => {
                          onConvert({
                            member: {
                              id: person.memberId,
                              nickname: person.nickname,
                              name: person.name,
                              category: section.category,
                            },
                            voucherYear: yearFilter!,
                            category: section.category as BoatVoucherCategory,
                          })
                        }}
                        style={{
                          border: `1px solid ${designSystem.colors.primary[500]}`,
                          borderRadius: designSystem.borderRadius.md,
                          background: designSystem.colors.background.card,
                          color: designSystem.colors.primary[600],
                          minHeight: 36,
                          padding: isMobile ? '7px 9px' : '7px 12px',
                          fontSize: getFontSize('button', isMobile),
                          fontWeight: 650,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          marginRight: isMobile ? 16 : 20,
                        }}
                      >
                        {person.remaining > 0 ? '轉儲值' : '補船券'}
                      </button>
                    ) : null}
                  </div>
                  )
                })}
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
