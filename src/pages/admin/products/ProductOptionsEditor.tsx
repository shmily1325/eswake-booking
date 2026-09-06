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

interface ProductOptionsEditorProps {
  value: ProductOptionConfig | null
  onChange: (value: ProductOptionConfig | null) => void
  disabled?: boolean
  isMobile?: boolean
  defaultVariantFields?: readonly FieldDef[]
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

export function ProductOptionsEditor({
  value,
  onChange,
  disabled = false,
  isMobile = false,
  defaultVariantFields = [],
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
          const visibility = field.visibility?.axis
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
                  {visibility ? ` · ${value.variantFields.axis.find((axis) => axis.key === visibility.key)?.label ?? visibility.key}為 ${visibility.value} 時顯示` : ''}
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
                {field.inputType === 'select' ? <div>
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
                        displayStyle: displayStyle === 'swatches' ? 'swatches' : undefined,
                        swatches: displayStyle === 'swatches'
                          ? Object.fromEntries(
                            (field.values ?? []).map((option) => [
                              option,
                              field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR,
                            ]),
                          )
                          : undefined,
                      })
                    }}
                  >
                    <option value="select">下拉選單</option>
                    <option value="swatches">色票圈圈</option>
                  </select>
                </label> : <div />}
              </div>
              {field.inputType === 'select' && field.displayStyle === 'swatches' ? (
                <div style={{ marginTop: 10 }}>
                  <span style={labelStyle}>色票顏色</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(field.values ?? []).map((option) => (
                      <label
                        key={option}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 8px',
                          border: `1px solid ${designSystem.colors.border.light}`,
                          borderRadius: designSystem.borderRadius.sm,
                          fontSize: 12,
                        }}
                      >
                        <input
                          type="color"
                          value={field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR}
                          disabled={disabled}
                          onChange={(event) => updateCustomField(index, {
                            swatches: {
                              ...field.swatches,
                              [option]: event.target.value,
                            },
                          })}
                        />
                        {option}
                      </label>
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
                  <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={visibility?.key ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, {
                      visibility: event.target.value
                        ? { axis: { key: event.target.value, value: '' } }
                        : undefined,
                    })}>
                    <option value="">任何情況</option>
                    {value.variantFields.axis.map((axis) => (
                      <option key={axis.key} value={axis.key}>{axis.label}</option>
                    ))}
                  </select>
                  {visibility ? <>
                  <span>為</span>
                  <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={visibility.value} disabled={disabled}
                    onChange={(event) => visibility && updateCustomField(index, {
                      visibility: { axis: { ...visibility, value: event.target.value } },
                    })}>
                    <option value="">請選擇</option>
                    {(value.variantFields.axis.find((axis) => axis.key === visibility.key)?.values ?? [])
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
