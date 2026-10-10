import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoachDesignatedHours } from '../CoachDesignatedHours'
import {
  backfillCoachDesignatedReportDeductions,
  createCoachDesignatedCredit,
  fetchCoachDesignatedEligibleReports,
  fetchCoachDesignatedStudentDetail,
  fetchCoachDesignatedStudents,
} from '../api'

vi.mock('../api', () => ({
  backfillCoachDesignatedReportDeductions: vi.fn(),
  createCoachDesignatedCredit: vi.fn(),
  fetchCoachDesignatedEligibleReports: vi.fn(),
  fetchCoachDesignatedStudentDetail: vi.fn(),
  fetchCoachDesignatedStudents: vi.fn(),
  updateCoachDesignatedEntry: vi.fn(),
  voidCoachDesignatedEntry: vi.fn(),
}))

vi.mock('../../../../hooks/useMemberSearch', () => ({
  useMemberSearch: () => ({
    searchTerm: '',
    filteredMembers: [],
    handleSearchChange: vi.fn(),
    selectMember: vi.fn(),
    selectMemberById: vi.fn(),
    reset: vi.fn(),
  }),
}))

const mockedCreateCredit = vi.mocked(createCoachDesignatedCredit)
const mockedFetchEligibleReports = vi.mocked(fetchCoachDesignatedEligibleReports)
const mockedFetchDetail = vi.mocked(fetchCoachDesignatedStudentDetail)
const mockedFetchStudents = vi.mocked(fetchCoachDesignatedStudents)
const mockedBackfillDeductions = vi.mocked(backfillCoachDesignatedReportDeductions)

describe('CoachDesignatedHours', () => {
  beforeEach(() => {
    mockedCreateCredit.mockReset()
    mockedFetchEligibleReports.mockReset()
    mockedFetchDetail.mockReset()
    mockedFetchStudents.mockReset()
    mockedBackfillDeductions.mockReset()

    mockedFetchStudents.mockResolvedValue([{
      member_id: 'member-1',
      name: 'Penny',
      nickname: null,
      membership_type: 'general',
      balance: 330,
      regular_balance: 330,
      gift_balance: 0,
      has_gift_entries: false,
      regular_expires_on: null,
      gift_expires_on: null,
      last_activity_at: '2026-10-09T10:00:00+08:00',
      entry_count: 1,
    }])
    mockedFetchDetail.mockResolvedValue({
      balance: 330,
      regular_balance: 330,
      gift_balance: 0,
      has_gift_entries: false,
      regular_expires_on: null,
      gift_expires_on: null,
      entries: [],
    })
    mockedFetchEligibleReports.mockResolvedValue([{
      participant_id: 123,
      duration_min: 30,
      booking_start_at: '2026-10-04T10:00:00+08:00',
      boat_name: 'G21',
    }])
    mockedBackfillDeductions.mockResolvedValue()
  })

  it('keeps adding credit separate from backfilling an existing report', async () => {
    render(<CoachDesignatedHours coachId="coach-1" isMobile />)

    expect(await screen.findByRole('heading', { name: '指定課學生' })).toBeInTheDocument()
    const studentName = await screen.findByText('Penny')
    fireEvent.click(studentName.closest('button')!)
    await screen.findByText('Penny｜指定課')

    expect(screen.queryByLabelText('搜尋指定課學生')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新增指定課' }))
    expect(screen.getByRole('heading', { name: '新增指定課' })).toBeInTheDocument()
    expect(mockedFetchEligibleReports).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    fireEvent.click(screen.getByRole('button', { name: '補扣指定課' }))
    expect(await screen.findByText(/2026-10-04 10:00 · G21 · 30 分/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.getByText('已選 1 堂・共扣 30 分')).toBeInTheDocument()
    expect(screen.getByText('扣後剩餘 300 分')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '確認扣除' }))

    await waitFor(() => expect(mockedBackfillDeductions).toHaveBeenCalledWith(
      'coach-1',
      'member-1',
      [{
      participant_id: 123,
      deduct: true,
      minutes: 30,
      regular_minutes: 30,
      gift_minutes: 0,
      }],
    ))
    expect(mockedCreateCredit).not.toHaveBeenCalled()
  })

  it('keeps the global add action anchored to the student list on desktop', async () => {
    render(<CoachDesignatedHours coachId="coach-1" isMobile={false} />)

    expect(await screen.findByRole('heading', { name: '指定課學生' })).toBeInTheDocument()
    expect(await screen.findByText('Penny｜指定課')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '新增指定課' })).toHaveLength(2)
  })

  it('shows one mobile-friendly add action when the coach has no students', async () => {
    mockedFetchStudents.mockResolvedValueOnce([])

    render(<CoachDesignatedHours coachId="coach-empty" isMobile />)

    expect(await screen.findByRole('heading', { name: '尚無指定課' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '進行中' })).not.toBeInTheDocument()
    expect(screen.queryByText('選擇學生查看指定課時數')).not.toBeInTheDocument()

    const addButton = screen.getByRole('button', { name: '新增指定課' })
    expect(addButton).toHaveStyle({ minWidth: '100%', minHeight: '48px' })
    fireEvent.click(addButton)
    expect(screen.getByRole('heading', { name: '新增指定課' })).toBeInTheDocument()
  })

  it('can split one backfilled report between regular and gift minutes', async () => {
    mockedFetchStudents.mockResolvedValueOnce([{
      member_id: 'member-1',
      name: 'Penny',
      nickname: null,
      membership_type: 'general',
      balance: 30,
      regular_balance: 20,
      gift_balance: 10,
      has_gift_entries: true,
      regular_expires_on: null,
      gift_expires_on: null,
      last_activity_at: '2026-10-09T10:00:00+08:00',
      entry_count: 2,
    }])
    mockedFetchDetail.mockResolvedValue({
      balance: 30,
      regular_balance: 20,
      gift_balance: 10,
      has_gift_entries: true,
      regular_expires_on: null,
      gift_expires_on: null,
      entries: [],
    })

    render(<CoachDesignatedHours coachId="coach-1" isMobile />)

    const studentName = await screen.findByText('Penny')
    fireEvent.click(studentName.closest('button')!)
    await screen.findByText('Penny｜指定課')
    fireEvent.click(screen.getByRole('button', { name: '補扣指定課' }))
    await screen.findByText(/2026-10-04 10:00 · G21 · 30 分/)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(screen.getByLabelText('指定課扣除分鐘，預約 30 分'), {
      target: { value: '20' },
    })
    fireEvent.change(screen.getByLabelText('贈送指定課扣除分鐘，預約 30 分'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: '確認扣除' }))

    await waitFor(() => expect(mockedBackfillDeductions).toHaveBeenCalledWith(
      'coach-1',
      'member-1',
      [{
        participant_id: 123,
        deduct: true,
        minutes: 30,
        regular_minutes: 20,
        gift_minutes: 10,
      }],
    ))
  })

  it('shows a retry action when eligible reports fail to load', async () => {
    mockedFetchEligibleReports
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce([{
        participant_id: 123,
        duration_min: 30,
        booking_start_at: '2026-10-04T10:00:00+08:00',
        boat_name: 'G21',
      }])

    render(<CoachDesignatedHours coachId="coach-1" isMobile />)

    const studentName = await screen.findByText('Penny')
    fireEvent.click(studentName.closest('button')!)
    await screen.findByText('Penny｜指定課')
    fireEvent.click(screen.getByRole('button', { name: '補扣指定課' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('無法載入上課紀錄')
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }))
    expect(await screen.findByText(/2026-10-04 10:00 · G21 · 30 分/)).toBeInTheDocument()
  })

  it('asks the coach to add designated minutes before backfilling', async () => {
    mockedFetchStudents.mockResolvedValueOnce([{
      member_id: 'member-1',
      name: 'Penny',
      nickname: null,
      membership_type: 'general',
      balance: 0,
      regular_balance: 0,
      gift_balance: 0,
      has_gift_entries: false,
      regular_expires_on: null,
      gift_expires_on: null,
      last_activity_at: '2026-10-09T10:00:00+08:00',
      entry_count: 1,
    }])
    mockedFetchDetail.mockResolvedValueOnce({
      balance: 0,
      regular_balance: 0,
      gift_balance: 0,
      has_gift_entries: false,
      regular_expires_on: null,
      gift_expires_on: null,
      entries: [],
    })

    render(<CoachDesignatedHours coachId="coach-1" isMobile />)

    fireEvent.click(screen.getByRole('button', { name: '已用完' }))
    const studentName = await screen.findByText('Penny')
    fireEvent.click(studentName.closest('button')!)
    await screen.findByText('Penny｜指定課')

    expect(screen.getByRole('button', { name: '補扣指定課' })).toBeDisabled()
    expect(screen.getByText('請先新增指定課，再補扣上課紀錄')).toBeInTheDocument()
    expect(mockedFetchEligibleReports).not.toHaveBeenCalled()
  })
})
