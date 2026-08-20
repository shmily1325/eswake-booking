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
  formatInquiryUnitPrice,
  isDiscountPercent,
  resolveShopPrice,
  type DiscountPercent,
  type DiscountPreset,
} from '../../shop/lib/shopPricing'

const EXAMPLE_MSRP = 10125

/**
 * 折扣設定：預購全館一次改；商品檔次給紅標／出清勾選。
 * 售價欄永遠是建議售價，Shop / LINE 用這裡的檔次自己算。
 */
export function DiscountSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [presets, setPresets] = useState<DiscountPreset[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newPercent, setNewPercent] = useState<DiscountPercent>(60)

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
  const captionSize = getFontSize('caption', isMobile)

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
  const firstActiveTag = tags.find((p) => p.is_active)
  const exampleTag = firstActiveTag
    ? resolveShopPrice(
        {
          price: EXAMPLE_MSRP,
          discount_preset_id: firstActiveTag.id,
          availability: 'in_stock',
          stock: 1,
          pre_order_until: null,
        },
        presets,
      )
    : null

  const handlePreorder = async (isActive: boolean, percent: DiscountPercent) => {
    if (!isDiscountPercent(percent)) return
    setSaving(true)
    try {
      await updatePreorderDiscount({ isActive, percent })
      await load()
      toast.success(isActive ? `預購全館 ${foldLabel(percent)}` : '已關閉預購全館折扣')
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
      await createTagPreset({ name: newName, label: newLabel, percent: newPercent })
      setNewName('')
      setNewLabel('')
      await load()
      toast.success('已新增檔次')
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
    padding: isMobile ? 16 : 20,
    marginBottom: 16,
  } as const

  if (loading) {
    return (
      <div style={{ padding: embedded ? 0 : 20, color: designSystem.colors.text.secondary }}>
        載入中…
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, padding: embedded ? 0 : isMobile ? 12 : 20 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: getFontSize('h3', isMobile) }}>折扣</h2>
      <p
        style={{
          margin: '0 0 16px',
          fontSize: captionSize,
          color: designSystem.colors.text.secondary,
          lineHeight: 1.55,
        }}
      >
        建議售價不要改。這裡設活動，商品掛檔次，Shop 跟 LINE 會自己算劃掉價。
      </p>

      <ol
        style={{
          margin: '0 0 16px',
          padding: '12px 12px 12px 32px',
          background: designSystem.colors.background.card,
          border: `1px solid ${designSystem.colors.border.light}`,
          borderRadius: designSystem.borderRadius.lg,
          fontSize: captionSize,
          color: designSystem.colors.text.primary,
          lineHeight: 1.7,
        }}
      >
        <li>在這頁打開預購全館，或新增紅標／出清檔次。</li>
        <li>
          預購商品不用勾。現貨要特價才到商品列表勾選或掃碼掛檔次。
        </li>
        <li>活動結束：關掉全館，或取消商品上的檔次。售價還在。</li>
      </ol>

      <section style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>預購全館</h3>
        <p
          style={{
            margin: '8px 0 14px',
            fontSize: captionSize,
            color: designSystem.colors.text.secondary,
            lineHeight: 1.5,
          }}
        >
          所有開放預購的 SKU 自動套用，不必逐筆勾。商品有指定檔次時，以指定檔次為準。
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
          <input
            type="checkbox"
            checked={Boolean(preorder?.is_active)}
            disabled={saving}
            onChange={(e) =>
              void handlePreorder(
                e.target.checked,
                isDiscountPercent(preorder?.percent ?? 80)
                  ? (preorder?.percent as DiscountPercent)
                  : 80,
              )
            }
          />
          <span style={{ fontWeight: 600 }}>開啟預購全館折扣</span>
        </label>
        <label style={{ display: 'block', marginTop: 10, fontSize: captionSize }}>
          幾折
          <select
            style={{ ...inputStyle, marginTop: 4 }}
            value={preorder?.percent ?? 80}
            disabled={saving || !preorder?.is_active}
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
        </label>
        <PreviewBlock
          title="Shop / LINE 預覽（以 $10,125 為例）"
          price={examplePreorder}
          isMobile={isMobile}
        />
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>商品檔次</h3>
        <p
          style={{
            margin: '8px 0 14px',
            fontSize: captionSize,
            color: designSystem.colors.text.secondary,
            lineHeight: 1.5,
          }}
        >
          紅標、出清等。在商品編輯下拉、列表批次「折扣」，或掃碼點貨時掛上。掛了就蓋過預購全館。
        </p>
        {tags.length === 0 && (
          <div style={{ marginBottom: 12, color: designSystem.colors.text.secondary }}>
            還沒有檔次
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
                padding: '12px 0',
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <strong style={{ minWidth: 72 }}>{p.name}</strong>
                <span style={{ color: designSystem.colors.text.secondary, fontSize: captionSize }}>
                  Shop 顯示「{p.label}」
                  {!p.is_active ? ' · 已關' : ''}
                  {count > 0 ? ` · ${count} 件` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <select
                  aria-label={`${p.name} 幾折`}
                  style={{ ...inputStyle, width: 'auto', minWidth: 96 }}
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
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <Button
                    size="small"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void updateTagPreset(p.id, { is_active: !p.is_active }).then(load)
                    }
                  >
                    {p.is_active ? '關閉' : '開啟'}
                  </Button>
                  <Button
                    size="small"
                    variant="outline"
                    disabled={saving}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `刪除「${p.name}」？已套用的 ${count} 件會回到原價或預購全館。`,
                        )
                      ) {
                        return
                      }
                      void deleteTagPreset(p.id).then(load)
                    }}
                  >
                    刪除
                  </Button>
                </div>
              </div>
            </div>
          )
        })}

        {exampleTag && (
          <PreviewBlock
            title={`Shop / LINE 預覽 · ${firstActiveTag?.name}`}
            price={exampleTag}
            isMobile={isMobile}
          />
        )}

        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 600 }}>新增檔次</div>
          <input
            style={inputStyle}
            placeholder="名稱（後台），例如 出清"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Shop 標籤，例如 SALE"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
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
          <Button disabled={saving || !newName.trim()} onClick={() => void handleAddTag()}>
            新增
          </Button>
        </div>
      </section>

      <section style={{ ...cardStyle, marginBottom: 0 }}>
        <h3 style={{ margin: 0, fontSize: getFontSize('h3', isMobile) }}>怎麼套到商品</h3>
        <ol
          style={{
            margin: '10px 0 0',
            paddingLeft: 20,
            fontSize: captionSize,
            color: designSystem.colors.text.primary,
            lineHeight: 1.7,
          }}
        >
          <li>單筆：打開商品 → 售價下面「折扣檔次」。可套到其他尺寸。</li>
          <li>批次：商品列表勾選 → 底部「折扣」→ 紅標／取消檔次。</li>
          <li>掃碼：點貨掃到那件 → 選檔次。Shop 下一秒就是特價。</li>
        </ol>
        <div style={{ marginTop: 12 }}>
          <Button variant="outline" onClick={() => navigate('/products')}>
            去商品列表套用
          </Button>
        </div>
      </section>

      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

function PreviewBlock({
  title,
  price,
  isMobile,
}: {
  title: string
  price: ReturnType<typeof resolveShopPrice>
  isMobile: boolean
}) {
  const { colors } = designSystem
  return (
    <div
      style={{
        marginTop: 14,
        padding: 12,
        background: colors.background.main,
        borderRadius: designSystem.borderRadius.md,
        fontSize: getFontSize('caption', isMobile),
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {price.hasDiscount && price.original != null && price.sale != null ? (
        <>
          <div>
            <span style={{ textDecoration: 'line-through', color: colors.text.secondary }}>
              NT$ {price.original.toLocaleString()}
            </span>
            {'  '}
            <strong>NT$ {price.sale.toLocaleString()}</strong>
            {price.caption ? `　${price.caption}` : ''}
          </div>
          <div style={{ marginTop: 4, color: colors.text.secondary }}>
            LINE　單價：{formatInquiryUnitPrice(price)}
          </div>
        </>
      ) : (
        <div style={{ color: colors.text.secondary }}>目前沒有折扣，客人看到原價。</div>
      )}
    </div>
  )
}
