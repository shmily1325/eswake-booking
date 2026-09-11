import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { AlertCard } from '../components/AlertCard'
import { RankingCard } from '../components/RankingCard'
import { OperationsTab } from '../tabs/OperationsTab'

describe('Dashboard click tracking', () => {
  it('tracks alert and ranking expansion state', () => {
    const { container } = render(
      <>
        <AlertCard
          variant="warning"
          title="尚未指派"
          count={1}
          minutes={30}
          expandable
          contactStats={[{ contactName: '會員', count: 1, minutes: 30 }]}
          trackId="dashboard_alert_unassigned"
        />
        <RankingCard
          title="排行"
          items={[{ id: 'coach-1', name: '教練', value: 30 }]}
          renderDetail={() => <div>明細</div>}
          trackId="dashboard_test_ranking"
        />
      </>,
    )

    const alert = screen.getByText('尚未指派').closest('[data-track]')
    expect(alert).toHaveAttribute('data-track', 'dashboard_alert_unassigned_expand')
    fireEvent.click(alert!)
    expect(alert).toHaveAttribute('data-track', 'dashboard_alert_unassigned_collapse')

    const ranking = container.querySelector('[data-track="dashboard_test_ranking_expand"]')
    expect(ranking).toHaveAttribute('data-track', 'dashboard_test_ranking_expand')
    fireEvent.click(ranking!)
    expect(ranking).toHaveAttribute('data-track', 'dashboard_test_ranking_collapse')
  })

  it('tracks operations period controls and subtabs', () => {
    const { container } = render(
      <OperationsTab
        periodMode="monthly"
        setPeriodMode={vi.fn()}
        selectedPeriod="2026-09"
        setSelectedPeriod={vi.fn()}
        monthlyCoachStats={[]}
        monthlyMemberStats={[]}
        monthlyWeekdayStats={{
          weekdayCount: 0,
          weekdayMinutes: 0,
          weekendCount: 0,
          weekendMinutes: 0,
        }}
        monthlyBoatUsage={[]}
        selectedYear={2026}
        setSelectedYear={vi.fn()}
        annualMonthlyStats={[]}
        annualCoachStats={[]}
        annualMemberStats={[]}
        annualBoatUsage={[]}
        annualLoading={false}
      />,
    )

    expect(container.querySelector('[data-track^="dashboard_period_month_"]')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: '選擇月份' })).toHaveAttribute(
      'data-track',
      'dashboard_period_month_select',
    )
    expect(screen.getByRole('button', { name: '教練統計' })).toHaveAttribute(
      'data-track',
      'dashboard_operations_subtab_coach',
    )
    expect(screen.getByRole('button', { name: '會員統計' })).toHaveAttribute(
      'data-track',
      'dashboard_operations_subtab_member',
    )
  })
})
