import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type AvailableSlotsStatus,
  type BookingAlternatives,
  fetchBookingAlternativeContext,
  findBookingAlternatives,
} from '../utils/bookingAlternatives'

interface UseBookingAlternativesInput {
  enabled: boolean
  date: string
  durationMin: number
  selectedBoatId: number
  coachIds: string[]
  isFacility?: boolean
  allowOverlap?: boolean
  excludeBookingId?: number
}

interface BookingAlternativeState extends BookingAlternatives {
  status: AvailableSlotsStatus
  retry: () => void
}

const RETRY_DELAY_MS = 600

export function useBookingAlternatives({
  enabled,
  date,
  durationMin,
  selectedBoatId,
  coachIds,
  isFacility,
  allowOverlap,
  excludeBookingId,
}: UseBookingAlternativesInput): BookingAlternativeState {
  const requestIdRef = useRef(0)
  const [status, setStatus] = useState<AvailableSlotsStatus>('idle')
  const [allDayTimes, setAllDayTimes] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)
  const coachIdsKey = coachIds.join(',')

  const retry = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const resolvedCoachIds = coachIdsKey ? coachIdsKey.split(',') : []
    const canQuery = enabled && !!date && !!selectedBoatId && resolvedCoachIds.length > 0

    if (!canQuery) {
      setStatus('idle')
      setAllDayTimes([])
      return
    }

    if (durationMin <= 0) {
      setStatus('awaiting-duration')
      setAllDayTimes([])
      return
    }

    setStatus('loading')
    setAllDayTimes([])

    let retryTimer: ReturnType<typeof setTimeout> | undefined

    // Transient network hiccups are common on mobile; retry once before surfacing an error.
    const load = async (attempt: number): Promise<void> => {
      try {
        const context = await fetchBookingAlternativeContext({
          date,
          boatIds: [selectedBoatId],
          coachIds: resolvedCoachIds,
        })
        if (requestId !== requestIdRef.current) return

        const alternatives = findBookingAlternatives(
          {
            date,
            durationMin,
            selectedBoatId,
            coachIds: resolvedCoachIds,
            isFacility,
            allowOverlap,
            excludeBookingId,
          },
          context,
        )
        setStatus('ready')
        setAllDayTimes(alternatives.allDayTimes)
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        if (attempt === 0) {
          retryTimer = setTimeout(() => {
            if (requestId === requestIdRef.current) void load(1)
          }, RETRY_DELAY_MS)
          return
        }
        console.error('載入可預約時段失敗:', error)
        setStatus('error')
        setAllDayTimes([])
      }
    }

    void load(0)

    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (requestId === requestIdRef.current) requestIdRef.current += 1
    }
  }, [
    enabled,
    date,
    durationMin,
    selectedBoatId,
    coachIdsKey,
    isFacility,
    allowOverlap,
    excludeBookingId,
    reloadKey,
  ])

  return { status, allDayTimes, retry }
}
