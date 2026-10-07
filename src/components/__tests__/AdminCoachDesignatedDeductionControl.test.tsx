import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCoachDesignatedDeductionControl } from '../AdminCoachDesignatedDeductionControl'
import { fetchCoachDesignatedMemberContext } from '../../pages/coach/designatedHours/api'

vi.mock('../../pages/coach/designatedHours/api', () => ({
  fetchCoachDesignatedMemberContext: vi.fn(),
  syncCoachDesignatedReportDeductions: vi.fn(),
}))

const mockedFetchContext = vi.mocked(fetchCoachDesignatedMemberContext)

describe('AdminCoachDesignatedDeductionControl', () => {
  beforeEach(() => {
    mockedFetchContext.mockReset()
    mockedFetchContext.mockResolvedValue({
      balance: 330,
      has_entries: true,
      deduction_minutes: 30,
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
      has_entries: true,
      deduction_minutes: 15,
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
})
