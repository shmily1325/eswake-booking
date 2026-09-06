import type { FieldDef } from './schema'

export const PRODUCT_OPTION_CONFIG_VERSION = 1 as const

export type ProductOptionInputType = 'text' | 'select'
export type ProductVariantFieldGroup = 'axis' | 'detail'

export interface ProductOptionField {
  key: string
  label: string
  inputType: ProductOptionInputType
  values?: string[]
  suffix?: string
  help?: string
}

export interface ProductCustomField extends ProductOptionField {
  required?: boolean
  readOnly?: boolean
  displayStyle?: 'select' | 'swatches'
  swatches?: Record<string, string>
  swatchImages?: Record<string, { url: string; path?: string }>
  placeholder?: string
  help?: string
  defaultDisplay?: string
  visibility?: {
    axis: {
      key: string
      value: string
    }
  }
}

export interface ProductOptionConfig {
  version: 1
  variantFields: {
    axis: ProductOptionField[]
    detail: ProductOptionField[]
  }
  customFields: ProductCustomField[]
}

export type SelectedOptionSnapshot = Record<string, { label: string; value: string }>

export interface OptionConfigValidationIssue {
  path: string
  message: string
}

export const EMPTY_PRODUCT_OPTION_CONFIG: ProductOptionConfig = {
  version: PRODUCT_OPTION_CONFIG_VERSION,
  variantFields: { axis: [], detail: [] },
  customFields: [],
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeValues(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  const values: string[] = []
  for (const item of value) {
    const text = cleanText(item)
    if (!text || seen.has(text)) continue
    seen.add(text)
    values.push(text)
  }
  return values.length > 0 ? values : undefined
}

function normalizeField(value: unknown): ProductOptionField | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const key = cleanText(source.key)
  const label = cleanText(source.label)
  if (!key || !label) return null
  const inputType: ProductOptionInputType = source.inputType === 'select' ? 'select' : 'text'
  const field: ProductOptionField = { key, label, inputType }
  const values = normalizeValues(source.values)
  if (values) field.values = values
  const suffix = cleanText(source.suffix)
  if (suffix) field.suffix = suffix
  const help = cleanText(source.help)
  if (help) field.help = help
  return field
}

function normalizeFields(value: unknown): ProductOptionField[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeField).filter((field): field is ProductOptionField => field !== null)
}

function normalizeCustomField(value: unknown): ProductCustomField | null {
  const base = normalizeField(value)
  if (!base || !value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const field: ProductCustomField = { ...base }
  if (source.required === true) field.required = true
  if (source.readOnly === true) field.readOnly = true
  if (source.displayStyle === 'swatches') field.displayStyle = 'swatches'
  if (source.swatches && typeof source.swatches === 'object' && !Array.isArray(source.swatches)) {
    const swatches = Object.fromEntries(
      Object.entries(source.swatches as Record<string, unknown>)
        .map(([key, color]) => [cleanText(key), cleanText(color)] as const)
        .filter(([key, color]) => key && /^#[0-9a-f]{6}$/i.test(color)),
    )
    if (Object.keys(swatches).length > 0) field.swatches = swatches
  }
  if (source.swatchImages && typeof source.swatchImages === 'object' && !Array.isArray(source.swatchImages)) {
    const swatchImages = Object.fromEntries(
      Object.entries(source.swatchImages as Record<string, unknown>)
        .map(([key, image]) => {
          if (!image || typeof image !== 'object' || Array.isArray(image)) return null
          const url = cleanText((image as Record<string, unknown>).url)
          const path = cleanText((image as Record<string, unknown>).path)
          return key.trim() && url
            ? [key.trim(), { url, ...(path ? { path } : {}) }] as const
            : null
        })
        .filter((entry): entry is readonly [string, { url: string; path?: string }] => entry !== null),
    )
    if (Object.keys(swatchImages).length > 0) field.swatchImages = swatchImages
  }
  const placeholder = cleanText(source.placeholder)
  if (placeholder) field.placeholder = placeholder
  const defaultDisplay = cleanText(source.defaultDisplay)
  if (defaultDisplay) field.defaultDisplay = defaultDisplay

  const visibility = source.visibility
  if (visibility && typeof visibility === 'object' && !Array.isArray(visibility)) {
    const axis = (visibility as Record<string, unknown>).axis
    if (axis && typeof axis === 'object' && !Array.isArray(axis)) {
      const key = cleanText((axis as Record<string, unknown>).key)
      const axisValue = cleanText((axis as Record<string, unknown>).value)
      if (key && axisValue) field.visibility = { axis: { key, value: axisValue } }
    }
  }
  return field
}

/**
 * Turns database JSON into a safe v1 config. Invalid top-level values return null,
 * which is also the compatibility signal for category-schema products.
 */
export function normalizeProductOptionConfig(value: unknown): ProductOptionConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  if (source.version !== PRODUCT_OPTION_CONFIG_VERSION) return null
  const variantFields =
    source.variantFields && typeof source.variantFields === 'object' && !Array.isArray(source.variantFields)
      ? source.variantFields as Record<string, unknown>
      : {}
  const customFields = Array.isArray(source.customFields)
    ? source.customFields
        .map(normalizeCustomField)
        .filter((field): field is ProductCustomField => field !== null)
    : []
  return {
    version: PRODUCT_OPTION_CONFIG_VERSION,
    variantFields: {
      axis: normalizeFields(variantFields.axis),
      detail: normalizeFields(variantFields.detail),
    },
    customFields,
  }
}

const VALID_KEY = /^[a-z][a-z0-9_]*$/

export function validateProductOptionConfig(
  config: ProductOptionConfig | null,
): OptionConfigValidationIssue[] {
  if (!config) return []
  const issues: OptionConfigValidationIssue[] = []
  if (config.version !== PRODUCT_OPTION_CONFIG_VERSION) {
    issues.push({ path: 'version', message: '僅支援 version=1' })
  }
  const entries: Array<{ group: string; field: ProductOptionField }> = [
    ...config.variantFields.axis.map((field) => ({ group: 'variantFields.axis', field })),
    ...config.variantFields.detail.map((field) => ({ group: 'variantFields.detail', field })),
    ...config.customFields.map((field) => ({ group: 'customFields', field })),
  ]
  const keys = new Set<string>()
  for (const { group, field } of entries) {
    const path = `${group}.${field.key || '?'}`
    if (!field.key || !VALID_KEY.test(field.key)) {
      issues.push({ path: `${path}.key`, message: 'key 須為英文小寫、數字或底線' })
    }
    if (!field.label.trim()) issues.push({ path: `${path}.label`, message: '顯示名稱不可空白' })
    if (keys.has(field.key)) issues.push({ path: `${path}.key`, message: 'key 不可重複' })
    keys.add(field.key)
    if (field.inputType === 'select' && (!field.values || field.values.length === 0)) {
      issues.push({ path: `${path}.values`, message: '下拉欄位至少需要一個選項' })
    }
    const customField = field as ProductCustomField
    if (customField.displayStyle === 'swatches') {
      if (customField.inputType !== 'select') {
        issues.push({ path: `${path}.displayStyle`, message: '色票只能用於固定選項' })
      }
      for (const value of customField.values ?? []) {
        if (!customField.swatches?.[value]) {
          issues.push({ path: `${path}.swatches`, message: `${value} 尚未設定顯示顏色` })
        }
      }
    }
  }
  const axisByKey = new Map(config.variantFields.axis.map((field) => [field.key, field]))
  for (const field of config.customFields) {
    const condition = field.visibility?.axis
    if (!condition) continue
    const axis = axisByKey.get(condition.key)
    if (!condition.value.trim()) {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: '顯示條件值不可空白',
      })
    } else if (!axis) {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: `找不到軸欄位 ${condition.key}`,
      })
    } else if (axis.values && !axis.values.includes(condition.value)) {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: `${condition.value} 不在 ${condition.key} 的選項內`,
      })
    }
  }
  return issues
}

/** The migration's all-empty v1 value is the persisted legacy/no-config sentinel. */
export function isEmptyProductOptionConfig(
  config: ProductOptionConfig | null | undefined,
): boolean {
  return Boolean(
    config
    && config.variantFields.axis.length === 0
    && config.variantFields.detail.length === 0
    && config.customFields.length === 0,
  )
}

/** Dynamic config wins; null keeps the existing category schema untouched. */
export function resolveVariantFields(
  config: ProductOptionConfig | null | undefined,
  categoryFields: readonly FieldDef[] = [],
): FieldDef[] {
  if (!config || isEmptyProductOptionConfig(config)) return [...categoryFields]
  return [...config.variantFields.axis, ...config.variantFields.detail].map((field) => ({
    key: field.key,
    label: field.label,
    type: field.inputType,
    options: field.values,
    required: config.variantFields.axis.some((axis) => axis.key === field.key),
    displaySuffix: field.suffix,
  }))
}

export function resolveProductOptionFields(
  config: ProductOptionConfig | null | undefined,
  categoryFields: readonly FieldDef[] = [],
): FieldDef[] {
  return resolveVariantFields(config, categoryFields)
}

export function visibleCustomFields(
  config: ProductOptionConfig | null | undefined,
  selection: Readonly<Record<string, unknown>>,
): ProductCustomField[] {
  if (!config) return []
  return config.customFields.filter((field) => {
    const condition = field.visibility?.axis
    return !condition || String(selection[condition.key] ?? '') === condition.value
  })
}

export const getVisibleCustomFields = visibleCustomFields

export function buildSelectedOptionSnapshot(
  config: ProductOptionConfig | null | undefined,
  variantAttributes: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
  excludedAxisKeys: readonly string[] = [],
): SelectedOptionSnapshot {
  const snapshot: SelectedOptionSnapshot = {}
  const excluded = new Set(excludedAxisKeys)
  for (const field of config?.variantFields.axis ?? []) {
    const value = printableValue(variantAttributes[field.key])
    if (value && !excluded.has(field.key)) {
      snapshot[field.key] = { label: field.label, value }
    }
  }
  for (const field of visibleCustomFields(config, variantAttributes)) {
    const value = values[field.key]?.trim() || field.defaultDisplay?.trim() || ''
    if (value) snapshot[field.key] = { label: field.label, value }
  }
  return snapshot
}

export function validateCustomSelection(
  config: ProductOptionConfig | null | undefined,
  variantAttributes: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
): string | null {
  for (const field of visibleCustomFields(config, variantAttributes)) {
    if (field.required && !values[field.key]?.trim() && !(field.readOnly && field.defaultDisplay)) {
      return `${field.label}為必填`
    }
    const value = values[field.key]?.trim()
    if (value && field.inputType === 'select' && !field.values?.includes(value)) {
      return `${field.label}的選項無效`
    }
  }
  return null
}

function printableValue(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export function formatOptionSelection(
  configOrFields:
    | ProductOptionConfig
    | readonly Pick<ProductOptionField, 'key' | 'suffix'>[],
  selection: Readonly<Record<string, unknown>>,
  separator = ' / ',
): string {
  const fields = 'variantFields' in configOrFields
    ? [...configOrFields.variantFields.axis, ...configOrFields.variantFields.detail]
    : configOrFields
  return fields
    .map((field) => {
      const value = printableValue(selection[field.key])
      return value ? `${value}${field.suffix ?? ''}` : ''
    })
    .filter(Boolean)
    .join(separator)
}

/** Deterministic identity independent of object insertion order. */
export function stableOptionIdentity(
  fields: readonly Pick<ProductOptionField, 'key'>[],
  selection: Readonly<Record<string, unknown>>,
): string {
  return fields
    .map((field) => [field.key, printableValue(selection[field.key])] as const)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export const stableSelectionIdentity = stableOptionIdentity
export const getStableOptionIdentity = stableOptionIdentity

export function stableVariantIdentity(
  selection: Readonly<Record<string, unknown>>,
  axes: readonly Pick<ProductOptionField, 'key'>[],
): string {
  return stableOptionIdentity(axes, selection)
}

export const variantIdentityKey = stableVariantIdentity

export function buildAxisCombinations(
  axes: readonly ProductOptionField[],
): Array<Record<string, string>> {
  if (axes.length === 0) return []
  let combinations: Array<Record<string, string>> = [{}]
  for (const axis of axes) {
    const values = axis.values ?? []
    if (values.length === 0) return []
    combinations = combinations.flatMap((combination) =>
      values.map((value) => ({ ...combination, [axis.key]: value })),
    )
  }
  return combinations
}

export function findMissingAxisCombinations(
  axes: readonly ProductOptionField[],
  selections: readonly Readonly<Record<string, unknown>>[],
): Array<Record<string, string>> {
  const identities = new Set(selections.map((selection) => stableOptionIdentity(axes, selection)))
  return buildAxisCombinations(axes).filter(
    (combination) => !identities.has(stableOptionIdentity(axes, combination)),
  )
}

export const generateMissingAxisCombinations = findMissingAxisCombinations
