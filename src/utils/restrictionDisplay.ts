export interface RestrictionDisplayInput {
  startDate: string
  startTime?: string | null
  endDate: string
  endTime?: string | null
  scope?: 'all' | 'coaches' | null
  coachNames?: readonly string[] | null
}

function shortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}/${Number(day)}`
}

function shortTime(time: string | null | undefined, fallback: string): string {
  if (!time) return fallback
  const [hour, minute] = time.split(':')
  return `${Number(hour)}:${minute}`
}

export function formatRestrictionAudience(
  scope: RestrictionDisplayInput['scope'],
  coachNames: RestrictionDisplayInput['coachNames'],
): string {
  return scope === 'coaches'
    ? `教練：${coachNames?.join('、') || '未指定'}`
    : '全部預約'
}

export function formatRestrictionDisplay(
  input: RestrictionDisplayInput,
  options: {
    includeLabel?: boolean
    includeDate?: boolean
  } = {},
): string {
  const includeLabel = options.includeLabel ?? true
  const includeDate = options.includeDate ?? true
  const sameDay = input.startDate === input.endDate
  const allDay = !input.startTime && !input.endTime

  let period: string
  if (sameDay) {
    const date = includeDate ? `${shortDate(input.startDate)} ` : ''
    period = allDay
      ? `${date}全天`
      : `${date}${shortTime(input.startTime, '0:00')}–${shortTime(input.endTime, '23:59')}`
  } else if (allDay) {
    period = includeDate
      ? `${shortDate(input.startDate)}–${shortDate(input.endDate)} 全天`
      : '全天'
  } else {
    period = includeDate
      ? `${shortDate(input.startDate)} ${shortTime(input.startTime, '0:00')}–${shortDate(input.endDate)} ${shortTime(input.endTime, '23:59')}`
      : `${shortTime(input.startTime, '0:00')}–${shortTime(input.endTime, '23:59')}`
  }

  return `${includeLabel ? '預約限制：' : ''}${period}｜${formatRestrictionAudience(
    input.scope,
    input.coachNames,
  )}`
}
