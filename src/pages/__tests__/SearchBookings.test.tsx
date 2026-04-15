import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBookings } from '../SearchBookings'

const mockUser = { id: 'test-user', email: 'test@example.com' } as import('@supabase/supabase-js').User

vi.mock('../../contexts/AuthContext', () => ({
  useAuthUser: () => mockUser,
}))

vi.mock('../../utils/auth', () => ({
  isEditorAsync: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}))

function tableMock(table: string) {
  if (table === 'members') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 'm1', name: '王小明', nickname: null, phone: null }],
        error: null,
      }),
    }
  }
  if (table === 'boats') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          { id: 1, name: 'G21', color: '#111' },
          { id: 2, name: '彈簧床', color: '#ccc' },
        ],
        error: null,
      }),
    }
  }
  if (table === 'bookings') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }
  if (table === 'boat_unavailable_dates') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
  }
  return {
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((t: string) => tableMock(t)),
  },
}))

describe('SearchBookings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('預設顯示預約人分頁', async () => {
    render(<SearchBookings isEmbedded />)
    expect(screen.getByRole('button', { name: /預約人/ })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/搜尋會員/)).toBeInTheDocument()
    })
  })

  it('船空檔：選船、日期後搜尋可顯示結果行', async () => {
    render(<SearchBookings isEmbedded />)

    fireEvent.click(screen.getByRole('button', { name: /船空檔/ }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^G21$/ })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /^G21$/ }))

    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBeGreaterThanOrEqual(2)
    fireEvent.change(dateInputs[0], { target: { value: '2026-06-02' } })
    fireEvent.change(dateInputs[1], { target: { value: '2026-06-02' } })

    const submit = screen.getByRole('button', { name: /^🔍 搜尋$/ })
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/共\s*\d+\s*行結果/)
    })
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/6\/2.*G21/)
    })
  })

  it('未選船時搜尋按鈕為停用', async () => {
    render(<SearchBookings isEmbedded />)
    fireEvent.click(screen.getByRole('button', { name: /船空檔/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^🔍 搜尋$/ })).toBeDisabled()
    })
  })
})
