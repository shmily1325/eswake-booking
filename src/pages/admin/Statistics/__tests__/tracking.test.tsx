import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { AlertCard } from '../components/AlertCard'
import { CoachMemberRankings } from '../components/CoachMemberRankings'
import { RankingCard } from '../components/RankingCard'
import { OperationsTab } from '../tabs/OperationsTab'

const loadCoachPerformanceMetric = vi.hoisted(() => vi.fn())

vi.mock('../../../../utils/coachPerformanceMetrics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../utils/coachPerformanceMetrics')>()
  return {
    ...actual,
    loadCoachPerformanceMetric,
  }
})

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
    loadCoachPerformanceMetric.mockResolvedValue([])
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
    expect(screen.getByRole('button', { name: '教學／駕駛' })).toHaveAttribute(
      'data-track',
      'dashboard_coach_metric_service',
    )
    expect(screen.getByRole('button', { name: '指定售出' })).toHaveAttribute(
      'data-track',
      'dashboard_coach_metric_designated_credit',
    )
    expect(screen.getByRole('button', { name: '指定單堂' })).toHaveAttribute(
      'data-track',
      'dashboard_coach_metric_designated_lesson',
    )
    expect(screen.getByRole('button', { name: '商品' })).toHaveAttribute(
      'data-track',
      'dashboard_coach_metric_product',
    )
  })

  it('loads a coach performance ranking only after its button is selected', async () => {
    loadCoachPerformanceMetric.mockReset()
    loadCoachPerformanceMetric.mockResolvedValue([
      { id: 'coach-1', name: 'Jerry', value: 300, count: 1 },
    ])
    render(
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

    expect(loadCoachPerformanceMetric).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '指定售出' }))

    await waitFor(() => expect(loadCoachPerformanceMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'designated_credit' }),
    ))
    expect(await screen.findByText(/Jerry/)).toBeInTheDocument()
    expect(screen.getByText('300 分')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '商品' }))
    await waitFor(() => expect(loadCoachPerformanceMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'product' }),
    ))
    expect(await screen.findByText('$300')).toBeInTheDocument()
    expect(screen.getByText('1 件')).toBeInTheDocument()
  })

  it('shows the top 30 members', () => {
    const members = Array.from({ length: 31 }, (_, index) => ({
      memberId: `member-${index + 1}`,
      memberName: `會員 ${index + 1}`,
      totalMinutes: 310 - index,
      designatedMinutes: 0,
      undesignatedMinutes: 310 - index,
      bookingCount: 1,
      coaches: [],
      boats: [],
    }))

    render(
      <CoachMemberRankings
        subTab="member"
        coachStats={[]}
        memberStats={members}
        periodWord="本月"
        coachMetric="service"
        performanceRows={[]}
        performanceLoading={false}
        performanceError={null}
        onRetryPerformance={vi.fn()}
      />,
    )

    expect(screen.getByText(/會員 30$/)).toBeInTheDocument()
    expect(screen.queryByText(/會員 31$/)).not.toBeInTheDocument()
  })
})
