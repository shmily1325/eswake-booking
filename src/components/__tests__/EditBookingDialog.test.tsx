import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

// Mock supabase client to avoid real env and to capture writes
const writeCalls: Array<{ table: string; op: string; payload?: any }> = []

function makeQuery(table: string) {
  const chain = {
    _filters: [] as any[],
    select: vi.fn().mockImplementation((_fields: any, _opts?: any) => {
      // Simulate count queries: return empty
      return Promise.resolve({ data: [], count: 0 })
    }),
    eq: vi.fn().mockImplementation((_k: string, _v: any) => chain),
    in: vi.fn().mockImplementation((_k: string, _v: any[]) => chain),
    lte: vi.fn().mockImplementation((_k: string, _v: any) => chain),
    gte: vi.fn().mockImplementation((_k: string, _v: any) => chain),
    order: vi.fn().mockImplementation((_k: string) => chain),
    update: vi.fn().mockImplementation((payload: any) => {
      writeCalls.push({ table, op: 'update', payload })
      return Promise.resolve({ error: null })
    }),
    delete: vi.fn().mockImplementation(() => {
      writeCalls.push({ table, op: 'delete' })
      return Promise.resolve({ error: null })
    }),
    insert: vi.fn().mockImplementation((payload: any) => {
      writeCalls.push({ table, op: 'insert', payload })
      return Promise.resolve({ error: null, data: [{ id: 1 }] })
    }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return chain
}

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => makeQuery(table),
    },
  }
})

// Mock hooks used by the component to provide stable state
vi.mock('../../hooks/useBookingForm', async () => {
  return {
    useBookingForm: () => ({
      // State
      boats: [{ id: 1, name: 'G23', color: '#000' }],
      selectedBoatId: 1,
      coaches: [{ id: 'c1', name: '教練A' }],
      selectedCoaches: ['c1'],
      members: [],
      memberSearchTerm: '',
      selectedMemberIds: [],
      showMemberDropdown: false,
      manualStudentName: '',
      manualNames: [],
      startDate: '2026-04-05',
      startTime: '10:00',
      durationMin: 60,
      activityTypes: [],
      notes: '',
      requiresDriver: true,
      filledBy: '測試人員',
      isCoachPractice: false,
      error: '',
      loading: false,
      loadingCoaches: false,
      // Derived
      selectedCoachesSet: new Set(['c1']),
      activityTypesSet: new Set<string>(),
      filteredMembers: [],
      finalStudentName: '張三',
      isSelectedBoatFacility: false,
      canRequireDriver: true,
      // Setters (no-ops)
      setSelectedBoatId: () => {},
      setSelectedCoaches: () => {},
      setMemberSearchTerm: () => {},
      setSelectedMemberIds: () => {},
      setShowMemberDropdown: () => {},
      setManualStudentName: () => {},
      setManualNames: () => {},
      setStartDate: () => {},
      setStartTime: () => {},
      setDurationMin: () => {},
      setNotes: () => {},
      setRequiresDriver: () => {},
      setFilledBy: () => {},
      setIsCoachPractice: () => {},
      setError: () => {},
      setLoading: () => {},
      // Actions
      fetchAllData: async () => {},
      toggleCoach: () => {},
      toggleActivityType: () => {},
      handleMemberSearch: () => {},
      performConflictCheck: async () => ({ hasConflict: false, reason: '' }),
      resetForm: () => {},
      refreshCoachTimeOff: async () => {},
    }),
  }
})

// Mock audit log utils
vi.mock('../../utils/auditLog', () => ({
  logBookingCreation: vi.fn().mockResolvedValue(undefined),
  logBookingUpdate: vi.fn().mockResolvedValue(undefined),
  logBookingDeletion: vi.fn().mockResolvedValue(undefined),
}))

// Mock toast to avoid errors
vi.mock('../../components/ui', () => ({
  useToast: () => ({ info: () => {}, error: () => {}, success: () => {} }),
}))

import { EditBookingDialog } from '../EditBookingDialog'

const baseBooking = {
  id: 999,
  boat_id: 1,
  start_at: '2026-04-05T09:00:00',
  duration_min: 60,
  cleanup_minutes: 15,
  contact_name: '張三',
  activity_types: [],
  notes: '',
  requires_driver: true,
  is_coach_practice: false,
  boats: { name: 'G23' },
  coaches: [{ id: 'c1', name: '教練A' }],
  booking_members: [],
} as any

const baseUser = {
  id: 'u1',
  email: 'tester@example.com',
} as any

describe('EditBookingDialog write sequencing', () => {
  beforeEach(() => {
    writeCalls.length = 0
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not perform any writes when user cancels confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(
      <EditBookingDialog
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        booking={baseBooking}
        user={baseUser}
      />
    )
    const submitBtn = screen.getByRole('button', { name: /確認更新|處理中/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      // No update/insert/delete should have occurred
      const mutated = writeCalls.some(c => ['update', 'insert', 'delete'].includes(c.op))
      expect(mutated).toBe(false)
    })
  }, 15_000)

  // Note: cleanup and update flows are covered by existing integration tests under:
  // src/components/__tests__/EditBookingDialog.noDriver.cleanup.integration.test.tsx
})

