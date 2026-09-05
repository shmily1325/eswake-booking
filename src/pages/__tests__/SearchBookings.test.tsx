import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { SearchBookings } from '../SearchBookings'

const mockUser = { id: 'test-user', email: 'test@example.com' } as import('@supabase/supabase-js').User
const reminderGuestMocks = vi.hoisted(() => ({
  callApi: vi.fn(),
  search: vi.fn(),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuthUser: () => mockUser,
}))

vi.mock('../../utils/auth', () => ({
  hasEditorFeatureAsync: vi.fn(() => Promise.resolve(false)),
}))

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}))

vi.mock('../../utils/lineReminderGuests', () => ({
  callReminderGuestApi: reminderGuestMocks.callApi,
  searchSavedLineReminderGuests: reminderGuestMocks.search,
}))

function tableMock(table: string) {
  if (table === 'members') {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{
          id: 'm1',
          name: '王小明',
          nickname: null,
          phone: null,
          membership_type: 'general',
        }],
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
    reminderGuestMocks.search.mockResolvedValue([])
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('預設顯示預約人搜尋表單', async () => {
    render(<SearchBookings isEmbedded />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/搜尋會員/)).toBeInTheDocument()
      expect(screen.queryByText(/註解含/)).not.toBeInTheDocument()
    })
  })

  it('會員建議優先顯示，LINE 建檔人物接續顯示', async () => {
    reminderGuestMocks.search.mockResolvedValue([{
      id: '11111111-1111-4111-8111-111111111111',
      line_user_id: 'U1',
      name: '王小明',
      line_contact: {
        display_name: '小明 LINE',
        picture_url: null,
        friend_status: 'friend',
      },
    }])
    render(<SearchBookings isEmbedded />)
    const input = await screen.findByPlaceholderText(/搜尋會員/)

    fireEvent.change(input, { target: { value: '小明' } })

    const memberSuggestion = await screen.findByTestId('member-suggestion-m1')
    const lineSuggestion = await screen.findByTestId(
      'line-suggestion-11111111-1111-4111-8111-111111111111',
    )
    expect(memberSuggestion.compareDocumentPosition(lineSuggestion))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByText('會員｜')).toBeInTheDocument()
    expect(screen.getByText('LINE｜')).toBeInTheDocument()

    fireEvent.click(memberSuggestion)
    expect(screen.getByText(/僅顯示此人的預約/)).toBeInTheDocument()
  })
})
