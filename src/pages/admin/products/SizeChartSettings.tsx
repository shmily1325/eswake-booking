import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, useToast, ToastContainer } from '../../../components/ui'
import { designSystem, getFontSize, getInputStyle, PAGE_MAX_WIDTHS } from '../../../styles/designSystem'
import { useResponsive } from '../../../hooks/useResponsive'
import { useAuthUser } from '../../../contexts/AuthContext'
import { removeProductImage, uploadProductImage } from '../../../utils/imageUpload'
import {
  createSizeChart,
  deactivateSizeChart,
  fetchProductBrands,
  fetchSizeChartUsage,
  fetchSizeCharts,
  updateSizeChart,
} from './api'
import type { SizeChartRow } from './types'

const ALL_BRANDS = ''

function slugBrand(brand: string) {
  return brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'shared'
}

function sameBrand(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function SizeChartSettings({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast()
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const fileRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const [charts, setCharts] = useState<SizeChartRow[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [brandFilter, setBrandFilter] = useState(ALL_BRANDS)
  const [productBrands, setProductBrands] = useState<string[]>([])
  const brandFilterReady = useRef(false)

  const load = async () => {
    const [rows, counts, brands] = await Promise.all([
      fetchSizeCharts(),
      fetchSizeChartUsage().catch(() => ({} as Record<string, number>)),
      fetchProductBrands().catch(() => [] as string[]),
    ])
    setCharts(rows)
    setUsage(counts)
    setProductBrands(brands)
    if (!brandFilterReady.current) {
      brandFilterReady.current = true
      const follow = brands.find((brand) => brand.toLowerCase() === 'follow')
      if (follow) setBrandFilter(follow)
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        await load()
      } catch (error) {
        console.error(error)
        toast.error('載入尺寸表失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔')
      return
    }
    const brand =
      brandFilter || window.prompt('品牌', 'Follow')?.trim() || ''
    if (!brand) return
    const name = window.prompt('名稱（不要含品牌，例如 男背心 2027）')?.trim()
    if (!name) return
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      const uploaded = await uploadProductImage(file, {
        storageFolder: 'size-charts',
        entityId: slugBrand(brand),
        compress: { maxWidth: 2200, maxHeight: 2200, quality: 0.9 },
      })
      uploadedPath = uploaded.path
      await createSizeChart({
        name,
        brand,
        image_url: uploaded.publicUrl,
        image_path: uploaded.path,
        created_by: user?.email ?? null,
      })
      await load()
      toast.success('已新增尺寸表')
    } catch (error) {
      if (uploadedPath) await removeProductImage(uploadedPath)
      toast.error(error instanceof Error ? error.message : '新增失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleReplace = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const chart = charts.find((row) => row.id === replaceId)
    setReplaceId(null)
    if (!file || !chart) return
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔')
      return
    }
    setSaving(true)
    let uploadedPath: string | null = null
    try {
      const uploaded = await uploadProductImage(file, {
        storageFolder: 'size-charts',
        entityId: slugBrand(chart.brand),
        compress: { maxWidth: 2200, maxHeight: 2200, quality: 0.9 },
      })
      uploadedPath = uploaded.path
      await updateSizeChart(chart.id, {
        image_url: uploaded.publicUrl,
        image_path: uploaded.path,
      })
      if (chart.image_path && chart.image_path !== uploaded.path) {
        await removeProductImage(chart.image_path)
      }
      await load()
      toast.success('已更換圖片')
    } catch (error) {
      if (uploadedPath) await removeProductImage(uploadedPath)
      toast.error(error instanceof Error ? error.message : '更換失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleRename = async (chart: SizeChartRow, name: string) => {
    const next = name.trim()
    if (!next || next === chart.name) return
    setSaving(true)
    try {
      await updateSizeChart(chart.id, { name: next })
      await load()
    } catch {
      toast.error('改名稱失敗')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (chart: SizeChartRow) => {
    const count = usage[chart.id] ?? 0
    const ok = window.confirm(
      count > 0
        ? `刪除「${chart.name}」？已掛的 ${count} 個商品會拿掉尺寸表。`
        : `刪除「${chart.name}」？`,
    )
    if (!ok) return
    setSaving(true)
    try {
      await deactivateSizeChart(chart.id)
      await load()
      toast.success('已刪除')
    } catch {
      toast.error('刪除失敗')
    } finally {
      setSaving(false)
    }
  }

  const brandOptions = useMemo(() => {
    const set = new Set(productBrands)
    for (const chart of charts) {
      if (chart.brand.trim()) set.add(chart.brand.trim())
    }
    return Array.from(set).sort((a, b) => {
      if (a.toLowerCase() === 'follow') return -1
      if (b.toLowerCase() === 'follow') return 1
      return a.localeCompare(b)
    })
  }, [productBrands, charts])

  const visibleCharts = useMemo(() => {
    return charts.filter((chart) => {
      if (brandFilter && !sameBrand(chart.brand, brandFilter)) return false
      return true
    })
  }, [charts, brandFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, SizeChartRow[]>()
    for (const chart of visibleCharts) {
      const key = chart.brand.trim() || '未填品牌'
      const list = map.get(key)
      if (list) list.push(chart)
      else map.set(key, [chart])
    }
    return Array.from(map.entries())
  }, [visibleCharts])

  const inputStyle = getInputStyle(isMobile)
  const wrap = {
    width: '100%',
    maxWidth: PAGE_MAX_WIDTHS.hub,
    margin: '0 auto',
    padding: embedded ? 0 : isMobile ? 12 : 20,
  } as const

  if (loading) {
    return <div style={{ ...wrap, color: designSystem.colors.text.secondary }}>載入中…</div>
  }

  return (
    <div style={wrap}>
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: getFontSize('h3', isMobile), fontWeight: 700 }}>尺寸表</div>
          <div
            style={{
              marginTop: 4,
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
            }}
          >
            依品牌整理。年份寫在名稱裡（例如 男背心 2027）。新年度請新增一張，不要覆蓋舊圖。
          </div>
        </div>
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => fileRef.current?.click()}
        >
          ＋ 新增
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[{ value: ALL_BRANDS, label: '全部' }, ...brandOptions.map((brand) => ({ value: brand, label: brand }))].map(
          (option) => {
            const active = brandFilter === option.value
            return (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => setBrandFilter(option.value)}
                style={{
                  minHeight: 36,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: `1px solid ${active ? designSystem.colors.primary[900] : designSystem.colors.border.main}`,
                  background: active ? designSystem.colors.primary[900] : designSystem.colors.background.card,
                  color: active ? '#fff' : designSystem.colors.text.primary,
                  cursor: 'pointer',
                  fontSize: getFontSize('caption', isMobile),
                  fontWeight: 700,
                }}
              >
                {option.label}
              </button>
            )
          },
        )}
      </div>

      {visibleCharts.length === 0 && (
        <div style={{ color: designSystem.colors.text.secondary }}>
          {brandFilter ? `還沒有 ${brandFilter} 的尺寸表` : '還沒有尺寸表'}
        </div>
      )}

      <div style={{ display: 'grid', gap: 20 }}>
        {grouped.map(([brand, rows]) => (
          <section key={brand}>
            <div
              style={{
                marginBottom: 8,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: designSystem.colors.text.secondary,
              }}
            >
              {brand}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {rows.map((chart) => {
                const count = usage[chart.id] ?? 0
                return (
                  <div
                    key={chart.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '96px 1fr' : '120px 1fr',
                      gap: 12,
                      alignItems: 'center',
                      padding: 12,
                      background: designSystem.colors.background.card,
                      border: `1px solid ${designSystem.colors.border.main}`,
                      borderRadius: designSystem.borderRadius.lg,
                    }}
                  >
                    <a href={chart.image_url} target="_blank" rel="noreferrer">
                      <img
                        src={chart.image_url}
                        alt={chart.name}
                        style={{
                          width: '100%',
                          height: isMobile ? 120 : 140,
                          objectFit: 'contain',
                          background: '#fff',
                          borderRadius: designSystem.borderRadius.md,
                          border: `1px solid ${designSystem.colors.border.light}`,
                        }}
                      />
                    </a>
                    <div style={{ minWidth: 0, display: 'grid', gap: 8 }}>
                      <input
                        style={inputStyle}
                        defaultValue={chart.name}
                        disabled={saving}
                        onBlur={(event) => void handleRename(chart, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur()
                          }
                        }}
                      />
                      <div
                        style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary,
                        }}
                      >
                        {count} 個商品
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={saving}
                          onClick={() => {
                            setReplaceId(chart.id)
                            replaceRef.current?.click()
                          }}
                        >
                          換圖
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={saving}
                          onClick={() => void handleRemove(chart)}
                        >
                          刪除
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleCreate} />
      <input ref={replaceRef} type="file" accept="image/*" hidden onChange={handleReplace} />
    </div>
  )
}
