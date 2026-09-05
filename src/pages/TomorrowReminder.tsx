import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
  getBadgeStyle,
  getButtonStyle,
  getEmptyStateStyle,
  getFontSize,
  getInputStyle,
  getLabelStyle,
} from '../styles/designSystem'
import { hasViewAccess } from '../utils/auth'
import {
  generateTomorrowReminderMessage,
  getTomorrowStudentList,
} from '../utils/tomorrowReminderMessage'
import { resolveContactNamesWithMembers } from '../utils/tomorrowReminderMembers'
import {
  buildTomorrowReminderRecipients,
  buildReminderSendPayload,
  getSelectedPushRecipients,
  type TomorrowReminderBindingRow,
  type TomorrowReminderMappingRow,
  type TomorrowReminderRecipient,
} from '../utils/tomorrowReminderRecipients'
import {
  getCoachTomorrowReminderLines,
  TOMORROW_COACH_REMINDER_TARGET_COACHES
} from '../utils/coachTomorrowReminderLines'
import { useTomorrowReminderTemplates } from '../hooks/useTomorrowReminderTemplates'
import { ToastContainer, useToast } from '../components/ui'

interface Booking {
  id: number
  boat_id: number
  contact_name: string
  contact_phone: string | null
  start_at: string
  duration_min: number
  activity_types: string[] | null
  notes: string | null
  boats?: { id: number; name: string; color: string } | null
  coaches?: { id: string; name: string }[]
  drivers?: { id: string; name: string }[]  // 駕駛資料
}

type ReminderLanguage = 'zh' | 'en'

type PushResult = {
  recipientKey: string
  memberId: string | null
  ok: boolean
  error?: string
  alreadySent?: boolean
  sentAt?: string
}

const FISH_REMINDER_COPY_RECIPIENT = '澤澤'

function formatSentTime(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function TomorrowReminder() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const toast = useToast()
  const weatherWarningRef = useRef<HTMLTextAreaElement>(null)
  const footerTextRef = useRef<HTMLTextAreaElement>(null)
  const englishFooterTextRef = useRef<HTMLTextAreaElement>(null)
  const englishWeatherWarningRef = useRef<HTMLTextAreaElement>(null)
  const fetchRequestIdRef = useRef(0)

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
  const selectedDateRef = useRef(selectedDate)
  selectedDateRef.current = selectedDate
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [copiedStudent, setCopiedStudent] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [copiedCoachReminder, setCopiedCoachReminder] = useState<string | null>(null)
  const [selectedCoachReminder, setSelectedCoachReminder] = useState<string | null>(null)
  const [studentLanguages, setStudentLanguages] = useState<Record<string, ReminderLanguage>>({})
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [memberIdsByName, setMemberIdsByName] = useState<Record<string, string[]>>({})
  const [bookingIdsByMemberId, setBookingIdsByMemberId] = useState<Record<string, number[]>>({})
  const [additionalReminderNames, setAdditionalReminderNames] = useState<string[]>([])
  const [bookingStudentNamesByMemberId, setBookingStudentNamesByMemberId] =
    useState<Record<string, string[]>>({})
  const [bookingStudentNamesByName, setBookingStudentNamesByName] =
    useState<Record<string, string[]>>({})
  const [lineBindings, setLineBindings] = useState<TomorrowReminderBindingRow[]>([])
  const [reminderMappings, setReminderMappings] = useState<TomorrowReminderMappingRow[]>([])
  const [bookingIdsByName, setBookingIdsByName] = useState<Record<string, number[]>>({})
  const [confirmedMappingByRecipient, setConfirmedMappingByRecipient] =
    useState<Record<string, string>>({})
  const [selectedPushMemberIds, setSelectedPushMemberIds] = useState<Set<string>>(new Set())
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({})
  const [pushStatusByMemberId, setPushStatusByMemberId] = useState<
    Record<string, { status: 'sent' | 'error'; error?: string; sentAt?: string }>
  >({})
  const [sending, setSending] = useState(false)

  const {
    includeWeatherWarning,
    setIncludeWeatherWarning,
    weatherWarning,
    setWeatherWarning,
    footerText,
    setFooterText,
    englishFooterText,
    setEnglishFooterText,
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
    fitTextareaToContent(englishFooterTextRef.current)
    fitTextareaToContent(englishWeatherWarningRef.current)
  }, [
    weatherWarning,
    footerText,
    englishFooterText,
    englishWeatherWarning,
    isMobile,
    showTemplateEditor,
  ])

  useEffect(() => {
    setSelectedStudent(null)
    setSelectedCoachReminder(null)
    setStudentLanguages({})
    setMemberIdsByName({})
    setBookingIdsByMemberId({})
    setAdditionalReminderNames([])
    setBookingStudentNamesByMemberId({})
    setBookingStudentNamesByName({})
    setLineBindings([])
    setReminderMappings([])
    setBookingIdsByName({})
    setConfirmedMappingByRecipient({})
    setSelectedPushMemberIds(new Set())
    setMessageDrafts({})
    setPushStatusByMemberId({})
    // 換日時先清空，避免新資料載入前畫面殘留前一天的學員/教練清單
    setBookings([])
    fetchData()
  }, [selectedDate])

  const fetchData = async () => {
    const requestId = ++fetchRequestIdRef.current
    const requestedDate = selectedDate
    const isLatestRequest = () =>
      requestId === fetchRequestIdRef.current && requestedDate === selectedDateRef.current
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('登入已失效，請重新登入')

      // 預約、教練、駕駛、會員與 LINE 狀態由同一個 API 回傳，
      // 將瀏覽器端原本兩輪相依請求縮成一次網路往返。
      const reminderContextResponse = await fetch('/api/line-reminder-send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'load_reminder_page',
          reminderDate: selectedDate,
        }),
      })
      const reminderContext = await reminderContextResponse.json().catch(() => null) as
        | {
            bookings?: Booking[]
            bookingCoaches?: Array<{
              booking_id: number
              coaches: { id: string; name: string } | null
            }>
            bookingDrivers?: Array<{
              booking_id: number
              coaches: { id: string; name: string } | null
            }>
            bookingMembers?: Array<{
              booking_id: number
              members: { id: string; name: string; nickname: string | null } | null
            }>
            additionalMembers?: Array<{
              id: string
              name: string
              nickname: string | null
            }>
            bindings?: TomorrowReminderBindingRow[]
            mappings?: TomorrowReminderMappingRow[]
            sendHistory?: Array<{
              recipient_key: string
              created_at: string
              sent_by_email: string
            }>
            error?: string
          }
        | null
      if (!reminderContextResponse.ok) {
        throw new Error(reminderContext?.error || '無法載入明日提醒')
      }
      const bookingsData = reminderContext?.bookings ?? []

      if (bookingsData && bookingsData.length > 0) {
        const bookingCoachesData = reminderContext?.bookingCoaches ?? []
        const bookingDriversData = reminderContext?.bookingDrivers ?? []
        const bookingMembersData = reminderContext?.bookingMembers ?? []

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

        const nextMemberIdsByName: Record<string, string[]> = {}
        const nextBookingIdsByMemberId: Record<string, number[]> = {}
        const nextAdditionalReminderNames: string[] = []
        const nextBookingStudentNamesByMemberId: Record<string, string[]> = {}
        const nextBookingStudentNamesByName: Record<string, string[]> = {}
        const nextBookingIdsByName: Record<string, number[]> = {}

        // ✅ 組合教練、駕駛和會員資料，並更新 contact_name 為最新暱稱
        bookingsData.forEach((booking: any) => {
          booking.coaches = coachesByBooking[booking.id] || []
          booking.drivers = driversByBooking[booking.id] || []

          // ✅ 有會員資料時更新名稱：保留訪客，會員換成最新暱稱
          const members = membersByBooking[booking.id] || []
          const resolved = resolveContactNamesWithMembers(booking.contact_name, members)
          booking.contact_name = resolved.contactName
          booking.contact_name.split(',').map((value: string) => value.trim()).filter(Boolean)
            .forEach((displayName: string) => {
              const ids = nextBookingIdsByName[displayName] || []
              if (!ids.includes(booking.id)) ids.push(booking.id)
              nextBookingIdsByName[displayName] = ids
            })
          members.forEach((member: { id: string; name?: string | null; nickname?: string | null }) => {
            const displayName = member.nickname || member.name || ''
            if (!displayName) return
            const ids = nextMemberIdsByName[displayName] || []
            if (!ids.includes(member.id)) ids.push(member.id)
            nextMemberIdsByName[displayName] = ids
            const bookingIds = nextBookingIdsByMemberId[member.id] || []
            if (!bookingIds.includes(booking.id)) bookingIds.push(booking.id)
            nextBookingIdsByMemberId[member.id] = bookingIds
          })
        })

        const fishBookingIds = bookingsData
          .filter((booking: Booking) =>
            booking.contact_name.split(',').map((name) => name.trim()).includes('Fish')
          )
          .map((booking: Booking) => booking.id)

        if (fishBookingIds.length > 0) {
          const hasNamedZheBooking = bookingsData.some((booking: Booking) =>
            booking.contact_name
              .split(',')
              .map((name) => name.trim())
              .includes(FISH_REMINDER_COPY_RECIPIENT)
          )
          const additionalMembers = reminderContext?.additionalMembers ?? []

          if (additionalMembers && additionalMembers.length > 1) {
            console.error('Multiple members matched the 澤澤 reminder rule')
          }

          if (additionalMembers?.length === 1) {
            const member = additionalMembers[0]
            const displayName = member.nickname || member.name || FISH_REMINDER_COPY_RECIPIENT
            const memberIds = nextMemberIdsByName[displayName] || []
            if (!memberIds.includes(member.id)) memberIds.push(member.id)
            nextMemberIdsByName[displayName] = memberIds
            const ownBookingIds = nextBookingIdsByMemberId[member.id] || []
            if (ownBookingIds.length === 0 && !hasNamedZheBooking) {
              nextBookingIdsByMemberId[member.id] = Array.from(new Set(fishBookingIds))
              nextBookingStudentNamesByMemberId[member.id] = ['Fish']
              if (!nextAdditionalReminderNames.includes(displayName)) {
                nextAdditionalReminderNames.push(displayName)
              }
            }
          } else if (!hasNamedZheBooking) {
            nextAdditionalReminderNames.push(FISH_REMINDER_COPY_RECIPIENT)
            nextBookingStudentNamesByName[FISH_REMINDER_COPY_RECIPIENT] = ['Fish']
          }
        }

        if (!isLatestRequest()) return
        setReminderMappings(reminderContext?.mappings ?? [])
        setLineBindings(reminderContext?.bindings ?? [])
        setMemberIdsByName(nextMemberIdsByName)
        setBookingIdsByMemberId(nextBookingIdsByMemberId)
        setAdditionalReminderNames(nextAdditionalReminderNames)
        setBookingStudentNamesByMemberId(nextBookingStudentNamesByMemberId)
        setBookingStudentNamesByName(nextBookingStudentNamesByName)
        setBookingIdsByName(nextBookingIdsByName)
        setPushStatusByMemberId(
          Object.fromEntries(
            (reminderContext?.sendHistory ?? []).map((send) => [
              send.recipient_key,
              { status: 'sent' as const, sentAt: send.created_at },
            ]),
          ),
        )
      }

      if (!isLatestRequest()) return
      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      if (isLatestRequest()) setLoading(false)
    }
  }

  const studentNames = useMemo(() => {
    const names = Array.from(new Set([
      ...getTomorrowStudentList(bookings),
      ...additionalReminderNames,
    ])).sort()
    if (additionalReminderNames.length === 0) return names

    const namesWithoutCopies = names.filter((name) => !additionalReminderNames.includes(name))
    const fishIndex = namesWithoutCopies.indexOf('Fish')
    namesWithoutCopies.splice(
      fishIndex >= 0 ? fishIndex + 1 : namesWithoutCopies.length,
      0,
      ...additionalReminderNames,
    )
    return namesWithoutCopies
  }, [additionalReminderNames, bookings])

  const generateMessageForStudent = (
    studentName: string,
    language: ReminderLanguage,
    sourceBookings: Booking[] = bookings,
    bookingStudentNames?: string[],
  ): string =>
    generateTomorrowReminderMessage({
      studentName,
      bookingStudentNames,
      bookings: sourceBookings,
      language,
      templates: {
        includeWeatherWarning,
        weatherWarning,
        footerText,
        englishFooterText,
        englishWeatherWarning,
      },
    })

  const recipients = useMemo(() => {
    const bookingCountByName: Record<string, number> = {}
    studentNames.forEach((studentName) => {
      const uniqueBookingKeys = new Set<string>()
      bookings.forEach((booking) => {
        const names = booking.contact_name.split(',').map((name) => name.trim())
        if (!names.includes(studentName)) return
        uniqueBookingKeys.add(`${booking.boat_id}-${booking.start_at}-${booking.duration_min}`)
      })
      bookingCountByName[studentName] = uniqueBookingKeys.size
    })

    const built = buildTomorrowReminderRecipients({
      studentNames,
      memberIdsByName,
      bindings: lineBindings,
      bookingCountByName,
      bookingIdsByMemberId,
      bookingStudentNamesByMemberId,
      bookingStudentNamesByName,
      bookingIdsByName,
      reminderMappings,
    })
    return built.map((recipient) => {
      const confirmedMappingId = confirmedMappingByRecipient[recipient.key]
      const candidate = recipient.mappingCandidates?.find(
        (mapping) => mapping.id === confirmedMappingId,
      )
      return candidate
        ? {
            ...recipient,
            status: 'mapped' as const,
            mappingId: candidate.id,
            mappingDisplayName: candidate.displayName,
          }
        : recipient
    })
  }, [
    bookingIdsByMemberId,
    bookingIdsByName,
    bookingStudentNamesByMemberId,
    bookingStudentNamesByName,
    bookings,
    confirmedMappingByRecipient,
    lineBindings,
    memberIdsByName,
    reminderMappings,
    studentNames,
  ])

  const pushableRecipients = useMemo(
    () => recipients.filter(
      (recipient) => recipient.status === 'pushable' || recipient.status === 'mapped',
    ),
    [recipients],
  )
  const manualRecipients = useMemo(
    () => recipients.filter(
      (recipient) => recipient.status !== 'pushable' && recipient.status !== 'mapped',
    ),
    [recipients],
  )

  useEffect(() => {
    setSelectedPushMemberIds(
      new Set(
        pushableRecipients
          .map((recipient) => recipient.key),
      ),
    )
  }, [pushableRecipients])

  const messageForRecipient = (recipient: TomorrowReminderRecipient): string => {
    const draft = messageDrafts[recipient.key]
    if (draft !== undefined) return draft

    const bookingIds = new Set(recipient.bookingIds)
    const recipientBookings = bookingIds.size > 0
      ? bookings.filter((booking) => bookingIds.has(booking.id))
      : bookings
    const messageStudentName = recipient.bookingStudentNames?.includes('Fish')
      ? 'Fish'
      : recipient.name
    return generateMessageForStudent(
      messageStudentName,
      studentLanguages[recipient.key] || 'zh',
      recipientBookings,
      recipient.bookingStudentNames,
    )
  }

  const handleCopyForRecipient = (recipient: TomorrowReminderRecipient) => {
    const message = messageForRecipient(recipient)
    navigator.clipboard.writeText(message).then(() => {
      setCopiedStudent(recipient.key)
      setTimeout(() => setCopiedStudent(null), 2000)
    })
  }

  const handleLanguageChange = (recipient: TomorrowReminderRecipient, language: ReminderLanguage) => {
    setStudentLanguages((current) => ({ ...current, [recipient.key]: language }))
    setMessageDrafts((current) => {
      const next = { ...current }
      delete next[recipient.key]
      return next
    })
    setCopiedStudent(null)
  }

  const togglePushRecipient = (recipientKey: string) => {
    if (pushStatusByMemberId[recipientKey]?.status === 'sent') return
    setSelectedPushMemberIds((current) => {
      const next = new Set(current)
      if (next.has(recipientKey)) next.delete(recipientKey)
      else next.add(recipientKey)
      return next
    })
  }

  const selectedPushRecipients = getSelectedPushRecipients(
    recipients,
    selectedPushMemberIds,
    new Set(
      Object.entries(pushStatusByMemberId)
        .filter(([, status]) => status.status === 'sent')
        .map(([recipientKey]) => recipientKey),
    ),
  )

  const sendRecipients = async (
    targetRecipients: TomorrowReminderRecipient[],
    confirmation: string,
    forceResend = false,
  ) => {
    if (sending || targetRecipients.length === 0) return
    const invalidRecipient = targetRecipients.find((recipient) => {
      const message = messageForRecipient(recipient).trim()
      return message.length === 0 || message.length > 5000
    })
    if (invalidRecipient) {
      setSelectedStudent(invalidRecipient.key)
      toast.warning(`${invalidRecipient.name} 的訊息必須為 1–5000 個字元`)
      return
    }

    const confirmed = window.confirm(confirmation)
    if (!confirmed) return

    setSending(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('登入已失效，請重新登入')

      const response = await fetch('/api/line-reminder-send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          forceResend,
          recipients: buildReminderSendPayload(targetRecipients, messageForRecipient),
        }),
      })
      const body = await response.json().catch(() => null) as
        | { results?: PushResult[]; error?: string }
        | null
      if (!response.ok && !body?.results) {
        throw new Error(body?.error || 'LINE 傳送失敗')
      }
      if (!body?.results) throw new Error('LINE 傳送結果格式錯誤')

      const results = body.results
      const nextStatuses: Record<
        string,
        { status: 'sent' | 'error'; error?: string; sentAt?: string }
      > = {}
      const successfulIds = new Set<string>()
      results.forEach((result) => {
        nextStatuses[result.recipientKey] = result.ok || result.alreadySent
          ? {
              status: 'sent',
              sentAt: result.sentAt ?? (result.ok ? new Date().toISOString() : undefined),
            }
          : { status: 'error', error: result.error || '傳送失敗' }
        if (result.ok || result.alreadySent) successfulIds.add(result.recipientKey)
      })
      setPushStatusByMemberId((current) => ({ ...current, ...nextStatuses }))
      setSelectedPushMemberIds((current) => {
        const next = new Set(current)
        successfulIds.forEach((recipientKey) => next.delete(recipientKey))
        return next
      })

      const alreadySentCount = results.filter((result) => result.alreadySent).length
      const failedCount = results.filter((result) => !result.ok && !result.alreadySent).length
      const successCount = results.filter((result) => result.ok).length
      if (!response.ok) {
        toast.warning(`訊息已處理，但操作紀錄寫入失敗；請勿重送已成功的 ${successCount} 位`)
      } else if (alreadySentCount > 0) {
        toast.warning(`${alreadySentCount} 位先前已傳送，本次未重送`)
      } else if (failedCount > 0) {
        toast.warning(`已傳送 ${successCount} 位，${failedCount} 位失敗，可再次重試`)
      } else {
        toast.success(`已傳送 ${successCount} 位聯絡人`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LINE 傳送失敗'
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  const handleSendSelected = () =>
    sendRecipients(
      selectedPushRecipients,
      `確定要傳送 ${selectedDate} 的提醒給 ${selectedPushRecipients.length} 位聯絡人嗎？`,
    )

  const handleSendRecipient = (recipient: TomorrowReminderRecipient) =>
    pushStatusByMemberId[recipient.key]?.status === 'sent'
      ? sendRecipients(
          [recipient],
          `${recipient.name} 在 ${selectedDate} 已傳送過提醒，確定仍要再次傳送嗎？`,
          true,
        )
      : sendRecipients(
          [recipient],
          `確定要傳送 ${selectedDate} 的提醒給 ${recipient.name} 嗎？`,
        )

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

  const memberListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: designSystem.spacing.sm,
  } as const

  const renderRecipientCard = (recipient: TomorrowReminderRecipient) => {
    const isExpanded = selectedStudent === recipient.key
    const isCopied = copiedStudent === recipient.key
    const language = studentLanguages[recipient.key] || 'zh'
    const pushState = pushStatusByMemberId[recipient.key]
    const sentTime = formatSentTime(pushState?.sentAt)
    const isPushable = recipient.status === 'pushable' || recipient.status === 'mapped'
    const isSelected = isPushable && selectedPushMemberIds.has(recipient.key)
    const statusLabel =
      pushState?.status === 'sent'
        ? '已傳送'
        : recipient.status === 'pushable'
          ? 'LINE 已綁定'
          : recipient.status === 'mapped'
            ? `提醒配對${recipient.mappingDisplayName ? `：${recipient.mappingDisplayName}` : ''}`
            : recipient.status === 'suggested'
              ? '找到候選，請確認'
          : recipient.status === 'rebind'
            ? '需重新綁定'
            : recipient.status === 'unbound'
              ? 'LINE 未綁定'
              : '非會員'
    const statusTone: 'success' | 'warning' | 'default' =
      pushState?.status === 'sent'
        ? 'success'
        : recipient.status === 'pushable' || recipient.status === 'mapped'
          ? 'success'
          : recipient.status === 'rebind' || recipient.status === 'suggested'
            ? 'warning'
            : 'default'

    return (
      <div
        key={recipient.key}
        style={{
          overflow: 'hidden',
          border: `1px solid ${
            pushState?.status === 'error'
              ? designSystem.colors.danger[500]
              : designSystem.colors.border.light
          }`,
          borderRadius: designSystem.borderRadius.md,
          background: designSystem.colors.background.card,
          boxShadow: isExpanded ? designSystem.shadows.xs : 'none',
          transition: designSystem.transitions.fast,
        }}
      >
        <div
          data-track="tomorrow_expand"
          onClick={() => setSelectedStudent(isExpanded ? null : recipient.key)}
          style={{
            minHeight: isMobile ? '64px' : '58px',
            padding: isMobile ? '10px 10px' : '11px 12px',
            background: isExpanded
              ? designSystem.colors.secondary[50]
              : designSystem.colors.background.card,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: designSystem.spacing.sm,
            touchAction: 'manipulation',
          }}
        >
          {isPushable && (
            <input
              type="checkbox"
              aria-label={`選取 ${recipient.name}`}
              checked={isSelected}
              disabled={pushState?.status === 'sent'}
              onClick={(event) => event.stopPropagation()}
              onChange={() => togglePushRecipient(recipient.key)}
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                accentColor: designSystem.colors.success[500],
              }}
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: designSystem.spacing.xs,
              flexWrap: 'wrap',
              marginBottom: 3,
            }}>
              <span style={{
                fontSize: getFontSize('body', isMobile),
                fontWeight: 600,
                color: designSystem.colors.text.primary,
                lineHeight: 1.35,
              }}>
                {recipient.bookingStudentNames?.includes('Fish')
                  ? `${recipient.name}(Fish提醒)`
                  : recipient.name}
              </span>
              <span style={getBadgeStyle(statusTone, 'small')}>{statusLabel}</span>
            </div>
            <div style={{
              fontSize: getFontSize('caption', isMobile),
              color: designSystem.colors.text.secondary,
            }}>
              {recipient.bookingCount} 個預約
              {pushState?.status === 'sent' && sentTime ? ` · ${sentTime} 已傳送` : ''}
            </div>
          </div>

          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: 3,
              border: `1px solid ${designSystem.colors.border.main}`,
              borderRadius: designSystem.borderRadius.sm,
              background: designSystem.colors.secondary[50],
              flexShrink: 0,
            }}
            role="group"
            aria-label={`${recipient.name} 的提醒訊息語言`}
          >
            {([
              { value: 'zh', label: '中' },
              { value: 'en', label: 'EN' },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                data-track={`tomorrow_language_${option.value}`}
                aria-pressed={language === option.value}
                onClick={() => handleLanguageChange(recipient, option.value)}
                style={{
                  minWidth: option.value === 'zh' ? 36 : 42,
                  minHeight: isMobile ? 40 : 34,
                  padding: isMobile ? '8px 9px' : '6px 9px',
                  border: 'none',
                  borderRadius: 7,
                  background:
                    language === option.value
                      ? designSystem.colors.secondary[200]
                      : 'transparent',
                  color:
                    language === option.value
                      ? designSystem.colors.text.primary
                      : designSystem.colors.text.secondary,
                  fontSize: getFontSize('button', isMobile),
                  fontWeight: language === option.value ? 650 : 500,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <span
            aria-hidden="true"
            style={{
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('bodySmall', isMobile),
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: designSystem.transitions.fast,
              flexShrink: 0,
            }}
          >
            ▼
          </span>
        </div>

        {isExpanded && (
          <div style={{
            padding: isMobile ? '10px 12px 12px' : '12px 14px 14px',
            borderTop: `1px solid ${designSystem.colors.border.light}`,
          }}>
            {recipient.status === 'suggested' && recipient.mappingCandidates?.length ? (
              <div style={{ marginBottom: designSystem.spacing.sm }}>
                <label style={{ ...getLabelStyle(isMobile), display: 'block', marginBottom: 6 }}>
                  確認這次要傳給哪位 LINE 聯絡人
                </label>
                <select
                  value={confirmedMappingByRecipient[recipient.key] || ''}
                  onChange={(event) => {
                    const mappingId = event.target.value
                    setConfirmedMappingByRecipient((current) => ({
                      ...current,
                      [recipient.key]: mappingId,
                    }))
                  }}
                  style={{ ...getInputStyle(isMobile), width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">請選擇，不會自動傳送</option>
                  {recipient.mappingCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.displayName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <textarea
              aria-label={`${recipient.name} 的提醒訊息`}
              value={messageForRecipient(recipient)}
              onChange={(event) =>
                setMessageDrafts((current) => ({
                  ...current,
                  [recipient.key]: event.target.value,
                }))
              }
              style={{
                ...getInputStyle(isMobile),
                width: '100%',
                minHeight: isMobile ? 210 : 240,
                boxSizing: 'border-box',
                fontSize: isMobile ? 16 : getFontSize('body', false),
                lineHeight: 1.55,
                fontFamily: 'inherit',
                resize: 'vertical',
                marginBottom: designSystem.spacing.sm,
              }}
            />
            {pushState?.status === 'error' && (
              <div style={{
                color: designSystem.colors.danger[700],
                fontSize: getFontSize('caption', isMobile),
                marginBottom: designSystem.spacing.sm,
              }}>
                傳送失敗：{pushState.error || '請稍後重試'}
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isPushable ? '1fr 1fr' : '1fr',
              gap: designSystem.spacing.sm,
            }}>
              <button
                type="button"
                data-track="tomorrow_copy"
                onClick={() => handleCopyForRecipient(recipient)}
                style={{
                  ...getButtonStyle(isCopied ? 'success' : 'outline', 'medium', isMobile),
                  width: '100%',
                  minHeight: isMobile ? 46 : undefined,
                  touchAction: 'manipulation',
                }}
              >
                {isCopied ? '已複製' : '複製提醒'}
              </button>
              {isPushable && (
                <button
                  type="button"
                  data-track="tomorrow_line_send_one"
                  onClick={() => void handleSendRecipient(recipient)}
                  disabled={sending}
                  style={{
                    ...getButtonStyle(
                      pushState?.status === 'sent' ? 'outline' : 'primary',
                      'medium',
                      isMobile,
                    ),
                    width: '100%',
                    minHeight: isMobile ? 46 : undefined,
                    touchAction: 'manipulation',
                  }}
                >
                  {pushState?.status === 'sent'
                    ? '再次傳送'
                    : sending
                      ? '傳送中…'
                      : '傳送此人'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

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
          {/* 常用設定保持在收合區塊外 */}
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

          {templateSaveStatus === 'error' && (
            <div
              role="alert"
              style={{
                marginBottom: isMobile ? '12px' : '14px',
                padding: '9px 10px',
                background: designSystem.colors.danger[50],
                border: `1px solid ${designSystem.colors.danger[500]}`,
                borderRadius: designSystem.borderRadius.sm,
                color: designSystem.colors.danger[700],
                fontSize: getFontSize('caption', isMobile),
                lineHeight: 1.4,
              }}
            >
              設定未能儲存，請重新整理後再試
            </div>
          )}

          <h2 style={{ ...sectionTitleStyle, marginBottom: showTemplateEditor ? (isMobile ? '10px' : '12px') : 0 }}>
            <button
              type="button"
              aria-expanded={showTemplateEditor}
              aria-controls="tomorrow-template-editor"
              onClick={() => setShowTemplateEditor((current) => !current)}
              style={{
              display: 'flex',
              alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: 0,
                border: 0,
                background: 'transparent',
              cursor: 'pointer',
                color: 'inherit',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <span>編輯文字模板</span>
              <span style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('bodySmall', isMobile),
                fontWeight: '500',
              }}>
                {showTemplateEditor ? '收合 ▲' : '展開 ▼'}
              </span>
            </button>
          </h2>

          {showTemplateEditor && (
            <div id="tomorrow-template-editor">
              {/* 中文結尾文字 */}
              <div style={{ marginBottom: designSystem.spacing.md }}>
            <label style={templateLabelStyle}>
              中文結尾文字
            </label>
            <textarea
              ref={footerTextRef}
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                fontSize: isMobile ? '16px' : getFontSize('body', false),
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

              {/* 中文天氣附加文字 */}
              <div>
            <label style={templateLabelStyle}>
              中文天氣附加文字
            </label>
            <textarea
              ref={weatherWarningRef}
              value={weatherWarning}
              onChange={(e) => setWeatherWarning(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                fontSize: isMobile ? '16px' : getFontSize('body', false),
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

              <div style={{
                marginTop: designSystem.spacing.md,
                paddingTop: designSystem.spacing.md,
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}>
            <label style={templateLabelStyle}>
              英文結尾文字
            </label>
            <textarea
              ref={englishFooterTextRef}
              value={englishFooterText}
              onChange={(e) => setEnglishFooterText(e.target.value)}
              style={{
                ...getInputStyle(isMobile),
                fontSize: isMobile ? '16px' : getFontSize('body', false),
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
                fontSize: isMobile ? '16px' : getFontSize('body', false),
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

              {templateSaveStatus !== 'error' && (
                <div style={{
                  marginTop: designSystem.spacing.md,
                  fontSize: getFontSize('caption', isMobile),
                  color: designSystem.colors.text.disabled,
                  display: 'flex',
                  alignItems: 'center',
                  gap: designSystem.spacing.xs,
                }}>
                  <span aria-hidden="true">✓</span>
                  <span>
                    {templateSaveStatus === 'loading' && '正在載入共用文字模板…'}
                    {templateSaveStatus === 'saving' && '正在儲存共用文字模板…'}
                    {templateSaveStatus === 'saved' && '修改會自動儲存'}
                  </span>
                </div>
              )}
            </div>
          )}
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
              可 LINE 傳送 ({pushableRecipients.length} 位)
            </h2>
            <div style={{
              marginTop: isMobile ? -5 : -6,
              marginBottom: isMobile ? 10 : 12,
              color: designSystem.colors.text.secondary,
              fontSize: getFontSize('caption', isMobile),
              lineHeight: 1.4,
            }}>
              預設全選；正式綁定與已確認的提醒配對都可直接傳送
            </div>
            {pushableRecipients.length > 0 ? (
              <div style={memberListStyle}>
                {pushableRecipients.map(renderRecipientCard)}
              </div>
            ) : (
              <div style={getEmptyStateStyle(isMobile)}>目前沒有可推播的預約人</div>
            )}

            {!isMobile && pushableRecipients.length > 0 && (
              <button
                type="button"
                data-track="tomorrow_line_send_selected"
                onClick={() => void handleSendSelected()}
                disabled={sending || selectedPushRecipients.length === 0}
                style={{
                  ...getButtonStyle(
                    selectedPushRecipients.length > 0 ? 'primary' : 'outline',
                    'large',
                    false,
                  ),
                  width: '100%',
                  marginTop: designSystem.spacing.md,
                }}
              >
                {sending ? '傳送中…' : `傳送已選 ${selectedPushRecipients.length} 位`}
              </button>
            )}
          </div>

          {manualRecipients.length > 0 && (
            <div style={pageCardStyle}>
              <h2 style={sectionTitleStyle}>
                需人工傳送 ({manualRecipients.length} 位)
              </h2>
              <div style={{
                marginTop: isMobile ? -5 : -6,
                marginBottom: isMobile ? 10 : 12,
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
                lineHeight: 1.4,
              }}>
                有候選者可展開確認；沒有候選時請先到「LINE 配對 → 提醒配對」
              </div>
              <div style={memberListStyle}>
                {manualRecipients.map(renderRecipientCard)}
              </div>
            </div>
          )}

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

        {isMobile && pushableRecipients.length > 0 && (
          <div style={{
            position: 'sticky',
            bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
            zIndex: designSystem.zIndex.dropdown,
            padding: 8,
            margin: '0 0 10px',
            borderRadius: designSystem.borderRadius.lg,
            background: 'rgba(255,255,255,0.96)',
            border: `1px solid ${designSystem.colors.border.light}`,
            boxShadow: designSystem.shadows.elevation[4],
          }}>
            <button
              type="button"
              data-track="tomorrow_line_send_selected"
              onClick={() => void handleSendSelected()}
              disabled={sending || selectedPushRecipients.length === 0}
              style={{
                ...getButtonStyle(
                  selectedPushRecipients.length > 0 ? 'primary' : 'outline',
                  'large',
                  true,
                ),
                width: '100%',
                minHeight: 48,
                touchAction: 'manipulation',
              }}
            >
              {sending ? '傳送中…' : `傳送已選 ${selectedPushRecipients.length} 位`}
            </button>
          </div>
        )}

        <Footer />
        <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </PageShell>
  )
}

