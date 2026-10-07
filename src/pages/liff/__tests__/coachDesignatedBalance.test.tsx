import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BalanceView } from '../components/BalanceView'
import { CoachDesignatedHistoryModal } from '../components/CoachDesignatedHistoryModal'
import type { Member } from '../types'

const member = {
  id: 'member-1',
  balance: 0,
  vip_voucher_amount: 0,
  boat_voucher_g23_minutes: 0,
  boat_voucher_g21_panther_minutes: 0,
  designated_lesson_minutes: 0,
  gift_boat_hours: 0,
} as Member

describe('LIFF coach designated hours', () => {
  it('adds each coach as one independent balance card', () => {
    const onClick = vi.fn()
    render(
      <BalanceView
        member={member}
        coachDesignatedBalances={[
          {
            coach_id: 'coach-jerry',
            coach_name: 'Jerry',
            balance: 330,
            last_activity_at: '2026-10-01T10:00:00+08:00',
          },
          {
            coach_id: 'coach-ed',
            coach_name: 'ED',
            balance: 60,
            last_activity_at: '2026-10-02T10:00:00+08:00',
          },
        ]}
        onCategoryClick={onClick}
      />,
    )

    fireEvent.click(screen.getByText('Jerry 指定課'))
    expect(onClick).toHaveBeenCalledWith('coach-designated:coach-jerry')
    expect(screen.getByText('ED 指定課')).toBeInTheDocument()
  })

  it('renders read-only history and lets the member request all rows', () => {
    const onLoadAll = vi.fn()
    render(
      <CoachDesignatedHistoryModal
        show
        coachName="Jerry"
        entries={[{
          id: 1,
          entry_type: 'report_deduction',
          minutes: 30,
          delta_minutes: -30,
          occurred_at: '2026-10-04T10:00:00+08:00',
          note: null,
          booking_start_at: '2026-10-04T10:00:00+08:00',
          boat_name: 'G21',
        }]}
        total={12}
        loading={false}
        onClose={vi.fn()}
        onLoadAll={onLoadAll}
      />,
    )

    expect(screen.getByText('Jerry 指定課明細')).toBeInTheDocument()
    expect(screen.getByText('G21')).toBeInTheDocument()
    expect(screen.queryByText(/編輯|儲存/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('查看全部紀錄'))
    expect(onLoadAll).toHaveBeenCalledOnce()
  })
})
