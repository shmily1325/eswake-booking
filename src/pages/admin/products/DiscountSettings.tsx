import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, useToast, ToastContainer } from '../../../components/ui'
import { designSystem, getFontSize, getInputStyle } from '../../../styles/designSystem'
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
  isDiscountPercent,
  resolveShopPrice,
  type DiscountPercent,
  type DiscountPreset,
} from '../../shop/lib/shopPricing'

const EXAMPLE_MSRP = 10125

/**
 * 折扣：預購全館一次改；紅標在商品列表掛。
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
  const [newPercent, setNewPercent] = useState<DiscountPercent>(50)

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
  const tags = presets.filter((p) => p.kind === 'tag')
  const inputStyle = getInputStyle(isMobile)
  const preorderOn = Boolean(preorder?.is_active)
  const preorderPercent = isDiscountPercent(preorder?.percent ?? 80)
    ? (preorder?.percent as DiscountPercent)
    : 80

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

  const handlePreorder = async (isActive: boolean, percent: DiscountPercent) => {
    if (!isDiscountPercent(percent)) return
    setSaving(true)
    try {
      await updatePreorderDiscount({ isActive, percent })
      await load()
      toast.success(isActive ? `預購全館 ${foldLabel(percent)}` : '已關預購折扣')
    } catch (error) {
      console.error(error)
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleTagPercent = async (id: string, percent: DiscountPercent) => {
    if (!isDiscountPercent(percent)) return
    setSaving(true)
    try {
      await updateTagPreset(id, { percent })
      await load()
      toast.success(`已改成 ${foldLabel(percent)}`)
    } catch (error) {
      console.error(error)
      toast.error('儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = async () => {
    setSaving(true)
    try {
      await createTagPreset({ name: newName, label: newName, percent: newPercent })
      setNewName('')
      setAdding(false)
      await load()
      toast.success('已新增')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  const cardStyle = {
    background: designSystem.colors.background.card,
    border: `1px solid ${designSystem.colors.border.main}`,
    borderRadius: designSystem.borderRadius.lg,
    padding: isMobile ? 14 : 18,
    marginBottom: 12,
  } as const

  if (loading) {
    return (
      <div style={{ padding: embedded ? 0 : 20, color: designSystem.colors.text.secondary }}>
        載入中…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, padding: embedded ? 0 : isMobile ? 12 : 20 }}>
      <section style={cardStyle}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 48,
          }}
        >
          <span style={{ fontSize: getFontSize('h3', isMobile), fontWeight: 700 }}>預購全館</span>
          <input
            type="checkbox"
            checked={preorderOn}
            disabled={saving}
            onChange={(e) => void handlePreorder(e.target.checked, preorderPercent)}
            style={{ width: 22, height: 22 }}
          />
        </label>
        <select
          aria-label="預購幾折"
          style={{ ...inputStyle, marginTop: 8 }}
          value={preorderPercent}
          disabled={saving || !preorderOn}
          onChange={(e) =>
            void handlePreorder(true, Number(e.target.value) as DiscountPercent)
          }
        >
          {DISCOUNT_PERCENTS.map((n) => (
            <option key={n} value={n}>
              {foldLabel(n)}
            </option>
          ))}
        </select>
        <PricePreview price={examplePreorder} />
      </section>

      <section style={{ ...cardStyle, marginBottom: 12 }}>
        {tags.length === 0 && !adding && (
          <div style={{ color: designSystem.colors.text.secondary, marginBottom: 8 }}>
            還沒有紅標檔次
          </div>
        )}
        {tags.map((p) => {
          const count = usage[p.id] ?? 0
          return (
            <div
              key={p.id}
              style={{
                display: 'grid',
                gap: 8,
                paddingBottom: 12,
                marginBottom: 12,
                borderBottom: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: getFontSize('h3', isMobile) }}>{p.name}</strong>
                {!p.is_active ? (
                  <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>
                    已關
                  </span>
                ) : count > 0 ? (
                  <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('caption', isMobile) }}>
                    {count} 件
                  </span>
                ) : null}
              </div>
              <select
                aria-label={`${p.name} 幾折`}
                style={inputStyle}
                value={p.percent}
                disabled={saving}
                onChange={(e) =>
                  void handleTagPercent(p.id, Number(e.target.value) as DiscountPercent)
                }
              >
                {DISCOUNT_PERCENTS.map((n) => (
                  <option key={n} value={n}>
                    {foldLabel(n)}
                  </option>
                ))}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Button
                  size="large"
                  variant="outline"
                  disabled={saving}
                  onClick={() =>
                    void updateTagPreset(p.id, { is_active: !p.is_active }).then(load)
                  }
                >
                  {p.is_active ? '關閉' : '開啟'}
                </Button>
                <Button
                  size="large"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm(`刪除「${p.name}」？`)) return
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
          <div style={{ display: 'grid', gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="名稱，例如 出清"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <select
              style={inputStyle}
              value={newPercent}
              onChange={(e) => setNewPercent(Number(e.target.value) as DiscountPercent)}
            >
              {DISCOUNT_PERCENTS.map((n) => (
                <option key={n} value={n}>
                  {foldLabel(n)}
                </option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Button
                size="large"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setAdding(false)
                  setNewName('')
                }}
              >
                取消
              </Button>
              <Button
                size="large"
                disabled={saving || !newName.trim()}
                onClick={() => void handleAddTag()}
              >
                新增
              </Button>
            </div>
          </div>
        ) : (
          <Button size="large" variant="outline" fullWidth onClick={() => setAdding(true)}>
            新增檔次
          </Button>
        )}
      </section>

      <Button size="large" fullWidth onClick={() => navigate('/products')}>
        去掛紅標
      </Button>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

function PricePreview({ price }: { price: ReturnType<typeof resolveShopPrice> }) {
  const { colors } = designSystem
  if (!price.hasDiscount || price.original == null || price.sale == null) {
    return (
      <div style={{ marginTop: 10, color: colors.text.secondary, fontSize: 14 }}>
        客人看到原價
      </div>
    )
  }
  return (
    <div
      style={{
        marginTop: 10,
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexWrap: 'wrap',
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
