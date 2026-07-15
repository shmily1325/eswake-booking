import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SearchBookings } from '../SearchBookings'

const mockUser = { id: 'test-user', email: 'test@example.com' } as import('@supabase/supabase-js').User

vi.mock('../../contexts/AuthContext', () => ({
  useAuthUser: () => mockUser,
}))

vi.mock('../../utils/auth', () => ({
  hasEditorFeatureAsync: vi.fn(() => Promise.resolve(false)),
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
  if (table === 'bookings') {
    return {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockResolvedValue({ data: [], error: null }),
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

  it('預設顯示預約人搜尋表單', async () => {
    render(<SearchBookings isEmbedded />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/搜尋會員/)).toBeInTheDocument()
    })
  })
})
