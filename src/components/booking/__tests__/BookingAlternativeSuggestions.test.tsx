import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { BookingAlternativeSuggestions } from '../BookingAlternativeSuggestions'

describe('BookingAlternativeSuggestions', () => {
  it('shows one hour per row and keeps unavailable quarters as quiet placeholders', () => {
    const onSelectTime = vi.fn()
    render(
      <BookingAlternativeSuggestions
        status="ready"
        allDayTimes={['09:00', '09:30']}
        selectedTime="09:00"
        isMobile
        onSelectTime={onSelectTime}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '可預約時段（2 個）' }))

    expect(screen.getByRole('button', { name: '目前 09:00' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '改為 09:30' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: '09:15 不可預約' })).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '改為 09:30' }))
    expect(onSelectTime).toHaveBeenCalledWith('09:30')
    expect(screen.queryByRole('button', { name: '改為 09:30' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '可預約時段（2 個）' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
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
