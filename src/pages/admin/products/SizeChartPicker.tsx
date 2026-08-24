import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../../../components/ui'
import { designSystem, getFontSize, getInputStyle } from '../../../styles/designSystem'
import { removeProductImage, uploadProductImage } from '../../../utils/imageUpload'
import { createSizeChart, fetchSizeCharts } from './api'
import type { SizeChartRow } from './types'

interface SizeChartPickerProps {
  value: string | null
  brand: string
  currentUserEmail?: string | null
  disabled?: boolean
  onChange: (id: string | null) => void
}

export function SizeChartPicker({
  value,
  brand,
  currentUserEmail,
  disabled,
  onChange,
}: SizeChartPickerProps) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [charts, setCharts] = useState<SizeChartRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchSizeCharts()
      .then((rows) => {
        if (!cancelled) setCharts(rows)
      })
      .catch((error) => {
        console.error('[SizeChartPicker] load failed', error)
        toast.error('載入尺寸表失敗')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [toast])

  const sortedCharts = useMemo(() => {
    const normalizedBrand = brand.trim().toLowerCase()
    return [...charts].sort((a, b) => {
      const aMatch = normalizedBrand && a.brand.trim().toLowerCase() === normalizedBrand ? 0 : 1
      const bMatch = normalizedBrand && b.brand.trim().toLowerCase() === normalizedBrand ? 0 : 1
      return aMatch - bMatch || a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)
    })
  }, [charts, brand])

  const selected = charts.find((chart) => chart.id === value) ?? null
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔')
      return
    }
    const name = window.prompt('尺寸表名稱', `${brand.trim() || '品牌'} 尺寸表`)?.trim()
    if (!name) return

    setCreating(true)
    let uploadedPath: string | null = null
    try {
      const uploaded = await uploadProductImage(file, {
        storageFolder: 'size-charts',
        entityId: brand.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'shared',
        compress: { maxWidth: 2200, maxHeight: 2200, quality: 0.9 },
      })
      uploadedPath = uploaded.path
      const chart = await createSizeChart({
        name,
        brand,
        image_url: uploaded.publicUrl,
        image_path: uploaded.path,
        created_by: currentUserEmail,
      })
      setCharts((rows) => [...rows, chart])
      onChange(chart.id)
      toast.success('尺寸表已建立並選取')
    } catch (error) {
      if (uploadedPath) await removeProductImage(uploadedPath)
      console.error('[SizeChartPicker] create failed', error)
      toast.error(error instanceof Error ? error.message : '新增尺寸表失敗')
    } finally {
      setCreating(false)
    }
  }

  const inputStyle = getInputStyle(false)
  return (
    <div style={{ display: 'grid', gap: designSystem.spacing.sm }}>
      <div style={{ display: 'flex', gap: designSystem.spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          disabled={disabled || loading || creating}
          style={{ ...inputStyle, flex: '1 1 240px' }}
        >
          <option value="">{loading ? '載入中…' : '不顯示尺寸表'}</option>
          {sortedCharts.map((chart) => (
            <option key={chart.id} value={chart.id}>
              {[chart.brand, chart.name].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || creating}
          style={{
            padding: '9px 14px',
            borderRadius: designSystem.borderRadius.md,
            border: `1px solid ${designSystem.colors.border.main}`,
            background: designSystem.colors.background.card,
            cursor: disabled || creating ? 'not-allowed' : 'pointer',
            fontSize: getFontSize('bodySmall', false),
          }}
        >
          {creating ? '上傳中…' : '＋ 新增尺寸表'}
        </button>
      </div>
      {selected && (
        <a href={selected.image_url} target="_blank" rel="noreferrer" style={{ width: 'fit-content' }}>
          <img
            src={selected.image_url}
            alt={selected.name}
            style={{
              width: 150,
              maxHeight: 180,
              objectFit: 'contain',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: designSystem.borderRadius.md,
              background: '#fff',
            }}
          />
        </a>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
    </div>
  )
}
