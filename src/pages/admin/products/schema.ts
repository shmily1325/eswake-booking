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
 *
 * 命名沿用 Ronix 等品牌的「-ing 形」：表示「這項運動的整套裝備」，
 * 而不是單指「板子」這個物件，因為這個 group 包含 board / boots / fin / handle 等多種品項。
 *
 * 'Essentials' 代表通用品項（救生衣、防寒衣、服飾這類不分 WB/WS 的物件，
 * 不管玩什麼運動都用得到的「必備裝備」）。
 */
export type ShopGroup = 'Essentials' | 'Wakeboarding' | 'Wakesurfing'

export interface CategoryDef {
  id: string
  /** 後台顯示名稱（中文，給內部員工） */
  name: string
  /**
   * 後台 tab chip 的短標籤（例：'板' / 'fin'），用在分組（WB / WS）那兩排的小膠囊上。
   * group prefix（'WB:' / 'WS/Skim:'）已經由 row 開頭標出，chip 只需要顯示後面的名詞。
   * 省略時 fallback 用 name（適合「Essentials」那種無 group prefix 的分類）。
   */
  shortName?: string
  /** 商城前台顯示名稱（英文，給顧客）；省略時 fallback 用 name */
  shopName?: string
  /** 列表頁 Tab 顯示順序 */
  sortOrder: number
  /** 該類別預設的 emoji 圖示，無圖時 fallback 用 */
  icon: string
  fields: FieldDef[]
  /**
   * 兩層分類的上層分組（後台 + 前台共用）。
   * 後台商品管理的 tab 列、商城前台的兩層篩選都用這個欄位決定 group。
   * 省略時不會出現在商城分類列（後台仍會被歸到 Essentials 預設行為，建議都標明）。
   */
  shopGroup?: ShopGroup
}

/** 列表頁通用欄位（所有類別都有） */
export const COMMON_VARIANT_FIELDS = ['vendor_code', 'price', 'stock', 'image_url'] as const

/** SKU gender（DB 存 Male / Female；舊資料 M/F 讀取時會正規化） */
export const GENDER_VALUES = ['Male', 'Female'] as const
export type GenderValue = (typeof GENDER_VALUES)[number]

export const GENDER_FIELD: FieldDef = {
  key: 'gender',
  label: 'Gender',
  type: 'select',
  options: [...GENDER_VALUES],
  required: false,
}

/** 所有 SKU 共用：型號年份（選填） */
export const YEAR_FIELD: FieldDef = {
  key: 'year',
  label: '年份',
  type: 'text',
  required: false,
  placeholder: '例：2025',
}

/** 分類規格欄位 + 共用年份（置於最前） */
export function getSkuFields(categoryId: string | null | undefined): FieldDef[] {
  const cat = getCategory(categoryId)
  if (!cat) return [YEAR_FIELD]
  if (cat.fields.some((f) => f.key === 'year')) return cat.fields
  return [YEAR_FIELD, ...cat.fields]
}

/** 舊值 M/F → Male/Female；無法辨識則回 null */
export function normalizeGenderValue(raw: unknown): GenderValue | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower === 'm' || lower === 'male' || s === 'Male') return 'Male'
  if (lower === 'f' || lower === 'female' || s === 'Female') return 'Female'
  return null
}

/** 顯示用（formatAttributes、前台規格列） */
export function formatGenderDisplay(raw: unknown): string | null {
  return normalizeGenderValue(raw)
}

/** 搜尋別名：male / m、female / f 等都能對到 */
export function genderSearchTokens(raw: unknown): string[] {
  const g = normalizeGenderValue(raw)
  if (g === 'Male') return ['male', 'm']
  if (g === 'Female') return ['female', 'f']
  return []
}

/** 儲存前正規化 attributes（目前僅 gender） */
export function normalizeVariantAttributes(
  attributes: Record<string, string>,
): Record<string, string> {
  const out = { ...attributes }
  const g = normalizeGenderValue(out.gender)
  if (g) out.gender = g
  return out
}

export const CATEGORY_SCHEMAS: Record<string, CategoryDef> = {
  lifejacket: {
    id: 'lifejacket',
    name: '救生衣',
    // 業界術語：CGA Vest = 海巡認證救生衣（高浮力、救生用），
    //           Impact Vest = 防撞衣（低浮力、貼身、做動作用）。
    //           我們賣的是後者，所以用 Impact Vest 而非 Life Jacket。
    shopName: 'Impact Vest',
    sortOrder: 10,
    icon: '🦺',
    shopGroup: 'Essentials',
    fields: [
      // 全部允許留空（required: false），匯入舊資料時很多欄位是缺漏的
      { ...GENDER_FIELD },
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
    shopGroup: 'Essentials',
    fields: [
      { ...GENDER_FIELD },
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
    shopGroup: 'Essentials',
    fields: [
      { ...GENDER_FIELD },
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },

  // ===== WB 系列 =====
  // 註：id 已經從 'wakeboard' rename 為 'wb_board'（migration 117）。
  //     舊資料的 category 同步在 DB 改完才推 code。
  wb_board: {
    id: 'wb_board',
    name: 'WB 板',
    shortName: '板',
    shopName: 'Boards',
    sortOrder: 30,
    icon: '🛹',
    shopGroup: 'Wakeboarding',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：134、137、142cm）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_boots: {
    id: 'wb_boots',
    name: 'WB 鞋',
    shortName: '鞋',
    shopName: 'Boots',
    sortOrder: 31,
    icon: '👢',
    shopGroup: 'Wakeboarding',
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
    shortName: 'fin',
    shopName: 'Fins',
    sortOrder: 32,
    icon: '🪶',
    shopGroup: 'Wakeboarding',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_handle: {
    id: 'wb_handle',
    name: 'WB handle',
    shortName: 'handle',
    shopName: 'Ropes & Handles',
    sortOrder: 33,
    icon: '🪢',
    shopGroup: 'Wakeboarding',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_helmet: {
    id: 'wb_helmet',
    name: 'WB 安全帽',
    shortName: '安全帽',
    shopName: 'Helmet',
    sortOrder: 34,
    icon: '⛑️',
    shopGroup: 'Wakeboarding',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  wb_accessories: {
    id: 'wb_accessories',
    name: 'WB 配件',
    shortName: '配件',
    shopName: 'Accessories',
    sortOrder: 35,
    icon: '🎒',
    shopGroup: 'Wakeboarding',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
      { key: 'color', label: '顏色', type: 'text', required: false },
    ],
  },

  // ===== Wakesurfing 系列 =====
  // 註：id 已經從 'wakesurf' rename 為 'ws_board'（migration 117）。
  // 命名策略對齊業界（Ronix / Hyperlite / Liquid Force）：
  //   - top-level shopGroup 統一叫 'Wakesurfing'
  //   - Skim 是 Wakesurf 板底下的一個 sub-style，不在 top-level 並列
  //   - 後台中文 name 仍保留「WS/Skim 板」，讓老闆同時看到兩種風格都進這個分類
  ws_board: {
    id: 'ws_board',
    name: 'WS/Skim 板',
    shortName: '板',
    shopName: 'Boards',
    sortOrder: 40,
    icon: '🏄',
    shopGroup: 'Wakesurfing',
    fields: [
      // 尺寸用 text 接受廠商各種寫法（例：4'10"、134cm、134）
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_fin: {
    id: 'ws_fin',
    name: 'WS fin',
    shortName: 'fin',
    shopName: 'Fins',
    sortOrder: 41,
    icon: '🪶',
    shopGroup: 'Wakesurfing',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_pad: {
    id: 'ws_pad',
    name: 'WS 墊子',
    shortName: '墊子',
    shopName: 'Traction Pad',
    sortOrder: 42,
    icon: '🟫',
    shopGroup: 'Wakesurfing',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_handle: {
    id: 'ws_handle',
    name: 'WS handle',
    shortName: 'handle',
    shopName: 'Ropes & Handles',
    sortOrder: 43,
    icon: '🪢',
    shopGroup: 'Wakesurfing',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_wax: {
    id: 'ws_wax',
    name: 'WS 蠟塊',
    shortName: '蠟塊',
    shopName: 'Wax',
    sortOrder: 44,
    icon: '🧱',
    shopGroup: 'Wakesurfing',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
    ],
  },
  ws_accessories: {
    id: 'ws_accessories',
    name: 'WS 配件',
    shortName: '配件',
    shopName: 'Accessories',
    sortOrder: 45,
    icon: '🎒',
    shopGroup: 'Wakesurfing',
    fields: [
      { key: 'size', label: '尺寸', type: 'text', required: false },
      { key: 'color', label: '顏色', type: 'text', required: false },
    ],
  },
}

/** 取得所有類別，依 sortOrder 排序 */
export function getAllCategories(): CategoryDef[] {
  return Object.values(CATEGORY_SCHEMAS).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 商城兩層分類列要的上層分組（固定順序）。
 * 運動類別擺前面（Wakeboarding / Wakesurfing），客人通常是衝著主項目來的；
 * 'Essentials'（救生衣、防寒衣等通用品項）擺最後當補貨用。
 */
export const SHOP_GROUPS: ShopGroup[] = ['Wakeboarding', 'Wakesurfing', 'Essentials']

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
  return getSkuFields(categoryId)
    .map((f) => {
      const v = attributes[f.key]
      if (v === null || v === undefined || v === '') return null
      if (f.key === 'gender') {
        const g = formatGenderDisplay(v)
        return g
      }
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
  for (const f of getSkuFields(categoryId)) {
    if (!f.required) continue
    const v = attrs[f.key]
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) {
      errors.push(`${f.label} 為必填`)
    }
  }
  return errors
}
