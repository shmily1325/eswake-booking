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

const DEFAULT_SWATCH_COLOR = '#d1d5db'

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
    <div
      key={`${group}-${index}`}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : '1.2fr 130px 1.5fr 100px 1.2fr auto',
        gap: 8,
        alignItems: 'end',
        marginBottom: 8,
        padding: 10,
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.sm,
      }}
    >
      <label>
        <span style={labelStyle}>{group === 'axis' ? '顯示名稱' : '資料名稱'}</span>
        <input
          style={inputStyle}
          value={field.label}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, { label: event.target.value })}
        />
      </label>
      <label>
        <span style={labelStyle}>填寫方式</span>
        <select
          style={inputStyle}
          value={field.inputType}
          disabled={disabled}
          onChange={(event) => updateVariantField(group, index, {
            inputType: event.target.value as ProductOptionField['inputType'],
          })}
        >
          <option value="text">自由輸入</option>
          <option value="select">固定選項</option>
        </select>
      </label>
      {field.inputType === 'select' ? <label>
        <span style={labelStyle}>可選內容（逗號分隔）</span>
        <input
          style={inputStyle}
          value={csv(field.values)}
          disabled={disabled}
          placeholder="例如：空板, 客製色, Full Carbon"
          onChange={(event) => updateVariantField(group, index, {
            values: parseCsv(event.target.value),
          })}
        />
      </label> : <div />}
      <label>
        <span style={labelStyle}>單位（選填）</span>
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
        <span style={labelStyle}>給店員的說明</span>
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
      <details style={{ gridColumn: '1 / -1', fontSize: 12, color: designSystem.colors.text.secondary }}>
        <summary style={{ cursor: 'pointer' }}>進階設定</summary>
        <label style={{ display: 'block', maxWidth: 280, marginTop: 8 }}>
          <span style={labelStyle}>系統代碼（建立後請勿修改）</span>
          <input
            style={inputStyle}
            value={field.key}
            disabled={disabled}
            onChange={(event) => updateVariantField(group, index, { key: event.target.value })}
          />
        </label>
      </details>
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          padding: 12,
          borderRadius: designSystem.borderRadius.sm,
          background: designSystem.colors.secondary[50],
          color: designSystem.colors.text.secondary,
          fontSize: 13,
          lineHeight: 1.55,
        }}
      >
        客人先選商品規格，系統會切換到對應的 SKU 與價格。需要客人另外填寫的資料，請放在「客製需求」。
      </div>
      {([
        ['axis', '客人可選的規格'],
        ['detail', '選定後顯示的商品資料'],
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
              + 新增{group === 'axis' ? '規格' : '資料'}
            </Button>
          </div>
          <p style={{ margin: '0 0 8px', color: designSystem.colors.text.secondary, fontSize: 12 }}>
            {group === 'axis'
              ? '例如：尺寸、板面材質。不同組合可以設定不同價格。'
              : '例如：寬度、厚度、容量。這些資料不會變成選擇按鈕。'}
          </p>
          {value.variantFields[group].map((field, index) => renderField(field, index, group))}
          {value.variantFields[group].length === 0 && (
            <div style={{ color: designSystem.colors.text.disabled, fontSize: 13 }}>尚無欄位</div>
          )}
        </div>
      ))}

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
        <p style={{ margin: '0 0 8px', color: designSystem.colors.text.secondary, fontSize: 12 }}>
          例如：選擇客製色後，讓客人填寫 Pantone 色號。
        </p>
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
                {field.inputType === 'select' ? <label>
                  <span style={labelStyle}>可選內容（逗號分隔）</span>
                  <input style={inputStyle} value={csv(field.values)}
                    disabled={disabled}
                    onChange={(event) => {
                      const values = parseCsv(event.target.value)
                      updateCustomField(index, {
                        values,
                        swatches: field.displayStyle === 'swatches'
                          ? Object.fromEntries(
                            (values ?? []).map((option) => [
                              option,
                              field.swatches?.[option] ?? DEFAULT_SWATCH_COLOR,
                            ]),
                          )
                          : field.swatches,
                      })
                    }} />
                </label> : <div />}
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
                <label>
                  <span style={labelStyle}>選了哪個規格才顯示</span>
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
                  <span style={labelStyle}>選到哪個內容</span>
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
        改回一般商品模式
      </button>
    </div>
  )
}
