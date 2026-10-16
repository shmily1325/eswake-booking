import { useEffect, useMemo, useState } from 'react'
import { designSystem, getButtonStyle, getFontSize } from '../styles/designSystem'
import type { CoachLedgerMetricRow, LedgerLoadStatus } from './coachLedgerTypes'
import {
  fetchProductSalesGroups,
  type SalespersonGroup,
} from '../utils/productSalesData'

interface Props {
  isMobile: boolean
  selectedDate: string
  selectedCoachId: string
  onDataChange?: (rows: CoachLedgerMetricRow[]) => void
  onStatusChange?: (status: LedgerLoadStatus, error?: string) => void
}

function dateRange(value: string): { start: string; end: string } {
  if (value.length === 10) return { start: value, end: value }
  const [year, monthNumber] = value.split('-').map(Number)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  return {
    start: `${value}-01`,
    end: `${value}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function ProductSalesStatistics({
  isMobile,
  selectedDate,
  selectedCoachId,
  onDataChange,
  onStatusChange,
}: Props) {
  const [groups, setGroups] = useState<SalespersonGroup[]>([])
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set())
  const [detailDateSortOrder, setDetailDateSortOrder] = useState<'asc' | 'desc'>('asc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setGroups([])
      setExpandedGroupIds(new Set())
      onDataChange?.([])
      onStatusChange?.('loading')
      try {
        const range = dateRange(selectedDate)
        const coachFilter = selectedCoachId === 'all' ? undefined : selectedCoachId
        const nextGroups = await fetchProductSalesGroups({
          startDate: range.start,
          endDate: range.end,
          coachId: coachFilter,
        })
        if (!cancelled) {
          setGroups(nextGroups)
          setExpandedGroupIds(new Set())
          onDataChange?.(nextGroups.map((group) => ({
            id: group.id,
            name: group.name,
            value: group.total,
            count: group.qty,
          })))
          onStatusChange?.('success')
        }
      } catch (cause) {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : '載入商品銷售失敗'
          setGroups([])
          setError(message)
          onStatusChange?.('error', message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [onDataChange, onStatusChange, reloadToken, selectedCoachId, selectedDate])

  const visibleGroups = groups
  const summary = useMemo(
    () => visibleGroups.reduce(
      (sum, group) => ({ qty: sum.qty + group.qty, total: sum.total + group.total }),
      { qty: 0, total: 0 },
    ),
    [visibleGroups],
  )
  const assignedGroups = visibleGroups.filter((group) => group.id !== 'unassigned')
  const unassignedGroup = visibleGroups.find((group) => group.id === 'unassigned')
  const maxAssignedTotal = Math.max(1, ...assignedGroups.map((group) => group.total))

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <div>
      <h2 style={{
        margin: '0 0 4px',
        fontSize: getFontSize('h3', isMobile),
        fontWeight: 600,
        color: designSystem.colors.text.primary,
      }}>
        商品銷售
      </h2>
      <p style={{
        margin: '0 0 14px',
        fontSize: getFontSize('caption', isMobile),
        color: designSystem.colors.text.disabled,
      }}>
        依結帳日計算
      </p>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          載入中...
        </div>
      ) : error ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ marginBottom: 12, color: designSystem.colors.danger[700] }}>{error}</div>
          <button
            type="button"
            onClick={() => setReloadToken((value) => value + 1)}
            style={getButtonStyle('outline', 'small', isMobile)}
          >
            重新載入
          </button>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: designSystem.colors.text.secondary }}>
          {selectedDate.length === 10 ? '當日無商品銷售' : '當月無商品銷售'}
        </div>
      ) : (
        <>
          <div style={{
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: `1px solid ${designSystem.colors.border.light}`,
            color: designSystem.colors.text.primary,
            fontSize: getFontSize('bodyLarge', isMobile),
            fontWeight: 600,
          }}>
            銷售 ${summary.total.toLocaleString()} 元 · {summary.qty} 件
          </div>

          {assignedGroups.length > 0 && (
            <section style={{
              marginBottom: designSystem.spacing.xl,
              padding: isMobile ? 14 : designSystem.spacing.lg,
              background: designSystem.colors.background.card,
              borderRadius: designSystem.borderRadius.lg,
              border: `1px solid ${designSystem.colors.border.light}`,
            }}>
              <h3 style={{
                margin: `0 0 ${isMobile ? 12 : 16}px`,
                fontSize: getFontSize('h3', isMobile),
                fontWeight: 600,
                color: designSystem.colors.text.primary,
              }}>
                商品銷售對比
              </h3>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: isMobile ? 10 : 12,
              }}>
                {assignedGroups.map((group) => (
                  <div key={`comparison-${group.id}`}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 4,
                    }}>
                      <span style={{
                        minWidth: 0,
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: 600,
                        color: designSystem.colors.text.primary,
                        overflowWrap: 'anywhere',
                      }}>
                        {group.name}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        fontSize: getFontSize('bodySmall', isMobile),
                        color: designSystem.colors.text.secondary,
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        ${group.total.toLocaleString()} ({group.qty}件)
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: isMobile ? 6 : 8,
                      overflow: 'hidden',
                      borderRadius: designSystem.borderRadius.full,
                      background: designSystem.colors.background.hover,
                    }}>
                      <div style={{
                        width: `${(group.total / maxAssignedTotal) * 100}%`,
                        height: '100%',
                        borderRadius: designSystem.borderRadius.full,
                        background: designSystem.colors.primary[500],
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {assignedGroups.length > 0 && (
              <section>
                <h2 style={{
                  margin: '0 0 12px',
                  fontSize: getFontSize('h3', isMobile),
                  fontWeight: 600,
                  color: designSystem.colors.text.primary,
                }}>
                  教練銷售細帳
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.md }}>
                  {assignedGroups.map((group) => (
                    <SalespersonStatRow
                      key={group.id}
                      group={group}
                      isMobile={isMobile}
                      expanded={expandedGroupIds.has(group.id)}
                      showName
                      onToggle={() => toggleGroup(group.id)}
                      dateSortOrder={detailDateSortOrder}
                      onDateSortToggle={() => setDetailDateSortOrder((current) =>
                        current === 'asc' ? 'desc' : 'asc')}
                    />
                  ))}
                </div>
              </section>
            )}

            {unassignedGroup && (
              <section>
                {selectedCoachId === 'all' && (
                  <h3 style={{
                    margin: '0 0 10px',
                    fontSize: getFontSize('bodyLarge', isMobile),
                    color: designSystem.colors.text.primary,
                  }}>
                    未指定
                  </h3>
                )}
                <SalespersonStatRow
                  group={unassignedGroup}
                  isMobile={isMobile}
                  expanded={expandedGroupIds.has(unassignedGroup.id)}
                  showName={false}
                  onToggle={() => toggleGroup(unassignedGroup.id)}
                  dateSortOrder={detailDateSortOrder}
                  onDateSortToggle={() => setDetailDateSortOrder((current) =>
                    current === 'asc' ? 'desc' : 'asc')}
                />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SalespersonStatRow({
  group,
  isMobile,
  expanded,
  showName,
  onToggle,
  dateSortOrder,
  onDateSortToggle,
}: {
  group: SalespersonGroup
  isMobile: boolean
  expanded: boolean
  showName: boolean
  onToggle: () => void
  dateSortOrder: 'asc' | 'desc'
  onDateSortToggle: () => void
}) {
  return (
    <div style={{
      overflow: 'hidden',
      border: expanded
        ? `1px solid ${designSystem.colors.border.dark}`
        : `1px solid ${designSystem.colors.border.light}`,
      borderRadius: designSystem.borderRadius.lg,
      background: designSystem.colors.background.card,
      transition: 'border-color 0.2s',
    }}>
      <button
        type="button"
        data-track={group.id === 'unassigned'
          ? 'product_sales_unassigned_detail_toggle'
          : 'product_sales_coach_detail_toggle'}
        aria-expanded={expanded}
        aria-label={`${expanded ? '收合' : '展開'} ${group.name} 銷售明細`}
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: isMobile ? 8 : 14,
          padding: isMobile ? '12px 14px' : '14px 18px',
          border: 0,
          background: expanded
            ? designSystem.colors.secondary[50]
            : designSystem.colors.background.card,
          color: designSystem.colors.text.primary,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ minWidth: 0 }}>
          {showName && (
            <strong style={{
              display: 'block',
              marginBottom: 5,
              fontSize: getFontSize('body', isMobile),
              overflowWrap: 'anywhere',
            }}>
              {group.name}
            </strong>
          )}
          <span style={{
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
            fontVariantNumeric: 'tabular-nums',
          }}>
            銷售 ${group.total.toLocaleString()} · {group.qty} 件
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              color: designSystem.colors.text.disabled,
              fontSize: getFontSize('caption', isMobile),
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            ▶
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{
          overflowX: 'auto',
          padding: isMobile ? '0 8px 10px' : '0 12px 12px',
          background: designSystem.colors.secondary[50],
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: getFontSize('bodySmall', isMobile),
          }}>
            <thead>
              <tr>
                {['結帳日', '訂單／客人', '商品', '件數', '金額'].map((label, index) => (
                  <th
                    key={label}
                    aria-sort={index === 0
                      ? (dateSortOrder === 'asc' ? 'ascending' : 'descending')
                      : undefined}
                    style={{
                      padding: 8,
                      textAlign: label === '件數' || label === '金額' ? 'right' : 'left',
                      borderBottom: `1px solid ${designSystem.colors.border.light}`,
                      color: designSystem.colors.text.secondary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {index === 0 ? (
                      <button
                        type="button"
                        data-track="product_sales_date_sort"
                        onClick={onDateSortToggle}
                        aria-label={`${label}，目前${dateSortOrder === 'asc' ? '由早到晚' : '由晚到早'}，點擊切換排序`}
                        style={{
                          padding: 0,
                          border: 0,
                          background: 'transparent',
                          color: 'inherit',
                          font: 'inherit',
                          cursor: 'pointer',
                        }}
                      >
                        {label} {dateSortOrder === 'asc' ? '↑' : '↓'}
                      </button>
                    ) : label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...group.details]
                .sort((a, b) => {
                  const comparison = a.date.localeCompare(b.date)
                  return dateSortOrder === 'asc' ? comparison : -comparison
                })
                .map((detail) => (
                <tr key={detail.id}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{detail.date}</td>
                  <td style={{ padding: 8 }}>
                    <div>{detail.orderNo}</div>
                    <div style={{ color: designSystem.colors.text.secondary }}>
                      {detail.customerName}
                    </div>
                  </td>
                  <td style={{ padding: 8 }}>{detail.productName}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{detail.qty}</td>
                  <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ${detail.total.toLocaleString()}
                  </td>
                </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
