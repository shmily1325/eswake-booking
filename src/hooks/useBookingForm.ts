import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBookingConflict } from './useBookingConflict'
import { filterMembers, composeFinalStudentName, toggleSelection, splitAndDeduplicateNames } from '../utils/memberUtils'
import { MEMBER_SEARCH_DEBOUNCE_MS } from '../constants/booking'
import type { Booking, Boat, Coach, Member } from '../types/booking'
import { isFacility } from '../utils/facility'
import { getFilledByName } from '../utils/filledByHelper'

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
                // 使用去重函數處理 contact_name
                const contactNames = splitAndDeduplicateNames(initialBooking.contact_name)
                
                // 取得已選會員的名字和暱稱（用於比對）
                const memberNamesSet = new Set<string>()
                if (initialBooking.booking_members && initialBooking.booking_members.length > 0) {
                    initialBooking.booking_members.forEach((bm: any) => {
                        if (bm.members) {
                            if (bm.members.name) memberNamesSet.add(bm.members.name)
                            if (bm.members.nickname) memberNamesSet.add(bm.members.nickname)
                        }
                    })
                }
                
                // 從 contact_name 中過濾出非會員（不在會員名字/暱稱中的名字）
                const nonMemberNames = contactNames.filter(name => !memberNamesSet.has(name))
                setManualNames(nonMemberNames)
            } else {
                setManualNames([])
            }
        } else {
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
        else setBoats(data || [])
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

    const fetchAllData = useCallback(async () => {
        await Promise.all([fetchBoats(), fetchCoaches(startDate), fetchMembers()])
    }, [fetchBoats, fetchCoaches, fetchMembers, startDate])
    
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
