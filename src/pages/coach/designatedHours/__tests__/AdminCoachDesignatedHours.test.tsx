import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAdminCoachDesignatedOverview } from '../api'
import { AdminCoachDesignatedHours } from '../AdminCoachDesignatedHours'

vi.mock('../api', () => ({
  fetchAdminCoachDesignatedOverview: vi.fn(),
}))

vi.mock('../CoachDesignatedHours', () => ({
  CoachDesignatedHours: ({
    coachId,
    initialMemberId,
  }: {
    coachId: string
    initialMemberId?: string | null
  }) => (
    <div data-testid="coach-designated-hours">
      {coachId}:{initialMemberId || 'none'}
    </div>
  ),
}))

const mockedFetchOverview = vi.mocked(fetchAdminCoachDesignatedOverview)

describe('AdminCoachDesignatedHours', () => {
  beforeEach(() => {
    mockedFetchOverview.mockReset()
    mockedFetchOverview.mockResolvedValue([
      {
        coach_id: 'coach-jerry',
        coach_name: 'Jerry',
        students: [{
          member_id: 'member-penny',
          name: 'Penny',
          nickname: null,
          membership_type: 'general',
          balance: 300,
          regular_balance: 300,
          gift_balance: 0,
          has_gift_entries: false,
          regular_expires_on: null,
          gift_expires_on: null,
          last_activity_at: '2026-10-09T10:00:00+08:00',
          entry_count: 2,
        }],
      },
      {
        coach_id: 'coach-empty',
        coach_name: '新教練',
        students: [],
      },
    ])
  })

  it('shows every active coach, including coaches without designated records', async () => {
    render(<AdminCoachDesignatedHours isMobile={false} />)

    expect(await screen.findByRole('button', { name: 'Jerry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新教練' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '總覽' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '新教練' }))
    expect(screen.getByText('目前管理：')).toHaveTextContent('目前管理：新教練')
    expect(screen.getByTestId('coach-designated-hours')).toHaveTextContent('coach-empty:none')
  })

  it('opens the shared coach view at the selected overview student', async () => {
    render(<AdminCoachDesignatedHours isMobile />)

    fireEvent.click(await screen.findByRole('button', { name: /Penny/ }))

    expect(screen.getByTestId('coach-designated-hours')).toHaveTextContent(
      'coach-jerry:member-penny',
    )
  })

  it('wraps all coach buttons into mobile-friendly rows', async () => {
    render(<AdminCoachDesignatedHours isMobile />)

    const overviewButton = await screen.findByRole('button', { name: '總覽' })
    expect(overviewButton.parentElement).toHaveStyle({
      flexWrap: 'wrap',
      overflowX: 'visible',
    })
  })
})
