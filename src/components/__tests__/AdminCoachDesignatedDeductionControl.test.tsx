import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCoachDesignatedDeductionControl } from '../AdminCoachDesignatedDeductionControl'
import {
  fetchCoachDesignatedMemberContext,
  syncCoachDesignatedReportDeductions,
} from '../../pages/coach/designatedHours/api'

vi.mock('../../pages/coach/designatedHours/api', () => ({
  fetchCoachDesignatedMemberContext: vi.fn(),
  syncCoachDesignatedReportDeductions: vi.fn(),
}))

const mockedFetchContext = vi.mocked(fetchCoachDesignatedMemberContext)
const mockedSync = vi.mocked(syncCoachDesignatedReportDeductions)

describe('AdminCoachDesignatedDeductionControl', () => {
  beforeEach(() => {
    mockedFetchContext.mockReset()
    mockedSync.mockReset()
    mockedSync.mockResolvedValue()
    mockedFetchContext.mockResolvedValue({
      balance: 330,
      regular_balance: 300,
      gift_balance: 30,
      has_gift_entries: true,
      has_entries: true,
      deduction_minutes: 30,
      deduction_regular_minutes: 30,
      deduction_gift_minutes: 0,
      deduction_decided: true,
      explicit_no_deduction: false,
    })
  })

  it('loads correction data only after the admin opens it', async () => {
    render(
      <AdminCoachDesignatedDeductionControl
        participantId={123}
        coachId="coach-1"
        memberId="member-1"
        lessonType="designated_free"
        durationMin={30}
        isMobile
      />,
    )

    expect(mockedFetchContext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('修正'))
    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledOnce())
    expect(await screen.findByText(/剩餘 330 分/)).toBeInTheDocument()
  })

  it('reloads correction data when the participant changes', async () => {
    const { rerender } = render(
      <AdminCoachDesignatedDeductionControl
        participantId={123}
        coachId="coach-1"
        memberId="member-1"
        lessonType="designated_free"
        durationMin={30}
        isMobile
      />,
    )

    fireEvent.click(screen.getByText('修正'))
    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledTimes(1))

    mockedFetchContext.mockResolvedValueOnce({
      balance: 120,
      regular_balance: 120,
      gift_balance: 0,
      has_gift_entries: false,
      has_entries: true,
      deduction_minutes: 15,
      deduction_regular_minutes: 15,
      deduction_gift_minutes: 0,
      deduction_decided: true,
      explicit_no_deduction: false,
    })
    rerender(
      <AdminCoachDesignatedDeductionControl
        participantId={456}
        coachId="coach-1"
        memberId="member-2"
        lessonType="designated_free"
        durationMin={20}
        isMobile
      />,
    )

    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/剩餘 120 分/)).toBeInTheDocument()
    expect(mockedFetchContext).toHaveBeenLastCalledWith('coach-1', 'member-2', 456)
  })

  it('saves a regular/gift split as one report deduction', async () => {
    render(
      <AdminCoachDesignatedDeductionControl
        participantId={123}
        coachId="coach-1"
        memberId="member-1"
        lessonType="designated_free"
        durationMin={30}
        isMobile
      />,
    )

    fireEvent.click(screen.getByText('修正'))
    await screen.findByText(/剩餘 330 分/)
    fireEvent.change(screen.getByLabelText('管理員修正一般指定課扣除分鐘'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByLabelText('管理員修正贈送指定課扣除分鐘'), {
      target: { value: '15' },
    })
    fireEvent.click(screen.getByText('更新扣除'))

    await waitFor(() => expect(mockedSync).toHaveBeenCalledWith('coach-1', [{
      participant_id: 123,
      deduct: true,
      minutes: 30,
      regular_minutes: 15,
      gift_minutes: 15,
    }]))
  })
})
