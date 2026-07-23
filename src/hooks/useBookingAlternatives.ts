import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ALTERNATIVE_BOAT_NAMES,
  type AlternativeBoat,
  type BookingAlternatives,
  fetchBookingAlternativeContext,
  findBookingAlternatives,
} from '../utils/bookingAlternatives'

interface UseBookingAlternativesInput {
  enabled: boolean
  date: string
  startTime: string
  durationMin: number
  selectedBoatId: number
  boats: AlternativeBoat[]
  coachIds: string[]
  excludeBookingId?: number
}

interface BookingAlternativeState extends BookingAlternatives {
  status: 'idle' | 'loading' | 'ready' | 'error'
}

const EMPTY_STATE: BookingAlternativeState = {
  status: 'idle',
  nearbyTimes: [],
  otherBoats: [],
}

export function useBookingAlternatives({
  enabled,
  date,
  startTime,
  durationMin,
  selectedBoatId,
  boats,
  coachIds,
  excludeBookingId,
}: UseBookingAlternativesInput): BookingAlternativeState {
  const requestIdRef = useRef(0)
  const [state, setState] = useState<BookingAlternativeState>(EMPTY_STATE)

  const supportedBoats = useMemo(
    () =>
      boats.filter((boat) =>
        ALTERNATIVE_BOAT_NAMES.includes(
          boat.name as (typeof ALTERNATIVE_BOAT_NAMES)[number],
        ),
      ),
    [boats],
  )
  const supportedBoatIds = useMemo(
    () => supportedBoats.map((boat) => boat.id),
    [supportedBoats],
  )
  const selectedBoatIsSupported = supportedBoatIds.includes(selectedBoatId)

  useEffect(() => {
    const requestId = ++requestIdRef.current

    if (
      !enabled ||
      !date ||
      !startTime ||
      durationMin <= 0 ||
      !selectedBoatIsSupported ||
      supportedBoatIds.length === 0
    ) {
      setState(EMPTY_STATE)
      return
    }

    setState({
      status: 'loading',
      nearbyTimes: [],
      otherBoats: [],
    })

    const load = async () => {
      try {
        const context = await fetchBookingAlternativeContext({
          date,
          boatIds: supportedBoatIds,
          coachIds,
        })
        if (requestId !== requestIdRef.current) return

        const alternatives = findBookingAlternatives(
          {
            date,
            startTime,
            durationMin,
            selectedBoatId,
            boats: supportedBoats,
            coachIds,
            excludeBookingId,
          },
          context,
        )
        setState({ status: 'ready', ...alternatives })
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        console.error('載入預約替代方案失敗:', error)
        setState({
          status: 'error',
          nearbyTimes: [],
          otherBoats: [],
        })
      }
    }

    void load()

    return () => {
      if (requestId === requestIdRef.current) requestIdRef.current += 1
    }
  }, [
    enabled,
    date,
    startTime,
    durationMin,
    selectedBoatId,
    selectedBoatIsSupported,
    supportedBoatIds,
    supportedBoats,
    coachIds,
    excludeBookingId,
  ])

  return state
}
