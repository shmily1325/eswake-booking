export interface ProductDataIssues {
  unlisted: boolean
  missingPrice: boolean
  missingImage: boolean
  missingCover: boolean
  missingLabel: boolean
}

export type SelectedProductDataIssues = ProductDataIssues

/**
 * 資料問題在同一組內採 OR：勾選多個問題時，顯示符合任一問題的 SKU。
 * 不同篩選組（分類、品牌、庫存、資料問題、檔期、搜尋）仍採 AND。
 */
export function matchesSelectedDataIssues(
  issues: ProductDataIssues,
  selected: SelectedProductDataIssues,
): boolean {
  const selectedKeys = (Object.keys(selected) as Array<keyof SelectedProductDataIssues>)
    .filter((key) => selected[key])

  return selectedKeys.length === 0 || selectedKeys.some((key) => issues[key])
}
