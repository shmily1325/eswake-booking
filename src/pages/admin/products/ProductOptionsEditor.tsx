import { useState, type CSSProperties } from 'react'
import { Button } from '../../../components/ui'
import { designSystem, getInputStyle } from '../../../styles/designSystem'
import {
  EMPTY_PRODUCT_OPTION_CONFIG,
  type ProductCustomField,
  type ProductOptionConfig,
  type ProductOptionField,
  type ProductVariantFieldGroup,
} from './productOptions'
import type { FieldDef } from './schema'
import { ImageUploader } from './ImageUploader'

interface ProductOptionsEditorProps {
  value: ProductOptionConfig | null
  onChange: (value: ProductOptionConfig | null) => void
  disabled?: boolean
  isMobile?: boolean
  defaultVariantFields?: readonly FieldDef[]
  productId?: string | null
  onImageUpload?: (path: string) => void
}

function newField(index: number): ProductOptionField {
  return { key: `option_${index + 1}`, label: '新選項', inputType: 'text' }
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: designSystem.colors.text.secondary,
  fontSize: 12,
  fontWeight: 600,
}

const DEFAULT_SWATCH_COLOR = '#d1d5db'

function OptionValuesEditor({
  values = [],
  onChange,
  disabled,
  inputStyle,
}: {
  values?: string[]
  onChange: (values: string[] | undefined) => void
  disabled: boolean
  inputStyle: CSSProperties
}) {
  const [draft, setDraft] = useState('')
  const addValue = () => {
    const next = draft.trim()
    if (!next || values.includes(next)) return
    onChange([...values, next])
    setDraft('')
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {values.map((option) => (
          <span
            key={option}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 8px',
              border: `1px solid ${designSystem.colors.border.light}`,
              borderRadius: 999,
              background: designSystem.colors.background.card,
              fontSize: 12,
            }}
          >
            {option}
            <button
              type="button"
              disabled={disabled}
              aria-label={`移除 ${option}`}
              onClick={() => onChange(values.filter((value) => value !== option))}
              style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={inputStyle}
          value={draft}
          disabled={disabled}
          placeholder="輸入後按 Enter"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            addValue()
          }}
        />
        <Button variant="outline" size="small" disabled={disabled || !draft.trim()} onClick={addValue}>
          新增
        </Button>
      </div>
    </div>
  )
}

function PriceOptionsEditor({
  field,
  disabled,
  inputStyle,
  onChange,
}: {
  field: ProductCustomField
  disabled: boolean
  inputStyle: CSSProperties
  onChange: (patch: Partial<ProductCustomField>) => void
}) {
  const [draft, setDraft] = useState('')
  const updateName = (oldName: string, nextName: string) => {
    const values = (field.values ?? []).map((value) => value === oldName ? nextName : value)
    const optionPrices = { ...field.optionPrices }
    const optionNotes = { ...field.optionNotes }
    optionPrices[nextName] = optionPrices[oldName] ?? 0
    if (optionNotes[oldName]) optionNotes[nextName] = optionNotes[oldName]
    if (nextName !== oldName) {
      delete optionPrices[oldName]
      delete optionNotes[oldName]
    }
    onChange({ values, optionPrices, optionNotes })
  }
  const remove = (name: string) => {
    const optionPrices = { ...field.optionPrices }
    const optionNotes = { ...field.optionNotes }
    delete optionPrices[name]
    delete optionNotes[name]
    onChange({
      values: field.values?.filter((value) => value !== name),
      optionPrices,
      optionNotes,
    })
  }
  const add = () => {
    const name = draft.trim()
    if (!name || field.values?.includes(name)) return
    onChange({
      values: [...(field.values ?? []), name],
      optionPrices: { ...field.optionPrices, [name]: 0 },
    })
    setDraft('')
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {(field.values ?? []).map((name) => (
        <div
          key={name}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 1fr) 120px minmax(160px, 1.5fr) auto',
            gap: 8,
            alignItems: 'end',
          }}
        >
          <label>
            <span style={labelStyle}>名稱</span>
            <input style={inputStyle} value={name} disabled={disabled}
              onChange={(event) => updateName(name, event.target.value)} />
          </label>
          <label>
            <span style={labelStyle}>固定成交價</span>
            <input type="number" min={0} step={1} style={inputStyle}
              value={field.optionPrices?.[name] ?? 0} disabled={disabled}
              onChange={(event) => onChange({
                optionPrices: {
                  ...field.optionPrices,
                  [name]: Math.max(0, Number(event.target.value) || 0),
                },
              })} />
          </label>
          <label>
            <span style={labelStyle}>說明</span>
            <input style={inputStyle} value={field.optionNotes?.[name] ?? ''} disabled={disabled}
              onChange={(event) => onChange({
                optionNotes: {
                  ...field.optionNotes,
                  [name]: event.target.value,
                },
              })} />
          </label>
          <Button variant="danger" size="small" disabled={disabled} onClick={() => remove(name)}>
            移除
          </Button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={inputStyle} value={draft} disabled={disabled}
          placeholder="新增價格選項名稱"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }} />
        <Button variant="outline" size="small" disabled={disabled || !draft.trim()} onClick={add}>
          新增
        </Button>
      </div>
    </div>
  )
}

export function ProductOptionsEditor({
  value,
  onChange,
  disabled = false,
  isMobile = false,
  defaultVariantFields = [],
  productId,
  onImageUpload,
}: ProductOptionsEditorProps) {
  const inputStyle: CSSProperties = {
    ...getInputStyle(isMobile),
    width: '100%',
    boxSizing: 'border-box',
    background: designSystem.colors.background.card,
  }

  if (!value) {
    return (
      <div>
        <p style={{ margin: '0 0 10px', color: designSystem.colors.text.secondary, fontSize: 13 }}>
          一般商品不需要設定。只有客製商品或多種組合售價時才需要啟用。
        </p>
        <Button
          variant="outline"
          size="small"
          disabled={disabled}
          onClick={() => onChange({
            ...EMPTY_PRODUCT_OPTION_CONFIG,
            variantFields: {
              axis: defaultVariantFields.map((field) => ({
                key: field.key,
                label: field.label,
                inputType: field.type === 'select' ? 'select' : 'text',
                values: field.options,
                suffix: field.displaySuffix,
              })),
              detail: [],
            },
            customFields: [],
          })}
        >
          設定客製商品
        </Button>
      </div>
    )
  }

  const updateVariantField = (
    group: ProductVariantFieldGroup,
    index: number,
    patch: Partial<ProductOptionField>,
  ) => {
    onChange({
      ...value,
      variantFields: {
        ...value.variantFields,
        [group]: value.variantFields[group].map((field, i) =>
          i === index ? { ...field, ...patch } : field,
        ),
      },
    })
  }

  const removeVariantField = (group: ProductVariantFieldGroup, index: number) => {
    onChange({
      ...value,
      variantFields: {
        ...value.variantFields,
        [group]: value.variantFields[group].filter((_, i) => i !== index),
      },
    })
  }

  const addVariantField = (group: ProductVariantFieldGroup) => {
    const count = value.variantFields.axis.length + value.variantFields.detail.length
    onChange({
      ...value,
      variantFields: {
        ...value.variantFields,
        [group]: [...value.variantFields[group], newField(count)],
      },
    })
  }

  const updateCustomField = (index: number, patch: Partial<ProductCustomField>) => {
    onChange({
      ...value,
      customFields: value.customFields.map((field, i) =>
        i === index ? { ...field, ...patch } : field,
      ),
    })
  }

  const renderField = (
    field: ProductOptionField,
    index: number,
    group: ProductVariantFieldGroup,
  ) => (
    <details
      key={`${group}-${index}`}
      style={{
        marginBottom: 8,
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.sm,
        background: designSystem.colors.background.card,
      }}
    >
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          cursor: 'pointer',
          listStyle: 'none',
        }}
      >
        <strong style={{ minWidth: 90, fontSize: 14 }}>{field.label}</strong>
        <span style={{ flex: 1, color: designSystem.colors.text.secondary, fontSize: 12 }}>
          {field.values?.length
            ? `${field.values.length} 個選項 · ${field.values.slice(0, 4).join('、')}${field.values.length > 4 ? '…' : ''}`
            : `${field.label}${field.suffix ?? ''}`}
        </span>
        <span style={{ color: designSystem.colors.primary[700], fontSize: 12 }}>編輯</span>
      </summary>
      <div style={{ padding: '0 12px 12px' }}>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={labelStyle}>名稱</span>
          <input
            style={inputStyle}
            value={field.label}
            disabled={disabled}
            onChange={(event) => updateVariantField(group, index, { label: event.target.value })}
          />
        </label>
        {field.inputType === 'select' ? (
          <div style={{ marginBottom: 10 }}>
            <span style={labelStyle}>選項</span>
            <OptionValuesEditor
              values={field.values}
              disabled={disabled}
              inputStyle={inputStyle}
              onChange={(values) => updateVariantField(group, index, { values })}
            />
          </div>
        ) : null}
        <details style={{ fontSize: 12, color: designSystem.colors.text.secondary }}>
          <summary style={{ cursor: 'pointer', marginBottom: 8 }}>進階設定</summary>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '130px 130px 1fr', gap: 8 }}>
            <label>
              <span style={labelStyle}>欄位類型</span>
              <select
                style={inputStyle}
                value={field.inputType}
                disabled={disabled}
                onChange={(event) => updateVariantField(group, index, {
                  inputType: event.target.value as ProductOptionField['inputType'],
                })}
              >
                <option value="text">文字</option>
                <option value="select">固定選項</option>
              </select>
            </label>
            {group === 'detail' ? (
              <label>
                <span style={labelStyle}>單位</span>
                <input
                  style={inputStyle}
                  value={field.suffix ?? ''}
                  disabled={disabled}
                  onChange={(event) => updateVariantField(group, index, {
                    suffix: event.target.value || undefined,
                  })}
                />
              </label>
            ) : <div />}
            <label>
              <span style={labelStyle}>內部說明</span>
              <input
                style={inputStyle}
                value={field.help ?? ''}
                disabled={disabled}
                onChange={(event) => updateVariantField(group, index, {
                  help: event.target.value || undefined,
                })}
              />
            </label>
          </div>
          <label style={{ display: 'block', maxWidth: 280, marginTop: 8 }}>
            <span style={labelStyle}>系統代碼</span>
            <input
              style={inputStyle}
              value={field.key}
              disabled={disabled}
              onChange={(event) => updateVariantField(group, index, { key: event.target.value })}
            />
          </label>
        </details>
        <Button
          variant="danger"
          size="small"
          disabled={disabled}
          onClick={() => removeVariantField(group, index)}
          style={{ marginTop: 10 }}
        >
          移除此欄位
        </Button>
      </div>
    </details>
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ flex: 1, fontSize: 14 }}>客人選擇</strong>
          <Button
            variant="outline"
            size="small"
            disabled={disabled}
            onClick={() => addVariantField('axis')}
          >
            + 新增
          </Button>
        </div>
        {value.variantFields.axis.map((field, index) => renderField(field, index, 'axis'))}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ flex: 1, fontSize: 14 }}>客製需求</strong>
          <Button
            variant="outline"
            size="small"
            disabled={disabled}
            onClick={() => onChange({
              ...value,
              customFields: [
                ...value.customFields,
                {
                  ...newField(
                    value.variantFields.axis.length
                    + value.variantFields.detail.length
                    + value.customFields.length,
                  ),
                  required: false,
                },
              ],
            })}
          >
            + 新增需求
          </Button>
        </div>
        {value.customFields.map((field, index) => ({ field, index }))
          .filter(({ field }) => !field.readOnly)
          .map(({ field, index }) => {
          const axisVisibility = field.visibility && 'axis' in field.visibility
            ? field.visibility.axis
            : undefined
          const customVisibility = field.visibility && 'customField' in field.visibility
            ? field.visibility.customField
            : undefined
          const visibilitySource = axisVisibility
            ? `axis:${axisVisibility.key}`
            : customVisibility
              ? `custom:${customVisibility.key}`
              : ''
          const visibilityValue = axisVisibility?.value ?? customVisibility?.value ?? ''
          const customVisibilitySource = value.customFields
            .slice(0, index)
            .find((candidate) => candidate.key === customVisibility?.key)
          return (
            <details
              key={`custom-${index}`}
              style={{
                marginBottom: 8,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.sm,
                background: designSystem.colors.background.card,
              }}
            >
              <summary
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  cursor: 'pointer',
                  listStyle: 'none',
                }}
              >
                <strong style={{ minWidth: 90, fontSize: 14 }}>{field.label}</strong>
                <span style={{ flex: 1, color: designSystem.colors.text.secondary, fontSize: 12 }}>
                  {field.values?.length ? `${field.values.length} 個選項` : '文字'}
                  {axisVisibility ? ` · ${value.variantFields.axis.find((axis) => axis.key === axisVisibility.key)?.label ?? axisVisibility.key}為 ${axisVisibility.value} 時顯示` : ''}
                  {customVisibility ? ` · ${customVisibilitySource?.label ?? customVisibility.key}為 ${customVisibility.value} 時顯示` : ''}
                </span>
                <span style={{ color: designSystem.colors.primary[700], fontSize: 12 }}>編輯</span>
              </summary>
              <div style={{ padding: '0 12px 12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 130px 1.5fr 130px', gap: 8 }}>
                <label>
                  <span style={labelStyle}>顯示名稱</span>
                  <input style={inputStyle} value={field.label} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { label: event.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>填寫方式</span>
                  <select style={inputStyle} value={field.inputType} disabled={disabled}
                    onChange={(event) => updateCustomField(index, {
                      inputType: event.target.value as ProductCustomField['inputType'],
                    })}>
                    <option value="text">自由輸入</option>
                    <option value="select">固定選項</option>
                  </select>
                </label>
                {field.inputType === 'select' && field.displayStyle !== 'price-list' ? <div>
                  <span style={labelStyle}>選項</span>
                  <OptionValuesEditor
                    values={field.values}
                    disabled={disabled}
                    inputStyle={inputStyle}
                    onChange={(values) => updateCustomField(index, {
                      values,
                      swatches: field.displayStyle === 'swatches'
                        ? Object.fromEntries(
                          (values ?? []).map((option) => [
                            option,
                            field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR,
                          ]),
                        )
                        : field.swatches,
                      swatchImages: field.swatchImages
                        ? Object.fromEntries(
                          (values ?? [])
                            .filter((option) => field.swatchImages?.[option])
                            .map((option) => [option, field.swatchImages![option]]),
                        )
                        : undefined,
                    })}
                  />
                </div> : <div />}
                {field.inputType === 'select' ? <label>
                  <span style={labelStyle}>商城顯示方式</span>
                  <select
                    style={inputStyle}
                    value={field.displayStyle ?? 'select'}
                    disabled={disabled}
                    onChange={(event) => {
                      const displayStyle = event.target.value as ProductCustomField['displayStyle']
                      updateCustomField(index, {
                        displayStyle: displayStyle === 'select' ? undefined : displayStyle,
                        swatches: displayStyle === 'swatches'
                          ? Object.fromEntries(
                            (field.values ?? []).map((option) => [
                              option,
                              field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR,
                            ]),
                          )
                          : undefined,
                        optionPrices: displayStyle === 'price-list'
                          ? Object.fromEntries(
                            (field.values ?? []).map((option) => [
                              option,
                              field.optionPrices?.[option] ?? 0,
                            ]),
                          )
                          : undefined,
                        optionNotes: displayStyle === 'price-list' ? field.optionNotes : undefined,
                        allowCustomValue: displayStyle === 'swatches'
                          ? field.allowCustomValue
                          : undefined,
                      })
                    }}
                  >
                    <option value="select">下拉選單</option>
                    <option value="swatches">色票圈圈</option>
                    <option value="price-list">價格選項清單</option>
                  </select>
                </label> : <div />}
              </div>
              {field.inputType === 'select' && field.displayStyle === 'price-list' ? (
                <div style={{ marginTop: 10 }}>
                  <span style={labelStyle}>價格選項（名稱、固定成交價、說明）</span>
                  <PriceOptionsEditor
                    field={field}
                    disabled={disabled}
                    inputStyle={inputStyle}
                    onChange={(patch) => updateCustomField(index, patch)}
                  />
                </div>
              ) : null}
              {field.inputType === 'select' && field.displayStyle === 'swatches' ? (
                <div style={{ marginTop: 10 }}>
                  <span style={labelStyle}>色票設定</span>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={field.allowCustomValue === true}
                      disabled={disabled}
                      onChange={(event) => updateCustomField(index, {
                        allowCustomValue: event.target.checked || undefined,
                      })}
                    />
                    {' '}允許客人輸入其他 Pantone 色號
                  </label>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {(field.values ?? []).map((option) => (
                      <div
                        key={option}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr auto' : 'minmax(150px, 1fr) 110px 72px',
                          alignItems: 'center',
                          gap: 10,
                          padding: 8,
                          border: `1px solid ${designSystem.colors.border.light}`,
                          borderRadius: designSystem.borderRadius.sm,
                          fontSize: 12,
                        }}
                      >
                        <label>
                          <span style={labelStyle}>顏色名稱</span>
                          <input
                            style={inputStyle}
                            value={option}
                            disabled={disabled}
                            onChange={(event) => {
                              const nextName = event.target.value
                              const values = (field.values ?? []).map((value) =>
                                value === option ? nextName : value
                              )
                              const swatches = { ...field.swatches }
                              const swatchImages = { ...field.swatchImages }
                              swatches[nextName] = swatches[option] ?? DEFAULT_SWATCH_COLOR
                              if (swatchImages[option]) swatchImages[nextName] = swatchImages[option]
                              if (nextName !== option) {
                                delete swatches[option]
                                delete swatchImages[option]
                              }
                              updateCustomField(index, { values, swatches, swatchImages })
                            }}
                          />
                        </label>
                        <label>
                          <span style={labelStyle}>色碼</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="color"
                              value={field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR}
                              disabled={disabled}
                              onChange={(event) => updateCustomField(index, {
                                swatches: { ...field.swatches, [option]: event.target.value },
                              })}
                            />
                            <span>{field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR}</span>
                          </div>
                        </label>
                        <div style={{ gridColumn: isMobile ? '1 / -1' : undefined }}>
                          <span style={labelStyle}>參考圖片</span>
                          <ImageUploader
                            value={field.swatchImages?.[option]?.url}
                            path={field.swatchImages?.[option]?.path}
                            storageFolder="covers"
                            entityId={`${productId ?? 'new'}-swatches`}
                            disabled={disabled}
                            size={56}
                            square
                            emptyLabel="上傳"
                            onUpload={onImageUpload}
                            onChange={(image) => {
                              const swatchImages = { ...field.swatchImages }
                              if (image.url) {
                                swatchImages[option] = {
                                  url: image.url,
                                  ...(image.path ? { path: image.path } : {}),
                                }
                              } else {
                                delete swatchImages[option]
                              }
                              updateCustomField(index, { swatchImages })
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
                <label>
                  <span style={labelStyle}>輸入提示</span>
                  <input style={inputStyle} value={field.placeholder ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { placeholder: event.target.value || undefined })} />
                </label>
                <div style={{ gridColumn: isMobile ? undefined : 'span 2' }}>
                  <span style={labelStyle}>顯示條件</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>當</span>
                  <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={visibilitySource} disabled={disabled}
                    onChange={(event) => {
                      const [kind, key] = event.target.value.split(':')
                      updateCustomField(index, {
                        visibility: kind === 'axis' && key
                          ? { axis: { key, value: '' } }
                          : kind === 'custom' && key
                            ? { customField: { key, value: '' } }
                            : undefined,
                      })
                    }}>
                    <option value="">任何情況</option>
                    {value.variantFields.axis.map((axis) => (
                      <option key={`axis:${axis.key}`} value={`axis:${axis.key}`}>SKU：{axis.label}</option>
                    ))}
                    {value.customFields.slice(0, index)
                      .filter((candidate) => candidate.inputType === 'select')
                      .map((candidate) => (
                        <option key={`custom:${candidate.key}`} value={`custom:${candidate.key}`}>
                          客製：{candidate.label}
                        </option>
                      ))}
                  </select>
                  {visibilitySource ? <>
                  <span>為</span>
                  <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={visibilityValue} disabled={disabled}
                    onChange={(event) => {
                      if (axisVisibility) {
                        updateCustomField(index, {
                          visibility: { axis: { ...axisVisibility, value: event.target.value } },
                        })
                      } else if (customVisibility) {
                        updateCustomField(index, {
                          visibility: { customField: { ...customVisibility, value: event.target.value } },
                        })
                      }
                    }}>
                    <option value="">請選擇</option>
                    {((axisVisibility
                      ? value.variantFields.axis.find((axis) => axis.key === axisVisibility.key)?.values
                      : customVisibilitySource?.values) ?? [])
                      .map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <span>時顯示</span>
                  </> : <span>都顯示</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    <input type="checkbox" checked={field.required === true} disabled={disabled}
                      onChange={(event) => updateCustomField(index, { required: event.target.checked || undefined })} />
                    {' '}必填
                  </label>
                  <label style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                    <input type="checkbox" checked={field.readOnly === true} disabled={disabled}
                      onChange={(event) => updateCustomField(index, { readOnly: event.target.checked || undefined })} />
                    {' '}固定文字
                  </label>
                  <Button variant="danger" size="small" disabled={disabled}
                    onClick={() => onChange({
                      ...value,
                      customFields: value.customFields.filter((_, i) => i !== index),
                    })}>
                    移除
                  </Button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginTop: 8 }}>
                <label>
                  <span style={labelStyle}>給客人的說明</span>
                  <input style={inputStyle} value={field.help ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { help: event.target.value || undefined })} />
                </label>
                <label>
                  <span style={labelStyle}>未填時帶入文字</span>
                  <input style={inputStyle} value={field.defaultDisplay ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { defaultDisplay: event.target.value || undefined })} />
                </label>
              </div>
              <details style={{ marginTop: 8, fontSize: 12, color: designSystem.colors.text.secondary }}>
                <summary style={{ cursor: 'pointer' }}>進階設定</summary>
                <label style={{ display: 'block', maxWidth: 280, marginTop: 8 }}>
                  <span style={labelStyle}>系統代碼（建立後請勿修改）</span>
                  <input style={inputStyle} value={field.key} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { key: event.target.value })} />
                </label>
              </details>
              </div>
            </details>
          )
        })}
      </div>

      <details
        style={{
          borderTop: `1px solid ${designSystem.colors.border.light}`,
          paddingTop: 10,
          color: designSystem.colors.text.secondary,
        }}
      >
        <summary style={{ cursor: 'pointer', fontSize: 13 }}>
          更多設定（商品資料 {value.variantFields.detail.length} 項）
        </summary>
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <Button
              variant="outline"
              size="small"
              disabled={disabled}
              onClick={() => addVariantField('detail')}
            >
              + 新增商品資料
            </Button>
          </div>
          {value.variantFields.detail.map((field, index) => renderField(field, index, 'detail'))}
          {value.customFields.map((field, index) => ({ field, index }))
            .filter(({ field }) => field.readOnly)
            .map(({ field, index }) => (
              <details
                key={`fixed-${field.key}`}
                style={{
                  marginTop: 8,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  borderRadius: designSystem.borderRadius.sm,
                  background: designSystem.colors.background.card,
                }}
              >
                <summary style={{ padding: 12, cursor: 'pointer' }}>
                  {field.label}：{field.defaultDisplay || '固定文字'}
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, padding: '0 12px 12px' }}>
                  <label>
                    <span style={labelStyle}>名稱</span>
                    <input style={inputStyle} value={field.label} disabled={disabled}
                      onChange={(event) => updateCustomField(index, { label: event.target.value })} />
                  </label>
                  <label>
                    <span style={labelStyle}>固定顯示內容</span>
                    <input style={inputStyle} value={field.defaultDisplay ?? ''} disabled={disabled}
                      onChange={(event) => updateCustomField(index, { defaultDisplay: event.target.value || undefined })} />
                  </label>
                </div>
              </details>
            ))}
        </div>
      </details>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        style={{
          justifySelf: 'start',
          border: 0,
          padding: 0,
          background: 'transparent',
          color: designSystem.colors.danger[700],
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        改回一般商品模式
      </button>
    </div>
  )
}
