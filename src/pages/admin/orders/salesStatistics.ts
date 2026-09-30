import type {
  OrderPaymentMethod,
  ShopOrderSettlementWithDetails,
} from './types'

export interface SalesDateRange {
  start: string
  end: string
}

export interface SalesSummary {
  orderCount: number
  qty: number
  grandTotal: number
  byMethod: Record<OrderPaymentMethod, { count: number; total: number }>
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function previousDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return formatUtcDate(new Date(Date.UTC(year, month - 1, day - 1)))
}

function monthLastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function salesDateRangeFromSelection(
  selectedDate: string,
  today: string,
): SalesDateRange {
  if (selectedDate.length === 4) {
    const currentYear = today.slice(0, 4)
    return {
      start: `${selectedDate}-01-01`,
      end: selectedDate === currentYear ? today : `${selectedDate}-12-31`,
    }
  }
  if (selectedDate.length === 10) {
    return { start: selectedDate, end: selectedDate }
  }
  const [year, month] = selectedDate.split('-').map(Number)
  return {
    start: `${selectedDate}-01`,
    end: `${selectedDate}-${String(monthLastDay(year, month)).padStart(2, '0')}`,
  }
}

export function previousSalesDateRange(
  selectedDate: string,
  today: string,
): SalesDateRange {
  if (selectedDate.length === 10) {
    const date = previousDay(selectedDate)
    return { start: date, end: date }
  }

  if (selectedDate.length === 4) {
    const previousYear = Number(selectedDate) - 1
    const isCurrentYear = selectedDate === today.slice(0, 4)
    const currentMonth = Number(today.slice(5, 7))
    const currentDay = Number(today.slice(8, 10))
    const comparableDay = Math.min(currentDay, monthLastDay(previousYear, currentMonth))
    const end = isCurrentYear
      ? `${previousYear}-${String(currentMonth).padStart(2, '0')}-${String(comparableDay).padStart(2, '0')}`
      : `${previousYear}-12-31`
    return { start: `${previousYear}-01-01`, end }
  }

  const [year, month] = selectedDate.split('-').map(Number)
  const previousMonthDate = new Date(Date.UTC(year, month - 2, 1))
  const previousYear = previousMonthDate.getUTCFullYear()
  const previousMonth = previousMonthDate.getUTCMonth() + 1
  const previousMonthValue = `${previousYear}-${String(previousMonth).padStart(2, '0')}`
  const isCurrentMonth = selectedDate === today.slice(0, 7)
  const selectedEndDay = isCurrentMonth
    ? Math.min(Number(today.slice(8, 10)), monthLastDay(previousYear, previousMonth))
    : monthLastDay(previousYear, previousMonth)
  return {
    start: `${previousMonthValue}-01`,
    end: `${previousMonthValue}-${String(selectedEndDay).padStart(2, '0')}`,
  }
}

export function salesComparisonLabel(selectedDate: string, today: string): string {
  if (selectedDate.length === 10) return '較前一日'
  if (selectedDate.length === 4) {
    return selectedDate === today.slice(0, 4) ? '較去年同期' : '較去年'
  }
  return selectedDate === today.slice(0, 7) ? '較上月同期' : '較上月'
}

export function summarizeSales(
  settlements: ReadonlyArray<
    Pick<
      ShopOrderSettlementWithDetails,
      'amount_total' | 'items_snapshot' | 'order_id' | 'payment_method'
    >
  >,
): SalesSummary {
  const byMethod: SalesSummary['byMethod'] = {
    balance: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
    cash: { count: 0, total: 0 },
  }
  let grandTotal = 0
  let qty = 0
  const orderIds = new Set<string>()
  for (const settlement of settlements) {
    grandTotal += settlement.amount_total
    orderIds.add(settlement.order_id)
    qty += settlement.items_snapshot.reduce((sum, line) => sum + line.qty, 0)
    byMethod[settlement.payment_method].count += 1
    byMethod[settlement.payment_method].total += settlement.amount_total
  }
  return {
    orderCount: orderIds.size,
    qty,
    grandTotal,
    byMethod,
  }
}
