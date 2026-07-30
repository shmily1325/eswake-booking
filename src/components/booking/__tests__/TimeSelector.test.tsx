import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeSelector } from '../TimeSelector'

function appearsBefore(first: Element, second: Element): boolean {
  return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('TimeSelector field order', () => {
  it('puts duration and availability before start time when availability is provided', () => {
    render(
      <TimeSelector
        startDate="2026-07-30"
        setStartDate={vi.fn()}
        startTime="10:00"
        setStartTime={vi.fn()}
        durationMin={60}
        setDurationMin={vi.fn()}
        afterDate={<div data-testid="availability">可預約時段</div>}
      />,
    )

    const date = screen.getByText('開始日期')
    const duration = screen.getByText('時長（分鐘）')
    const availability = screen.getByTestId('availability')
    const startTime = screen.getByText('開始時間')

    expect(appearsBefore(date, duration)).toBe(true)
    expect(appearsBefore(duration, availability)).toBe(true)
    expect(appearsBefore(availability, startTime)).toBe(true)
  })

  it('keeps the existing start-time then duration order without availability', () => {
    render(
      <TimeSelector
        showDate={false}
        startTime="10:00"
        setStartTime={vi.fn()}
        durationMin={60}
        setDurationMin={vi.fn()}
      />,
    )

    expect(
      appearsBefore(
        screen.getByText('開始時間'),
        screen.getByText('時長（分鐘）'),
      ),
    ).toBe(true)
  })

  it('supports duration then start-time ordering for repeat booking', () => {
    render(
      <TimeSelector
        showDate={false}
        durationBeforeTime
        startTime="10:00"
        setStartTime={vi.fn()}
        durationMin={60}
        setDurationMin={vi.fn()}
      />,
    )

    expect(
      appearsBefore(
        screen.getByText('時長（分鐘）'),
        screen.getByText('開始時間'),
      ),
    ).toBe(true)
  })
})
