import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BookingDateNav } from '../BookingDateNav'

function renderNav(disabled = false) {
  const callbacks = {
    onDateChange: vi.fn(),
    onPrevDate: vi.fn(),
    onNextDate: vi.fn(),
    onGoToToday: vi.fn(),
  }

  render(
    <BookingDateNav
      date="2026-08-03"
      disabled={disabled}
      marginBottom="0"
      {...callbacks}
    />
  )

  return callbacks
}

describe('BookingDateNav', () => {
  it('載入期間停用所有日期切換控制', () => {
    const callbacks = renderNav(true)

    const previous = screen.getByRole('button', { name: '前一天' })
    const next = screen.getByRole('button', { name: '後一天' })
    const today = screen.getByRole('button', { name: '今天' })
    const date = screen.getByLabelText('日期')

    expect(previous).toBeDisabled()
    expect(next).toBeDisabled()
    expect(today).toBeDisabled()
    expect(date).toBeDisabled()

    fireEvent.click(previous)
    fireEvent.click(next)
    fireEvent.click(today)
    fireEvent.change(date, { target: { value: '2026-08-04' } })

    expect(callbacks.onPrevDate).not.toHaveBeenCalled()
    expect(callbacks.onNextDate).not.toHaveBeenCalled()
    expect(callbacks.onGoToToday).not.toHaveBeenCalled()
    expect(callbacks.onDateChange).not.toHaveBeenCalled()
  })

  it('未載入時維持原本的日期切換行為', () => {
    const callbacks = renderNav()

    fireEvent.click(screen.getByRole('button', { name: '前一天' }))
    fireEvent.click(screen.getByRole('button', { name: '後一天' }))
    fireEvent.click(screen.getByRole('button', { name: '今天' }))
    fireEvent.change(screen.getByLabelText('日期'), {
      target: { value: '2026-08-04' },
    })

    expect(callbacks.onPrevDate).toHaveBeenCalledOnce()
    expect(callbacks.onNextDate).toHaveBeenCalledOnce()
    expect(callbacks.onGoToToday).toHaveBeenCalledOnce()
    expect(callbacks.onDateChange).toHaveBeenCalledOnce()
  })
})
