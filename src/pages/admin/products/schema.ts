/**
 * 商品分類 schema 定義
 *
 * 設計原則：
 * - 欄位定義寫死在程式碼，要新增/修改欄位由開發者改這個檔案，重新部署
 * - DB 使用 JSONB attributes 保留彈性，加新類別不用 alter table
 * - key 一旦設定就不要改（會讓舊資料的 attributes 讀不到）
 * - 修改類型（type）或刪除欄位前，請評估舊資料是否需要遷移
 */

export type FieldType = 'text' | 'select' | 'number'

export interface FieldDef {
  /** JSONB attributes 內的鍵名，請用英文 snake_case，設定後不要改 */
  key: string
  /** 顯示名稱 */
  label: string
  /** 欄位類型 */
  type: FieldType
  /** select 的選項；type !== 'select' 時忽略 */
  options?: string[]
  /** 是否必填（前端驗證用） */
  required?: boolean
  /** 在列表頁顯示時的順序權重，數字小者先顯示；省略 = 跟著陣列順序 */
  displayOrder?: number
}

export interface CategoryDef {
  id: string
  name: string
  /** 列表頁 Tab 顯示順序 */
  sortOrder: number
  /** 該類別預設的 emoji 圖示，無圖時 fallback 用 */
  icon: string
  fields: FieldDef[]
}

/** 列表頁通用欄位（所有類別都有） */
export const COMMON_VARIANT_FIELDS = ['vendor_code', 'price', 'stock', 'image_url'] as const

export const CATEGORY_SCHEMAS: Record<string, CategoryDef> = {
  lifejacket: {
    id: 'lifejacket',
    name: '救生衣',
    sortOrder: 10,
    icon: '🦺',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: true },
      { key: 'color', label: '顏色', type: 'text' },
    ],
  },
  wetsuit: {
    id: 'wetsuit',
    name: '防寒衣',
    sortOrder: 20,
    icon: '🧥',
    fields: [
      {
        key: 'thickness',
        label: '厚度',
        type: 'select',
        options: ['1MM(半)', '2/2MM(半)', '3MM(全)', '3/2MM(全)', '5/4MM(全)'],
        required: true,
      },
      { key: 'size', label: '尺寸', type: 'text', required: true },
      { key: 'color', label: '顏色', type: 'text' },
    ],
  },
}

/** 取得所有類別，依 sortOrder 排序 */
export function getAllCategories(): CategoryDef[] {
  return Object.values(CATEGORY_SCHEMAS).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** 取得分類，找不到時 fallback 為 undefined */
export function getCategory(id: string | null | undefined): CategoryDef | undefined {
  if (!id) return undefined
  return CATEGORY_SCHEMAS[id]
}

/**
 * 把 attributes 物件依分類 schema 串成可讀字串
 * 例：{ thickness: '1MM(半)', size: 'M', color: '黑' } → "1MM(半) / M / 黑"
 */
export function formatAttributes(
  categoryId: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined
): string {
  if (!attributes) return ''
  const cat = getCategory(categoryId)
  if (!cat) {
    // 沒有對應類別時直接 join 所有 value
    return Object.values(attributes)
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => String(v))
      .join(' / ')
  }
  return cat.fields
    .map((f) => attributes[f.key])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => String(v))
    .join(' / ')
}

/**
 * 驗證 attributes 是否符合 schema（必填欄位都有值）
 * 回傳錯誤訊息陣列；空陣列代表通過
 */
export function validateAttributes(
  categoryId: string | null | undefined,
  attributes: Record<string, unknown> | null | undefined
): string[] {
  const errors: string[] = []
  const cat = getCategory(categoryId)
  if (!cat) {
    errors.push('未指定商品類別')
    return errors
  }
  const attrs = attributes ?? {}
  for (const f of cat.fields) {
    if (!f.required) continue
    const v = attrs[f.key]
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${f.label} 為必填`)
    }
  }
  return errors
}
