import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBookingConflict } from './useBookingConflict'
import { filterMembers, composeFinalStudentName, toggleSelection, splitAndDeduplicateNames, stripManualNamesMatchingSelectedMembers } from '../utils/memberUtils'
import { MEMBER_SEARCH_DEBOUNCE_MS } from '../constants/booking'
import type { Booking, Boat, Coach, Member } from '../types/booking'
import { isFacility } from '../utils/facility'
import { getFilledByName } from '../utils/filledByHelper'
import { getLocalDateString } from '../utils/date'

interface UseBookingFormProps {
    initialBooking?: Booking
    defaultDate?: string
    defaultBoatId?: number
    userEmail?: string  // 操作者的 email，用於自動填入填表人
}

export function useBookingForm({ initialBooking, defaultDate, defaultBoatId, userEmail }: UseBookingFormProps = {}) {
    const { checkConflict } = useBookingConflict()

    // --- State ---
    const [boats, setBoats] = useState<Pick<Boat, 'id' | 'name' | 'color'>[]>([])
    const [selectedBoatId, setSelectedBoatId] = useState<number>(initialBooking?.boat_id || defaultBoatId || 0)

    const [coaches, setCoaches] = useState<(Pick<Coach, 'id' | 'name'> & { isOnTimeOff?: boolean })[]>([])
    const [selectedCoaches, setSelectedCoaches] = useState<string[]>(
        initialBooking?.coaches?.map(c => c.id) || []
    )

    // Members
    const [members, setMembers] = useState<Pick<Member, 'id' | 'name' | 'nickname' | 'phone'>[]>([])
    const [memberSearchTerm, setMemberSearchTerm] = useState('')
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
    const [showMemberDropdown, setShowMemberDropdown] = useState(false)
    const [manualStudentName, setManualStudentName] = useState('')
    const [manualNames, setManualNames] = useState<string[]>([])

    // Time & Details
    const [startDate, setStartDate] = useState('')
    const [startTime, setStartTime] = useState('00:00')
    const [durationMin, setDurationMin] = useState(initialBooking?.duration_min || 60)
    const [activityTypes, setActivityTypes] = useState<string[]>(initialBooking?.activity_types || [])
    const [notes, setNotes] = useState(initialBooking?.notes || '')
    const [requiresDriver, setRequiresDriver] = useState(initialBooking?.requires_driver || false)
    // 填表人：優先使用 email 對應的姓名（如有），否則為空（用戶自行輸入）
    const [filledBy, setFilledBy] = useState(() => getFilledByName(userEmail))
    const [isCoachPractice, setIsCoachPractice] = useState(initialBooking?.is_coach_practice || false)

    // Status
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCoaches, setLoadingCoaches] = useState(false)

    // Initialization tracking
    const isInitializedRef = useRef(false)
    /** 已用 contact_name + 會員名冊還原過手動名（避免 members 異動時重覆覆寫使用者編輯） */
    const contactManualParsedKeyRef = useRef<string | null>(null)
    const prevEditBookingIdRef = useRef<number | null>(null)

    // Search Debounce
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // --- Derived State ---
    const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
    const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])

    const selectedBoat = useMemo(() => boats.find(b => b.id === selectedBoatId), [boats, selectedBoatId])
    const isSelectedBoatFacility = useMemo(() => isFacility(selectedBoat?.name), [selectedBoat])

    const canRequireDriver = useMemo(() => 
        selectedCoaches.length > 0 && !isSelectedBoatFacility,
        [selectedCoaches, isSelectedBoatFacility]
    )

    const filteredMembers = useMemo(() =>
        filterMembers(members, memberSearchTerm, 10),
        [members, memberSearchTerm]
    )

    const finalStudentName = useMemo(() => 
        composeFinalStudentName(members, selectedMemberIds, manualNames),
        [members, selectedMemberIds, manualNames]
    )

    // --- Effects ---

    // Initialize from initialBooking or defaults
    useEffect(() => {
        if (initialBooking) {
            if (prevEditBookingIdRef.current !== initialBooking.id) {
                contactManualParsedKeyRef.current = null
                prevEditBookingIdRef.current = initialBooking.id
            }

            // Edit Mode Initialization
            setSelectedBoatId(initialBooking.boat_id)
            setDurationMin(initialBooking.duration_min)
            setNotes(initialBooking.notes || '')
            setRequiresDriver(initialBooking.requires_driver || false)
            setActivityTypes(initialBooking.activity_types || [])
            setIsCoachPractice(initialBooking.is_coach_practice || false)
            // 編輯模式下：如果有對應的填表人姓名就自動填入，否則清空讓編輯者重新填寫
            setFilledBy(getFilledByName(userEmail))

            const datetime = initialBooking.start_at.substring(0, 16)
            const [date, time] = datetime.split('T')
            setStartDate(date)
            setStartTime(time)

            setSelectedCoaches(initialBooking.coaches?.map(c => c.id) || [])

            // Initialize members
            const initialMemberIds: string[] = []
            if (initialBooking.member_id) initialMemberIds.push(initialBooking.member_id)
            if (initialBooking.booking_members && initialBooking.booking_members.length > 0) {
                initialBooking.booking_members.forEach((bm: any) => initialMemberIds.push(bm.member_id))
            }
            setSelectedMemberIds([...new Set(initialMemberIds)])

            // Initialize manual names - 從 contact_name 中提取非會員名字
            if (initialBooking.contact_name) {
                const contactNames = splitAndDeduplicateNames(initialBooking.contact_name)

                const memberNamesSet = new Set<string>()
                if (initialBooking.booking_members && initialBooking.booking_members.length > 0) {
                    initialBooking.booking_members.forEach((bm: any) => {
                        if (bm.members) {
                            if (bm.members.name) memberNamesSet.add(String(bm.members.name).trim())
                            if (bm.members.nickname) memberNamesSet.add(String(bm.members.nickname).trim())
                        }
                    })
                }

                const nonMemberNames = contactNames.filter(name => !memberNamesSet.has(name.trim()))
                // 有關聯會員但嵌套資料比對不到姓名時，先不把手動名寫入 state，等 members 載入後再解析，避免橘標閃一下又消失
                const deferUntilMembers =
                    initialMemberIds.length > 0 && memberNamesSet.size === 0
                setManualNames(deferUntilMembers ? [] : nonMemberNames)
            } else {
                setManualNames([])
            }
        } else {
            prevEditBookingIdRef.current = null
            contactManualParsedKeyRef.current = null

            // Create Mode Initialization
            if (defaultBoatId) setSelectedBoatId(defaultBoatId)

            if (defaultDate) {
                const datetime = defaultDate.substring(0, 16)
                const [date, time] = datetime.split('T')
                setStartDate(date)
                setStartTime(time)
            } else {
                const now = new Date()
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                const hour = now.getHours()
                const minute = Math.floor(now.getMinutes() / 15) * 15
                const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
                setStartDate(dateStr)
                setStartTime(timeStr)
            }
        }

        // Mark as initialized (synchronously after state updates)
        // Use a microtask to ensure state updates are queued first
        Promise.resolve().then(() => {
            isInitializedRef.current = true
        })
    }, [initialBooking, defaultDate, defaultBoatId])

    // 編輯模式：會員名冊載入後一次從 contact_name 還原手動名（與預約上的 member 比對），避免先畫錯誤橘標
    useEffect(() => {
        if (!initialBooking?.contact_name || members.length === 0) {
            if (!initialBooking) contactManualParsedKeyRef.current = null
            return
        }

        const parseKey = `${initialBooking.id}|${initialBooking.contact_name}`
        if (contactManualParsedKeyRef.current === parseKey) return

        const ids = new Set<string>()
        if (initialBooking.member_id) ids.add(initialBooking.member_id)
        if (initialBooking.booking_members?.length) {
            initialBooking.booking_members.forEach((bm: any) => {
                if (bm.member_id) ids.add(bm.member_id)
            })
        }

        const memberLabels = new Set<string>()
        if (initialBooking.booking_members?.length) {
            initialBooking.booking_members.forEach((bm: any) => {
                if (bm.members) {
                    if (bm.members.name) memberLabels.add(String(bm.members.name).trim())
                    if (bm.members.nickname) memberLabels.add(String(bm.members.nickname).trim())
                }
            })
        }
        for (const id of ids) {
            const m = members.find(mm => mm.id === id)
            if (!m) continue
            if (m.name?.trim()) memberLabels.add(m.name.trim())
            if (m.nickname?.trim()) memberLabels.add(m.nickname.trim())
            memberLabels.add((m.nickname || m.name).trim())
        }

        const contactNames = splitAndDeduplicateNames(initialBooking.contact_name)
        const nonMemberNames = contactNames.filter((name) => {
            const t = name.trim()
            if (!t) return false
            if (memberLabels.has(t)) return false
            return ![...memberLabels].some(
                (ml) => ml && (t.includes(ml) || ml.includes(t))
            )
        })

        setManualNames(nonMemberNames)
        contactManualParsedKeyRef.current = parseKey
    }, [initialBooking, members])

    // 會員名冊載入後：contact_name 拆出的手動名若與已選會員本名／暱稱相同則移除，避免同一人出現藍標＋橘標
    useEffect(() => {
        if (selectedMemberIds.length === 0 || members.length === 0) return
        setManualNames(prev => {
            const next = stripManualNamesMatchingSelectedMembers(members, selectedMemberIds, prev)
            if (next.length === prev.length && next.every((n, i) => n === prev[i])) return prev
            return next
        })
    }, [members, selectedMemberIds])

    // Auto-disable requiresDriver if conditions not met (but not during initialization or data loading)
    useEffect(() => {
        // Only auto-disable if:
        // 1. Already initialized
        // 2. Not currently loading coaches (to avoid race condition during data fetch)
        // 3. Conditions not met
        if (!canRequireDriver && requiresDriver && isInitializedRef.current && !loadingCoaches) {
            setRequiresDriver(false)
        }
    }, [canRequireDriver, requiresDriver, loadingCoaches])

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [])

    // --- Actions ---

    const fetchBoats = useCallback(async () => {
        const { data, error } = await supabase
            .from('boats')
            .select('id, name, color')
            .eq('is_active', true)  // 只顯示啟用的船隻
            .order('id')

        if (error) console.error('Error fetching boats:', error)
        else {
            // 統一顯示順序
            const desiredOrder = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床', '陸上課程']
            const indexOfName = (name?: string) => {
                if (!name) return Number.MAX_SAFE_INTEGER
                const idx = desiredOrder.findIndex(label => name.includes(label))
                return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
            }
            const sorted = (data || []).slice().sort((a, b) => {
                const ia = indexOfName(a.name)
                const ib = indexOfName(b.name)
                if (ia !== ib) return ia - ib
                // 次排序：原本的 id 順序，確保穩定
                return (a.id || 0) - (b.id || 0)
            })
            setBoats(sorted)
        }
    }, [])

    const fetchCoaches = useCallback(async (dateToCheck?: string) => {
        setLoadingCoaches(true)
        try {
            // 取得要檢查的日期（預設為 startDate）
            const checkDate = dateToCheck || startDate
            
            // 並行查詢教練和休假資料
            const [coachesResult, timeOffResult] = await Promise.all([
                supabase
                    .from('coaches')
                    .select('id, name')
                    .eq('status', 'active')
                    .order('name'),
                checkDate ? supabase
                    .from('coach_time_off')
                    .select('coach_id')
                    .lte('start_date', checkDate)
                    .gte('end_date', checkDate) : Promise.resolve({ data: [] })
            ])

            if (coachesResult.error) throw coachesResult.error
            
            // 建立休假教練 ID 集合
            const timeOffCoachIds = new Set((timeOffResult.data || []).map((t: any) => t.coach_id))
            
            // 標記休假狀態
            const coachesWithTimeOff = (coachesResult.data || []).map(coach => ({
                ...coach,
                isOnTimeOff: timeOffCoachIds.has(coach.id)
            }))
            
            setCoaches(coachesWithTimeOff)
        } catch (error) {
            console.error('Error fetching coaches:', error)
        } finally {
            setLoadingCoaches(false)
        }
    }, [startDate])

    const fetchMembers = useCallback(async () => {
        const { data, error } = await supabase
            .from('members')
            .select('id, name, nickname, phone')
            .eq('status', 'active')
            .order('name')

        if (error) console.error('Error fetching members:', error)
        else setMembers(data || [])
    }, [])

    // 用於教練休假的日期：避免彈窗剛打開時 startDate 尚未從 defaultDate/initialBooking 更新，導致用空字串查詢而沒帶入休假資料（手機版較易出現）
    const dateForCoachTimeOff = startDate
        || (defaultDate ? defaultDate.split('T')[0] : '')
        || (initialBooking?.start_at ? initialBooking.start_at.substring(0, 10) : '')
        || getLocalDateString()

    const fetchAllData = useCallback(async () => {
        await Promise.all([fetchBoats(), fetchCoaches(dateForCoachTimeOff), fetchMembers()])
    }, [fetchBoats, fetchCoaches, fetchMembers, dateForCoachTimeOff])
    
    // 當日期改變時，重新查詢教練休假狀態
    const refreshCoachTimeOff = useCallback(async () => {
        if (startDate) {
            await fetchCoaches(startDate)
        }
    }, [startDate, fetchCoaches])

    const toggleCoach = (coachId: string) => {
        setSelectedCoaches(prev => toggleSelection(prev, coachId))
    }

    const toggleActivityType = (type: string) => {
        setActivityTypes(prev => toggleSelection(prev, type))
    }

    const handleMemberSearch = (term: string) => {
        setMemberSearchTerm(term)
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

        searchTimeoutRef.current = setTimeout(() => {
            setShowMemberDropdown(term.trim().length > 0)
        }, MEMBER_SEARCH_DEBOUNCE_MS)
    }

    const performConflictCheck = useCallback(async (excludeBookingId?: number) => {
        const boat = boats.find(b => b.id === selectedBoatId)
        const boatName = boat?.name || '未知船隻'
        const coachesMap = new Map(coaches.map(c => [c.id, { name: c.name }]))

        return await checkConflict({
            boatId: selectedBoatId,
            boatName,
            date: startDate,
            startTime,
            durationMin,
            coachIds: selectedCoaches,
            coachesMap,
            excludeBookingId
        })
    }, [boats, coaches, checkConflict, selectedBoatId, startDate, startTime, durationMin, selectedCoaches])

    const resetForm = () => {
        setSelectedCoaches([])
        setSelectedMemberIds([])
        setMemberSearchTerm('')
        setManualStudentName('')
        setManualNames([])
        setShowMemberDropdown(false)
        setActivityTypes([])
        setNotes('')
        setRequiresDriver(false)
        setFilledBy(getFilledByName(userEmail))  // 重置時也使用自動填入
        setIsCoachPractice(false)
        setError('')

        // Reset time to defaults if needed, or keep current
        if (!initialBooking) {
            setDurationMin(60)
        }
    }

    return {
        // State
        boats,
        selectedBoatId,
        coaches,
        selectedCoaches,
        members,
        memberSearchTerm,
        selectedMemberIds,
        showMemberDropdown,
        manualStudentName,
        manualNames,
        startDate,
        startTime,
        durationMin,
        activityTypes,
        notes,
        requiresDriver,
        filledBy,
        isCoachPractice,
        error,
        loading,
        loadingCoaches,

        // Derived
        selectedCoachesSet,
        activityTypesSet,
        selectedBoat,
        isSelectedBoatFacility,
        canRequireDriver,
        filteredMembers,
        finalStudentName,

        // Setters
        setSelectedBoatId,
        setSelectedCoaches,
        setMemberSearchTerm,
        setSelectedMemberIds,
        setShowMemberDropdown,
        setManualStudentName,
        setManualNames,
        setStartDate,
        setStartTime,
        setDurationMin,
        setActivityTypes,
        setNotes,
        setRequiresDriver,
        setFilledBy,
        setIsCoachPractice,
        setError,
        setLoading,

        // Actions
        fetchAllData,
        toggleCoach,
        toggleActivityType,
        handleMemberSearch,
        performConflictCheck,
        resetForm,
        refreshCoachTimeOff
    }
}
