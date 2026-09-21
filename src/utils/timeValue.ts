/** 將資料庫 TIME 或文字時間統一為前端表單使用的 HH:mm。 */
export function normalizeTimeHm(
  value: string | null | undefined,
  fallback = '',
): string {
  const match = value?.match(/^([01]?\d|2[0-3]):([0-5]\d)/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : fallback
}
