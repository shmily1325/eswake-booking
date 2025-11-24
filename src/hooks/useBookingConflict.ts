import { useState, useCallback } from 'react'
import { checkBoatConflict, checkCoachesConflictBatch } from '../utils/bookingConflict'
import { checkBoatUnavailable } from '../utils/availability'
import { isFacility } from '../utils/facility'

interface UseBookingConflictProps {
    boatId: number
    boatName?: string
    date: string
    startTime: string
    durationMin: number
    coachIds: string[]
    coachesMap: Map<string, { name: string }>
    excludeBookingId?: number
}

interface ConflictCheckResult {
    hasConflict: boolean
    reason: string
}

export function useBookingConflict() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const checkConflict = useCallback(async ({
        boatId,
        boatName,
        date,
        startTime,
        durationMin,
        coachIds,
        coachesMap,
        excludeBookingId
    }: UseBookingConflictProps): Promise<ConflictCheckResult> => {
        setLoading(true)
        setError(null)

        try {
            // 1. 檢查船隻是否維修/停用
            const availability = await checkBoatUnavailable(
                boatId,
                date,
                startTime,
                undefined,
                durationMin
            )

            if (availability.isUnavailable) {
                const reason = `船隻不可用：${availability.reason || '維修保養中'}`
                setError(reason)
                return { hasConflict: true, reason }
            }

            // 2. 檢查船隻預約衝突
            const isBoatFacility = isFacility(boatName)
            const boatConflict = await checkBoatConflict(
                boatId,
                date,
                startTime,
                durationMin,
                isBoatFacility,
                excludeBookingId
            )

            if (boatConflict.hasConflict) {
                setError(boatConflict.reason)
                return boatConflict
            }

            // 3. 檢查教練衝突
            if (coachIds.length > 0) {
                const coachConflict = await checkCoachesConflictBatch(
                    coachIds,
                    date,
                    startTime,
                    durationMin,
                    coachesMap,
                    excludeBookingId
                )

                if (coachConflict.hasConflict) {
                    const conflictMessages = coachConflict.conflictCoaches
                        .map(c => `${c.coachName}: ${c.reason}`)
                        .join('\n')
                    const reason = `教練衝突：\n${conflictMessages}`
                    setError(reason)
                    return { hasConflict: true, reason }
                }
            }

            return { hasConflict: false, reason: '' }
        } catch (err: any) {
            const reason = err.message || '檢查衝突時發生未預期的錯誤'
            setError(reason)
            return { hasConflict: true, reason }
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        checkConflict,
        loading,
        error,
        clearError: () => setError(null)
    }
}
