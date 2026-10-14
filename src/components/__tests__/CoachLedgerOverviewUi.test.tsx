import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it } from 'vitest'
import { CoachLedgerOverview } from '../CoachLedgerOverview'

describe('CoachLedgerOverview interactions', () => {
  it('sorts the desktop comparison table by a tracked metric', () => {
    render(
      <CoachLedgerOverview
        isMobile={false}
        serviceRows={[
          {
            coachId: 'coach-1',
            coachName: 'Casper',
            teachingMinutes: 120,
            teachingCount: 2,
            drivingMinutes: 30,
            drivingCount: 1,
          },
          {
            coachId: 'coach-2',
            coachName: 'Jerry',
            teachingMinutes: 90,
            teachingCount: 1,
            drivingMinutes: 60,
            drivingCount: 1,
          },
        ]}
        performanceRows={{
          designated_lesson: [],
          designated_credit: [],
          product: [
            { id: 'coach-1', name: 'Casper', value: 2000, count: 1 },
            { id: 'coach-2', name: 'Jerry', value: 4800, count: 2 },
          ],
        }}
      />,
    )

    const productSort = screen.getByRole('button', { name: '商品' })
    expect(productSort).toHaveAttribute('data-track', 'statistics_coach_overview_sort_product')
    fireEvent.click(productSort)
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('Jerry')
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
      />,
    )

    expect(screen.queryByText('未指定')).not.toBeInTheDocument()
    expect(screen.getByText('此期間尚無教練數據')).toBeInTheDocument()
  })

  it('uses explicit labels in the mobile coach card', () => {
    render(
      <CoachLedgerOverview
        isMobile
        serviceRows={[{
          coachId: 'coach-1',
          coachName: 'Jerry',
          teachingMinutes: 120,
          teachingCount: 2,
          drivingMinutes: 30,
          drivingCount: 1,
        }]}
        performanceRows={{
          designated_lesson: [],
          designated_credit: [],
          product: [],
        }}
      />,
    )

    expect(screen.getByText('教學／駕駛')).toBeInTheDocument()
    expect(screen.getByText('教學')).toBeInTheDocument()
    expect(screen.getByText('駕駛')).toBeInTheDocument()
    expect(screen.getByText('單堂')).toBeInTheDocument()
    expect(screen.getByText('售出')).toBeInTheDocument()
  })
})
