import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { EditBookingDialog } from '../../components/EditBookingDialog'

// Mocks
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      delete: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      insert: vi.fn().mockReturnThis(),
    })),
  },
}))

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

const setRequiresDriverSpy = vi.fn()
const setLoadingSpy = vi.fn()

vi.mock('../../hooks/useBookingForm', () => ({
  useBookingForm: () => ({
    // state
    boats: [{ id: 1, name: '設施A' }],
    selectedBoatId: 1,
    coaches: [],
    selectedCoaches: [],
    members: [],
    memberSearchTerm: '',
    selectedMemberIds: [],
    showMemberDropdown: false,
    manualStudentName: '',
    manualNames: [],
    startDate: '2026-04-06',
    startTime: '10:00',
    durationMin: 60,
    activityTypes: [],
    notes: '',
    requiresDriver: true, // will be turned off when facility
    filledBy: 'Tester',
    isCoachPractice: false,
    error: '',
    loading: false,
    loadingCoaches: false,

    // derived
    selectedCoachesSet: new Set(),
    activityTypesSet: new Set(),
    filteredMembers: [],
    finalStudentName: 'Student X',
    isSelectedBoatFacility: true, // critical for the auto-uncheck test
    canRequireDriver: true,

    // setters
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
    setRequiresDriver: setRequiresDriverSpy,
    setFilledBy: vi.fn(),
    setIsCoachPractice: vi.fn(),
    setError: vi.fn(),
    setLoading: setLoadingSpy,

    // actions
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

describe('EditBookingDialog - no driver behaviors', () => {
  const booking = {
    id: 123,
    boat_id: 1,
    start_at: '2026-04-06T10:00:00',
    duration_min: 60,
    contact_name: 'Student X',
    coaches: [],
    boats: { name: '設施A' },
    requires_driver: true,
  } as any

  const user = { id: 'u1', email: 't@t.com' } as any

  test('auto-uncheck requires driver when facility is selected and show toast', async () => {
    render(
      <EditBookingDialog
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        booking={booking}
        user={user}
      />
    )

    await waitFor(() => {
      expect(setRequiresDriverSpy).toHaveBeenCalledWith(false)
      expect(mockToast.info).toHaveBeenCalled()
    })
  })

  // Note: deeper cleanup flow is verified by integration tests elsewhere; here we keep a light smoke test.
})

