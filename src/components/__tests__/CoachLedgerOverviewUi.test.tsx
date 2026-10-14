import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { CoachLedgerOverview } from '../CoachLedgerOverview'

describe('CoachLedgerOverview interactions', () => {
  it('filters to a coach from the overview card', () => {
    const onSelectCoach = vi.fn()
    render(
      <CoachLedgerOverview
        isMobile={false}
        serviceRows={[{
          coachId: 'coach-1',
          coachName: 'Pierre',
          teachingMinutes: 120,
          teachingCount: 2,
          drivingMinutes: 30,
          drivingCount: 1,
        }]}
        performanceRows={{
          designated_lesson: [],
          designated_credit: [],
          product: [{ id: 'coach-1', name: 'Pierre', value: 4800, count: 2 }],
        }}
        selectedCoachId="all"
        onSelectCoach={onSelectCoach}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Pierre.*\$4,800.*2 件/ }))
    expect(onSelectCoach).toHaveBeenCalledWith('coach-1')
  })

  it('does not show unassigned product sales as a coach', () => {
    render(
      <CoachLedgerOverview
        isMobile={false}
        serviceRows={[]}
        performanceRows={{
          designated_lesson: [],
          designated_credit: [],
          product: [{ id: 'unassigned', name: '未指定', value: 2000, count: 3 }],
        }}
        selectedCoachId="all"
        onSelectCoach={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button', { name: /未指定/ })).not.toBeInTheDocument()
    expect(screen.getByText('此期間尚無教練數據')).toBeInTheDocument()
  })
})
