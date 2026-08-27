/**
 * 明日提醒「預約人訊息」的產生邏輯。
 * 由 /tomorrow 的預覽、複製與 LINE 推播共用，確保文案一致。
 */

import { getFacilityMessageLabel } from './facility'
import { displayCoachNameForTomorrowMessage } from './tomorrowReminderDisplay'

export type ReminderLanguage = 'zh' | 'en'

export type TomorrowReminderBooking = {
  contact_name: string
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

export function generateTomorrowReminderMessage(params: {
  studentName: string
  bookings: TomorrowReminderBooking[]
  language: ReminderLanguage
  templates: TomorrowReminderTemplates
}): string {
  const { studentName, bookings, language, templates } = params
  const {
    includeWeatherWarning,
    weatherWarning,
    footerText,
    englishMessageTemplate,
    englishWeatherWarning,
  } = templates

  const studentBookings = getBookingsForStudent(bookings, studentName)

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

  const hasPapaCoach = studentBookings.some((booking) =>
    booking.coaches?.some((coach) => coach.name.toUpperCase() === 'PAPA')
  )

  let message = `${studentName}你好\n提醒你，明天有預約\n`

  if (hasPapaCoach) {
    message += `請幫我帶現金直接給Papa\n`
  }

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

  let previousCoachNames = ''
  let boatCount = 0 // 只計算真正的船（不含彈簧床等設施）

  studentBookings.forEach((booking, index) => {
    const hasCoach = !!booking.coaches && booking.coaches.length > 0
    const coachNames = hasCoach
      ? booking.coaches!.map((c) => displayCoachNameForTomorrowMessage(studentName, c.name)).join('/')
      : ''
    const startTime = formatTimeNoColon(booking.start_at)
    const boatName = booking.boats?.name || ''
    const facilityLabel = getFacilityMessageLabel(boatName)
    const isFacilityBooking = !!facilityLabel

    if (!isFacilityBooking) {
      boatCount++
    }

    if (index === 0) {
      const arrivalTime = getArrivalTimeNoColon(booking.start_at)
      if (hasCoach) {
        message += `${coachNames}教練\n`
      }
      message += `${arrivalTime}抵達\n`
      message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
      previousCoachNames = coachNames
      return
    }

    if (!isFacilityBooking && boatCount >= 2) {
      const shipLabel = boatCount === 2 ? '第二船' : boatCount === 3 ? '第三船' : `第${boatCount}船`
      message += `\n${shipLabel}\n`
    }

    // 空字串也視為相同，避免重複顯示空內容
    if (coachNames === previousCoachNames) {
      message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
      return
    }

    if (hasCoach) {
      message += `${coachNames}教練\n`
    }
    message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
    previousCoachNames = coachNames
  })

  message += '\n'

  if (includeWeatherWarning) {
    message += weatherWarning + '\n\n'
  }

  message += footerText

  return message
}
