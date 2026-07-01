/** 教練休假列（coach_time_off） */
export type CoachTimeOffRow = {
  coach_id: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason?: string | null
}

export type TimeOffMode = 'fullday' | 'morning' | 'afternoon' | 'custom'

export const TIME_OFF_MORNING_START = '00:00'
export const TIME_OFF_MORNING_END = '12:00'
export const TIME_OFF_AFTERNOON_START = '12:00'

const MINUTES_PER_DAY = 24 * 60

/** start_time / end_time 皆空 → 整天 */
export function isFullDayTimeOff(row: Pick<CoachTimeOffRow, 'start_time' | 'end_time'>): boolean {
  return !row.start_time && !row.end_time
}

function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

/** 某筆休假在指定日期的分鐘區間 [startMin, endMin) */
export function getTimeOffDayBlock(
  row: CoachTimeOffRow,
  targetDate: string
): { startMin: number; endMin: number } | null {
  if (targetDate < row.start_date || targetDate > row.end_date) return null

  if (isFullDayTimeOff(row)) {
    return { startMin: 0, endMin: MINUTES_PER_DAY }
  }

  let startMin = 0
  let endMin = MINUTES_PER_DAY

  if (row.start_date === targetDate && row.start_time) {
    startMin = parseTimeToMinutes(row.start_time) ?? 0
  }

  if (row.end_date === targetDate && row.end_time) {
    endMin = parseTimeToMinutes(row.end_time) ?? MINUTES_PER_DAY
  }

  if (startMin >= endMin) return null
  return { startMin, endMin }
}

/** 兩時段 [a,b) 與 [c,d) 是否重疊 */
export function timeRangesOverlap(
  startMinA: number,
  endMinA: number,
  startMinB: number,
  endMinB: number
): boolean {
  return !(endMinA <= startMinB || startMinA >= endMinB)
}

/** 預約時段（startTime + durationMin）是否與任一筆休假重疊 */
export function isTimeOffOverlappingBooking(
  rows: CoachTimeOffRow[],
  targetDate: string,
  startTime: string,
  durationMin: number
): boolean {
  const startMin = parseTimeToMinutes(startTime)
  if (startMin === null) return false
  const endMin = startMin + durationMin

  for (const row of rows) {
    const block = getTimeOffDayBlock(row, targetDate)
    if (!block) continue
    if (timeRangesOverlap(block.startMin, block.endMin, startMin, endMin)) {
      return true
    }
  }
  return false
}

/** 指定日期是否整天休假（所有時段皆被覆蓋，或單筆整天紀錄） */
export function isCoachFullyOffOnDate(rows: CoachTimeOffRow[], targetDate: string): boolean {
  const blocks = rows
    .map(r => getTimeOffDayBlock(r, targetDate))
    .filter((b): b is { startMin: number; endMin: number } => b !== null)

  if (blocks.length === 0) return false
  return blocks.some(b => b.startMin === 0 && b.endMin === MINUTES_PER_DAY)
}

/** 指定日期是否有任何休假（含部分時段） */
export function hasAnyTimeOffOnDate(rows: CoachTimeOffRow[], targetDate: string): boolean {
  return rows.some(r => getTimeOffDayBlock(r, targetDate) !== null)
}

/** 連續日期且同原因、整天才可合併（僅供列表顯示） */
export function canMergeTimeOffRecords(a: CoachTimeOffRow, b: CoachTimeOffRow): boolean {
  if (!isFullDayTimeOff(a) || !isFullDayTimeOff(b)) return false
  if ((a.reason || '') !== (b.reason || '')) return false
  const prevEnd = new Date(a.end_date)
  const currStart = new Date(b.start_date)
  const dayDiff = (currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24)
  return dayDiff <= 1
}

/** 判斷是否為上午快捷（00:00–12:00 單日） */
export function isMorningPreset(row: CoachTimeOffRow): boolean {
  return (
    row.start_date === row.end_date &&
    (row.start_time === TIME_OFF_MORNING_START || !row.start_time) &&
    row.end_time === TIME_OFF_MORNING_END
  )
}

/** 判斷是否為下午快捷（12:00–24:00 單日） */
export function isAfternoonPreset(row: CoachTimeOffRow): boolean {
  return (
    row.start_date === row.end_date &&
    row.start_time === TIME_OFF_AFTERNOON_START &&
    !row.end_time
  )
}

function formatShortDate(dateStr: string, showYear = false): string {
  const [year, month, day] = dateStr.split('-')
  if (showYear) return `${year}/${parseInt(month, 10)}/${parseInt(day, 10)}`
  return `${parseInt(month, 10)}/${parseInt(day, 10)}`
}

function formatTimeHm(time: string | null | undefined): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  return `${parseInt(h, 10)}:${m}`
}

/** 列表顯示文字，例如「7/4 下午」「7/4 14:00–18:00」「7/4 – 7/6」 */
export function formatTimeOffDisplay(row: CoachTimeOffRow): string {
  const startYear = row.start_date.split('-')[0]
  const endYear = row.end_date.split('-')[0]
  const showYear = startYear !== endYear
  const startStr = formatShortDate(row.start_date, showYear)
  const endStr = formatShortDate(row.end_date, showYear)

  if (isFullDayTimeOff(row)) {
    return startStr === endStr ? startStr : `${startStr} – ${endStr}`
  }

  if (isMorningPreset(row)) {
    return `${startStr} 上午`
  }

  if (isAfternoonPreset(row)) {
    return `${startStr} 下午`
  }

  const startTimeStr = row.start_time ? formatTimeHm(row.start_time) : null
  const endTimeStr = row.end_time ? formatTimeHm(row.end_time) : null

  if (row.start_date === row.end_date) {
    if (startTimeStr && endTimeStr) return `${startStr} ${startTimeStr}–${endTimeStr}`
    if (startTimeStr) return `${startStr} ${startTimeStr}起`
    if (endTimeStr) return `${startStr} – ${endTimeStr}`
    return startStr
  }

  const left = `${startStr}${startTimeStr ? ` ${startTimeStr}` : ''}`
  const right = `${endStr}${endTimeStr ? ` ${endTimeStr}` : ''}`
  return `${left} – ${right}`
}

export type TimeOffPeriodKind = 'fullday' | 'morning' | 'afternoon' | 'custom'

/** 人員管理列表：日期與時段分開顯示 */
export function getTimeOffListDisplayParts(row: CoachTimeOffRow): {
  dateLabel: string
  periodLabel: string
  periodKind: TimeOffPeriodKind
} {
  const startYear = row.start_date.split('-')[0]
  const endYear = row.end_date.split('-')[0]
  const showYear = startYear !== endYear
  const startStr = formatShortDate(row.start_date, showYear)
  const endStr = formatShortDate(row.end_date, showYear)
  const dateRange = startStr === endStr ? startStr : `${startStr} – ${endStr}`

  if (isFullDayTimeOff(row)) {
    return { dateLabel: dateRange, periodLabel: '整天', periodKind: 'fullday' }
  }
  if (isMorningPreset(row)) {
    return { dateLabel: startStr, periodLabel: '上午', periodKind: 'morning' }
  }
  if (isAfternoonPreset(row)) {
    return { dateLabel: startStr, periodLabel: '下午', periodKind: 'afternoon' }
  }

  const startTimeStr = row.start_time ? formatTimeHm(row.start_time) : null
  const endTimeStr = row.end_time ? formatTimeHm(row.end_time) : null

  if (row.start_date === row.end_date) {
    if (startTimeStr && endTimeStr) {
      return { dateLabel: startStr, periodLabel: `${startTimeStr}–${endTimeStr}`, periodKind: 'custom' }
    }
    if (startTimeStr) {
      return { dateLabel: startStr, periodLabel: `${startTimeStr}起`, periodKind: 'custom' }
    }
    if (endTimeStr) {
      return { dateLabel: startStr, periodLabel: `–${endTimeStr}`, periodKind: 'custom' }
    }
    return { dateLabel: startStr, periodLabel: '自訂', periodKind: 'custom' }
  }

  const left = startTimeStr ? `${startTimeStr}起` : '整天'
  const right = endTimeStr ? `–${endTimeStr}` : '整天'
  return {
    dateLabel: dateRange,
    periodLabel: `${left} ${right}`.trim(),
    periodKind: 'custom',
  }
}

/** 每日公告用：整天只回傳空字串，部分時段回傳「下午」等 */
export function formatTimeOffPeriodLabel(row: CoachTimeOffRow, targetDate: string): string {
  const block = getTimeOffDayBlock(row, targetDate)
  if (!block) return ''
  if (block.startMin === 0 && block.endMin === MINUTES_PER_DAY) return ''

  if (isMorningPreset(row) && row.start_date === targetDate) return '上午'
  if (isAfternoonPreset(row) && row.start_date === targetDate) return '下午'

  const startLabel = block.startMin === 0 ? '' : formatTimeHm(row.start_time)
  const endLabel = block.endMin === MINUTES_PER_DAY ? '' : formatTimeHm(row.end_time)

  if (startLabel && endLabel) return `${startLabel}–${endLabel}`
  if (startLabel) return `${startLabel}起`
  if (endLabel) return `–${endLabel}`
  return ''
}

/** 人員列 badge：小胖 / Kevin（下午） */
export function formatStaffTimeOffBadgeLabel(
  name: string,
  records: CoachTimeOffRow[],
  targetDate: string
): string {
  const periods = new Set<string>()
  for (const row of records) {
    const period = formatTimeOffPeriodLabel(row, targetDate)
    if (period) periods.add(period)
  }
  if (periods.size === 0) return name
  return `${name}（${[...periods].join('、')}）`
}

/** 月排班表格子文字：空=上班，全/上/下/自訂時段 */
export function getTimeOffCellLabel(
  records: CoachTimeOffRow[],
  targetDate: string
): string {
  const affecting = records
    .map(row => ({ row, block: getTimeOffDayBlock(row, targetDate) }))
    .filter((x): x is { row: CoachTimeOffRow; block: { startMin: number; endMin: number } } => x.block !== null)

  if (affecting.length === 0) return ''

  if (affecting.some(a => a.block.startMin === 0 && a.block.endMin === MINUTES_PER_DAY)) {
    return '全'
  }

  const labels = new Set<string>()
  for (const { row, block } of affecting) {
    if (isMorningPreset(row) && row.start_date === targetDate) {
      labels.add('上')
      continue
    }
    if (isAfternoonPreset(row) && row.start_date === targetDate) {
      labels.add('下')
      continue
    }
    const period = formatTimeOffPeriodLabel(row, targetDate)
    if (period === '上午') labels.add('上')
    else if (period === '下午') labels.add('下')
    else if (period) labels.add(period)
    else if (block.startMin === 0 && block.endMin === 720) labels.add('上')
    else if (block.startMin === 720 && block.endMin === MINUTES_PER_DAY) labels.add('下')
    else {
      const s = block.startMin === 0 ? '' : formatTimeHm(row.start_time)
      const e = block.endMin === MINUTES_PER_DAY ? '' : formatTimeHm(row.end_time)
      if (s && e) labels.add(`${s}-${e}`)
      else if (s) labels.add(`${s}起`)
      else if (e) labels.add(`-${e}`)
    }
  }

  return [...labels].join('/')
}

/** 列表／卡片用：整天、上午、下午或自訂時段 */
export function getTimeOffDayDisplayLabel(
  records: CoachTimeOffRow[],
  targetDate: string
): string {
  const cell = getTimeOffCellLabel(records, targetDate)
  if (!cell) return ''
  if (cell === '全') return '整天'
  if (cell === '上') return '上午'
  if (cell === '下') return '下午'
  return cell.replace(/-/g, '–')
}

/** 月排班表 tooltip：原因與完整說明 */
export function getTimeOffCellTooltip(
  coachName: string,
  records: CoachTimeOffRow[],
  targetDate: string
): string {
  const label = getTimeOffCellLabel(records, targetDate)
  if (!label) return `${coachName} ${targetDate}：可上班`

  const reasons = [...new Set(
    records
      .filter(r => getTimeOffDayBlock(r, targetDate))
      .map(r => r.reason?.trim())
      .filter(Boolean) as string[]
  )]

  let text = `${coachName} ${targetDate}：${label}`
  if (reasons.length > 0) text += `（${reasons.join('、')}）`
  return text
}

/** 依 coach_id 分組休假列 */
export function groupTimeOffByCoach(rows: CoachTimeOffRow[]): Map<string, CoachTimeOffRow[]> {
  const map = new Map<string, CoachTimeOffRow[]>()
  for (const row of rows) {
    const list = map.get(row.coach_id) ?? []
    list.push(row)
    map.set(row.coach_id, list)
  }
  return map
}

/** 查詢某教練在日期是否與預約重疊（給排班／下拉用） */
export function coachHasTimeOffOverlap(
  coachRows: CoachTimeOffRow[] | undefined,
  targetDate: string,
  startTime?: string,
  durationMin?: number
): boolean {
  if (!coachRows?.length) return false
  if (startTime && durationMin != null) {
    return isTimeOffOverlappingBooking(coachRows, targetDate, startTime, durationMin)
  }
  return isCoachFullyOffOnDate(coachRows, targetDate)
}

/** 將 UI 模式轉成 DB 欄位 */
export function timeOffModeToDbFields(
  mode: TimeOffMode,
  customStartTime: string,
  customEndTime: string
): { start_time: string | null; end_time: string | null } {
  if (mode === 'fullday') {
    return { start_time: null, end_time: null }
  }
  if (mode === 'morning') {
    return { start_time: TIME_OFF_MORNING_START, end_time: TIME_OFF_MORNING_END }
  }
  if (mode === 'afternoon') {
    return { start_time: TIME_OFF_AFTERNOON_START, end_time: null }
  }
  return {
    start_time: customStartTime || null,
    end_time: customEndTime || null,
  }
}

/** 從 DB 列還原 UI 模式（編輯用） */
export function inferTimeOffModeFromRow(row: CoachTimeOffRow): {
  mode: TimeOffMode
  customStartTime: string
  customEndTime: string
} {
  if (isFullDayTimeOff(row)) {
    return { mode: 'fullday', customStartTime: '', customEndTime: '' }
  }
  if (isMorningPreset(row)) {
    return { mode: 'morning', customStartTime: '', customEndTime: '' }
  }
  if (isAfternoonPreset(row)) {
    return { mode: 'afternoon', customStartTime: '', customEndTime: '' }
  }
  return {
    mode: 'custom',
    customStartTime: row.start_time || '',
    customEndTime: row.end_time || '',
  }
}

/** 單日自訂但未填任何時間 */
export function isCustomTimeOffEmptyOnSingleDay(
  mode: TimeOffMode,
  startDate: string,
  endDate: string,
  customStartTime: string,
  customEndTime: string
): boolean {
  return mode === 'custom' && startDate === endDate && !customStartTime && !customEndTime
}

/** 設定前預覽文字 */
export function buildTimeOffPreviewText(
  mode: TimeOffMode,
  startDate: string,
  endDate: string,
  customStartTime: string,
  customEndTime: string
): string {
  const { start_time, end_time } = timeOffModeToDbFields(
    mode,
    customStartTime,
    customEndTime
  )
  const display = formatTimeOffDisplay({
    coach_id: '',
    start_date: startDate,
    end_date: endDate,
    start_time,
    end_time,
  })

  const isCrossDay = startDate !== endDate
  if (!isCrossDay) return display

  const startMs = new Date(startDate).getTime()
  const endMs = new Date(endDate).getTime()
  const daySpan = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
  if (daySpan > 1 && !isFullDayTimeOff({ start_time, end_time })) {
    return `${display}（中間日期整天休假）`
  }
  return display
}
