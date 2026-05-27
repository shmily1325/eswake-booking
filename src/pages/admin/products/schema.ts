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
  /** 編輯欄位時的 placeholder 提示，例如「3、3/2」 */
  placeholder?: string
  /**
   * 顯示時自動附加在值後面的單位後綴（DB 不存）
   * 例如 thickness = "3" + displaySuffix "mm" → 顯示 "3mm"
   */
  displaySuffix?: string
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
      // 全部允許留空（required: false），匯入舊資料時很多欄位是缺漏的
      {
        key: 'gender',
        label: 'M/F',
        type: 'select',
        options: ['M', 'F'],
        required: false,
      },
      {
        key: 'age_group',
        label: '年齡層',
        type: 'select',
        options: ['Adult', 'Teen', 'Child', 'Infant'],
        required: false,
      },
      // 字母尺碼（M / S / L / XS6 / M10 / 3XL / 4XL...），用 text 接受廠商各種編碼
      { key: 'size', label: '尺寸', type: 'text', required: false },
      // C/W 用 text 是為了支援童裝的區間值，例如 "71-81"
      { key: 'chest', label: 'C', type: 'text', required: false },
      { key: 'waist', label: 'W', type: 'text', required: false },
      { key: 'color', label: '顏色', type: 'text', required: false },
    ],
  },
  wetsuit: {
    id: 'wetsuit',
    name: '防寒衣',
    sortOrder: 20,
    icon: '🧥',
    fields: [
      // 跟救生衣相同的 gender 設計，全部允許留空
      {
        key: 'gender',
        label: 'M/F',
        type: 'select',
        options: ['M', 'F'],
        required: false,
      },
      // 厚度只存純數字（3 / 3/2 / 5/4），顯示時自動附加 "mm"
      // 好處：使用者不會打錯單位、搜尋時打數字就能找到
      {
        key: 'thickness',
        label: '厚度 (mm)',
        type: 'text',
        required: false,
        placeholder: '3 或 3/2',
        displaySuffix: 'mm',
      },
      {
        key: 'coverage',
        label: '全/半身',
        type: 'select',
        options: ['全身', '半身'],
        required: false,
      },
      // 尺碼系統混雜（XS/S/M/L/LG/數字…），用 text 自由填
      { key: 'size', label: '尺寸', type: 'text', required: false },
      { key: 'color', label: '顏色', type: 'text', required: false },
    ],
  },
  // ===== WB 系列 =====
  // 註：id 'wakeboard' 暫不 rename 成 'wb_board'，避免動到老大正在輸入的資料；
  // 之後做兩層 UI 時一起 rename + 寫 SQL 遷移。
  wakeboard: {
    id: 'wakeboard',
    name: 'WB 板',
    sortOrder: 30,
    icon: '🛹',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：134、137、142cm）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_boots: {
    id: 'wb_boots',
    name: 'WB 鞋',
    sortOrder: 31,
    icon: '👢',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_fin: {
    id: 'wb_fin',
    name: 'WB fin',
    sortOrder: 32,
    icon: '🪶',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_handle: {
    id: 'wb_handle',
    name: 'WB handle',
    sortOrder: 33,
    icon: '🪢',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_helmet: {
    id: 'wb_helmet',
    name: 'WB 安全帽',
    sortOrder: 34,
    icon: '⛑️',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },

  // ===== WS 系列 =====
  // 註：id 'wakesurf' 暫不 rename 成 'ws_board'，理由同上。
  wakesurf: {
    id: 'wakesurf',
    name: 'WS 板',
    sortOrder: 40,
    icon: '🏄',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：4'10"、134cm、134）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_fin: {
    id: 'ws_fin',
    name: 'WS fin',
    sortOrder: 41,
    icon: '🪶',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_pad: {
    id: 'ws_pad',
    name: 'WS 墊子',
    sortOrder: 42,
    icon: '🟫',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_handle: {
    id: 'ws_handle',
    name: 'WS handle',
    sortOrder: 43,
    icon: '🪢',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_wax: {
    id: 'ws_wax',
    name: 'WS 蠟塊',
    sortOrder: 44,
    icon: '🧱',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },

  // ===== 服飾類 =====
  apparel: {
    id: 'apparel',
    name: '服飾類',
    sortOrder: 50,
    icon: '👕',
    fields: [
      {
        key: 'gender',
        label: 'M/F',
        type: 'select',
        options: ['M', 'F'],
        required: false,
      },
      { key: 'size', label: '尺寸', type: 'text', required: false },
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
 * 例：{ thickness: '3/2', coverage: '全身', size: 'M', color: '黑' } → "3/2mm / 全身 / M / 黑"
 *
 * 會把 schema 上 field 設定的 displaySuffix 附加到值後面。
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
    .map((f) => {
      const v = attributes[f.key]
      if (v === null || v === undefined || v === '') return null
      const text = String(v)
      return f.displaySuffix ? text + f.displaySuffix : text
    })
    .filter((v): v is string => v !== null)
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
