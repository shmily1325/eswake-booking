import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Shared toast mock
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

// Mock DateMultiPicker to control date selection in tests
vi.mock('../../components/booking/DateMultiPicker', () => ({
  DateMultiPicker: ({ selectedDates, onDatesChange }: any) => {
    return (
      <div>
        <div data-testid="selected-count">selected:{selectedDates.length}</div>
        <button type="button" onClick={() => onDatesChange(['2026-04-10'])}>
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

// Hoist spies for ESM mocking order
const { conflictSpy } = vi.hoisted(() => ({
  conflictSpy: vi.fn(),
}))

describe('RepeatBookingDialog - behavior', () => {
  const user = { id: 'u1', email: 't@t.com' } as any

  test.skip('shows result dialog with skipped items when conflicts occur', async () => {
    // supabase mocks: insert succeeds
    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 999, name: 'G23' } }),
          eq: vi.fn().mockReturnThis(),
        })),
      },
    }))

    // useBookingForm: normal boat and has a coach selected
    vi.mock('../../hooks/useBookingForm', () => ({
      useBookingForm: () => ({
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
        selectedCoachesSet: new Set(['c1']),
        activityTypesSet: new Set(),
        filteredMembers: [],
        finalStudentName: 'Student X',
        isSelectedBoatFacility: false,
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
        resetForm: vi.fn(),
      }),
    }))

    // useBookingConflict: first ok, second conflict
    conflictSpy
      .mockResolvedValueOnce({ hasConflict: false })
      .mockResolvedValueOnce({ hasConflict: true, reason: '時間衝突' })
    vi.mock('../../hooks/useBookingConflict', () => ({
      useBookingConflict: () => ({ checkConflict: conflictSpy }),
    }))

    // Render
    const { RepeatBookingDialog } = await import('../../components/RepeatBookingDialog')
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

    // pick 2 dates and submit
    fireEvent.click(screen.getByText('pick-2'))
    fireEvent.click(
      screen.getByRole('button', { name: /確認建立 2 個預約/ })
    )

    // Expect result dialog (部分成功，部分跳過)
    await waitFor(() => {
      expect(screen.getByText('重複預約結果')).toBeInTheDocument()
      expect(screen.getByText('跳過')).toBeInTheDocument()
    })
  })

  test.skip('shows inline error when facility and no coach on submit', async () => {
    // supabase mock for boat name lookup
    vi.mock('../../lib/supabase', () => ({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { name: '彈簧床' } }),
          eq: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
        })),
      },
    }))

    // Mark name as facility
    vi.mock('../../utils/facility', () => ({
      isFacility: (name?: string) => (name || '').includes('彈簧床'),
    }))

    // useBookingForm: facility boat, no coach selected
    vi.mock('../../hooks/useBookingForm', () => ({
      useBookingForm: () => ({
        boats: [{ id: 1, name: '彈簧床' }],
        selectedBoatId: 1,
        coaches: [{ id: 'c1', name: 'A' }],
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
        requiresDriver: false,
        filledBy: 'Tester',
        isCoachPractice: false,
        error: '',
        loading: false,
        loadingCoaches: false,
        selectedCoachesSet: new Set(),
        activityTypesSet: new Set(),
        filteredMembers: [],
        finalStudentName: 'Student X',
        isSelectedBoatFacility: true,
        canRequireDriver: false,
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
        resetForm: vi.fn(),
      }),
    }))

    // Render
    const { RepeatBookingDialog } = await import('../../components/RepeatBookingDialog')
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

    // pick 1 date and submit without coach
    fireEvent.click(screen.getByText('pick-1'))
    fireEvent.click(
      screen.getByRole('button', { name: /確認建立 1 個預約/ })
    )

    // Expect bottom warning area to include facility-coach requirement text
    await waitFor(() => {
      expect(
        screen.getByText('彈簧床、陸上課程必須指定教練')
      ).toBeInTheDocument()
    })
  })
})

