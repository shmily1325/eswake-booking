import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { CoachLedgerOverview } from '../CoachLedgerOverview'

describe('CoachLedgerOverview interactions', () => {
  it('opens the selected coach and ledger section from the overview table', () => {
    const onSelect = vi.fn()
    render(
      <CoachLedgerOverview
        isMobile={false}
        section="service"
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
        onSelect={onSelect}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /\$4,800.*2 件/ }))
    expect(onSelect).toHaveBeenCalledWith('product', 'coach-1')
  })
})
