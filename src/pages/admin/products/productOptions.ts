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
  displayStyle?: 'select' | 'swatches' | 'price-list'
  swatches?: Record<string, string>
  swatchImages?: Record<string, { url: string; path?: string }>
  optionPrices?: Record<string, number>
  optionNotes?: Record<string, string>
  allowCustomValue?: boolean
  placeholder?: string
  help?: string
  defaultDisplay?: string
  visibility?: { axis: { key: string; value: string } } | { customField: { key: string; value: string } }
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

export const VIBES_BUILD_NAMES = ['Standard', 'Custom Color', 'Carbon'] as const
export type VibesBuildName = (typeof VIBES_BUILD_NAMES)[number]

export function createVibesCustomOrderConfig(): ProductOptionConfig {
  const colors = [
    'HOT PINK',
    'YELLOW',
    'NEON GREEN',
    'SKY BLUE',
    'ORANGE CRUSH',
    'PURPLE HAZE',
    'TIFF BLUE',
    'PLATINUM GRAY',
  ]
  return {
    version: PRODUCT_OPTION_CONFIG_VERSION,
    variantFields: {
      axis: [{ key: 'size', label: 'Size', inputType: 'select', values: [] }],
      detail: [
        { key: 'width', label: 'Width', inputType: 'text', suffix: 'in' },
        { key: 'thickness', label: 'Thickness', inputType: 'text', suffix: 'in' },
        { key: 'volume', label: 'Volume', inputType: 'text', suffix: 'L' },
        { key: 'max_rider_weight_kg', label: '適用體重', inputType: 'text', suffix: ' kg 以下' },
      ],
    },
    customFields: [
      {
        key: 'build_option',
        label: 'Build',
        inputType: 'select',
        values: [...VIBES_BUILD_NAMES],
        required: true,
        displayStyle: 'price-list',
        optionPrices: {
          Standard: 65000,
          'Custom Color': 70000,
          Carbon: 75000,
        },
        optionNotes: {
          Standard: '標準板',
          'Custom Color': '可選推薦色或用Pantone色號選色',
          Carbon: '碳纖維製作・固定黑色',
        },
      },
      {
        key: 'standard_color',
        label: 'Color',
        inputType: 'text',
        required: true,
        readOnly: true,
        defaultDisplay: 'White',
        visibility: { customField: { key: 'build_option', value: 'Standard' } },
      },
      {
        key: 'spray_color',
        label: 'Color',
        inputType: 'select',
        values: colors,
        required: true,
        displayStyle: 'swatches',
        swatches: {
          'HOT PINK': '#FF4FA3',
          YELLOW: '#FFD928',
          'NEON GREEN': '#63FF33',
          'SKY BLUE': '#48BCEB',
          'ORANGE CRUSH': '#FF7A1A',
          'PURPLE HAZE': '#9B6BDB',
          'TIFF BLUE': '#55DDE0',
          'PLATINUM GRAY': '#A7A9AC',
        },
        allowCustomValue: true,
        placeholder: 'Choose a color',
        help: '可選推薦色或用Pantone色號選色',
        visibility: { customField: { key: 'build_option', value: 'Custom Color' } },
      },
      {
        key: 'carbon_color',
        label: 'Color',
        inputType: 'text',
        required: true,
        readOnly: true,
        defaultDisplay: 'Black',
        visibility: { customField: { key: 'build_option', value: 'Carbon' } },
      },
    ],
  }
}

export interface VibesBuildSetting {
  name: VibesBuildName
  price: number | null
  note: string
}

export interface VibesColorSetting {
  name: string
  hex: string
  image?: { url: string; path?: string }
}

function vibesStoredBuildName(name: VibesBuildName, field: ProductCustomField): string {
  if (name === 'Standard' && field.values?.includes('Standard Build')) return 'Standard Build'
  return name
}

export function isVibesCustomOrderConfig(
  category: string | null | undefined,
  brand: string | null | undefined,
  config: ProductOptionConfig | null | undefined,
): boolean {
  return (
    category === 'ws_board' &&
    brand?.trim().toLowerCase() === 'vibes' &&
    Boolean(config?.customFields.some((field) => field.key === 'build_option'))
  )
}

export function getVibesBuildSettings(config: ProductOptionConfig): VibesBuildSetting[] {
  const field = config.customFields.find((candidate) => candidate.key === 'build_option')
  if (!field) return []
  return VIBES_BUILD_NAMES.map((name) => {
    const storedName = vibesStoredBuildName(name, field)
    const price = field.optionPrices?.[storedName]
    return {
      name,
      price: Number.isFinite(price) ? price! : null,
      note: field.optionNotes?.[storedName] ?? '',
    }
  })
}

export function updateVibesBuildSetting(
  config: ProductOptionConfig,
  name: VibesBuildName,
  patch: { price?: number | null; note?: string },
): ProductOptionConfig {
  return {
    ...config,
    customFields: config.customFields.map((field) => {
      if (field.key !== 'build_option') return field
      const storedName = vibesStoredBuildName(name, field)
      const optionPrices = { ...field.optionPrices }
      const optionNotes = { ...field.optionNotes }
      if ('price' in patch) {
        if (patch.price == null) delete optionPrices[storedName]
        else optionPrices[storedName] = patch.price
      }
      if ('note' in patch) {
        const note = patch.note?.trim() ?? ''
        if (note) optionNotes[storedName] = note
        else delete optionNotes[storedName]
      }
      return { ...field, optionPrices, optionNotes }
    }),
  }
}

export function getVibesColorSettings(config: ProductOptionConfig): VibesColorSetting[] {
  const field = config.customFields.find((candidate) => candidate.key === 'spray_color')
  if (!field) return []
  return (field.values ?? []).map((name) => ({
    name,
    hex: field.swatches?.[name] ?? '#d1d5db',
    ...(field.swatchImages?.[name] ? { image: field.swatchImages[name] } : {}),
  }))
}

export function setVibesColorSettings(
  config: ProductOptionConfig,
  colors: readonly VibesColorSetting[],
): ProductOptionConfig {
  return {
    ...config,
    customFields: config.customFields.map((field) =>
      field.key === 'spray_color'
        ? {
            ...field,
            values: colors.map((color) => color.name),
            swatches: Object.fromEntries(colors.map((color) => [color.name, color.hex])),
            swatchImages: Object.fromEntries(
              colors.filter((color) => Boolean(color.image?.url)).map((color) => [color.name, color.image!]),
            ),
          }
        : field,
    ),
  }
}

export function setVibesSizeValues(config: ProductOptionConfig, sizes: readonly string[]): ProductOptionConfig {
  const normalized = Array.from(new Set(sizes.map((size) => size.trim()).filter(Boolean)))
  return {
    ...config,
    variantFields: {
      ...config.variantFields,
      axis: config.variantFields.axis.map((field) => (field.key === 'size' ? { ...field, values: normalized } : field)),
    },
  }
}

export function validateVibesCustomOrderConfig(config: ProductOptionConfig): string[] {
  const issues: string[] = []
  const builds = getVibesBuildSettings(config)
  for (const name of VIBES_BUILD_NAMES) {
    const build = builds.find((candidate) => candidate.name === name)
    if (!build || build.price == null || build.price < 0) issues.push(`${name} 尚未設定價格`)
  }
  const colors = getVibesColorSettings(config)
  const normalizedNames = colors.map((color) => color.name.trim().toLowerCase())
  if (normalizedNames.some((name) => !name)) issues.push('推薦色名稱不可空白')
  if (new Set(normalizedNames).size !== normalizedNames.length) issues.push('推薦色名稱不可重複')
  if (colors.some((color) => !/^#[0-9a-f]{6}$/i.test(color.hex))) issues.push('推薦色色碼格式不正確')
  return issues
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
  if (source.displayStyle === 'swatches' || source.displayStyle === 'price-list') {
    field.displayStyle = source.displayStyle
  }
  if (source.allowCustomValue === true) field.allowCustomValue = true
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
          return key.trim() && url ? ([key.trim(), { url, ...(path ? { path } : {}) }] as const) : null
        })
        .filter((entry): entry is readonly [string, { url: string; path?: string }] => entry !== null),
    )
    if (Object.keys(swatchImages).length > 0) field.swatchImages = swatchImages
  }
  if (source.optionPrices && typeof source.optionPrices === 'object' && !Array.isArray(source.optionPrices)) {
    const optionPrices = Object.fromEntries(
      Object.entries(source.optionPrices as Record<string, unknown>)
        .map(([key, price]) => [cleanText(key), typeof price === 'number' ? price : Number.NaN] as const)
        .filter(([key, price]) => key && Number.isFinite(price) && price >= 0),
    )
    if (Object.keys(optionPrices).length > 0) field.optionPrices = optionPrices
  }
  if (source.optionNotes && typeof source.optionNotes === 'object' && !Array.isArray(source.optionNotes)) {
    const optionNotes = Object.fromEntries(
      Object.entries(source.optionNotes as Record<string, unknown>)
        .map(([key, note]) => [cleanText(key), cleanText(note)] as const)
        .filter(([key, note]) => key && note),
    )
    if (Object.keys(optionNotes).length > 0) field.optionNotes = optionNotes
  }
  const placeholder = cleanText(source.placeholder)
  if (placeholder) field.placeholder = placeholder
  const defaultDisplay = cleanText(source.defaultDisplay)
  if (defaultDisplay) field.defaultDisplay = defaultDisplay

  const visibility = source.visibility
  if (visibility && typeof visibility === 'object' && !Array.isArray(visibility)) {
    const visibilitySource = visibility as Record<string, unknown>
    const axis = visibilitySource.axis
    if (axis && typeof axis === 'object' && !Array.isArray(axis)) {
      const key = cleanText((axis as Record<string, unknown>).key)
      const axisValue = cleanText((axis as Record<string, unknown>).value)
      if (key && axisValue) field.visibility = { axis: { key, value: axisValue } }
    } else {
      const customField = visibilitySource.customField
      if (customField && typeof customField === 'object' && !Array.isArray(customField)) {
        const key = cleanText((customField as Record<string, unknown>).key)
        const customValue = cleanText((customField as Record<string, unknown>).value)
        if (key && customValue) field.visibility = { customField: { key, value: customValue } }
      }
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
      ? (source.variantFields as Record<string, unknown>)
      : {}
  const customFields = Array.isArray(source.customFields)
    ? source.customFields.map(normalizeCustomField).filter((field): field is ProductCustomField => field !== null)
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

export function validateProductOptionConfig(config: ProductOptionConfig | null): OptionConfigValidationIssue[] {
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
    if (customField.displayStyle === 'price-list') {
      if (customField.inputType !== 'select') {
        issues.push({ path: `${path}.displayStyle`, message: '價格選項只能用於固定選項' })
      }
      if (customField.allowCustomValue) {
        issues.push({ path: `${path}.allowCustomValue`, message: '價格選項不可接受未定價的自訂值' })
      }
      for (const value of customField.values ?? []) {
        const price = customField.optionPrices?.[value]
        if (!Number.isFinite(price) || (price ?? -1) < 0) {
          issues.push({ path: `${path}.optionPrices`, message: `${value} 尚未設定有效價格` })
        }
      }
    }
  }
  const axisByKey = new Map(config.variantFields.axis.map((field) => [field.key, field]))
  for (let index = 0; index < config.customFields.length; index += 1) {
    const field = config.customFields[index]
    const condition = field.visibility && 'axis' in field.visibility ? field.visibility.axis : undefined
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
  for (let index = 0; index < config.customFields.length; index += 1) {
    const field = config.customFields[index]
    const condition = field.visibility && 'customField' in field.visibility ? field.visibility.customField : undefined
    if (!condition) continue
    const sourceIndex = config.customFields.findIndex((candidate) => candidate.key === condition.key)
    const source = config.customFields[sourceIndex]
    if (sourceIndex < 0 || sourceIndex >= index) {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: `顯示條件須選擇前一個客製欄位`,
      })
    } else if (source?.inputType !== 'select') {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: `${source?.label ?? condition.key} 不是固定選項欄位`,
      })
    } else if (!source.allowCustomValue && !source.values?.includes(condition.value)) {
      issues.push({
        path: `customFields.${field.key}.visibility`,
        message: `${condition.value} 不在 ${source.label} 的選項內`,
      })
    }
  }
  return issues
}

/** The migration's all-empty v1 value is the persisted legacy/no-config sentinel. */
export function isEmptyProductOptionConfig(config: ProductOptionConfig | null | undefined): boolean {
  return Boolean(
    config &&
    config.variantFields.axis.length === 0 &&
    config.variantFields.detail.length === 0 &&
    config.customFields.length === 0,
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
  variantAttributes: Readonly<Record<string, unknown>>,
  customValues: Readonly<Record<string, unknown>> = {},
): ProductCustomField[] {
  if (!config) return []
  return config.customFields.filter((field) => {
    const visibility = field.visibility
    if (!visibility) return true
    if ('axis' in visibility) {
      return String(variantAttributes[visibility.axis.key] ?? '') === visibility.axis.value
    }
    return String(customValues[visibility.customField.key] ?? '') === visibility.customField.value
  })
}

export const getVisibleCustomFields = visibleCustomFields

/** Removes values whose conditional fields are no longer visible. */
export function pruneHiddenCustomValues(
  config: ProductOptionConfig | null | undefined,
  variantAttributes: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  let next = { ...values }
  for (let pass = 0; pass < (config?.customFields.length ?? 0); pass += 1) {
    const visibleKeys = new Set(visibleCustomFields(config, variantAttributes, next).map((field) => field.key))
    const pruned = Object.fromEntries(Object.entries(next).filter(([key]) => visibleKeys.has(key)))
    if (Object.keys(pruned).length === Object.keys(next).length) return pruned
    next = pruned
  }
  return next
}

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
  for (const field of visibleCustomFields(config, variantAttributes, values)) {
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
  for (const field of visibleCustomFields(config, variantAttributes, values)) {
    if (field.required && !values[field.key]?.trim() && !(field.readOnly && field.defaultDisplay)) {
      return `${field.label}為必填`
    }
    const value = values[field.key]?.trim()
    if (value && field.inputType === 'select' && !field.allowCustomValue && !field.values?.includes(value)) {
      return `${field.label}的選項無效`
    }
  }
  return null
}

/** Returns the fixed transaction price selected by a price-list field, if any. */
export function resolveCustomSelectionPrice(
  config: ProductOptionConfig | null | undefined,
  variantAttributes: Readonly<Record<string, unknown>>,
  values: Readonly<Record<string, string>>,
): number | null {
  for (const field of visibleCustomFields(config, variantAttributes, values)) {
    if (field.displayStyle !== 'price-list') continue
    const selected = values[field.key]?.trim()
    const price = selected ? field.optionPrices?.[selected] : undefined
    if (Number.isFinite(price) && (price ?? -1) >= 0) return price!
  }
  return null
}

/** Fixed-price range advertised by configured price-list fields. */
export function resolveCustomPriceRange(
  config: ProductOptionConfig | null | undefined,
): { min: number; max: number } | null {
  const prices = (config?.customFields ?? [])
    .filter((field) => field.displayStyle === 'price-list')
    .flatMap((field) =>
      (field.values ?? [])
        .map((value) => field.optionPrices?.[value])
        .filter((price): price is number => Number.isFinite(price) && (price ?? -1) >= 0),
    )
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

function printableValue(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export function formatOptionSelection(
  configOrFields: ProductOptionConfig | readonly Pick<ProductOptionField, 'key' | 'suffix'>[],
  selection: Readonly<Record<string, unknown>>,
  separator = ' / ',
): string {
  const fields =
    'variantFields' in configOrFields
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

export function buildAxisCombinations(axes: readonly ProductOptionField[]): Array<Record<string, string>> {
  if (axes.length === 0) return []
  let combinations: Array<Record<string, string>> = [{}]
  for (const axis of axes) {
    const values = axis.values ?? []
    if (values.length === 0) return []
    combinations = combinations.flatMap((combination) => values.map((value) => ({ ...combination, [axis.key]: value })))
  }
  return combinations
}

export function findMissingAxisCombinations(
  axes: readonly ProductOptionField[],
  selections: readonly Readonly<Record<string, unknown>>[],
): Array<Record<string, string>> {
  const identities = new Set(selections.map((selection) => stableOptionIdentity(axes, selection)))
  return buildAxisCombinations(axes).filter((combination) => !identities.has(stableOptionIdentity(axes, combination)))
}

export const generateMissingAxisCombinations = findMissingAxisCombinations
