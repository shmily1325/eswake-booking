export interface ProductIdentityCandidate {
  id: string
  category: string
  brand: string
  model: string
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
): string {
  return [
    normalizeProductIdentityPart(category),
    normalizeProductIdentityPart(brand),
    normalizeProductIdentityPart(model),
  ].join('\u0000')
}

export function findExactProductIdentityMatch(
  products: readonly ProductIdentityCandidate[],
  category: string,
  brand: string,
  model: string,
): ProductIdentityCandidate | null {
  if (!category.trim() || !brand.trim() || !model.trim()) return null
  const key = getProductIdentityKey(category, brand, model)
  return products.find(
    product => getProductIdentityKey(product.category, product.brand, product.model) === key,
  ) ?? null
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
