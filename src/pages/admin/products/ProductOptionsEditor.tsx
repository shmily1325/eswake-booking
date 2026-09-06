import type { CSSProperties } from 'react'
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

function csv(values: string[] | undefined): string {
  return values?.join(', ') ?? ''
}

function parseCsv(value: string): string[] | undefined {
  const values = Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)))
  return values.length > 0 ? values : undefined
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
          目前沿用商品類別的既有規格欄位。
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
          啟用自訂商品選項
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
    <div
      key={`${group}-${index}`}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1.2fr 110px 1.4fr 90px 1.2fr auto',
        gap: 8,
        alignItems: 'end',
        marginBottom: 8,
      }}
    >
      <label>
        <span style={labelStyle}>key</span>
        <input
          style={inputStyle}
          value={field.key}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, { key: event.target.value })}
        />
      </label>
      <label>
        <span style={labelStyle}>名稱</span>
        <input
          style={inputStyle}
          value={field.label}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, { label: event.target.value })}
        />
      </label>
      <label>
        <span style={labelStyle}>輸入方式</span>
        <select
          style={inputStyle}
          value={field.inputType}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, {
            inputType: event.target.value as ProductOptionField['inputType'],
          })}
        >
          <option value="text">文字</option>
          <option value="select">下拉</option>
        </select>
      </label>
      <label>
        <span style={labelStyle}>選項（逗號分隔）</span>
        <input
          style={inputStyle}
          value={csv(field.values)}
          disabled={disabled || field.inputType !== 'select'}
          placeholder="S, M, L"
          onChange={(event) => updateVariantField(group, index, {
            values: parseCsv(event.target.value),
          })}
        />
      </label>
      <label>
        <span style={labelStyle}>單位後綴</span>
        <input
          style={inputStyle}
          value={field.suffix ?? ''}
          disabled={disabled}
          placeholder="cm"
          onChange={(event) => updateVariantField(group, index, {
            suffix: event.target.value || undefined,
          })}
        />
      </label>
      <label>
        <span style={labelStyle}>說明</span>
        <input
          style={inputStyle}
          value={field.help ?? ''}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, {
            help: event.target.value || undefined,
          })}
        />
      </label>
      <Button
        variant="danger"
        size="small"
        disabled={disabled}
        onClick={() => removeVariantField(group, index)}
      >
        移除
      </Button>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {([
        ['axis', '規格軸（每種組合各一筆 SKU）'],
        ['detail', 'SKU 詳細欄位'],
      ] as const).map(([group, title]) => (
        <div key={group}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ flex: 1, fontSize: 14 }}>{title}</strong>
            <Button
              variant="outline"
              size="small"
              disabled={disabled}
              onClick={() => addVariantField(group)}
            >
              + 新增
            </Button>
          </div>
          {value.variantFields[group].map((field, index) => renderField(field, index, group))}
          {value.variantFields[group].length === 0 && (
            <div style={{ color: designSystem.colors.text.disabled, fontSize: 13 }}>尚無欄位</div>
          )}
        </div>
      ))}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ flex: 1, fontSize: 14 }}>顧客填寫欄位</strong>
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
            + 新增
          </Button>
        </div>
        {value.customFields.map((field, index) => {
          const visibility = field.visibility?.axis
          return (
            <div
              key={`custom-${index}`}
              style={{
                padding: 10,
                marginBottom: 8,
                border: `1px solid ${designSystem.colors.border.light}`,
                borderRadius: designSystem.borderRadius.sm,
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1.2fr 120px 1.5fr', gap: 8 }}>
                <label>
                  <span style={labelStyle}>key</span>
                  <input style={inputStyle} value={field.key} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { key: event.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>名稱</span>
                  <input style={inputStyle} value={field.label} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { label: event.target.value })} />
                </label>
                <label>
                  <span style={labelStyle}>輸入方式</span>
                  <select style={inputStyle} value={field.inputType} disabled={disabled}
                    onChange={(event) => updateCustomField(index, {
                      inputType: event.target.value as ProductCustomField['inputType'],
                    })}>
                    <option value="text">文字</option>
                    <option value="select">下拉</option>
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>選項（逗號分隔）</span>
                  <input style={inputStyle} value={csv(field.values)}
                    disabled={disabled || field.inputType !== 'select'}
                    onChange={(event) => updateCustomField(index, { values: parseCsv(event.target.value) })} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: 8, marginTop: 8, alignItems: 'end' }}>
                <label>
                  <span style={labelStyle}>placeholder / 提示</span>
                  <input style={inputStyle} value={field.placeholder ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { placeholder: event.target.value || undefined })} />
                </label>
                <label>
                  <span style={labelStyle}>顯示條件（規格軸）</span>
                  <select style={inputStyle} value={visibility?.key ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, {
                      visibility: event.target.value
                        ? { axis: { key: event.target.value, value: '' } }
                        : undefined,
                    })}>
                    <option value="">永遠顯示</option>
                    {value.variantFields.axis.map((axis) => (
                      <option key={axis.key} value={axis.key}>{axis.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>條件值</span>
                  <input style={inputStyle} value={visibility?.value ?? ''} disabled={disabled || !visibility}
                    onChange={(event) => visibility && updateCustomField(index, {
                      visibility: { axis: { ...visibility, value: event.target.value } },
                    })} />
                </label>
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
                  <span style={labelStyle}>說明</span>
                  <input style={inputStyle} value={field.help ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { help: event.target.value || undefined })} />
                </label>
                <label>
                  <span style={labelStyle}>未填時顯示文字</span>
                  <input style={inputStyle} value={field.defaultDisplay ?? ''} disabled={disabled}
                    onChange={(event) => updateCustomField(index, { defaultDisplay: event.target.value || undefined })} />
                </label>
              </div>
            </div>
          )
        })}
      </div>

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
        停用自訂選項並改回類別預設
      </button>
    </div>
  )
}
