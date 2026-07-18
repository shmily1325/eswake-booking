import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { supabase } from '../lib/supabase'
import { useResponsive } from '../hooks/useResponsive'
import {
  addDaysToDate,
  getVenueDateString,
  getVenueTimeParts,
} from '../utils/date'
import { Footer } from '../components/Footer'
import { PageShell } from '../components/PageShell'
import { BookingDateNav } from '../components/BookingDateNav'
import {
  designSystem,
  getButtonStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
import { hasViewAccess } from '../utils/auth'
import { getFacilityMessageLabel } from '../utils/facility'
import { displayCoachNameForTomorrowMessage } from '../utils/tomorrowReminderDisplay'
import {
  getCoachTomorrowReminderLines,
  TOMORROW_COACH_REMINDER_TARGET_COACHES
} from '../utils/coachTomorrowReminderLines'
import { useTomorrowReminderTemplates } from '../hooks/useTomorrowReminderTemplates'

interface Booking {
  id: number
  boat_id: number
  contact_name: string
  start_at: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  boats?: { id: number; name: string; color: string } | null
  coaches?: { id: string; name: string }[]
  drivers?: { id: string; name: string }[]  // 駕駛資料
}

type ReminderLanguage = 'zh' | 'en'

export function TomorrowReminder() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const weatherWarningRef = useRef<HTMLTextAreaElement>(null)
  const footerTextRef = useRef<HTMLTextAreaElement>(null)
  const englishMessageTemplateRef = useRef<HTMLTextAreaElement>(null)
  const englishWeatherWarningRef = useRef<HTMLTextAreaElement>(null)

  // 權限檢查：需要一般權限
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const canAccess = await hasViewAccess(user)
        if (!canAccess) {
          navigate('/')
        }
      }
    }
    checkAccess()
  }, [user, navigate])

  const getDefaultDate = () => {
    const today = getVenueDateString()
    const { hours } = getVenueTimeParts()

    if (hours < 3) {
      return today
    } else {
      return addDaysToDate(today, 1)
    }
  }

  const [selectedDate, setSelectedDate] = useState(getDefaultDate())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedStudent, setCopiedStudent] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [copiedCoachReminder, setCopiedCoachReminder] = useState<string | null>(null)
  const [selectedCoachReminder, setSelectedCoachReminder] = useState<string | null>(null)
  const [studentLanguages, setStudentLanguages] = useState<Record<string, ReminderLanguage>>({})

  const {
    includeWeatherWarning,
    setIncludeWeatherWarning,
    weatherWarning,
    setWeatherWarning,
    footerText,
    setFooterText,
    englishMessageTemplate,
    setEnglishMessageTemplate,
    englishWeatherWarning,
    setEnglishWeatherWarning,
    saveStatus: templateSaveStatus,
  } = useTomorrowReminderTemplates(user?.id)

  useLayoutEffect(() => {
    const fitTextareaToContent = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight + 2}px`
    }

    fitTextareaToContent(weatherWarningRef.current)
    fitTextareaToContent(footerTextRef.current)
    fitTextareaToContent(englishMessageTemplateRef.current)
    fitTextareaToContent(englishWeatherWarningRef.current)
  }, [
    weatherWarning,
    footerText,
    englishMessageTemplate,
    englishWeatherWarning,
    isMobile,
  ])

  useEffect(() => {
    setSelectedStudent(null)
    setSelectedCoachReminder(null)
    setStudentLanguages({})
    // 換日時先清空，避免新資料載入前畫面殘留前一天的學員/教練清單
    setBookings([])
    fetchData()
  }, [selectedDate])

  const fetchData = async () => {
    setLoading(true)
    try {
      const startOfDay = `${selectedDate}T00:00:00`
      const endOfDay = `${selectedDate}T23:59:59`

      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, boats:boat_id(id, name, color)')
        .gte('start_at', startOfDay)
        .lte('start_at', endOfDay)
        .or('is_coach_practice.is.null,is_coach_practice.eq.false')
        .order('start_at', { ascending: true })

      if (bookingsData && bookingsData.length > 0) {
        const bookingIds = bookingsData.map((b: any) => b.id)

        // 三個關聯查詢都只依賴 bookingIds，並行送出可節省兩輪 RTT
        const [coachesResult, driversResult, membersResult] = await Promise.all([
          supabase
            .from('booking_coaches')
            .select('booking_id, coaches:coach_id(id, name)')
            .in('booking_id', bookingIds),
          supabase
            .from('booking_drivers')
            .select('booking_id, coaches:driver_id(id, name)')
            .in('booking_id', bookingIds),
          supabase
            .from('booking_members')
            .select('booking_id, members:member_id(id, name, nickname)')
            .in('booking_id', bookingIds)
        ])

        const { data: bookingCoachesData } = coachesResult
        const { data: bookingDriversData } = driversResult
        const { data: bookingMembersData } = membersResult

        const coachesByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of bookingCoachesData || []) {
          const bookingId = item.booking_id
          const coach = (item as any).coaches
          if (coach) {
            if (!coachesByBooking[bookingId]) {
              coachesByBooking[bookingId] = []
            }
            coachesByBooking[bookingId].push(coach)
          }
        }

        const driversByBooking: { [key: number]: { id: string; name: string }[] } = {}
        for (const item of bookingDriversData || []) {
          const bookingId = item.booking_id
          const driver = (item as any).coaches
          if (driver) {
            if (!driversByBooking[bookingId]) {
              driversByBooking[bookingId] = []
            }
            driversByBooking[bookingId].push(driver)
          }
        }

        const membersByBooking: { [key: number]: any[] } = {}
        for (const item of bookingMembersData || []) {
          const bookingId = item.booking_id
          const member = (item as any).members
          if (member) {
            if (!membersByBooking[bookingId]) {
              membersByBooking[bookingId] = []
            }
            membersByBooking[bookingId].push(member)
          }
        }

        // ✅ 組合教練、駕駛和會員資料，並更新 contact_name 為最新暱稱
        bookingsData.forEach((booking: any) => {
          booking.coaches = coachesByBooking[booking.id] || []
          booking.drivers = driversByBooking[booking.id] || []

          // ✅ 如果有會員資料，智能更新名稱：保留訪客，更新會員
          const members = membersByBooking[booking.id] || []
          if (members.length > 0) {
            const originalNames = booking.contact_name.split(',').map((n: string) => n.trim())

            // 策略：如果名字數量 = 會員數量，直接全部替換（純會員預約）
            if (members.length === originalNames.length) {
              booking.contact_name = members.map(m => m.nickname || m.name).join(', ')
            } else {
              // 混合預約：需要區分會員和訪客
              const updatedNames: string[] = []
              const processedMemberIds = new Set<string>()

              originalNames.forEach((name: string) => {
                // 嘗試匹配會員（完全匹配或部分匹配）
                const matchedMember = members.find(m => {
                  // 完全匹配
                  if (name === m.name || name === m.nickname) return true
                  // 部分匹配：處理 "Ingrid/Joanna" 這種複合名稱
                  const nameParts = name.split('/').map(p => p.trim())
                  if (nameParts.some(part => part === m.name || part === m.nickname)) return true
                  return false
                })

                if (matchedMember && !processedMemberIds.has(matchedMember.id)) {
                  // 找到會員：用最新暱稱
                  updatedNames.push(matchedMember.nickname || matchedMember.name)
                  processedMemberIds.add(matchedMember.id)
                } else if (!matchedMember) {
                  // 不是會員：保留訪客名字
                  updatedNames.push(name)
                }
              })

              // 確保所有會員都出現（防止遺漏）
              members.forEach(m => {
                if (!processedMemberIds.has(m.id)) {
                  updatedNames.push(m.nickname || m.name)
                }
              })

              if (updatedNames.length > 0) {
                booking.contact_name = updatedNames.join(', ')
              }
            }
          }
          // 如果沒有會員資料，保持原始的 contact_name（純訪客）
        })
      }

      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeNoColon = (dateString: string): string => {
    // 純字符串處理
    const datetime = dateString.substring(0, 16) // "2025-11-01T13:55"
    const [, timeStr] = datetime.split('T')
    const [hours, minutes] = timeStr.split(':')
    return `${hours}${minutes}`
  }

  const getArrivalTimeNoColon = (dateString: string): string => {
    // 純字符串處理，提前30分鐘
    const datetime = dateString.substring(0, 16)
    const [, timeStr] = datetime.split('T')
    const [hour, minute] = timeStr.split(':').map(Number)
    const totalMinutes = hour * 60 + minute - 30
    const arrivalHour = Math.floor(totalMinutes / 60)
    const arrivalMinute = totalMinutes % 60
    return `${arrivalHour.toString().padStart(2, '0')}${arrivalMinute.toString().padStart(2, '0')}`
  }

  /** 與 getArrivalTimeNoColon 同邏輯，顯示為 HH:MM */
  const getArrivalTimeWithColon = (dateString: string): string => {
    const raw = getArrivalTimeNoColon(dateString)
    return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
  }

  /** 不產生「預約人提醒訊息」條目 */
  const EXCLUDED_FROM_TOMORROW_STUDENT_REMINDERS = new Set(['Ming'])

  // ✅ 改為以單一會員為主軸
  const getStudentList = (): string[] => {
    const students = new Set<string>()
    bookings.forEach(booking => {
      // 拆分會員名字（用逗號分隔）
      const names = booking.contact_name.split(',').map(n => n.trim())
      names.forEach(name => students.add(name))
    })
    return Array.from(students)
      .filter((name) => !EXCLUDED_FROM_TOMORROW_STUDENT_REMINDERS.has(name))
      .sort()
  }

  // ✅ 特殊會員：需要額外顯示船和開船教練資訊
  const SPECIAL_MEMBERS_FOR_BOAT_INFO = ['Mandy', '火腿', '火小', '火隆', '火龍']

  /** 明日提醒極簡版：名單為 Safin 時稱呼李伯 */
  const SAFIN_TOMORROW_STUDENT_NAMES = new Set(['Safin'])

  const generateMessageForStudent = (
    studentName: string,
    language: ReminderLanguage = studentLanguages[studentName] || 'zh'
  ): string => {
    // ✅ 找出所有包含此會員的預約
    const studentBookings = bookings
      .filter(b => {
        const names = b.contact_name.split(',').map(n => n.trim())
        return names.includes(studentName)
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at)) // 按時間排序

    if (language === 'en') {
      const appointmentTimes = Array.from(new Set(
        studentBookings.map(booking => getArrivalTimeWithColon(booking.start_at))
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

    // ✅ 檢查是否有 PAPA 教練的預約
    const hasPapaCoach = studentBookings.some(booking =>
      booking.coaches?.some(coach =>
        coach.name.toUpperCase() === 'PAPA'
      )
    )

    let message = `${studentName}你好\n提醒你，明天有預約\n`

    // ✅ 如果有 PAPA 教練，加上現金提醒
    if (hasPapaCoach) {
      message += `請幫我帶現金直接給Papa\n`
    }

    message += '\n'

    // ✅ 特殊會員：加入船和開船教練資訊（從第一個預約取得）
    if (SPECIAL_MEMBERS_FOR_BOAT_INFO.includes(studentName) && studentBookings.length > 0) {
      const firstBooking = studentBookings[0]
      const boatName = firstBooking.boats?.name || ''
      // 駕駛：優先使用 booking_drivers，如果沒有則使用教練
      const driverNames = firstBooking.drivers && firstBooking.drivers.length > 0
        ? firstBooking.drivers.map(d => d.name).join('/')
        : (firstBooking.coaches && firstBooking.coaches.length > 0
            ? firstBooking.coaches.map(c => c.name).join('/')
            : '')

      if (boatName) {
        // 有駕駛才顯示開船資訊，沒有就只顯示船名
        if (driverNames) {
          message += `船：${boatName} / 開船：${driverNames}\n`
        } else {
          message += `船：${boatName}\n`
        }
      }
    }

    let previousCoachNames = ''
    let boatCount = 0  // 只計算真正的船（不含彈簧床）

    // ✅ 按順序處理每個預約
    studentBookings.forEach((booking, index) => {
      const hasCoach = booking.coaches && booking.coaches.length > 0
      const coachNames = hasCoach
        ? booking.coaches!.map(c => displayCoachNameForTomorrowMessage(studentName, c.name)).join('/')
        : ''
      const startTime = formatTimeNoColon(booking.start_at)
      const boatName = booking.boats?.name || ''
      const facilityLabel = getFacilityMessageLabel(boatName)
      const isFacilityBooking = !!facilityLabel

      // 如果不是彈簧床、陸上課程，船次計數增加
      if (!isFacilityBooking) {
        boatCount++
      }

      if (index === 0) {
        // 第一個預約：教練 + 抵達時間 + 下水時間（或設施標籤）
        const arrivalTime = getArrivalTimeNoColon(booking.start_at)
        if (hasCoach) {
          message += `${coachNames}教練\n`
        }
        message += `${arrivalTime}抵達\n`
        message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
        previousCoachNames = coachNames
      } else {
        // 第二個預約之後
        // 如果當前是船（不是設施）且船次 >= 2，空一行並標註船次
        if (!isFacilityBooking && boatCount >= 2) {
          const shipLabel = boatCount === 2 ? '第二船' : boatCount === 3 ? '第三船' : `第${boatCount}船`
          message += `\n${shipLabel}\n`
        }

        // 檢查是否同一個教練（空字串也視為相同，避免重複顯示空內容）
        if (coachNames === previousCoachNames) {
          // 同一個教練：只顯示時間，不顯示教練名稱
          message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
        } else {
          // 不同教練：顯示教練名稱 + 時間（如果有教練才顯示）
          if (hasCoach) {
            message += `${coachNames}教練\n`
          }
          message += facilityLabel ? `${startTime}${facilityLabel}\n` : `${startTime}下水\n`
          previousCoachNames = coachNames
        }
      }
    })

    message += '\n'

    if (includeWeatherWarning) {
      message += weatherWarning + '\n\n'
    }

    message += footerText

    return message
  }

  const handleCopyForStudent = (studentName: string) => {
    const message = generateMessageForStudent(
      studentName,
      studentLanguages[studentName] || 'zh'
    )
    navigator.clipboard.writeText(message).then(() => {
      setCopiedStudent(studentName)
      setTimeout(() => setCopiedStudent(null), 2000)
    })
  }

  const coachReminderBlocks =
    !loading && bookings.length > 0
      ? TOMORROW_COACH_REMINDER_TARGET_COACHES.map((coach) => ({
          coach,
          lines: getCoachTomorrowReminderLines(coach, bookings)
        })).filter((b) => b.lines.length > 0)
      : []

  const handleCopyCoachReminder = (coach: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCoachReminder(coach)
      setTimeout(() => setCopiedCoachReminder(null), 2000)
    })
  }

  const pageCardStyle = {
    background: designSystem.colors.background.card,
    borderRadius: designSystem.borderRadius.lg,
    padding: isMobile ? '14px' : '18px',
    marginBottom: isMobile ? '10px' : '14px',
    boxShadow: designSystem.shadows.elevation[1],
    border: `1px solid ${designSystem.colors.border.light}`,
  } as const

  const sectionTitleStyle = {
    fontSize: getFontSize('body', isMobile),
    fontWeight: '650',
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
    color: designSystem.colors.text.primary,
    margin: 0,
    marginBottom: isMobile ? '10px' : '12px',
  } as const

  const templateLabelStyle = {
    ...getLabelStyle(isMobile),
    marginBottom: designSystem.spacing.xs,
    color: designSystem.colors.text.secondary,
  } as const

  const groupedListStyle = {
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.md,
    overflow: 'hidden',
    background: designSystem.colors.background.card,
  } as const

  return (
    <PageShell variant="focused" mobilePadding="12px" desktopPadding="20px">
        <PageHeader title="明日提醒" user={user} />

        <div style={{
          ...(isMobile ? {
            marginBottom: '10px',
          } : pageCardStyle),
        }}>
          <BookingDateNav
            date={selectedDate}
            onDateChange={(event) => setSelectedDate(event.target.value)}
            onPrevDate={() => setSelectedDate(addDaysToDate(selectedDate, -1))}
            onNextDate={() => setSelectedDate(addDaysToDate(selectedDate, 1))}
            onGoToToday={() => setSelectedDate(getVenueDateString())}
            isMobile={isMobile}
            todayDisabled={selectedDate === getVenueDateString()}
            prevTrackId="tomorrow_date_prev"
            nextTrackId="tomorrow_date_next"
            todayTrackId="tomorrow_date_today"
            dateTrackId="tomorrow_date_pick"
            marginBottom="0"
            trailing={
              loading ? (
                <span
                  style={{
                    color: designSystem.colors.text.secondary,
                    fontSize: getFontSize('bodySmall', false),
                  }}
                >
                  載入中...
                </span>
              ) : null
            }
          />
          {loading && isMobile && (
            <div
              style={{
                marginTop: 8,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', true),
              }}
            >
              載入中...
            </div>
          )}
        </div>

        {/* Text Templates */}
        <div style={pageCardStyle}>
          <h2 style={sectionTitleStyle}>
            編輯文字模板
          </h2>

          {/* 天氣警告開關 */}
          <div style={{
            marginBottom: isMobile ? '12px' : '14px',
            padding: isMobile ? '9px 10px' : '10px 12px',
            background: designSystem.colors.secondary[50],
            borderRadius: designSystem.borderRadius.md,
            border: `1px solid ${designSystem.colors.border.light}`
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: getFontSize('body', isMobile),
              fontWeight: '500',
              gap: designSystem.spacing.sm,
              minHeight: '28px',
            }}>
              <input
                type="checkbox"
                data-track="tomorrow_weather_toggle"
                checked={includeWeatherWarning}
                onChange={(e) => setIncludeWeatherWarning(e.target.checked)}
                style={{
                  width: '17px',
                  height: '17px',
                  cursor: 'pointer',
                  accentColor: designSystem.colors.info[500],
                }}
              />
              <span>包含天氣警告</span>
            </label>
          </div>

          {/* 天氣提醒 */}
          <div style={{ marginBottom: designSystem.spacing.md }}>
            <label style={templateLabelStyle}>
              天氣提醒
            </label>
            <textarea
              ref={weatherWarningRef}
              value={weatherWarning}
              onChange={(e) => setWeatherWarning(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                height: 'auto',
                minHeight: 0,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                touchAction: 'manipulation',
                boxSizing: 'border-box',
                opacity: includeWeatherWarning ? 1 : 0.5
              }}
              disabled={!includeWeatherWarning}
            />
          </div>

          {/* 預約提醒 */}
          <div>
            <label style={templateLabelStyle}>
              預約提醒
            </label>
            <textarea
              ref={footerTextRef}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                height: 'auto',
                minHeight: 0,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                touchAction: 'manipulation',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{
            marginTop: designSystem.spacing.md,
            paddingTop: designSystem.spacing.md,
            borderTop: `1px solid ${designSystem.colors.border.light}`,
          }}>
            <label style={templateLabelStyle}>
              英文提醒模板
            </label>
            <textarea
              ref={englishMessageTemplateRef}
              value={englishMessageTemplate}
              onChange={(e) => setEnglishMessageTemplate(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                height: 'auto',
                minHeight: 0,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                touchAction: 'manipulation',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: designSystem.spacing.md }}>
            <label style={templateLabelStyle}>
              英文天氣提醒
            </label>
            <textarea
              ref={englishWeatherWarningRef}
              value={englishWeatherWarning}
              onChange={(e) => setEnglishWeatherWarning(e.target.value)}
              disabled={!includeWeatherWarning}
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                height: 'auto',
                minHeight: 0,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'none',
                overflow: 'hidden',
                touchAction: 'manipulation',
                boxSizing: 'border-box',
                opacity: includeWeatherWarning ? 1 : 0.5,
              }}
            />
          </div>

          <div style={{
            marginTop: designSystem.spacing.md,
            padding: templateSaveStatus === 'error' ? '9px 10px' : 0,
            background: templateSaveStatus === 'error'
              ? designSystem.colors.danger[50]
              : 'transparent',
            border: templateSaveStatus === 'error'
              ? `1px solid ${designSystem.colors.danger[500]}`
              : 'none',
            borderRadius: designSystem.borderRadius.sm,
            fontSize: getFontSize('caption', isMobile),
            color: templateSaveStatus === 'error'
              ? designSystem.colors.danger[700]
              : designSystem.colors.text.disabled,
            display: 'flex',
            alignItems: 'center',
            gap: designSystem.spacing.xs,
          }}>
            <span aria-hidden="true">{templateSaveStatus === 'error' ? '!' : '✓'}</span>
            <span>
              {templateSaveStatus === 'loading' && '正在載入共用文字模板…'}
              {templateSaveStatus === 'saving' && '正在儲存共用文字模板…'}
              {templateSaveStatus === 'saved' && '修改會自動儲存'}
              {templateSaveStatus === 'error' && '文字模板未能儲存，請重新整理後再試'}
            </span>
          </div>
        </div>

        {/* Student Messages List */}
        {bookings.length === 0 && !loading ? (
          <div style={pageCardStyle}>
            <div style={{
              ...getEmptyStateStyle(isMobile),
              padding: isMobile ? '28px 16px' : '36px 20px',
            }}>
              <div style={{ fontWeight: '500' }}>
                選擇的日期沒有預約記錄
              </div>
            </div>
          </div>
        ) : (
          <>
          <div style={pageCardStyle}>
            <h2 style={sectionTitleStyle}>
              預約人提醒訊息 ({getStudentList().length} 位)
            </h2>

            <div style={groupedListStyle}>
              {getStudentList().map((studentName, studentIndex, students) => {
                const isExpanded = selectedStudent === studentName
                const isCopied = copiedStudent === studentName
                const studentLanguage = studentLanguages[studentName] || 'zh'
                // ✅ 修改：查找包含此會員的所有預約
                const studentBookings = bookings.filter(b => {
                  const names = b.contact_name.split(',').map(n => n.trim())
                  return names.includes(studentName)
                })

                const uniqueBookingKeys = new Set<string>()
                studentBookings.forEach(b => {
                  const key = `${b.boat_id}-${b.start_at}-${b.duration_min}`
                  uniqueBookingKeys.add(key)
                })
                const uniqueBookingCount = uniqueBookingKeys.size

                return (
                  <div
                    key={studentName}
                    style={{
                      borderBottom: studentIndex < students.length - 1
                        ? `1px solid ${designSystem.colors.border.light}`
                        : 'none',
                    }}
                  >
                    <div
                      data-track="tomorrow_expand"
                      onClick={() => setSelectedStudent(isExpanded ? null : studentName)}
                      style={{
                        minHeight: '56px',
                        padding: isMobile ? '9px 10px 9px 12px' : '11px 12px 11px 14px',
                        background: isExpanded ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: designSystem.spacing.sm,
                        touchAction: 'manipulation'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: getFontSize('body', isMobile),
                          fontWeight: '600',
                          color: designSystem.colors.text.primary,
                          marginBottom: '2px',
                          lineHeight: 1.35,
                        }}>
                          {studentName}
                        </div>
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.secondary
                        }}>
                          {uniqueBookingCount} 個預約
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: designSystem.spacing.sm,
                        flexShrink: 0,
                      }}>
                        <div
                          onClick={(event) => event.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0,
                            padding: '2px',
                            border: `1px solid ${designSystem.colors.border.light}`,
                            borderRadius: designSystem.borderRadius.sm,
                            background: designSystem.colors.secondary[100],
                          }}
                          role="group"
                          aria-label={`${studentName} 的提醒訊息語言`}
                        >
                          {([
                            { value: 'zh', label: '中' },
                            { value: 'en', label: 'EN' },
                          ] as const).map(option => (
                            <button
                              key={option.value}
                              type="button"
                              data-track={`tomorrow_language_${option.value}`}
                              aria-pressed={studentLanguage === option.value}
                              onClick={() => {
                                setStudentLanguages(current => ({
                                  ...current,
                                  [studentName]: option.value,
                                }))
                                setCopiedStudent(null)
                              }}
                              style={{
                                minWidth: option.value === 'zh' ? '34px' : '40px',
                                minHeight: '34px',
                                padding: '6px 9px',
                                border: studentLanguage === option.value
                                  ? `1px solid ${designSystem.colors.info[500]}`
                                  : `1px solid ${designSystem.colors.border.light}`,
                                borderRadius: '8px',
                                background: studentLanguage === option.value
                                  ? designSystem.colors.info[50]
                                  : designSystem.colors.background.card,
                                color: studentLanguage === option.value
                                  ? designSystem.colors.info[700]
                                  : designSystem.colors.text.secondary,
                                fontSize: getFontSize('bodySmall', isMobile),
                                fontWeight: studentLanguage === option.value ? '650' : '500',
                                lineHeight: 1,
                                cursor: 'pointer',
                                transition: designSystem.transitions.fast,
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.disabled,
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}>
                          ▼
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{
                        padding: isMobile ? '10px 12px 12px' : '12px 14px 14px',
                        borderTop: `1px solid ${designSystem.colors.border.light}`,
                        background: designSystem.colors.background.card
                      }}>
                        {/* Preview Message */}
                        <div style={{
                          background: designSystem.colors.background.main,
                          padding: isMobile ? '10px' : '12px',
                          borderRadius: designSystem.borderRadius.md,
                          whiteSpace: 'pre-wrap',
                          fontSize: getFontSize('body', isMobile),
                          lineHeight: 1.55,
                          color: designSystem.colors.text.primary,
                          fontFamily: 'inherit',
                          marginBottom: designSystem.spacing.sm,
                          maxHeight: isMobile ? '300px' : '400px',
                          overflowY: 'auto',
                          WebkitOverflowScrolling: 'touch'
                        }}>
                          {generateMessageForStudent(studentName, studentLanguage)}
                        </div>

                        {/* Copy Button */}
                        <button
                          data-track="tomorrow_copy"
                          onClick={() => handleCopyForStudent(studentName)}
                          style={{
                            ...getButtonStyle(isCopied ? 'success' : 'primary', 'medium', isMobile),
                            width: '100%',
                            touchAction: 'manipulation',
                          }}
                        >
                          {isCopied ? '已複製' : '複製訊息'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {coachReminderBlocks.length > 0 && (
            <div style={pageCardStyle}>
              <h2 style={sectionTitleStyle}>
                教練提醒訊息 ({coachReminderBlocks.length} 位)
              </h2>
              <div style={groupedListStyle}>
                {coachReminderBlocks.map(({ coach, lines }, coachIndex) => {
                  const text = lines.join('\n')
                  const isExpanded = selectedCoachReminder === coach
                  const isCopied = copiedCoachReminder === coach
                  return (
                    <div
                      key={coach}
                      style={{
                        borderBottom: coachIndex < coachReminderBlocks.length - 1
                          ? `1px solid ${designSystem.colors.border.light}`
                          : 'none',
                      }}
                    >
                      <div
                        data-track="tomorrow_coach_expand"
                        onClick={() => setSelectedCoachReminder(isExpanded ? null : coach)}
                        style={{
                          minHeight: '56px',
                          padding: isMobile ? '9px 12px' : '11px 14px',
                          background: isExpanded ? designSystem.colors.secondary[50] : designSystem.colors.background.card,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: designSystem.spacing.sm,
                          touchAction: 'manipulation'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: getFontSize('body', isMobile),
                            fontWeight: '600',
                            color: designSystem.colors.text.primary,
                            marginBottom: '2px',
                            lineHeight: 1.35,
                          }}>
                            {coach}
                          </div>
                          <div style={{
                            fontSize: getFontSize('caption', isMobile),
                            color: designSystem.colors.text.secondary
                          }}>
                            {lines.length} 筆預約
                          </div>
                        </div>
                        <div style={{
                          fontSize: getFontSize('caption', isMobile),
                          color: designSystem.colors.text.disabled,
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                        }}>
                          ▼
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{
                          padding: isMobile ? '10px 12px 12px' : '12px 14px 14px',
                          borderTop: `1px solid ${designSystem.colors.border.light}`,
                          background: designSystem.colors.background.card
                        }}>
                          <div style={{
                            background: designSystem.colors.background.main,
                            padding: isMobile ? '10px' : '12px',
                            borderRadius: designSystem.borderRadius.md,
                            whiteSpace: 'pre-wrap',
                            fontSize: getFontSize('body', isMobile),
                            lineHeight: 1.55,
                            color: designSystem.colors.text.primary,
                            fontFamily: 'inherit',
                            marginBottom: designSystem.spacing.sm,
                            maxHeight: isMobile ? '300px' : '400px',
                            overflowY: 'auto',
                            WebkitOverflowScrolling: 'touch'
                          }}>
                            {text}
                          </div>
                          <button
                            type="button"
                            data-track="tomorrow_coach_reminder_copy"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyCoachReminder(coach, text)
                            }}
                            style={{
                              ...getButtonStyle(isCopied ? 'success' : 'primary', 'medium', isMobile),
                              width: '100%',
                              touchAction: 'manipulation',
                            }}
                          >
                            {isCopied ? '已複製' : '複製訊息'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          </>
        )}

        <Footer />
    </PageShell>
  )
}

