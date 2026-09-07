import type { CSSProperties } from 'react'
import { Button } from '../../../components/ui'
import { designSystem, getInputStyle } from '../../../styles/designSystem'
import { ImageUploader } from './ImageUploader'
import {
  getVibesBuildSettings,
  getVibesColorSettings,
  setVibesColorSettings,
  updateVibesBuildSetting,
  validateVibesCustomOrderConfig,
  type ProductOptionConfig,
  type VibesColorSetting,
} from './productOptions'

export interface VibesSpecRow {
  index: number
  key: string
  size: string
  width: string
  thickness: string
  volume: string
  pendingDelete: boolean
}

interface VibesCustomOrderEditorProps {
  value: ProductOptionConfig
  onChange: (value: ProductOptionConfig) => void
  specs: readonly VibesSpecRow[]
  onSpecChange: (index: number, key: 'size' | 'width' | 'thickness' | 'volume', value: string) => void
  onAddSpec: () => void
  onRemoveSpec: (index: number) => void
  onRestoreSpec: (index: number) => void
  disabled?: boolean
  isMobile?: boolean
  productId?: string | null
  onImageUpload?: (path: string) => void
}

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
  color: designSystem.colors.text.primary,
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: designSystem.colors.text.secondary,
  fontSize: 12,
  fontWeight: 600,
}

export function VibesCustomOrderEditor({
  value,
  onChange,
  specs,
  onSpecChange,
  onAddSpec,
  onRemoveSpec,
  onRestoreSpec,
  disabled = false,
  isMobile = false,
  productId,
  onImageUpload,
}: VibesCustomOrderEditorProps) {
  const inputStyle: CSSProperties = {
    ...getInputStyle(isMobile),
    width: '100%',
    boxSizing: 'border-box',
    background: designSystem.colors.background.card,
  }
  const builds = getVibesBuildSettings(value)
  const colors = getVibesColorSettings(value)
  const issues = validateVibesCustomOrderConfig(value)

  const updateColors = (next: VibesColorSetting[]) => onChange(setVibesColorSettings(value, next))
  const updateColor = (index: number, patch: Partial<VibesColorSetting>) => {
    updateColors(colors.map((color, colorIndex) => (colorIndex === index ? { ...color, ...patch } : color)))
  }
  const moveColor = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= colors.length) return
    const next = [...colors]
    ;[next[index], next[target]] = [next[target], next[index]]
    updateColors(next)
  }
  const addColor = () => {
    const used = new Set(colors.map((color) => color.name))
    let number = colors.length + 1
    while (used.has(`COLOR ${number}`)) number += 1
    updateColors([...colors, { name: `COLOR ${number}`, hex: '#D1D5DB' }])
  }

  return (
    <div style={{ display: 'grid', gap: 22 }}>
      {issues.length > 0 && (
        <div
          role="alert"
          style={{
            padding: 10,
            border: `1px solid ${designSystem.colors.warning[500]}`,
            borderRadius: designSystem.borderRadius.sm,
            background: designSystem.colors.warning[50],
            color: designSystem.colors.warning[700],
            fontSize: 13,
          }}
        >
          {issues[0]}
        </div>
      )}

      <section>
        <h4 style={headingStyle}>Build 與價格</h4>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {builds.map((build) => (
            <div
              key={build.name}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '130px 140px minmax(180px, 1fr)',
                gap: 10,
                alignItems: 'end',
                padding: 10,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.sm,
                background: designSystem.colors.background.card,
              }}
            >
              <strong style={{ alignSelf: 'center', fontSize: 14 }}>{build.name}</strong>
              <label>
                <span style={labelStyle}>成交價</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  style={inputStyle}
                  value={build.price ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      updateVibesBuildSetting(value, build.name, {
                        price: event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0),
                      }),
                    )
                  }
                />
              </label>
              <label>
                <span style={labelStyle}>給客人的簡短說明</span>
                <input
                  style={inputStyle}
                  value={build.note}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      updateVibesBuildSetting(value, build.name, {
                        note: event.target.value,
                      }),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h4 style={{ ...headingStyle, flex: 1 }}>尺寸與 Board Specs</h4>
          <Button variant="outline" size="small" disabled={disabled} onClick={onAddSpec}>
            + 新增尺寸
          </Button>
        </div>
        <div style={{ overflowX: 'auto', marginTop: 10 }}>
          <div style={{ display: 'grid', gap: 8, minWidth: 650 }}>
            <div
              aria-hidden
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 1fr 1fr 78px',
                gap: 8,
                padding: '0 10px',
                color: designSystem.colors.text.secondary,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>Size</span>
              <span>Width (in)</span>
              <span>Thickness (in)</span>
              <span>Volume (L)</span>
              <span />
            </div>
            {specs.map((spec) => (
              <div
                key={spec.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 1fr 1fr 78px',
                  gap: 8,
                  alignItems: 'center',
                  padding: 10,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: designSystem.borderRadius.sm,
                  background: spec.pendingDelete
                    ? designSystem.colors.secondary[100]
                    : designSystem.colors.background.card,
                  opacity: spec.pendingDelete ? 0.65 : 1,
                }}
              >
                {(['size', 'width', 'thickness', 'volume'] as const).map((key) => (
                  <input
                    key={key}
                    aria-label={`${key} ${spec.size || spec.index + 1}`}
                    style={inputStyle}
                    value={spec[key]}
                    disabled={disabled || spec.pendingDelete}
                    onChange={(event) => onSpecChange(spec.index, key, event.target.value)}
                  />
                ))}
                {spec.pendingDelete ? (
                  <Button variant="outline" size="small" disabled={disabled} onClick={() => onRestoreSpec(spec.index)}>
                    復原
                  </Button>
                ) : (
                  <Button variant="danger" size="small" disabled={disabled} onClick={() => onRemoveSpec(spec.index)}>
                    停用
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h4 style={{ ...headingStyle, flex: 1 }}>推薦色</h4>
          <Button variant="outline" size="small" disabled={disabled} onClick={addColor}>
            + 新增顏色
          </Button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          {colors.map((color, index) => (
            <div
              key={`${index}-${color.name}`}
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(140px, 1fr) 150px 76px auto',
                gap: 10,
                alignItems: 'end',
                padding: 10,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.sm,
                background: designSystem.colors.background.card,
              }}
            >
              <label>
                <span style={labelStyle}>顏色名稱</span>
                <input
                  style={inputStyle}
                  value={color.name}
                  disabled={disabled}
                  onChange={(event) => updateColor(index, { name: event.target.value })}
                />
              </label>
              <label>
                <span style={labelStyle}>色碼</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(color.hex) ? color.hex : '#d1d5db'}
                    disabled={disabled}
                    onChange={(event) => updateColor(index, { hex: event.target.value.toUpperCase() })}
                    style={{ width: 42, minWidth: 42 }}
                  />
                  <input
                    style={inputStyle}
                    value={color.hex}
                    disabled={disabled}
                    maxLength={7}
                    onChange={(event) => updateColor(index, { hex: event.target.value.toUpperCase() })}
                  />
                </div>
              </label>
              <div style={{ gridColumn: isMobile ? '2' : undefined }}>
                <span style={labelStyle}>參考圖</span>
                <ImageUploader
                  value={color.image?.url}
                  path={color.image?.path}
                  storageFolder="covers"
                  entityId={`${productId ?? 'new'}-swatches`}
                  disabled={disabled}
                  size={48}
                  square
                  emptyLabel="上傳"
                  onUpload={onImageUpload}
                  onChange={(image) =>
                    updateColor(index, {
                      image: image.url ? { url: image.url, ...(image.path ? { path: image.path } : {}) } : undefined,
                    })
                  }
                />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Button
                  variant="outline"
                  size="small"
                  disabled={disabled || index === 0}
                  onClick={() => moveColor(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="outline"
                  size="small"
                  disabled={disabled || index === colors.length - 1}
                  onClick={() => moveColor(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  variant="danger"
                  size="small"
                  disabled={disabled}
                  onClick={() => updateColors(colors.filter((_, colorIndex) => colorIndex !== index))}
                >
                  移除
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: '8px 0 0', color: designSystem.colors.text.secondary, fontSize: 12 }}>
          客人也可以直接輸入其他 Pantone 色號。
        </p>
      </section>
    </div>
  )
}
