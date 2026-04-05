import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { EditBookingDialog } from '../../components/EditBookingDialog'

// Track delete invocations per table
const deleteInvoked: Record<string, number> = {
  booking_drivers: 0,
  coach_reports: 0,
  booking_participants: 0,
}

// Sophisticated supabase mock for integration-like flow
vi.mock('../../lib/supabase', () => {
  function makeChain(table: string) {
    let participantsEqCount = 0
    return {
      // Select presence
      select: vi.fn().mockReturnThis(),
      // Update bookings etc.
      update: vi.fn().mockReturnThis(),
      // Insert noop
      insert: vi.fn().mockReturnThis(),
      // Delete then eq handles
      delete: vi.fn(() => ({
        eq: vi.fn(async () => {
          if (table in deleteInvoked) deleteInvoked[table]++
          return {}
        }),
      })),
      // Filters
      eq: vi.fn(function (this: any, _col?: string, _val?: any) {
        if (table === 'booking_participants') {
          participantsEqCount += 1
          if (participantsEqCount < 2) {
            // allow chaining the second eq
            return this
          }
          // on second eq resolve final data
          return Promise.resolve({ data: [{ id: 'p1', participant_name: 'N' }] })
        }
        if (table === 'booking_drivers') return Promise.resolve({ count: 1 })
        if (table === 'coach_reports') return Promise.resolve({ count: 1 })
        // default resolve
        return Promise.resolve({})
      }),
      in: vi.fn(async () => ({ data: [] })),
      single: vi.fn(async () => ({ data: null })),
    }
  }

  return {
    supabase: {
      from: vi.fn((table: string) => makeChain(table)),
    },
  }
})

const mockToast = {
  info: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  messages: [],
  closeToast: vi.fn(),
}
vi.mock('../../components/ui', () => ({
  useToast: () => mockToast,
  ToastContainer: () => null,
}))

// Configure form hook: facility selected so requiresDriver 最終為 false
vi.mock('../../hooks/useBookingForm', () => ({
  useBookingForm: () => ({
    boats: [{ id: 1, name: '設施B' }],
    selectedBoatId: 1,
    coaches: [{ id: 'c1', name: '教練一號' }],
    selectedCoaches: ['c1'],
    members: [],
    memberSearchTerm: '',
    selectedMemberIds: [],
    showMemberDropdown: false,
    manualStudentName: '',
    manualNames: [],
    startDate: '2026-04-06',
    startTime: '11:00',
    durationMin: 60,
    activityTypes: [],
    notes: '',
    requiresDriver: true,
    filledBy: 'Tester',
    isCoachPractice: false,
    error: '',
    loading: false,
    loadingCoaches: false,

    selectedCoachesSet: new Set(['c1']),
    activityTypesSet: new Set(),
    filteredMembers: [],
    finalStudentName: 'Student Y',
    isSelectedBoatFacility: true,
    canRequireDriver: true,

    setSelectedBoatId: vi.fn(),
    setSelectedCoaches: vi.fn(),
    setMemberSearchTerm: vi.fn(),
    setSelectedMemberIds: vi.fn(),
    setShowMemberDropdown: vi.fn(),
    setManualStudentName: vi.fn(),
    setManualNames: vi.fn(),
    setStartDate: vi.fn(),
    setStartTime: vi.fn(),
    setDurationMin: vi.fn(),
    setNotes: vi.fn(),
    setRequiresDriver: vi.fn(),
    setFilledBy: vi.fn(),
    setIsCoachPractice: vi.fn(),
    setError: vi.fn(),
    setLoading: vi.fn(),

    fetchAllData: vi.fn(),
    toggleCoach: vi.fn(),
    toggleActivityType: vi.fn(),
    handleMemberSearch: vi.fn(),
    performConflictCheck: vi.fn().mockResolvedValue({ hasConflict: false }),
    resetForm: vi.fn(),
    refreshCoachTimeOff: vi.fn(),
  }),
}))

vi.mock('../../utils/facility', () => ({
  isFacility: (name: string) => name.includes('設施'),
}))

describe('EditBookingDialog - integration cleanup when requires_driver=false', () => {
  const booking = {
    id: 987,
    boat_id: 1,
    start_at: '2026-04-06T11:00:00',
    duration_min: 60,
    contact_name: 'Student Y',
    coaches: [],
    boats: { name: '設施B' },
    requires_driver: true,
  } as any
  const user = { id: 'u1', email: 't@t.com' } as any

  test('prompts and deletes drivers/reports/participants when presence detected', async () => {
    // accept confirmation
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true as any)

    // reset counters
    deleteInvoked.booking_drivers = 0
    deleteInvoked.coach_reports = 0
    deleteInvoked.booking_participants = 0

    const { getByText } = render(
      <EditBookingDialog isOpen={true} onClose={() => {}} onSuccess={() => {}} booking={booking} user={user} />
    )

    fireEvent.click(getByText('✅ 確認更新'))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(deleteInvoked.booking_drivers).toBeGreaterThan(0)
      expect(deleteInvoked.coach_reports).toBeGreaterThan(0)
      expect(deleteInvoked.booking_participants).toBeGreaterThan(0)
    }, { timeout: 15000 })
  }, 20000)
})

