import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DailyStaffDisplayContent } from '../DailyStaffDisplay'

describe('DailyStaffDisplayContent', () => {
  it('使用頁面已載入的人員資料呈現相同內容', () => {
    render(
      <DailyStaffDisplayContent
        date="2026-08-03"
        isMobile={false}
        loading={false}
        allStaff={[
          {
            id: 'working',
            name: '上班教練',
            isOnTimeOff: false,
            timeOffRecords: [],
          },
          {
            id: 'off',
            name: '休假教練',
            isOnTimeOff: true,
            timeOffRecords: [{
              coach_id: 'off',
              start_date: '2026-08-03',
              end_date: '2026-08-03',
              start_time: null,
              end_time: null,
            }],
          },
        ]}
      />
    )

    expect(screen.getByText('上班教練')).toBeInTheDocument()
    expect(screen.getByText(/休假教練/)).toBeInTheDocument()
  })
})
