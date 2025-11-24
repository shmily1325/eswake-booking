import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useBookingConflict } from './useBookingConflict'
import { filterMembers, composeFinalStudentName, toggleSelection } from '../utils/memberUtils'
import { MEMBER_SEARCH_DEBOUNCE_MS } from '../constants/booking'
import type { Booking, Boat, Coach, Member } from '../types/booking'
import { isFacility } from '../utils/facility'

interface UseBookingFormProps {
    initialBooking?: Booking
    defaultDate?: string
    defaultBoatId?: number
}

export function useBookingForm({ initialBooking, defaultDate, defaultBoatId }: UseBookingFormProps = {}) {
    const { checkConflict } = useBookingConflict()

    // --- State ---
    const [boats, setBoats] = useState<Pick<Boat, 'id' | 'name' | 'color'>[]>([])
    const [selectedBoatId, setSelectedBoatId] = useState<number>(initialBooking?.boat_id || defaultBoatId || 0)

    const [coaches, setCoaches] = useState<Pick<Coach, 'id' | 'name'>[]>([])
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
    const [filledBy, setFilledBy] = useState(initialBooking?.filled_by || '')

    // Status
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [loadingCoaches, setLoadingCoaches] = useState(false)

    // Search Debounce
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // --- Derived State ---
    const selectedCoachesSet = useMemo(() => new Set(selectedCoaches), [selectedCoaches])
    const activityTypesSet = useMemo(() => new Set(activityTypes), [activityTypes])

    const selectedBoat = useMemo(() => boats.find(b => b.id === selectedBoatId), [boats, selectedBoatId])
    const isSelectedBoatFacility = useMemo(() => isFacility(selectedBoat?.name), [selectedBoat])

    const canRequireDriver = selectedCoaches.length > 0 && !isSelectedBoatFacility

    const filteredMembers = useMemo(() =>
        filterMembers(members, memberSearchTerm, 10),
        [members, memberSearchTerm]
    )

    const finalStudentName = composeFinalStudentName(members, selectedMemberIds, manualNames)

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
            setFilledBy(initialBooking.filled_by || '')

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

            // Initialize manual names
            if (initialMemberIds.length === 0 && initialBooking.contact_name) {
                setManualNames([initialBooking.contact_name])
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
    }, [initialBooking, defaultDate, defaultBoatId])

    // Auto-disable requiresDriver if conditions not met
    useEffect(() => {
        if (!canRequireDriver && requiresDriver) {
            setRequiresDriver(false)
        }
    }, [canRequireDriver, requiresDriver])

    // --- Actions ---

    const fetchBoats = useCallback(async () => {
        const { data, error } = await supabase
            .from('boats')
            .select('id, name, color')
            .order('id')

        if (error) console.error('Error fetching boats:', error)
        else setBoats(data || [])
    }, [])

    const fetchCoaches = useCallback(async () => {
        setLoadingCoaches(true)
        try {
            const { data, error } = await supabase
                .from('coaches')
                .select('id, name')
                .eq('status', 'active')
                .order('name')

            if (error) throw error
            setCoaches(data || [])
        } catch (error) {
            console.error('Error fetching coaches:', error)
        } finally {
            setLoadingCoaches(false)
        }
    }, [])

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
        await Promise.all([fetchBoats(), fetchCoaches(), fetchMembers()])
    }, [fetchBoats, fetchCoaches, fetchMembers])

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
        const boatName = selectedBoat?.name || '未知船隻'
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
    }, [selectedBoat, coaches, checkConflict, selectedBoatId, startDate, startTime, durationMin, selectedCoaches])

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
        setFilledBy('')
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
        setError,
        setLoading,

        // Actions
        fetchAllData,
        toggleCoach,
        toggleActivityType,
        handleMemberSearch,
        performConflictCheck,
        resetForm
    }
}
