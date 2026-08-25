import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast, ToastContainer } from '../../../components/ui'
import { designSystem, getFontSize, getInputStyle, PAGE_MAX_WIDTHS } from '../../../styles/designSystem'
import { useResponsive } from '../../../hooks/useResponsive'
import {
  createTagPreset,
  deleteTagPreset,
  fetchDiscountPresetUsage,
  fetchDiscountPresets,
  updatePreorderDiscount,
  updateTagPreset,
} from './discountApi'
import {
  DISCOUNT_PERCENTS,
  activePreorderPreset,
  foldLabel,
  formatFoldInput,
  isDiscountPercent,
  parseFoldInput,
  resolveShopPrice,
  type DiscountPreset,
} from '../../shop/lib/shopPricing'
import { productsListPath } from './productDiscountQuery'

const EXAMPLE_MSRP = 10125

/**
 * 折扣：預購全館自動套；Sale 檔期掛在商品上，現貨進店面 Sale。
 */
export function DiscountSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [presets, setPresets] = useState<DiscountPreset[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPercent, setNewPercent] = useState(60)

  const load = async () => {
    const [list, counts] = await Promise.all([
      fetchDiscountPresets(),
      fetchDiscountPresetUsage().catch(() => ({} as Record<string, number>)),
    ])
    setPresets(list)
    setUsage(counts)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await load()
      } catch (error) {
        console.error(error)
        toast.error('載入折扣設定失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const preorder = activePreorderPreset(presets) ?? presets.find((p) => p.kind === 'preorder')
  const campaigns = presets.filter((p) => p.kind === 'tag')
  const inputStyle = getInputStyle(isMobile)
  const preorderOn = Boolean(preorder?.is_active)
  const rawPreorderPercent = preorder?.percent ?? 80
  const preorderPercent = isDiscountPercent(rawPreorderPercent) ? rawPreorderPercent : 80

  const examplePreorder = resolveShopPrice(
    {
      price: EXAMPLE_MSRP,
      discount_preset_id: null,
      availability: 'pre_order',
      stock: 0,
      pre_order_until: null,
    },
    presets,
  )

  const handlePreorder = async (isActive: boolean, percent: number) => {
    if (!isDiscountPercent(percent)) return
    setSaving(true)
    try {
      await updatePreorderDiscount({ isActive, percent })
      await load()
      toast.success(isActive ? `預購全館 ${foldLabel(percent)}` : '已關預購折扣')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleCampaignPercent = async (id: string, percent: number) => {
    if (!isDiscountPercent(percent)) return
    const campaign = campaigns.find((p) => p.id === id)
    if (campaign && campaign.percent === percent) return
    setSaving(true)
    try {
      await updateTagPreset(id, { percent })
      await load()
      toast.success(`已改成 ${foldLabel(percent)}`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleCampaignName = async (id: string, name: string) => {
    const next = name.trim()
    if (!next) return
    setSaving(true)
    try {
      await updateTagPreset(id, { name: next, label: next })
      await load()
      toast.success('已改名稱')
    } catch (error) {
      console.error(error)
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleCampaign = async (p: DiscountPreset) => {
    const count = usage[p.id] ?? 0
    if (p.is_active && count > 0) {
      if (!window.confirm(`結束「${p.name}」？已掛 ${count} 件先回原價，重開就恢復。`)) return
    }
    setSaving(true)
    try {
      await updateTagPreset(p.id, { is_active: !p.is_active })
      await load()
      toast.success(p.is_active ? '已結束檔期' : '已重開檔期')
    } catch (error) {
      console.error(error)
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCampaign = async () => {
    setSaving(true)
    try {
      await createTagPreset({ name: newName, label: newName, percent: newPercent })
      setNewName('')
      setNewPercent(60)
      setAdding(false)
      await load()
      toast.success('已新增檔期')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = {
    width: '100%',
    minWidth: 0,
    background: designSystem.colors.background.card,
    border: `1px solid ${designSystem.colors.border.main}`,
    borderRadius: designSystem.borderRadius.lg,
    padding: isMobile ? 14 : 20,
    display: 'grid',
    gap: isMobile ? 10 : 12,
  } as const

  const nestStyle = {
    width: '100%',
    minWidth: 0,
    display: 'grid',
    gap: 10,
    padding: isMobile ? 10 : 14,
    borderRadius: designSystem.borderRadius.md,
    background: designSystem.colors.background.main,
    border: `1px solid ${designSystem.colors.border.light}`,
  } as const

  if (loading) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: PAGE_MAX_WIDTHS.content,
          margin: '0 auto',
          padding: embedded ? 0 : isMobile ? 12 : 20,
          color: designSystem.colors.text.secondary,
        }}
      >
        載入中…
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: PAGE_MAX_WIDTHS.content,
        margin: '0 auto',
        minWidth: 0,
        padding: embedded ? 0 : isMobile ? 12 : 20,
        paddingBottom: isMobile
          ? `calc(${embedded ? 8 : 12}px + env(safe-area-inset-bottom, 0px))`
          : embedded
            ? 0
            : 20,
        display: 'grid',
        gap: 12,
      }}
    >
      <style>{`
        .discount-fold-input::-webkit-outer-spin-button,
        .discount-fold-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .discount-fold-input {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>

      <section style={cardStyle}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 48,
            margin: isMobile ? '-4px 0' : 0,
          }}
        >
          <span style={{ fontSize: getFontSize('h3', isMobile), fontWeight: 700 }}>預購全館</span>
          <input
            type="checkbox"
            checked={preorderOn}
            disabled={saving}
            onChange={(e) => void handlePreorder(e.target.checked, preorderPercent)}
            style={{ width: 24, height: 24, margin: 0, flexShrink: 0 }}
          />
        </label>
        <Hint isMobile={isMobile}>開放預購的商品自動套用，不進 Sale。</Hint>
        <FoldPicker
          percent={preorderPercent}
          disabled={saving || !preorderOn}
          isMobile={isMobile}
          inputStyle={inputStyle}
          onChange={(percent) => void handlePreorder(true, percent)}
        />
        <PricePreview price={examplePreorder} isMobile={isMobile} />
      </section>

      <section style={cardStyle}>
        <div>
          <div style={{ fontSize: getFontSize('h3', isMobile), fontWeight: 700 }}>Sale 檔期</div>
          <Hint isMobile={isMobile}>現貨掛上後進 Sale。點件數可直接勾選。</Hint>
        </div>

        {campaigns.length === 0 && !adding && (
          <div style={{ color: designSystem.colors.text.secondary }}>還沒有檔期</div>
        )}
        {campaigns.map((p) => {
          const count = usage[p.id] ?? 0
          const example = resolveShopPrice(
            {
              price: EXAMPLE_MSRP,
              discount_preset_id: p.id,
              availability: 'in_stock',
              stock: 1,
              pre_order_until: null,
            },
            [{ ...p, is_active: true }],
          )
          return (
            <div key={p.id} style={nestStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <CommitInput
                  ariaLabel={`${p.name} 名稱`}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, minHeight: isMobile ? 48 : undefined }}
                  value={p.name}
                  disabled={saving}
                  placeholder="檔期名稱"
                  onCommit={(name) => void handleCampaignName(p.id, name)}
                />
                {count > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate(productsListPath({ filterId: p.id, select: true }))}
                    style={{
                      flexShrink: 0,
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      minHeight: 44,
                      color: designSystem.colors.text.secondary,
                      fontSize: getFontSize('caption', isMobile),
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {count} 件
                  </button>
                ) : (
                  <span
                    style={{
                      flexShrink: 0,
                      color: designSystem.colors.text.secondary,
                      fontSize: getFontSize('caption', isMobile),
                    }}
                  >
                    {!p.is_active ? '已結束' : '0 件'}
                  </span>
                )}
              </div>
              {p.is_active ? (
                <>
                  <FoldPicker
                    percent={p.percent}
                    disabled={saving}
                    isMobile={isMobile}
                    inputStyle={inputStyle}
                    onChange={(percent) => void handleCampaignPercent(p.id, percent)}
                  />
                  <PricePreview price={example} isMobile={isMobile} />
                </>
              ) : (
                <div style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('body', isMobile) }}>
                  已結束 · {foldLabel(p.percent)}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Button
                  size="large"
                  variant="outline"
                  fullWidth
                  disabled={saving}
                  onClick={() => void handleToggleCampaign(p)}
                >
                  {p.is_active ? '結束檔期' : '重開檔期'}
                </Button>
                <Button
                  size="large"
                  variant="outline"
                  fullWidth
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm(`刪除「${p.name}」？掛記會清掉。`)) {
                      return
                    }
                    void deleteTagPreset(p.id).then(load)
                  }}
                >
                  刪除
                </Button>
              </div>
            </div>
          )
        })}

        {adding ? (
          <div style={nestStyle}>
            <input
              style={{ ...inputStyle, minHeight: isMobile ? 48 : undefined }}
              placeholder="名稱，例如 出清、週年慶"
              value={newName}
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              onChange={(e) => setNewName(e.target.value)}
            />
            <FoldPicker
              percent={newPercent}
              disabled={saving}
              isMobile={isMobile}
              inputStyle={inputStyle}
              onChange={setNewPercent}
            />
            <PricePreview
              price={resolveShopPrice(
                {
                  price: EXAMPLE_MSRP,
                  discount_preset_id: 'new',
                  availability: 'in_stock',
                  stock: 1,
                  pre_order_until: null,
                },
                [
                  {
                    id: 'new',
                    kind: 'tag',
                    name: newName.trim() || '新檔期',
                    label: newName.trim() || '新檔期',
                    percent: newPercent,
                    is_active: true,
                    sort_order: 99,
                  },
                ],
              )}
              isMobile={isMobile}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button
                size="large"
                variant="outline"
                fullWidth
                disabled={saving}
                onClick={() => {
                  setAdding(false)
                  setNewName('')
                  setNewPercent(60)
                }}
              >
                取消
              </Button>
              <Button
                size="large"
                fullWidth
                disabled={saving || !newName.trim() || !isDiscountPercent(newPercent)}
                onClick={() => void handleAddCampaign()}
              >
                新增
              </Button>
            </div>
          </div>
        ) : (
          <Button size="large" variant="outline" fullWidth onClick={() => setAdding(true)}>
            新增檔期
          </Button>
        )}
      </section>

      <div
        style={{
          position: isMobile ? 'sticky' : 'static',
          bottom: 0,
          zIndex: 2,
          margin: isMobile ? '0 -2px' : 0,
          padding: isMobile ? '8px 0 0' : 0,
          background: isMobile ? '#f5f6f8' : 'transparent',
        }}
      >
        <Button
          size="large"
          fullWidth
          disabled={!campaigns.some((p) => p.is_active)}
          onClick={() => navigate(productsListPath({ select: true }))}
        >
          去掛檔期
        </Button>
      </div>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

function Hint({ children, isMobile }: { children: string; isMobile: boolean }) {
  return (
    <div
      style={{
        marginTop: 4,
        color: designSystem.colors.text.secondary,
        fontSize: getFontSize('bodySmall', isMobile),
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  )
}

function FoldPicker({
  percent,
  disabled,
  isMobile,
  inputStyle,
  onChange,
}: {
  percent: number
  disabled?: boolean
  isMobile: boolean
  inputStyle: CSSProperties
  onChange: (percent: number) => void
}) {
  const [draft, setDraft] = useState(formatFoldInput(percent))

  useEffect(() => {
    setDraft(formatFoldInput(percent))
  }, [percent])

  const commit = () => {
    const parsed = parseFoldInput(draft)
    if (parsed == null) {
      setDraft(formatFoldInput(percent))
      return
    }
    setDraft(formatFoldInput(parsed))
    if (parsed !== percent) onChange(parsed)
  }

  return (
    <div style={{ display: 'grid', gap: 8, width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          style={{
            flexShrink: 0,
            color: designSystem.colors.text.secondary,
            fontSize: getFontSize('bodySmall', isMobile),
            fontWeight: 600,
          }}
        >
          幾折
        </span>
        <input
          className="discount-fold-input"
          aria-label="幾折"
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            ...inputStyle,
            width: isMobile ? 'auto' : 88,
            flex: isMobile ? '1 1 auto' : '0 0 88px',
            minWidth: 0,
            minHeight: isMobile ? 48 : undefined,
            textAlign: 'center',
            paddingLeft: 8,
            paddingRight: 8,
          }}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            e.currentTarget.select()
            if (isMobile) {
              e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <span style={{ fontWeight: 700, width: 20, flexShrink: 0 }}>折</span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: isMobile ? 8 : 6,
        }}
      >
        {DISCOUNT_PERCENTS.map((n) => {
          const active = percent === n
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(n)}
              style={{
                minHeight: isMobile ? 48 : 40,
                width: '100%',
                padding: 0,
                borderRadius: designSystem.borderRadius.md,
                border: `1px solid ${
                  active ? designSystem.colors.danger[500] : designSystem.colors.border.main
                }`,
                background: active ? designSystem.colors.danger[50] : designSystem.colors.background.card,
                color: active ? designSystem.colors.danger[700] : designSystem.colors.text.primary,
                fontWeight: active ? 800 : 600,
                fontSize: getFontSize('button', isMobile),
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
                touchAction: 'manipulation',
                WebkitUserSelect: 'none',
                userSelect: 'none',
              }}
            >
              {foldLabel(n)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CommitInput({
  value,
  disabled,
  style,
  placeholder,
  ariaLabel,
  onCommit,
}: {
  value: string
  disabled?: boolean
  style: CSSProperties
  placeholder?: string
  ariaLabel?: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  return (
    <input
      aria-label={ariaLabel}
      style={style}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      enterKeyHint="done"
      autoComplete="off"
      autoCorrect="off"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim()
        if (!next || next === value) {
          setDraft(value)
          return
        }
        onCommit(next)
      }}
    />
  )
}

function PricePreview({
  price,
  isMobile,
}: {
  price: ReturnType<typeof resolveShopPrice>
  isMobile: boolean
}) {
  const { colors } = designSystem
  if (!price.hasDiscount || price.original == null || price.sale == null) {
    return (
      <div style={{ color: colors.text.secondary, fontSize: getFontSize('body', isMobile) }}>
        客人看到原價
      </div>
    )
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      <span style={{ textDecoration: 'line-through', color: colors.text.secondary }}>
        NT$ {price.original.toLocaleString()}
      </span>
      <strong>NT$ {price.sale.toLocaleString()}</strong>
      {price.percent != null ? (
        <span style={{ fontWeight: 800, color: colors.danger[500] }}>
          {foldLabel(price.percent)}
        </span>
      ) : null}
    </div>
  )
}
