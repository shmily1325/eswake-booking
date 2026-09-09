import { describe, expect, it } from 'vitest'
import {
  buildSelectedOptionSnapshot,
  createVibesCustomOrderConfig,
  findMissingAxisCombinations,
  formatOptionSelection,
  getVibesBuildSettings,
  getVibesColorSettings,
  isVibesCustomOrderConfig,
  normalizeProductOptionConfig,
  pruneHiddenCustomValues,
  resolveCustomPriceRange,
  resolveVariantFields,
  resolveCustomSelectionPrice,
  setVibesColorSettings,
  setVibesSizeValues,
  stableOptionIdentity,
  updateVibesBuildSetting,
  validateProductOptionConfig,
  validateVibesCustomOrderConfig,
  visibleCustomFields,
  validateCustomSelection,
  type ProductOptionConfig,
} from '../productOptions'

const config: ProductOptionConfig = {
  version: 1,
  variantFields: {
    axis: [
      { key: 'size', label: '尺寸', inputType: 'select', values: ['S', 'M'] },
      { key: 'color', label: '顏色', inputType: 'select', values: ['黑', '白'] },
    ],
    detail: [{ key: 'length', label: '長度', inputType: 'text', suffix: 'cm' }],
  },
  customFields: [
    { key: 'name', label: '姓名', inputType: 'text', required: true },
    {
      key: 'black_note',
      label: '黑色備註',
      inputType: 'text',
      visibility: { axis: { key: 'color', value: '黑' } },
    },
  ],
}

describe('product options core', () => {
  it('normalizes v1 config and rejects unsupported versions', () => {
    expect(normalizeProductOptionConfig(config)).toEqual(config)
    expect(normalizeProductOptionConfig({ ...config, version: 2 })).toBeNull()
  })

  it('validates duplicate keys and select values', () => {
    const invalid: ProductOptionConfig = {
      ...config,
      variantFields: {
        axis: [{ key: 'size', label: '尺寸', inputType: 'select' }],
        detail: [{ key: 'size', label: '尺寸細節', inputType: 'text' }],
      },
    }
    const messages = validateProductOptionConfig(invalid).map((issue) => issue.message)
    expect(messages).toContain('下拉欄位至少需要一個選項')
    expect(messages).toContain('key 不可重複')
  })

  it('keeps category fields only when config is null', () => {
    const legacy = [{ key: 'legacy', label: '舊欄位', type: 'text' as const }]
    expect(resolveVariantFields(null, legacy)).toEqual(legacy)
    expect(
      resolveVariantFields(
        {
          version: 1,
          variantFields: { axis: [], detail: [] },
          customFields: [],
        },
        legacy,
      ),
    ).toEqual(legacy)
    expect(resolveVariantFields(config, legacy).map((field) => field.key)).toEqual(['size', 'color', 'length'])
  })

  it('resolves visible custom fields from the axis selection', () => {
    expect(visibleCustomFields(config, { color: '白' }).map((field) => field.key)).toEqual(['name'])
    expect(visibleCustomFields(config, { color: '黑' }).map((field) => field.key)).toEqual(['name', 'black_note'])
  })

  it('formats selections and creates stable identities', () => {
    expect(formatOptionSelection(config, { size: 'M', color: '黑', length: '120' })).toBe('M / 黑 / 120cm')
    expect(stableOptionIdentity(config.variantFields.axis, { color: '黑', size: 'M' })).toBe(
      stableOptionIdentity(config.variantFields.axis, { size: 'M', color: '黑' }),
    )
  })

  it('finds only missing cartesian axis combinations', () => {
    expect(
      findMissingAxisCombinations(config.variantFields.axis, [
        { size: 'S', color: '黑' },
        { size: 'M', color: '白' },
      ]),
    ).toEqual([
      { size: 'S', color: '白' },
      { size: 'M', color: '黑' },
    ])
  })

  it('snapshots non-legacy axes and visible customer values', () => {
    expect(
      buildSelectedOptionSnapshot(config, { size: 'M', color: '黑' }, { name: 'Ming', black_note: '霧面' }, ['size']),
    ).toEqual({
      color: { label: '顏色', value: '黑' },
      name: { label: '姓名', value: 'Ming' },
      black_note: { label: '黑色備註', value: '霧面' },
    })
  })

  it('validates required visible fields only', () => {
    expect(validateCustomSelection(config, { color: '白' }, {})).toBe('姓名為必填')
    expect(validateCustomSelection(config, { color: '白' }, { name: 'Ming' })).toBeNull()
  })

  it('normalizes and validates editable color swatches', () => {
    const swatchConfig: ProductOptionConfig = {
      ...config,
      customFields: [
        {
          key: 'spray_color',
          label: '噴色',
          inputType: 'select',
          values: ['HOT PINK', 'YELLOW'],
          displayStyle: 'swatches',
          swatches: {
            'HOT PINK': '#ff4fa3',
            YELLOW: '#ffd928',
          },
          swatchImages: {
            'HOT PINK': {
              url: 'https://example.com/hot-pink.jpg',
              path: 'covers/vibes/hot-pink.jpg',
            },
          },
        },
      ],
    }
    expect(normalizeProductOptionConfig(swatchConfig)).toEqual(swatchConfig)
    expect(validateProductOptionConfig(swatchConfig)).toEqual([])
    expect(normalizeProductOptionConfig(swatchConfig)?.customFields[0].swatchImages).toEqual(
      swatchConfig.customFields[0].swatchImages,
    )
    expect(
      validateProductOptionConfig({
        ...swatchConfig,
        customFields: [
          {
            ...swatchConfig.customFields[0],
            swatches: { 'HOT PINK': '#ff4fa3' },
          },
        ],
      }).map((issue) => issue.message),
    ).toContain('YELLOW 尚未設定顯示顏色')
  })

  it('normalizes price-list metadata and resolves its fixed transaction price', () => {
    const priceConfig: ProductOptionConfig = {
      ...config,
      customFields: [
        {
          key: 'build_option',
          label: 'Build Option',
          inputType: 'select',
          values: ['Standard Build', 'Carbon Build'],
          displayStyle: 'price-list',
          optionPrices: {
            'Standard Build': 68000,
            'Carbon Build': 78000,
          },
          optionNotes: {
            'Carbon Build': 'Carbon construction',
          },
          required: true,
        },
      ],
    }
    expect(normalizeProductOptionConfig(priceConfig)).toEqual(priceConfig)
    expect(validateProductOptionConfig(priceConfig)).toEqual([])
    expect(resolveCustomSelectionPrice(priceConfig, {}, { build_option: 'Carbon Build' })).toBe(78000)
    expect(resolveCustomPriceRange(priceConfig)).toEqual({
      min: 68000,
      max: 78000,
    })
    expect(
      validateProductOptionConfig({
        ...priceConfig,
        customFields: [
          {
            ...priceConfig.customFields[0],
            optionPrices: { 'Standard Build': 68000 },
          },
        ],
      }).map((issue) => issue.message),
    ).toContain('Carbon Build 尚未設定有效價格')
    expect(
      validateProductOptionConfig({
        ...priceConfig,
        customFields: [
          {
            ...priceConfig.customFields[0],
            allowCustomValue: true,
          },
        ],
      }).map((issue) => issue.message),
    ).toContain('價格選項不可接受未定價的自訂值')
  })

  it('supports custom-field visibility and prunes hidden dependent values', () => {
    const vibesConfig: ProductOptionConfig = {
      ...config,
      customFields: [
        {
          key: 'build_option',
          label: 'Build Option',
          inputType: 'select',
          values: ['Standard Build', 'Custom Color', 'Carbon Build'],
        },
        {
          key: 'spray_color',
          label: 'Spray Color',
          inputType: 'select',
          values: ['PINK'],
          displayStyle: 'swatches',
          swatches: { PINK: '#ff4fa3' },
          allowCustomValue: true,
          visibility: { customField: { key: 'build_option', value: 'Custom Color' } },
        },
        {
          key: 'carbon_color',
          label: 'Carbon Color',
          inputType: 'select',
          values: ['BLACK'],
          visibility: { customField: { key: 'build_option', value: 'Carbon Build' } },
        },
      ],
    }
    expect(visibleCustomFields(vibesConfig, {}, { build_option: 'Custom Color' }).map((field) => field.key)).toEqual([
      'build_option',
      'spray_color',
    ])
    expect(validateCustomSelection(vibesConfig, {}, { build_option: 'Custom Color', spray_color: '186 C' })).toBeNull()
    expect(
      pruneHiddenCustomValues(
        vibesConfig,
        {},
        {
          build_option: 'Carbon Build',
          spray_color: '186 C',
          carbon_color: 'BLACK',
        },
      ),
    ).toEqual({
      build_option: 'Carbon Build',
      carbon_color: 'BLACK',
    })
    expect(
      buildSelectedOptionSnapshot(
        vibesConfig,
        {},
        {
          build_option: 'Carbon Build',
          spray_color: '186 C',
          carbon_color: 'BLACK',
        },
      ),
    ).toEqual({
      build_option: { label: 'Build Option', value: 'Carbon Build' },
      carbon_color: { label: 'Carbon Color', value: 'BLACK' },
    })
  })

  it('updates the guided VIBES editor without losing fixed color rules', () => {
    const vibesConfig: ProductOptionConfig = {
      version: 1,
      variantFields: {
        axis: [{ key: 'size', label: 'Size', inputType: 'select', values: ["4'7", "4'8"] }],
        detail: [
          { key: 'width', label: 'Width', inputType: 'text', suffix: ' in' },
          { key: 'thickness', label: 'Thickness', inputType: 'text', suffix: ' in' },
          { key: 'volume', label: 'Volume', inputType: 'text', suffix: ' L' },
        ],
      },
      customFields: [
        {
          key: 'build_option',
          label: 'Build',
          inputType: 'select',
          values: ['Standard', 'Custom Color', 'Carbon'],
          displayStyle: 'price-list',
          required: true,
          optionPrices: { Standard: 65000, 'Custom Color': 70000, Carbon: 75000 },
          optionNotes: { Standard: '標準板' },
        },
        {
          key: 'spray_color',
          label: 'Color',
          inputType: 'select',
          values: ['PINK'],
          displayStyle: 'swatches',
          required: true,
          allowCustomValue: true,
          swatches: { PINK: '#FF4FA3' },
          visibility: { customField: { key: 'build_option', value: 'Custom Color' } },
        },
        {
          key: 'standard_color',
          label: 'Color',
          inputType: 'text',
          readOnly: true,
          required: true,
          defaultDisplay: 'White',
          visibility: { customField: { key: 'build_option', value: 'Standard' } },
        },
        {
          key: 'carbon_color',
          label: 'Color',
          inputType: 'text',
          readOnly: true,
          required: true,
          defaultDisplay: 'Black',
          visibility: { customField: { key: 'build_option', value: 'Carbon' } },
        },
      ],
    }

    expect(isVibesCustomOrderConfig('ws_board', 'VIBES', vibesConfig)).toBe(true)
    expect(getVibesBuildSettings(vibesConfig).map((build) => build.price)).toEqual([65000, 70000, 75000])

    const repriced = updateVibesBuildSetting(vibesConfig, 'Standard', {
      price: 66000,
      note: '標準白色',
    })
    const recolored = setVibesColorSettings(repriced, [
      { name: 'GREEN', hex: '#50D760', image: { url: 'https://example.com/green.jpg' } },
      { name: 'PINK', hex: '#FF4FA3' },
    ])
    const resized = setVibesSizeValues(recolored, ["4'10", "4'8", "4'9", "4'8"])

    expect(getVibesBuildSettings(resized)[0]).toEqual({
      name: 'Standard',
      price: 66000,
      note: '標準白色',
    })
    expect(getVibesColorSettings(resized).map((color) => color.name)).toEqual(['GREEN', 'PINK'])
    expect(resized.variantFields.axis[0].values).toEqual(["4'8", "4'9", "4'10"])
    expect(resized.customFields.find((field) => field.key === 'standard_color')).toEqual(vibesConfig.customFields[2])
    expect(resized.customFields.find((field) => field.key === 'carbon_color')).toEqual(vibesConfig.customFields[3])
    expect(validateVibesCustomOrderConfig(resized)).toEqual([])
  })

  it('creates a ready-to-edit VIBES custom product template', () => {
    const config = createVibesCustomOrderConfig()
    expect(isVibesCustomOrderConfig('ws_board', 'VIBES', config)).toBe(true)
    expect(getVibesBuildSettings(config).map(({ name, price }) => ({ name, price }))).toEqual([
      { name: 'Standard', price: 65000 },
      { name: 'Custom Color', price: 70000 },
      { name: 'Carbon', price: 75000 },
    ])
    expect(getVibesColorSettings(config)).toHaveLength(8)
    expect(config.variantFields.axis[0]).toMatchObject({ key: 'size', values: [] })
    expect(validateVibesCustomOrderConfig(config)).toEqual([])
  })
})
