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

/**
 * 商城頂層分組（兩層篩選的上排）。
 * 'All' 代表通用（救生衣、防寒衣、服飾這類不分 WB/WS 的品項）。
 */
export type ShopGroup = 'All' | 'Wakeboard' | 'Wakesurf/Skim'

export interface CategoryDef {
  id: string
  /** 後台顯示名稱（中文，給內部員工） */
  name: string
  /** 商城前台顯示名稱（英文，給顧客）；省略時 fallback 用 name */
  shopName?: string
  /** 列表頁 Tab 顯示順序 */
  sortOrder: number
  /** 該類別預設的 emoji 圖示，無圖時 fallback 用 */
  icon: string
  fields: FieldDef[]
  /**
   * 後台 tab 列分組標籤。桌機 tab 列會依此分到不同行；undefined = 一般行（最上方）。
   * 例：'WB' | 'WS'
   */
  group?: string
  /**
   * 商城前台兩層篩選的上層分組。
   * 省略時不會出現在商城分類列；建議所有對外品項都標一個 shopGroup。
   */
  shopGroup?: ShopGroup
}

/** 列表頁通用欄位（所有類別都有） */
export const COMMON_VARIANT_FIELDS = ['vendor_code', 'price', 'stock', 'image_url'] as const

export const CATEGORY_SCHEMAS: Record<string, CategoryDef> = {
  lifejacket: {
    id: 'lifejacket',
    name: '救生衣',
    shopName: 'Life Jacket',
    sortOrder: 10,
    icon: '🦺',
    shopGroup: 'All',
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
    shopName: 'Wetsuit',
    sortOrder: 20,
    icon: '🧥',
    shopGroup: 'All',
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
  // ===== 服飾類（一般行）=====
  apparel: {
    id: 'apparel',
    name: '服飾類',
    shopName: 'Apparel',
    sortOrder: 25,
    icon: '👕',
    shopGroup: 'All',
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

  // ===== WB 系列 =====
  // 註：id 已經從 'wakeboard' rename 為 'wb_board'（migration 117）。
  //     舊資料的 category 同步在 DB 改完才推 code。
  wb_board: {
    id: 'wb_board',
    name: 'WB 板',
    shopName: 'Board',
    sortOrder: 30,
    icon: '🛹',
    group: 'WB',
    shopGroup: 'Wakeboard',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：134、137、142cm）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_boots: {
    id: 'wb_boots',
    name: 'WB 鞋',
    shopName: 'Boots',
    sortOrder: 31,
    icon: '👢',
    group: 'WB',
    shopGroup: 'Wakeboard',
    fields: [
      // 鞋子尺寸只存純數字，廠商規格普遍以 cm 為主，顯示時自動附加 "cm"
      {
        key: 'size',
        label: '尺寸 (cm)',
        type: 'text',
        required: false,
        placeholder: '例：26',
        displaySuffix: 'cm',
      },
      // Open Toe（其他俱樂部訂購用）vs Closed Toe，兩種款式都會進
      {
        key: 'toe_style',
        label: 'Toe 款式',
        type: 'select',
        options: ['Open Toe', 'Closed Toe'],
        required: false,
      },
    ],
  },
  wb_fin: {
    id: 'wb_fin',
    name: 'WB fin',
    shopName: 'Fin',
    sortOrder: 32,
    icon: '🪶',
    group: 'WB',
    shopGroup: 'Wakeboard',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_handle: {
    id: 'wb_handle',
    name: 'WB handle',
    shopName: 'Handle',
    sortOrder: 33,
    icon: '🪢',
    group: 'WB',
    shopGroup: 'Wakeboard',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_helmet: {
    id: 'wb_helmet',
    name: 'WB 安全帽',
    shopName: 'Helmet',
    sortOrder: 34,
    icon: '⛑️',
    group: 'WB',
    shopGroup: 'Wakeboard',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },

  // ===== WS 系列 =====
  // 註：id 已經從 'wakesurf' rename 為 'ws_board'（migration 117）。
  ws_board: {
    id: 'ws_board',
    name: 'WS 板',
    shopName: 'Surf Board',
    sortOrder: 40,
    icon: '🏄',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：4'10"、134cm、134）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_fin: {
    id: 'ws_fin',
    name: 'WS fin',
    shopName: 'Fin',
    sortOrder: 41,
    icon: '🪶',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_pad: {
    id: 'ws_pad',
    name: 'WS 墊子',
    shopName: 'Pad',
    sortOrder: 42,
    icon: '🟫',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_handle: {
    id: 'ws_handle',
    name: 'WS handle',
    shopName: 'Handle',
    sortOrder: 43,
    icon: '🪢',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_wax: {
    id: 'ws_wax',
    name: 'WS 蠟塊',
    shopName: 'Wax',
    sortOrder: 44,
    icon: '🧱',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },

  // ===== Skim（歸在 WS 群組）=====
  ws_skim: {
    id: 'ws_skim',
    name: 'Skim 板',
    shopName: 'Skim Board',
    sortOrder: 45,
    icon: '🏖️',
    group: 'WS',
    shopGroup: 'Wakesurf/Skim',
    fields: [
      // 跟 wakesurf 板共用「自由填」的 size，廠商規格寫法很雜（cm、英吋、自訂代號）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
}

/** 取得所有類別，依 sortOrder 排序 */
export function getAllCategories(): CategoryDef[] {
  return Object.values(CATEGORY_SCHEMAS).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 商城兩層分類列要的上層分組（固定順序）。
 * 第一順位是 'All'（通用品項），其後是運動類別。
 */
export const SHOP_GROUPS: ShopGroup[] = ['All', 'Wakeboard', 'Wakesurf/Skim']

/** 取分類在商城前台要顯示的名稱（英文優先，fallback 用中文 name） */
export function getCategoryShopName(cat: CategoryDef): string {
  return cat.shopName ?? cat.name
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
