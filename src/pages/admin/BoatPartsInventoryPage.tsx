import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { PageHeader } from '../../components/PageHeader'
import { PageShell } from '../../components/PageShell'
import { Footer } from '../../components/Footer'
import { Modal } from '../../components/ui/Modal'
import { ToastContainer, useToast } from '../../components/ui'
import { useResponsive } from '../../hooks/useResponsive'
import {
  designSystem,
  getButtonStyle,
  getCardStyle,
  getFilterChipStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../../styles/designSystem'
import { canAccessBoatOperations } from '../../utils/boatOperationsAccess'
import { formatDateTime } from '../../utils/formatters'
import {
  applyBoatPartMovement,
  loadBoatPartMovementLedger,
  loadBoatPartMovements,
  loadBoatParts,
  type BoatCode,
  type BoatPart,
  type BoatPartMovement,
  type BoatPartMovementType,
} from './boatPartsApi'

type StockFilter = 'all' | 'low' | 'out'
type InventoryView = 'inventory' | 'inbound' | 'outbound'

const BOAT_OPTIONS: Array<{ value: BoatCode; label: string }> = [
  { value: 'FI23', label: '黑豹（FI23）' },
  { value: 'G21', label: 'G21' },
  { value: 'G23', label: 'G23' },
  { value: 'ALL', label: '共用／全部船艇' },
]

function stockState(part: BoatPart): 'normal' | 'low' | 'out' {
  if (part.current_quantity <= 0) return 'out'
  if (part.safety_quantity > 0 && part.current_quantity <= part.safety_quantity) return 'low'
  return 'normal'
}

function stockStateLabel(part: BoatPart): string {
  const state = stockState(part)
  if (state === 'out') return '斷貨'
  if (state === 'low') return '需補貨'
  return '正常'
}

function stockStateStyle(part: BoatPart): CSSProperties {
  const state = stockState(part)
  const palette =
    state === 'out'
      ? designSystem.colors.danger
      : state === 'low'
        ? designSystem.colors.warning
        : designSystem.colors.success
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${designSystem.spacing.xs} ${designSystem.spacing.sm}`,
    borderRadius: designSystem.borderRadius.full,
    background: palette[50],
    color: palette[700],
    fontSize: designSystem.fontSize.caption.mobile,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(value)
}

function formatMovementDate(value: string): string {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function compatibleBoatLabel(code: BoatCode): string {
  if (code === 'FI23') return '黑豹（FI23）'
  if (code === 'ALL') return '全部船艇'
  return code
}

function movementLabel(type: BoatPartMovementType): string {
  if (type === 'inbound') return '進貨'
  if (type === 'outbound') return '領用'
  return '盤點調整'
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/insufficient inventory/i.test(message)) return '庫存不足，無法完成領用'
  if (/not allowed|permission|42501/i.test(message)) return '你沒有操作零件庫存的權限'
  return '操作失敗，請稍後再試'
}

export function BoatPartsInventoryPage() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  const [parts, setParts] = useState<BoatPart[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [activeView, setActiveView] = useState<InventoryView>('inventory')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [boatFilter, setBoatFilter] = useState<'all' | BoatCode>('all')
  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<BoatPartMovementType>('inbound')
  const [movementPart, setMovementPart] = useState<BoatPart | null>(null)
  const [detailPart, setDetailPart] = useState<BoatPart | null>(null)
  const [movements, setMovements] = useState<BoatPartMovement[]>([])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextParts, nextMovements] = await Promise.all([
        loadBoatParts(),
        loadBoatPartMovementLedger(),
      ])
      setParts(nextParts)
      setMovements(nextMovements)
    } catch (error) {
      console.error(error)
      setLoadError('零件資料尚未就緒或載入失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshMovements = useCallback(async () => {
    try {
      setMovements(await loadBoatPartMovementLedger())
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => {
    if (user && canAccessBoatOperations(user)) void refresh()
  }, [refresh, user])

  const categories = useMemo(
    () =>
      Array.from(new Set(parts.map(part => part.category || '未分類'))).sort((a, b) =>
        a.localeCompare(b, 'zh-TW'),
      ),
    [parts],
  )

  const summary = useMemo(() => {
    const out = parts.filter(part => stockState(part) === 'out').length
    const low = parts.filter(part => stockState(part) === 'low').length
    const value = parts.reduce(
      (total, part) => total + (part.unit_price ?? 0) * part.current_quantity,
      0,
    )
    return { out, low, value }
  }, [parts])

  const filteredParts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return parts.filter(part => {
      if (normalizedQuery) {
        const haystack = [
          part.part_no,
          part.name,
          part.brand,
          part.category,
          part.storage_location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(normalizedQuery)) return false
      }
      if (stockFilter !== 'all' && stockState(part) !== stockFilter) return false
      if (categoryFilter !== 'all' && (part.category || '未分類') !== categoryFilter) {
        return false
      }
      if (boatFilter !== 'all' && !part.compatible_boats.includes(boatFilter)) return false
      return true
    }).sort((a, b) => {
      const rank = { out: 0, low: 1, normal: 2 }
      return rank[stockState(a)] - rank[stockState(b)] || a.name.localeCompare(b.name, 'zh-TW')
    })
  }, [boatFilter, categoryFilter, parts, query, stockFilter])

  const partsById = useMemo(
    () => new Map(parts.map(part => [part.id, part])),
    [parts],
  )

  const filteredMovements = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const movementType = activeView === 'inbound' ? 'inbound' : 'outbound'
    return movements.filter(movement => {
      if (movement.movement_type !== movementType) return false
      if (!normalizedQuery) return true
      const part = partsById.get(movement.part_id)
      return [
        part?.part_no,
        part?.name,
        movement.note,
        movement.boat_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [activeView, movements, partsById, query])

  if (!canAccessBoatOperations(user)) {
    return <Navigate to="/unauthorized" replace />
  }

  const openMovement = (type: BoatPartMovementType, part: BoatPart | null = null) => {
    setMovementType(type)
    setMovementPart(part)
    setMovementOpen(true)
  }

  const syncPartQuantity = (partId: string, currentQuantity: number) => {
    setParts(current =>
      current.map(part =>
        part.id === partId ? { ...part, current_quantity: currentQuantity } : part,
      ),
    )
    setDetailPart(current =>
      current?.id === partId ? { ...current, current_quantity: currentQuantity } : current,
    )
  }

  return (
    <PageShell
      variant="wide"
      mobilePadding="12px 16px"
      desktopPadding="20px 24px"
      outerStyle={{ paddingBottom: '80px' }}
    >
      <PageHeader title="船艇零件庫存" user={user} />

      <section
        style={{
          ...getCardStyle(isMobile),
          padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: designSystem.spacing.lg,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: designSystem.spacing.sm,
                marginBottom: designSystem.spacing.xs,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  color: designSystem.colors.text.primary,
                  fontSize: getFontSize('h2', isMobile),
                  letterSpacing: '-0.02em',
                }}
              >
                庫存總覽
              </h1>
              <span
                style={{
                  padding: `${designSystem.spacing.xs} ${designSystem.spacing.sm}`,
                  borderRadius: designSystem.borderRadius.full,
                  background: designSystem.colors.background.hover,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('caption', isMobile),
                  fontWeight: 600,
                }}
              >
                Demo
              </span>
            </div>
            <p
              style={{
                margin: 0,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
                lineHeight: 1.6,
              }}
            >
              {parts.length} 種零件 · {summary.low} 種需補貨 · {summary.out} 種斷貨 ·
              庫存金額 {formatNumber(summary.value)}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: designSystem.spacing.sm,
              minWidth: isMobile ? undefined : '220px',
            }}
          >
            <button
              type="button"
              onClick={() => openMovement('inbound')}
              style={{
                ...getButtonStyle('secondary', 'large', isMobile),
                minHeight: isMobile ? '48px' : undefined,
              }}
            >
              進貨
            </button>
            <button
              type="button"
              onClick={() => openMovement('outbound')}
              style={{
                ...getButtonStyle('primary', 'large', isMobile),
                minHeight: isMobile ? '48px' : undefined,
              }}
            >
              領用
            </button>
          </div>
        </div>
      </section>

      <nav
        aria-label="庫存資料表"
        style={{
          ...getCardStyle(isMobile),
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          padding: designSystem.spacing.xs,
          gap: designSystem.spacing.xs,
        }}
      >
        {([
          ['inventory', '庫存總表'],
          ['inbound', '進貨紀錄'],
          ['outbound', '領用紀錄'],
        ] as const).map(([view, label]) => (
          <button
            key={view}
            type="button"
            onClick={() => {
              setActiveView(view)
              setQuery('')
            }}
            style={{
              ...getButtonStyle(activeView === view ? 'primary' : 'outline', 'medium', isMobile),
              borderColor: activeView === view ? undefined : 'transparent',
              boxShadow: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <section
        aria-label="庫存篩選"
        style={{
          ...getCardStyle(isMobile),
          padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl,
        }}
      >
        <label style={{ ...getLabelStyle(isMobile), display: 'block' }}>
          {activeView === 'inventory' ? '搜尋料號、品名或儲位' : '搜尋料號、品名或備註'}
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={activeView === 'inventory' ? '例如 302345、浪板馬達' : '輸入關鍵字搜尋紀錄'}
            style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
          />
        </label>

        {activeView === 'inventory' && (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: designSystem.spacing.sm,
                marginTop: designSystem.spacing.lg,
              }}
            >
              {([
                ['all', `全部 ${parts.length}`],
                ['low', `需補貨 ${summary.low}`],
                ['out', `斷貨 ${summary.out}`],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStockFilter(value)}
                  style={{
                    ...getFilterChipStyle(stockFilter === value, value === 'all' ? 'info' : 'warning'),
                    padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
                    fontSize: getFontSize('button', isMobile),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: designSystem.spacing.md,
                marginTop: designSystem.spacing.lg,
              }}
            >
              <label style={getLabelStyle(isMobile)}>
                分類
                <select
                  value={categoryFilter}
                  onChange={event => setCategoryFilter(event.target.value)}
                  style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
                >
                  <option value="all">全部分類</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label style={getLabelStyle(isMobile)}>
                適用船艇
                <select
                  value={boatFilter}
                  onChange={event => setBoatFilter(event.target.value as 'all' | BoatCode)}
                  style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
                >
                  <option value="all">全部船艇</option>
                  {BOAT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </section>

      <section
        style={{
          ...getCardStyle(isMobile),
          padding: isMobile ? designSystem.spacing.md : designSystem.spacing.xl,
        }}
      >
        {loading && (
          <p style={{ color: designSystem.colors.text.secondary, textAlign: 'center' }}>
            載入中...
          </p>
        )}
        {loadError && (
          <div
            role="alert"
            style={{
              padding: designSystem.spacing.lg,
              borderRadius: designSystem.borderRadius.lg,
              background: designSystem.colors.danger[50],
              color: designSystem.colors.danger[700],
              textAlign: 'center',
            }}
          >
            {loadError}
            <button
              type="button"
              onClick={() => void refresh()}
              style={{ ...getButtonStyle('outline', 'small', isMobile), marginLeft: designSystem.spacing.md }}
            >
              重試
            </button>
          </div>
        )}
        {!loading && !loadError && activeView === 'inventory' && (
          <InventoryTable
            parts={filteredParts}
            isMobile={isMobile}
            onDetail={setDetailPart}
            onMovement={openMovement}
          />
        )}
        {!loading && !loadError && activeView !== 'inventory' && (
          <MovementLedgerTable
            type={activeView}
            movements={filteredMovements}
            partsById={partsById}
            isMobile={isMobile}
          />
        )}
      </section>

      <MovementModal
        isOpen={movementOpen}
        initialType={movementType}
        initialPart={movementPart}
        parts={parts}
        isMobile={isMobile}
        onClose={() => {
          setMovementOpen(false)
          setMovementPart(null)
        }}
        onSaved={(partId, currentQuantity, type) => {
          syncPartQuantity(partId, currentQuantity)
          void refreshMovements()
          if (type === 'inbound') setActiveView('inbound')
          if (type === 'outbound') setActiveView('outbound')
          setMovementOpen(false)
          setMovementPart(null)
          toast.success(`${movementLabel(type)}已完成，目前庫存 ${currentQuantity}`)
        }}
      />

      <PartDetailModal
        part={detailPart}
        isMobile={isMobile}
        onClose={() => setDetailPart(null)}
        onMovement={type => {
          if (!detailPart) return
          setDetailPart(null)
          openMovement(type, detailPart)
        }}
      />

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      <Footer />
    </PageShell>
  )
}

function InventoryTable({
  parts,
  isMobile,
  onDetail,
  onMovement,
}: {
  parts: BoatPart[]
  isMobile: boolean
  onDetail: (part: BoatPart) => void
  onMovement: (type: BoatPartMovementType, part: BoatPart | null) => void
}) {
  const title = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: designSystem.spacing.md,
      }}
    >
      <h2 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>庫存總表</h2>
      <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
        {parts.length} 筆
      </span>
    </div>
  )

  if (parts.length === 0) {
    return (
      <>
        {title}
        <p style={{ padding: designSystem.spacing.xxl, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
          找不到符合條件的零件
        </p>
      </>
    )
  }

  if (isMobile) {
    return (
      <>
        {title}
        {parts.map(part => (
          <article
            key={part.id}
            style={{
              padding: `${designSystem.spacing.lg} ${designSystem.spacing.xs}`,
              borderTop: `1px solid ${designSystem.colors.border.light}`,
            }}
          >
            <button
              type="button"
              onClick={() => onDetail(part)}
              style={{
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: designSystem.colors.text.primary,
                textAlign: 'left',
              }}
            >
              <strong style={{ display: 'block', fontSize: getFontSize('body', true) }}>{part.name}</strong>
              <span
                style={{
                  display: 'block',
                  marginTop: designSystem.spacing.xs,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('caption', true),
                }}
              >
                {part.part_no || '待補料號'} · {part.storage_location || '未填儲位'}
              </span>
            </button>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: designSystem.spacing.sm,
                marginTop: designSystem.spacing.md,
              }}
            >
              <div>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', true) }}>
                  庫存{' '}
                </span>
                <strong style={{ fontSize: getFontSize('h3', true), fontVariantNumeric: 'tabular-nums' }}>
                  {part.current_quantity}
                </strong>
                {stockState(part) !== 'normal' && (
                  <span style={{ ...stockStateStyle(part), marginLeft: designSystem.spacing.sm }}>
                    {stockStateLabel(part)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: designSystem.spacing.sm }}>
                <button
                  type="button"
                  onClick={() => onMovement('inbound', part)}
                  style={getButtonStyle('outline', 'small', true)}
                >
                  進貨
                </button>
                <button
                  type="button"
                  onClick={() => onMovement('outbound', part)}
                  style={getButtonStyle('primary', 'small', true)}
                >
                  領用
                </button>
              </div>
            </div>
          </article>
        ))}
      </>
    )
  }

  const headerStyle: CSSProperties = {
    padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
    color: designSystem.colors.text.secondary,
    fontSize: getFontSize('bodySmall', false),
    fontWeight: 600,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    borderBottom: `1px solid ${designSystem.colors.border.main}`,
  }
  const cellStyle: CSSProperties = {
    padding: `${designSystem.spacing.md}`,
    borderBottom: `1px solid ${designSystem.colors.border.light}`,
    verticalAlign: 'middle',
  }

  return (
    <>
      {title}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
          <thead style={{ background: designSystem.colors.background.main }}>
            <tr>
              <th style={headerStyle}>料號／品名</th>
              <th style={headerStyle}>分類</th>
              <th style={headerStyle}>儲位</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>庫存</th>
              <th style={headerStyle}>狀態</th>
              <th style={{ ...headerStyle, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {parts.map(part => (
              <tr key={part.id}>
                <td style={cellStyle}>
                  <button
                    type="button"
                    onClick={() => onDetail(part)}
                    style={{
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      color: designSystem.colors.text.primary,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'block', fontWeight: 600 }}>{part.name}</span>
                    <span
                      style={{
                        display: 'block',
                        marginTop: '2px',
                        color: part.part_no
                          ? designSystem.colors.text.secondary
                          : designSystem.colors.warning[700],
                        fontSize: getFontSize('caption', false),
                      }}
                    >
                      {part.part_no || '待補料號'}
                    </span>
                  </button>
                </td>
                <td style={cellStyle}>{part.category || '未分類'}</td>
                <td style={{ ...cellStyle, color: designSystem.colors.text.secondary }}>
                  {part.storage_location || '未填'}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: getFontSize('h3', false),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {part.current_quantity}
                </td>
                <td style={cellStyle}>
                  {stockState(part) === 'normal' ? (
                    <span style={{ color: designSystem.colors.text.secondary }}>正常</span>
                  ) : (
                    <span style={stockStateStyle(part)}>{stockStateLabel(part)}</span>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    type="button"
                    onClick={() => onMovement('inbound', part)}
                    style={{ ...getButtonStyle('outline', 'small', false), marginRight: designSystem.spacing.sm }}
                  >
                    進貨
                  </button>
                  <button
                    type="button"
                    onClick={() => onMovement('outbound', part)}
                    style={getButtonStyle('primary', 'small', false)}
                  >
                    領用
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function MovementLedgerTable({
  type,
  movements,
  partsById,
  isMobile,
}: {
  type: 'inbound' | 'outbound'
  movements: BoatPartMovement[]
  partsById: Map<string, BoatPart>
  isMobile: boolean
}) {
  const isInbound = type === 'inbound'
  const title = isInbound ? '進貨紀錄' : '領用紀錄'

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: designSystem.spacing.md,
        }}
      >
        <h2 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>{title}</h2>
        <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
          {movements.length} 筆
        </span>
      </div>

      {movements.length === 0 && (
        <p style={{ padding: designSystem.spacing.xxl, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
          找不到符合條件的紀錄
        </p>
      )}

      {isMobile &&
        movements.map(movement => {
          const part = partsById.get(movement.part_id)
          return (
            <article
              key={movement.id}
              style={{
                padding: `${designSystem.spacing.lg} ${designSystem.spacing.xs}`,
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: designSystem.spacing.md }}>
                <div>
                  <strong>{part?.name || '未知零件'}</strong>
                  <div
                    style={{
                      marginTop: designSystem.spacing.xs,
                      color: designSystem.colors.text.secondary,
                      fontSize: getFontSize('caption', true),
                    }}
                  >
                    {part?.part_no || '待補料號'} · {formatMovementDate(movement.moved_at)}
                  </div>
                </div>
                <strong style={{ fontSize: getFontSize('h3', true), fontVariantNumeric: 'tabular-nums' }}>
                  {Math.abs(movement.quantity)}
                </strong>
              </div>
              {!isInbound && movement.boat_code && (
                <div style={{ marginTop: designSystem.spacing.sm }}>
                  使用船艇：{compatibleBoatLabel(movement.boat_code)}
                </div>
              )}
              <div
                style={{
                  marginTop: designSystem.spacing.sm,
                  color: designSystem.colors.text.secondary,
                  fontSize: getFontSize('bodySmall', true),
                }}
              >
                {movement.note || (movement.affects_inventory ? '無備註' : 'Excel 歷史紀錄')}
              </div>
            </article>
          )
        })}

      {!isMobile && movements.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
            <thead style={{ background: designSystem.colors.background.main }}>
              <tr>
                {['日期', '料號', '品名', isInbound ? '進貨數量' : '領用數量', ...(isInbound ? [] : ['使用船艇']), '備註'].map(
                  heading => (
                    <th
                      key={heading}
                      style={{
                        padding: `${designSystem.spacing.sm} ${designSystem.spacing.md}`,
                        color: designSystem.colors.text.secondary,
                        fontSize: getFontSize('bodySmall', false),
                        fontWeight: 600,
                        textAlign: heading.includes('數量') ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                        borderBottom: `1px solid ${designSystem.colors.border.main}`,
                      }}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {movements.map(movement => {
                const part = partsById.get(movement.part_id)
                const cellStyle: CSSProperties = {
                  padding: designSystem.spacing.md,
                  borderBottom: `1px solid ${designSystem.colors.border.light}`,
                }
                return (
                  <tr key={movement.id}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{formatMovementDate(movement.moved_at)}</td>
                    <td style={{ ...cellStyle, color: designSystem.colors.text.secondary }}>
                      {part?.part_no || '待補料號'}
                    </td>
                    <td style={{ ...cellStyle, fontWeight: 600 }}>{part?.name || '未知零件'}</td>
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: 'right',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {Math.abs(movement.quantity)}
                    </td>
                    {!isInbound && (
                      <td style={cellStyle}>
                        {movement.boat_code ? compatibleBoatLabel(movement.boat_code) : '未指定'}
                      </td>
                    )}
                    <td style={{ ...cellStyle, color: designSystem.colors.text.secondary }}>
                      {movement.note || (movement.affects_inventory ? '—' : 'Excel 歷史紀錄')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function MovementModal({
  isOpen,
  initialType,
  initialPart,
  parts,
  isMobile,
  onClose,
  onSaved,
}: {
  isOpen: boolean
  initialType: BoatPartMovementType
  initialPart: BoatPart | null
  parts: BoatPart[]
  isMobile: boolean
  onClose: () => void
  onSaved: (partId: string, currentQuantity: number, type: BoatPartMovementType) => void
}) {
  const [type, setType] = useState<BoatPartMovementType>(initialType)
  const [selectedPart, setSelectedPart] = useState<BoatPart | null>(initialPart)
  const [partQuery, setPartQuery] = useState('')
  const [quantity, setQuantity] = useState('')
  const [boatCode, setBoatCode] = useState<'' | BoatCode>('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setType(initialType)
    setSelectedPart(initialPart)
    setPartQuery('')
    setQuantity('')
    setBoatCode('')
    setNote('')
    setFormError(null)
  }, [initialPart, initialType, isOpen])

  const matchingParts = useMemo(() => {
    const normalized = partQuery.trim().toLowerCase()
    if (!normalized || selectedPart) return []
    return parts
      .filter(part =>
        [part.part_no, part.name, part.storage_location]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 8)
  }, [partQuery, parts, selectedPart])

  const parsedQuantity = Number(quantity)
  const adjustmentDelta =
    type === 'adjustment' && selectedPart && Number.isInteger(parsedQuantity)
      ? parsedQuantity - selectedPart.current_quantity
      : parsedQuantity
  const projectedQuantity =
    selectedPart && Number.isInteger(parsedQuantity)
      ? type === 'inbound'
        ? selectedPart.current_quantity + parsedQuantity
        : type === 'outbound'
          ? selectedPart.current_quantity - parsedQuantity
          : parsedQuantity
      : null

  const submit = async () => {
    if (!selectedPart) {
      setFormError('請先選擇零件')
      return
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 0 || (type !== 'adjustment' && parsedQuantity < 1)) {
      setFormError(type === 'adjustment' ? '請輸入有效的盤點後數量' : '數量至少為 1')
      return
    }
    if (type === 'adjustment' && adjustmentDelta === 0) {
      setFormError('盤點後數量與目前庫存相同')
      return
    }
    if (projectedQuantity !== null && projectedQuantity < 0) {
      setFormError('領用數量不能超過目前庫存')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const result = await applyBoatPartMovement({
        partId: selectedPart.id,
        movementType: type,
        quantity: type === 'adjustment' ? adjustmentDelta : parsedQuantity,
        boatCode: boatCode || null,
        note,
      })
      onSaved(selectedPart.id, result.current_quantity, type)
    } catch (error) {
      console.error(error)
      setFormError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={movementLabel(type)}
      size="medium"
      closeOnOverlayClick={!submitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={getButtonStyle('outline', 'large', isMobile)}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            style={{
              ...getButtonStyle('primary', 'large', isMobile),
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? '儲存中...' : `確認${movementLabel(type)}`}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.lg }}>
        <div
          role="group"
          aria-label="異動類型"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: designSystem.spacing.sm,
          }}
        >
          {(['inbound', 'outbound', 'adjustment'] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              style={{
                ...getFilterChipStyle(type === option),
                padding: `${designSystem.spacing.md} ${designSystem.spacing.sm}`,
                fontSize: getFontSize('button', isMobile),
              }}
            >
              {movementLabel(option)}
            </button>
          ))}
        </div>

        <div>
          <label style={getLabelStyle(isMobile)}>料號或品名</label>
          {selectedPart ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: designSystem.spacing.md,
                padding: designSystem.spacing.md,
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.background.main,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong>{selectedPart.name}</strong>
                <div
                  style={{
                    color: designSystem.colors.text.secondary,
                    fontSize: getFontSize('bodySmall', isMobile),
                    marginTop: designSystem.spacing.xs,
                  }}
                >
                  {selectedPart.part_no || '待補料號'} · 目前庫存 {selectedPart.current_quantity}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPart(null)}
                style={getButtonStyle('outline', 'small', isMobile)}
              >
                更換
              </button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                autoFocus
                type="search"
                value={partQuery}
                onChange={event => setPartQuery(event.target.value)}
                placeholder="輸入料號或品名搜尋"
                style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
              />
              {partQuery.trim() && (
                <div
                  style={{
                    marginTop: designSystem.spacing.sm,
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderRadius: designSystem.borderRadius.lg,
                    overflow: 'hidden',
                  }}
                >
                  {matchingParts.length === 0 ? (
                    <div
                      style={{
                        padding: designSystem.spacing.md,
                        color: designSystem.colors.text.secondary,
                      }}
                    >
                      找不到零件
                    </div>
                  ) : (
                    matchingParts.map(part => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => setSelectedPart(part)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: designSystem.spacing.md,
                          padding: designSystem.spacing.md,
                          border: 'none',
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          background: '#ffffff',
                          color: designSystem.colors.text.primary,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <span>
                          <strong>{part.name}</strong>
                          <span
                            style={{
                              display: 'block',
                              color: designSystem.colors.text.secondary,
                              fontSize: getFontSize('caption', isMobile),
                              marginTop: designSystem.spacing.xs,
                            }}
                          >
                            {part.part_no || '待補料號'}
                          </span>
                        </span>
                        <span style={{ flexShrink: 0 }}>庫存 {part.current_quantity}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <label style={getLabelStyle(isMobile)}>
          {type === 'adjustment' ? '盤點後數量' : '數量'}
          <input
            type="number"
            min={type === 'adjustment' ? 0 : 1}
            step={1}
            inputMode="numeric"
            value={quantity}
            onChange={event => setQuantity(event.target.value)}
            style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
          />
        </label>

        {selectedPart && projectedQuantity !== null && Number.isFinite(projectedQuantity) && (
          <div
            style={{
              padding: designSystem.spacing.md,
              borderRadius: designSystem.borderRadius.lg,
              background:
                projectedQuantity < 0
                  ? designSystem.colors.danger[50]
                  : designSystem.colors.background.main,
              color:
                projectedQuantity < 0
                  ? designSystem.colors.danger[700]
                  : designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
            }}
          >
            完成後庫存：<strong>{projectedQuantity}</strong>
          </div>
        )}

        {type === 'outbound' && (
          <label style={getLabelStyle(isMobile)}>
            使用船艇（選填）
            <select
              value={boatCode}
              onChange={event => setBoatCode(event.target.value as '' | BoatCode)}
              style={{ ...getInputStyle(isMobile), marginTop: designSystem.spacing.sm }}
            >
              <option value="">未指定</option>
              {BOAT_OPTIONS.filter(option => option.value !== 'ALL').map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={getLabelStyle(isMobile)}>
          備註（選填）
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={3}
            style={{
              ...getInputStyle(isMobile),
              marginTop: designSystem.spacing.sm,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </label>

        {formError && (
          <div
            role="alert"
            style={{
              padding: designSystem.spacing.md,
              borderRadius: designSystem.borderRadius.lg,
              background: designSystem.colors.danger[50],
              color: designSystem.colors.danger[700],
              fontSize: getFontSize('bodySmall', isMobile),
            }}
          >
            {formError}
          </div>
        )}
      </div>
    </Modal>
  )
}

function PartDetailModal({
  part,
  isMobile,
  onClose,
  onMovement,
}: {
  part: BoatPart | null
  isMobile: boolean
  onClose: () => void
  onMovement: (type: BoatPartMovementType) => void
}) {
  const [movements, setMovements] = useState<BoatPartMovement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!part) {
      setMovements([])
      return
    }
    let cancelled = false
    setLoading(true)
    loadBoatPartMovements(part.id)
      .then(data => {
        if (!cancelled) setMovements(data)
      })
      .catch(error => console.error(error))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [part])

  return (
    <Modal
      isOpen={Boolean(part)}
      onClose={onClose}
      title={part?.name}
      size="large"
      footer={
        <>
          <button
            type="button"
            onClick={() => onMovement('adjustment')}
            style={getButtonStyle('outline', 'large', isMobile)}
          >
            盤點
          </button>
          <button
            type="button"
            onClick={() => onMovement('inbound')}
            style={getButtonStyle('secondary', 'large', isMobile)}
          >
            進貨
          </button>
          <button
            type="button"
            onClick={() => onMovement('outbound')}
            style={getButtonStyle('primary', 'large', isMobile)}
          >
            領用
          </button>
        </>
      }
    >
      {part && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.xl }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
              gap: designSystem.spacing.lg,
            }}
          >
            <DetailValue label="料號" value={part.part_no || '待補料號'} isMobile={isMobile} />
            <DetailValue label="目前庫存" value={String(part.current_quantity)} isMobile={isMobile} />
            <DetailValue label="安全數量" value={String(part.safety_quantity)} isMobile={isMobile} />
            <DetailValue label="庫存狀態" value={stockStateLabel(part)} isMobile={isMobile} />
            <DetailValue label="分類" value={part.category || '未分類'} isMobile={isMobile} />
            <DetailValue label="品牌" value={part.brand || '未填'} isMobile={isMobile} />
            <DetailValue label="儲位" value={part.storage_location || '未填'} isMobile={isMobile} />
            <DetailValue
              label="單價"
              value={part.unit_price === null ? '未填' : formatNumber(part.unit_price)}
              isMobile={isMobile}
            />
          </div>

          <div>
            <h3
              style={{
                margin: `0 0 ${designSystem.spacing.md}`,
                fontSize: getFontSize('h3', isMobile),
              }}
            >
              適用船艇
            </h3>
            <div
              style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('body', isMobile),
              }}
            >
              {part.compatible_boats.length
                ? part.compatible_boats.map(compatibleBoatLabel).join('、')
                : '未指定'}
            </div>
          </div>

          <div>
            <h3
              style={{
                margin: `0 0 ${designSystem.spacing.md}`,
                fontSize: getFontSize('h3', isMobile),
              }}
            >
              最近紀錄
            </h3>
            {loading && <p style={{ color: designSystem.colors.text.secondary }}>載入中...</p>}
            {!loading && movements.length === 0 && (
              <p style={{ color: designSystem.colors.text.secondary }}>尚無進出紀錄</p>
            )}
            {!loading &&
              movements.map(movement => (
                <div
                  key={movement.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    alignItems: 'center',
                    gap: designSystem.spacing.md,
                    padding: `${designSystem.spacing.md} 0`,
                    borderTop: `1px solid ${designSystem.colors.border.light}`,
                  }}
                >
                  <span
                    style={{
                      color:
                        movement.quantity > 0
                          ? designSystem.colors.success[700]
                          : designSystem.colors.danger[700],
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {movement.quantity > 0 ? '+' : ''}
                    {movement.quantity}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{movementLabel(movement.movement_type)}</div>
                    <div
                      style={{
                        marginTop: designSystem.spacing.xs,
                        color: designSystem.colors.text.secondary,
                        fontSize: getFontSize('caption', isMobile),
                      }}
                    >
                      {movement.boat_code ? `${compatibleBoatLabel(movement.boat_code)} · ` : ''}
                      {movement.note || (movement.affects_inventory ? '無備註' : 'Excel 歷史紀錄')}
                    </div>
                  </div>
                  <time
                    style={{
                      color: designSystem.colors.text.secondary,
                      fontSize: getFontSize('caption', isMobile),
                      textAlign: 'right',
                    }}
                  >
                    {formatDateTime(movement.moved_at)}
                  </time>
                </div>
              ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

function DetailValue({
  label,
  value,
  isMobile,
}: {
  label: string
  value: string
  isMobile: boolean
}) {
  return (
    <div>
      <div
        style={{
          color: designSystem.colors.text.secondary,
          fontSize: getFontSize('caption', isMobile),
          marginBottom: designSystem.spacing.xs,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: designSystem.colors.text.primary,
          fontSize: getFontSize('body', isMobile),
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  )
}
