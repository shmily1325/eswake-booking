/**
 * Shop 文案規則：標籤 / 按鈕 / badge 用英文；說明、空狀態、提示用中文。
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
  showResults: (n: number) => `顯示 ${n} 件`,
  itemCount: (n: number) => `${n} 件商品`,
  emptySearch: (q: string) => `找不到符合「${q}」的商品`,
  emptyFilter: '沒有符合篩選條件的商品',
  emptyPreOrder: '目前沒有開放預購的商品',
  emptyCatalog: '目前還沒有上架商品',
  loadError: '暫時無法載入商品',
  reload: '重新載入',
} as const
