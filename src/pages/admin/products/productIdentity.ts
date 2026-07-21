export interface ProductIdentityCandidate {
  id: string
  category: string
  brand: string
  model: string
  modelYear?: number | null
  coverImageUrl?: string | null
  variantCount?: number
}

export function normalizeProductIdentityPart(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-US')
}

export function getProductIdentityKey(
  category: string,
  brand: string,
  model: string,
  modelYear: number | null = null,
): string {
  return [
    normalizeProductIdentityPart(category),
    normalizeProductIdentityPart(brand),
    normalizeProductIdentityPart(model),
    modelYear == null ? 'unknown-year' : String(modelYear),
  ].join('\u0000')
}

export function findExactProductIdentityMatch(
  products: readonly ProductIdentityCandidate[],
  category: string,
  brand: string,
  model: string,
  modelYear: number | null = null,
): ProductIdentityCandidate | null {
  if (!category.trim() || !brand.trim() || !model.trim()) return null
  const key = getProductIdentityKey(category, brand, model, modelYear)
  return products.find(
    product => getProductIdentityKey(
      product.category,
      product.brand,
      product.model,
      product.modelYear ?? null,
    ) === key,
  ) ?? null
}

/** 同分類、品牌、型號的商品；年份可不同，用於建立前的人工作業提醒。 */
export function findSameModelCandidates(
  products: readonly ProductIdentityCandidate[],
  category: string,
  brand: string,
  model: string,
): ProductIdentityCandidate[] {
  if (!category.trim() || !brand.trim() || !model.trim()) return []
  const categoryKey = normalizeProductIdentityPart(category)
  const brandKey = normalizeProductIdentityPart(brand)
  const modelKey = normalizeProductIdentityPart(model)
  return products.filter(
    product =>
      normalizeProductIdentityPart(product.category) === categoryKey &&
      normalizeProductIdentityPart(product.brand) === brandKey &&
      normalizeProductIdentityPart(product.model) === modelKey,
  )
}

export function findProductIdentityCandidates(
  products: readonly ProductIdentityCandidate[],
  category: string,
  brand: string,
): ProductIdentityCandidate[] {
  const categoryKey = normalizeProductIdentityPart(category)
  const brandKey = normalizeProductIdentityPart(brand)
  if (!categoryKey || !brandKey) return []

  return products.filter(
    product =>
      normalizeProductIdentityPart(product.category) === categoryKey &&
      normalizeProductIdentityPart(product.brand) === brandKey,
  )
}
