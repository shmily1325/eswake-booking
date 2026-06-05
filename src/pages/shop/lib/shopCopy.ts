/**
 * Shop 文案 — 見 shopUiStyle.ts
 * 英文：控制項、badge、分類、Filter drawer CTA。中文：空狀態、錯誤、搜尋 placeholder。不寫副標／教學句。
 */

export const SHOP_LABEL = {
  filter: 'Filter',
  sort: 'Sort',
  brand: 'Brand',
  availability: 'Availability',
  category: 'Category',
  preOrder: 'Pre-Order',
  preOrderOnly: 'Pre-Order only',
  clear: 'Clear',
  clearAll: 'Clear all',
  all: 'All',
  catalog: 'Catalog',
  allProducts: 'All Products',
  newest: 'Newest',
  priceAsc: 'Price: Low → High',
  priceDesc: 'Price: High → Low',
  sortBy: 'Sort by',
} as const

export const SHOP_COPY = {
  tagline: 'Eat · Sleep · Wake',
  preOrderHint: '預購商品 · 詳情請 LINE 確認',
  showResults: (n: number) => `Show ${n}`,
  viewingAll: '全部商品',
  emptySearch: (q: string) => `找不到符合「${q}」的商品`,
  emptyFilter: '沒有符合篩選條件的商品',
  emptyPreOrder: '目前沒有開放預購的商品',
  emptyCatalog: '目前還沒有上架商品',
  loadError: '暫時無法載入商品',
  reload: '重新載入',
  searchContext: (q: string) => `搜尋「${q}」`,
  searchPlaceholder: '搜尋品牌或型號',
  clearFilters: '清除篩選',
} as const
