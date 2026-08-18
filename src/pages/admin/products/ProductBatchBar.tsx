import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../../../components/ui'
import { designSystem, getFontSize } from '../../../styles/designSystem'

const { colors, borderRadius } = designSystem

export type BatchSheet = 'public' | 'preorder' | 'until' | null

interface ProductBatchBarProps {
  selectedCount: number
  visibleCount: number
  busy: boolean
  onSelectAll: () => void
  onClear: () => void
  onDone: () => void
  onSetPublic: (isPublic: boolean) => void
  onSetPreOrder: (accept: boolean) => void
  onSetUntil: (until: string | null) => void
  /** 到期日只對已開放預購的 SKU 有意義 */
  untilEnabled?: boolean
}

const actionBtnStyle: React.CSSProperties = {
  minWidth: 0,
  padding: '12px 6px',
  fontSize: 14,
  overflow: 'hidden',
}

export function ProductBatchBar({
  selectedCount,
  visibleCount,
  busy,
  onSelectAll,
  onClear,
  onDone,
  onSetPublic,
  onSetPreOrder,
  onSetUntil,
  untilEnabled = true,
}: ProductBatchBarProps) {
  const [sheet, setSheet] = useState<BatchSheet>(null)
  const [until, setUntil] = useState('')

  const closeSheet = () => setSheet(null)

  useEffect(() => {
    if (!untilEnabled && sheet === 'until') setSheet(null)
  }, [untilEnabled, sheet])

  return (
    <>
      <style>{`
        .product-batch-until {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 48px;
          padding: 10px 12px;
          font-size: 16px;
          border: 1px solid ${colors.border.main};
          border-radius: ${borderRadius.md};
          color: ${colors.text.primary};
          background: ${colors.background.card};
          -webkit-appearance: none;
          appearance: none;
        }
        .product-batch-until::-webkit-datetime-edit,
        .product-batch-until::-webkit-date-and-time-value {
          min-width: 0;
          width: 100%;
          padding: 0;
        }
      `}</style>
      {sheet && (
        <div
          role="presentation"
          onClick={busy ? undefined : closeSheet}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 40,
          }}
        />
      )}

      {sheet === 'public' && (
        <BatchSheet title="Shop 上架" onClose={closeSheet}>
          <Button fullWidth size="large" disabled={busy} onClick={() => { onSetPublic(true); closeSheet() }}>
            上架
          </Button>
          <Button fullWidth size="large" variant="secondary" disabled={busy} onClick={() => { onSetPublic(false); closeSheet() }}>
            下架
          </Button>
        </BatchSheet>
      )}

      {sheet === 'preorder' && (
        <BatchSheet title="預購" onClose={closeSheet}>
          <Button fullWidth size="large" disabled={busy} onClick={() => { onSetPreOrder(true); closeSheet() }}>
            開放預購
          </Button>
          <Button fullWidth size="large" variant="secondary" disabled={busy} onClick={() => { onSetPreOrder(false); closeSheet() }}>
            關閉預購
          </Button>
        </BatchSheet>
      )}

      {sheet === 'until' && (
        <BatchSheet title="到期日" onClose={closeSheet}>
          <div style={{ width: '100%', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
            <input
              className="product-batch-until"
              type="date"
              lang="en"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
          <Button
            fullWidth
            size="large"
            disabled={busy || !until}
            onClick={() => {
              onSetUntil(until)
              closeSheet()
            }}
          >
            套用
          </Button>
          <Button
            fullWidth
            size="large"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              onSetUntil(null)
              closeSheet()
            }}
          >
            清除到期日
          </Button>
        </BatchSheet>
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: sheet ? 39 : 41,
          background: colors.background.card,
          borderTop: `1px solid ${colors.border.light}`,
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
          maxWidth: '100%',
          overflow: 'hidden',
          boxShadow: designSystem.shadows.elevation[4],
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: getFontSize('body', true),
              fontWeight: 700,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            已選 {selectedCount}/{visibleCount}
          </span>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <TextBtn disabled={busy} onClick={onSelectAll}>
              全選
            </TextBtn>
            <TextBtn disabled={busy || selectedCount === 0} onClick={onClear}>
              清除
            </TextBtn>
            <TextBtn disabled={busy} onClick={onDone}>
              完成
            </TextBtn>
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            minWidth: 0,
          }}
        >
          <Button
            fullWidth
            size="large"
            variant="secondary"
            disabled={busy || selectedCount === 0}
            style={actionBtnStyle}
            onClick={() => setSheet('public')}
          >
            上架
          </Button>
          <Button
            fullWidth
            size="large"
            variant="secondary"
            disabled={busy || selectedCount === 0}
            style={actionBtnStyle}
            onClick={() => setSheet('preorder')}
          >
            預購
          </Button>
          <span
            title={selectedCount > 0 && !untilEnabled ? '僅預購可設定到期日' : undefined}
            style={{ minWidth: 0, display: 'block' }}
          >
            <Button
              fullWidth
              size="large"
              variant="secondary"
              disabled={busy || selectedCount === 0 || !untilEnabled}
              style={actionBtnStyle}
              onClick={() => setSheet('until')}
            >
              到期日
            </Button>
          </span>
        </div>
      </div>
    </>
  )
}

function BatchSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 42,
        background: colors.background.card,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        maxWidth: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
        <strong style={{ fontSize: getFontSize('h3', true) }}>{title}</strong>
        <TextBtn onClick={onClose}>取消</TextBtn>
      </div>
      {children}
    </div>
  )
}

function TextBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 44,
        padding: '0 6px',
        border: 'none',
        background: 'transparent',
        color: colors.text.primary,
        fontSize: getFontSize('body', true),
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

export function SelectCheck({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-label={checked ? '取消勾選' : '勾選'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      style={{
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `2px solid ${checked ? colors.text.primary : colors.border.main}`,
          background: checked ? colors.text.primary : colors.background.card,
          color: '#fff',
          fontSize: 14,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        {checked ? '✓' : ''}
      </span>
    </button>
  )
}
