import type { ProductWithVariants } from '../../admin/products/types'

export const SHOP_CATALOG_FRESH_MS = 90_000

export function isShopCatalogFresh(
  fetchedAt: number,
  now = Date.now(),
): boolean {
  return fetchedAt > 0 && now - fetchedAt < SHOP_CATALOG_FRESH_MS
}

export function prepareShopCatalog(
  products: ProductWithVariants[],
): ProductWithVariants[] {
  return products.filter((product) => product.variants.length > 0)
}

export function mergeShopCatalogProduct(
  products: ProductWithVariants[],
  product: ProductWithVariants,
): ProductWithVariants[] {
  const index = products.findIndex((item) => item.id === product.id)
  if (index === -1) return [...products, product]
  if (products[index] === product) return products
  const next = products.slice()
  next[index] = product
  return next
}
