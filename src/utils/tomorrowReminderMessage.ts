/**
 * 明日提醒「預約人訊息」的產生邏輯。
 * 由 /tomorrow 的預覽、複製與 LINE 推播共用，確保文案一致。
 */

import { getFacilityMessageLabel } from './facility'
import {
  formatActualRider,
  getActualRiderGroupKey,
} from './riderDisplay'
import { displayCoachNameForTomorrowMessage } from './tomorrowReminderDisplay'

export type ReminderLanguage = 'zh' | 'en'

export type TomorrowReminderBooking = {
  contact_name: string
  actual_rider?: string | null
  start_at: string
  boats?: { name: string } | null
  coaches?: { name: string }[] | null
  drivers?: { name: string }[] | null
}

export type TomorrowReminderTemplates = {
  includeWeatherWarning: boolean
  weatherWarning: string
  footerText: string
  englishMessageTemplate: string
  englishWeatherWarning: string
}

/** 不產生「預約人提醒訊息」條目 */
export const EXCLUDED_FROM_TOMORROW_STUDENT_REMINDERS = new Set(['Ming'])

/** 需要額外顯示船與開船教練資訊 */
export const SPECIAL_MEMBERS_FOR_BOAT_INFO = ['Mandy', '火腿', '火小', '火隆', '火龍']

/** 明日提醒極簡版：名單為 Safin 時稱呼李伯 */
const SAFIN_TOMORROW_STUDENT_NAMES = new Set(['Safin'])

export function splitContactNames(contactName: string): string[] {
  return contactName.split(',').map((name) => name.trim())
}

export function formatTimeNoColon(dateString: string): string {
  const datetime = dateString.substring(0, 16)
  const [, timeStr] = datetime.split('T')
  const [hours, minutes] = timeStr.split(':')
  return `${hours}${minutes}`
}

export function formatTimeWithColon(dateString: string): string {
  return dateString.substring(11, 16)
}

/** 提前 30 分鐘的抵達時間，HHMM */
export function getArrivalTimeNoColon(dateString: string): string {
  const datetime = dateString.substring(0, 16)
  const [, timeStr] = datetime.split('T')
  const [hour, minute] = timeStr.split(':').map(Number)
  const totalMinutes = hour * 60 + minute - 30
  const arrivalHour = Math.floor(totalMinutes / 60)
  const arrivalMinute = totalMinutes % 60
  return `${arrivalHour.toString().padStart(2, '0')}${arrivalMinute.toString().padStart(2, '0')}`
}

/** 與 getArrivalTimeNoColon 同邏輯，顯示為 HH:MM */
export function getArrivalTimeWithColon(dateString: string): string {
  const raw = getArrivalTimeNoColon(dateString)
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
}

/** 以單一預約人為主軸的名單 */
export function getTomorrowStudentList(bookings: TomorrowReminderBooking[]): string[] {
  const students = new Set<string>()
  bookings.forEach((booking) => {
    splitContactNames(booking.contact_name).forEach((name) => students.add(name))
  })
  return Array.from(students)
    .filter((name) => !EXCLUDED_FROM_TOMORROW_STUDENT_REMINDERS.has(name))
    .sort()
}

/** 該預約人的所有預約，按時間排序 */
export function getBookingsForStudent<T extends TomorrowReminderBooking>(
  bookings: T[],
  studentName: string
): T[] {
  return bookings
    .filter((booking) => splitContactNames(booking.contact_name).includes(studentName))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
}

type RiderBookingGroup<T extends TomorrowReminderBooking> = {
  rider: string
  bookings: T[]
}

export function groupTomorrowBookingsByRider<T extends TomorrowReminderBooking>(
  bookings: T[],
): RiderBookingGroup<T>[] {
  const groups = new Map<string, RiderBookingGroup<T>>()

  bookings.forEach((booking) => {
    const rider = formatActualRider(booking.actual_rider)
    const boatName = booking.boats?.name || ''
    const key = rider
      ? `rider:${getActualRiderGroupKey(rider)}`
      : boatName.includes('煙火')
        ? `special-boat:${boatName}`
        : 'without-rider'
    const existing = groups.get(key)
    if (existing) {
      existing.bookings.push(booking)
    } else {
      groups.set(key, { rider, bookings: [booking] })
    }
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      bookings: group.bookings.sort((a, b) => a.start_at.localeCompare(b.start_at)),
    }))
    .sort((left, right) =>
      left.bookings[0].start_at.localeCompare(right.bookings[0].start_at)
    )
}

export function generateTomorrowReminderMessage(params: {
  studentName: string
  bookingStudentNames?: string[]
  bookings: TomorrowReminderBooking[]
  language: ReminderLanguage
  templates: TomorrowReminderTemplates
}): string {
  const { studentName, bookingStudentNames, bookings, language, templates } = params
  const {
    includeWeatherWarning,
    weatherWarning,
    footerText,
    englishMessageTemplate,
    englishWeatherWarning,
  } = templates

  const sourceNames = Array.from(new Set([studentName, ...(bookingStudentNames || [])]))
  const studentBookings = bookings
    .filter((booking) => {
      const contactNames = splitContactNames(booking.contact_name)
      return sourceNames.some((name) => contactNames.includes(name))
    })
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  if (language === 'en') {
    const appointmentTimes = Array.from(new Set(
      studentBookings.map((booking) => getArrivalTimeWithColon(booking.start_at))
    ))
    const appointment = appointmentTimes.length === 1
      ? `an appointment tomorrow at ${appointmentTimes[0]}`
      : `appointments tomorrow at ${appointmentTimes.join(' and ')}`
    const weather = includeWeatherWarning ? `\n\n${englishWeatherWarning}` : ''

    return englishMessageTemplate
      .split('{username}').join(studentName)
      .split('{appointment}').join(appointment)
      .split('{weather}').join(weather)
  }

  if (SAFIN_TOMORROW_STUDENT_NAMES.has(studentName) && studentBookings.length > 0) {
    return [
      '你好李伯',
      ...studentBookings.map(
        (booking) => `明天有預約，請 ${getArrivalTimeWithColon(booking.start_at)} 抵達`
      ),
    ].join('\n')
  }

  let message = `${studentName}你好\n提醒你，明天有預約\n`

  message += '\n'

  if (SPECIAL_MEMBERS_FOR_BOAT_INFO.includes(studentName) && studentBookings.length > 0) {
    const firstBooking = studentBookings[0]
    const boatName = firstBooking.boats?.name || ''
    // 駕駛：優先使用 booking_drivers，沒有則退回教練
    const driverNames = firstBooking.drivers && firstBooking.drivers.length > 0
      ? firstBooking.drivers.map((d) => d.name).join('/')
      : (firstBooking.coaches && firstBooking.coaches.length > 0
          ? firstBooking.coaches.map((c) => c.name).join('/')
          : '')

    if (boatName) {
      if (driverNames) {
        message += `船：${boatName} / 開船：${driverNames}\n`
      } else {
        message += `船：${boatName}\n`
      }
    }
  }

  const riderGroups = groupTomorrowBookingsByRider(studentBookings)

  riderGroups.forEach((group, groupIndex) => {
    if (groupIndex > 0) message += '\n'

    const coachNamesByBooking = group.bookings.map((booking) =>
      booking.coaches && booking.coaches.length > 0
        ? booking.coaches
            .map((coach) => displayCoachNameForTomorrowMessage(studentName, coach.name))
            .join('/')
        : ''
    )
    const uniqueCoachNames = Array.from(new Set(coachNamesByBooking.filter(Boolean)))
    const distinctCoachAssignments = new Set(coachNamesByBooking)

    if (group.rider) {
      const heading = distinctCoachAssignments.size === 1 && uniqueCoachNames.length === 1
        ? `${uniqueCoachNames[0]}教練－${group.rider}`
        : group.rider
      message += `${heading}\n`
      message += `${getArrivalTimeWithColon(group.bookings[0].start_at)} 抵達\n`

      let previousCoachNames = ''
      group.bookings.forEach((booking, index) => {
        const coachNames = coachNamesByBooking[index]
        if (
          distinctCoachAssignments.size > 1
          && coachNames
          && coachNames !== previousCoachNames
        ) {
          message += `${coachNames}教練\n`
        }
        const facilityLabel = getFacilityMessageLabel(booking.boats?.name || '')
        message += `${formatTimeWithColon(booking.start_at)} ${facilityLabel || '下水'}\n`
        previousCoachNames = coachNames
      })
      return
    }

    let previousCoachNames = ''
    let boatCount = 0
    group.bookings.forEach((booking, index) => {
      const coachNames = coachNamesByBooking[index]
      const hasCoach = !!coachNames
      const boatName = booking.boats?.name || ''
      const facilityLabel = getFacilityMessageLabel(boatName)
      const isFacilityBooking = !!facilityLabel
      if (!isFacilityBooking) boatCount++

      if (index === 0) {
        if (hasCoach) {
          message += `${coachNames}教練\n`
        } else if (boatName.includes('煙火')) {
          message += `${boatName}\n`
        }
        message += `${getArrivalTimeWithColon(booking.start_at)} 抵達\n`
        message += `${formatTimeWithColon(booking.start_at)} ${facilityLabel || '下水'}\n`
        previousCoachNames = coachNames
        return
      }

      if (!isFacilityBooking && boatCount >= 2) {
        const shipLabel = boatCount === 2 ? '第二船' : boatCount === 3 ? '第三船' : `第${boatCount}船`
        message += `\n${shipLabel}\n`
      }
      if (coachNames !== previousCoachNames && hasCoach) {
        message += `${coachNames}教練\n`
      }
      message += `${formatTimeWithColon(booking.start_at)} ${facilityLabel || '下水'}\n`
      previousCoachNames = coachNames
    })
  })

  message += '\n'

  if (includeWeatherWarning) {
    message += weatherWarning + '\n\n'
  }

  message += footerText

  return message
}
