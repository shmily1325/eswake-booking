import { useEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatisticsTab } from '../StatisticsTab'
import { fetchAllPaginated } from '../../utils/supabasePaginate'

const performanceMock = vi.hoisted(() => ({ failingSection: null as string | null }))

vi.mock('../../utils/supabasePaginate', () => ({
  fetchAllPaginated: vi.fn(),
}))

vi.mock('../ui', () => ({
  useToast: () => ({ error: vi.fn() }),
}))

vi.mock('../DateRangePicker', () => ({
  DateRangePicker: ({ onDateChange }: { onDateChange: (value: string) => void }) => (
    <button type="button" onClick={() => onDateChange('2026-09')}>換日期</button>
  ),
}))

vi.mock('../CoachLedgerOverview', () => ({
  CoachLedgerOverview: () => <div data-testid="ledger-overview" />,
}))

vi.mock('../PerformanceStatistics', () => ({
  PerformanceStatistics: ({
    section,
    onSectionStatusChange,
  }: {
    section: 'designated_lesson' | 'designated_credit' | 'product'
    onSectionStatusChange?: (section: string, status: string, error?: string) => void
  }) => {
    useEffect(() => {
      if (performanceMock.failingSection === section) {
        onSectionStatusChange?.(section, 'error', 'temporary failure')
      } else {
        onSectionStatusChange?.(section, 'success')
      }
    }, [onSectionStatusChange, section])
    return <div data-testid="performance-section" data-section={section} />
  },
}))

const mockedFetchAllPaginated = vi.mocked(fetchAllPaginated)

describe('StatisticsTab shared ledger', () => {
  beforeEach(() => {
    mockedFetchAllPaginated.mockReset()
    mockedFetchAllPaginated.mockResolvedValue([])
    performanceMock.failingSection = null
  })

  it('keeps the four simple report sections', async () => {
    render(<StatisticsTab isMobile={false} />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '全部教練' })).toHaveAttribute(
      'data-track',
      'admin_statistics_ledger_coach_all',
    )
    expect(screen.getByRole('button', { name: '教練總表' })).toHaveAttribute(
      'data-track',
      'statistics_coach_overview_open',
    )
    expect(screen.getByRole('button', { name: '教學／駕駛' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '指定單堂' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '指定售出' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '商品' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '教練總表' }))
    expect(await screen.findByTestId('ledger-overview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '商品' }))
    expect(screen.getByTestId('performance-section')).toHaveAttribute('data-section', 'product')
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalled())
  })

  it('locks the coach view to the supplied coach', async () => {
    render(<StatisticsTab isMobile autoFilterCoachId="coach-1" />)

    expect(screen.queryByLabelText('篩選教練')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '教練總表' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ledger-overview')).not.toBeInTheDocument()
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalled())
  })

  it('shows a retry instead of a partial coach overview when one source fails', async () => {
    performanceMock.failingSection = 'designated_credit'
    render(<StatisticsTab isMobile={false} />)

    fireEvent.click(screen.getByRole('button', { name: '教練總表' }))
    expect(await screen.findByText(/總表載入失敗/)).toBeInTheDocument()
    expect(screen.queryByTestId('ledger-overview')).not.toBeInTheDocument()

    performanceMock.failingSection = null
    fireEvent.click(screen.getByRole('button', { name: '重新載入' }))
    expect(await screen.findByTestId('ledger-overview')).toBeInTheDocument()
  })

  it('reloads service data when the date changes', async () => {
    render(<StatisticsTab isMobile={false} />)
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole('button', { name: '換日期' }))
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalledTimes(4))
  })
})
