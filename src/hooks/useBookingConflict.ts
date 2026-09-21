import { useState, useCallback } from 'react'
import { checkBoatConflict, checkCoachesConflictBatch } from '../utils/bookingConflict'
import { checkBoatUnavailable } from '../utils/availability'
import { isFacility } from '../utils/facility'
import {
    checkGlobalRestriction,
    formatRestrictionTimeLabel,
} from '../utils/restriction'

interface UseBookingConflictProps {
    boatId: number
    boatName?: string
    date: string
    startTime: string
    durationMin: number
    coachIds: string[]
    restrictionPersonIds?: string[]
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
        restrictionPersonIds,
        coachesMap,
        excludeBookingId
    }: UseBookingConflictProps): Promise<ConflictCheckResult> => {
        setLoading(true)
        setError(null)

        try {
            // 0. 預約限制（公告啟用的限制）
            const restriction = await checkGlobalRestriction(
                date,
                startTime,
                undefined,
                durationMin,
                restrictionPersonIds ?? coachIds,
            )
            if (restriction.isRestricted) {
                const affectedNames = (restriction.restrictedPersonIds ?? [])
                    .filter((id) => coachIds.includes(id))
                    .map((id) => coachesMap.get(id)?.name)
                    .filter((name): name is string => Boolean(name))
                const period = formatRestrictionTimeLabel(
                    restriction.startDate === date ? restriction.startTime : null,
                    restriction.endDate === date ? restriction.endTime : null,
                )
                const reason = `${affectedNames.length > 0
                    ? `${affectedNames.join('、')} `
                    : ''}${period} ${restriction.reason || '暫停受理預約'}，無法安排`
                setError(reason)
                return { hasConflict: true, reason }
            }

            // 1. 檢查船隻是否維修/停用
            const availability = await checkBoatUnavailable(
                boatId,
                date,
                startTime,
                undefined,
                durationMin
            )

        if (availability.isUnavailable) {
            const displayBoatName = boatName || '船隻'
            const reason = `${displayBoatName} 不可用：${availability.reason || '維修保養中'}`
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
            excludeBookingId,
            boatName
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
