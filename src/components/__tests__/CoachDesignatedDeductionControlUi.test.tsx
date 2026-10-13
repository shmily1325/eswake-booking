import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Participant } from '../../types/booking'
import { fetchCoachDesignatedMemberContext } from '../../pages/coach/designatedHours/api'
import { CoachDesignatedDeductionControl } from '../CoachDesignatedDeductionControl'

vi.mock('../../pages/coach/designatedHours/api', () => ({
  fetchCoachDesignatedMemberContext: vi.fn(),
}))

const mockedFetchContext = vi.mocked(fetchCoachDesignatedMemberContext)

function Harness() {
  const [participant, setParticipant] = useState<Participant>({
    id: 3130,
    booking_id: 1,
    coach_id: 'coach-jerry',
    member_id: 'member-penny',
    participant_name: 'Penny',
    duration_min: 60,
    payment_method: 'voucher',
    lesson_type: 'designated_free',
    status: 'not_applicable',
    designated_hours_initialized: false,
  } as Participant)

  return (
    <CoachDesignatedDeductionControl
      coachId="coach-jerry"
      participant={participant}
      participantIndex={0}
      isMobile={false}
      onUpdate={(_index, field, value) => {
        setParticipant((current) => ({ ...current, [field]: value }))
      }}
    />
  )
}

describe('CoachDesignatedDeductionControl balance preview', () => {
  beforeEach(() => {
    mockedFetchContext.mockReset()
    mockedFetchContext.mockResolvedValue({
      balance: 70,
      regular_balance: 70,
      gift_balance: 0,
      has_gift_entries: false,
      has_entries: true,
      deduction_minutes: 60,
      deduction_regular_minutes: 60,
      deduction_gift_minutes: 0,
      deduction_decided: true,
      explicit_no_deduction: false,
    })
  })

  it('does not subtract an existing deduction twice while editing', async () => {
    render(<Harness />)

    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: /指定課.*剩餘 70 分/ }))
      .toHaveAttribute('aria-expanded', 'true')

    expect(await screen.findByText('扣除後總剩餘 70 分鐘')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('本次扣除分鐘'), {
      target: { value: '50' },
    })
    expect(screen.getByText('扣除後總剩餘 80 分鐘')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: '本次扣除時數' }))
    expect(screen.getByText('取消扣除後總剩餘 130 分鐘')).toBeInTheDocument()
  })

  it('restores both regular and gift deductions before previewing a split edit', async () => {
    mockedFetchContext.mockResolvedValueOnce({
      balance: 100,
      regular_balance: 70,
      gift_balance: 30,
      has_gift_entries: true,
      has_entries: true,
      deduction_minutes: 30,
      deduction_regular_minutes: 20,
      deduction_gift_minutes: 10,
      deduction_decided: true,
      explicit_no_deduction: false,
    })

    render(<Harness />)

    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: /指定課.*剩餘 100 分/ }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(await screen.findByText(/扣除後總剩餘 100 分鐘/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('指定課扣除分鐘'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByLabelText('贈送指定課扣除分鐘'), {
      target: { value: '5' },
    })
    expect(screen.getByText(/扣除後總剩餘 110 分鐘/)).toBeInTheDocument()
    expect(screen.getByText(/指定課 75・贈送 35/)).toBeInTheDocument()
  })

  it('keeps a manually collapsed card closed', async () => {
    render(<Harness />)

    await waitFor(() => expect(mockedFetchContext).toHaveBeenCalledOnce())
    const toggle = screen.getByRole('button', { name: /指定課.*剩餘 70 分/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('checkbox', { name: '本次扣除時數' })).not.toBeInTheDocument()
  })
})
