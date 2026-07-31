import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { BookingAlternativeSuggestions } from '../BookingAlternativeSuggestions'

describe('BookingAlternativeSuggestions', () => {
  it('packs available times continuously and separates afternoon slots', () => {
    const onSelectTime = vi.fn()
    render(
      <BookingAlternativeSuggestions
        status="ready"
        allDayTimes={['05:00', '06:15', '11:30', '17:15']}
        selectedTime="05:00"
        isMobile
        onSelectTime={onSelectTime}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '可預約時段（4 個）' }))

    const selected = screen.getByRole('button', { name: '目前 05:00' })
    expect(selected).toBeEnabled()
    expect(selected).toHaveAttribute('data-track', 'booking_slots_select:05:00')
    expect(selected).toHaveStyle({ background: '#5f8791', color: '#ffffff' })
    expect(screen.getByRole('button', { name: '改為 06:15' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '改為 11:30' })).toBeEnabled()
    expect(screen.getByRole('separator', { name: '下午時段' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '改為 17:15' })).toHaveAttribute(
      'data-track',
      'booking_slots_select:17:15',
    )

    fireEvent.click(screen.getByRole('button', { name: '改為 17:15' }))
    expect(onSelectTime).toHaveBeenCalledWith('17:15')
    expect(screen.queryByRole('button', { name: '改為 17:15' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '可預約時段（4 個）' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.getByRole('button', { name: '可預約時段（4 個）' })).toHaveAttribute(
      'data-track',
      'booking_slots_open',
    )
  })

  it('tracks open/close and retry actions on the header', () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <BookingAlternativeSuggestions
        status="ready"
        allDayTimes={['09:00']}
        selectedTime="09:00"
        isMobile
        onSelectTime={vi.fn()}
      />,
    )

    const header = screen.getByRole('button', { name: '可預約時段（1 個）' })
    expect(header).toHaveAttribute('data-track', 'booking_slots_open')
    fireEvent.click(header)
    expect(header).toHaveAttribute('data-track', 'booking_slots_close')

    rerender(
      <BookingAlternativeSuggestions
        status="error"
        allDayTimes={[]}
        selectedTime="09:00"
        isMobile
        onSelectTime={vi.fn()}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('button', { name: /可預約時段（重新載入）/ })).toHaveAttribute(
      'data-track',
      'booking_slots_retry',
    )
  })

  it('does not show a period divider when only morning slots are available', () => {
    render(
      <BookingAlternativeSuggestions
        status="ready"
        allDayTimes={['09:00', '11:45']}
        selectedTime="09:00"
        isMobile
        onSelectTime={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '可預約時段（2 個）' }))
    expect(screen.queryByRole('separator', { name: '下午時段' })).not.toBeInTheDocument()
  })

  it('labels more than 20 available slots as abundant', () => {
    const allDayTimes = Array.from({ length: 21 }, (_, index) => {
      const minutes = 5 * 60 + index * 15
      const hour = Math.floor(minutes / 60)
      const minute = minutes % 60
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    })

    render(
      <BookingAlternativeSuggestions
        status="ready"
        allDayTimes={allDayTimes}
        selectedTime="05:00"
        isMobile
        onSelectTime={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: '可預約時段充足（21 個）' }),
    ).toBeInTheDocument()
  })

  it('未設定時長時保留欄位但不可展開', () => {
    render(
      <BookingAlternativeSuggestions
        status="awaiting-duration"
        allDayTimes={[]}
        selectedTime="09:00"
        isMobile
        onSelectTime={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: '可預約時段（請先設定時長）' })
    expect(trigger).toBeDisabled()
  })

  it('載入失敗時可點擊重試，不會整塊消失', () => {
    const onRetry = vi.fn()
    render(
      <BookingAlternativeSuggestions
        status="error"
        allDayTimes={[]}
        selectedTime="09:00"
        isMobile
        onSelectTime={vi.fn()}
        onRetry={onRetry}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /可預約時段（重新載入）/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('當天無可預約時段')).not.toBeInTheDocument()
  })
})
