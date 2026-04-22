import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { RepeatBookingDialog } from '../../components/RepeatBookingDialog'

// --- Lightweight mocks (align with other component tests) ---
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { name: 'G23' } }),
      eq: vi.fn().mockReturnThis(),
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

// Mock useBookingForm to isolate UI
vi.mock('../../hooks/useBookingForm', () => ({
  useBookingForm: () => ({
    // state
    boats: [{ id: 1, name: 'G23' }],
    selectedBoatId: 1,
    coaches: [{ id: 'c1', name: 'A' }],
    selectedCoaches: ['c1'],
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
    requiresDriver: false,
    filledBy: 'Tester',
    isCoachPractice: false,
    error: '',
    loading: false,
    loadingCoaches: false,

    // derived
    selectedCoachesSet: new Set(['c1']),
    activityTypesSet: new Set(),
    filteredMembers: [],
    finalStudentName: 'Student X',
    isSelectedBoatFacility: false,
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
    setRequiresDriver: vi.fn(),
    setFilledBy: vi.fn(),
    setIsCoachPractice: vi.fn(),
    setError: vi.fn(),
    setLoading: vi.fn(),

    // actions
    fetchAllData: vi.fn(),
    toggleCoach: vi.fn(),
    toggleActivityType: vi.fn(),
    handleMemberSearch: vi.fn(),
    resetForm: vi.fn(),
  }),
}))

// Mock DateMultiPicker so we can deterministically control date selection
vi.mock('../../components/booking/DateMultiPicker', () => ({
  DateMultiPicker: ({ selectedDates, onDatesChange }: any) => {
    return (
      <div>
        <div data-testid="selected-count">selected:{selectedDates.length}</div>
        <button
          type="button"
          onClick={() => onDatesChange(['2026-04-10'])}
        >
          pick-1
        </button>
        <button
          type="button"
          onClick={() => onDatesChange(['2026-04-10', '2026-04-11'])}
        >
          pick-2
        </button>
      </div>
    )
  },
}))

describe('RepeatBookingDialog - UI alignment', () => {
  const user = { id: 'u1', email: 't@t.com' } as any

  const renderDialog = () =>
    render(
      <RepeatBookingDialog
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        defaultBoatId={1}
        defaultStartTime={'2026-04-06T10:00:00'}
        user={user}
      />
    )

  test('shows custom-date flow only and includes 40-minute option', () => {
    renderDialog()
    expect(screen.getByText('日期（可多選）')).toBeInTheDocument()
    expect(screen.getByText('開始時間')).toBeInTheDocument()
    expect(screen.getByText('時長（分鐘）')).toBeInTheDocument()
    // no weekly/end-date labels
    expect(screen.queryByText('每週重複')).not.toBeInTheDocument()
    expect(screen.queryByText('結束日期')).not.toBeInTheDocument()
    // duration includes 40
    expect(screen.getByRole('button', { name: '40' })).toBeInTheDocument()
  }, 15_000)

  test('submit label reflects number of generated bookings', () => {
    renderDialog()
    fireEvent.click(screen.getByText('pick-2'))
    expect(
      screen.getByRole('button', { name: /確認建立 2 個預約/ })
    ).toBeInTheDocument()
  }, 10000)
})

