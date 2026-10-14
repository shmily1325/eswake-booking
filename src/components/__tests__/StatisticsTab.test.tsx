import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatisticsTab } from '../StatisticsTab'
import { fetchAllPaginated } from '../../utils/supabasePaginate'

vi.mock('../../utils/supabasePaginate', () => ({
  fetchAllPaginated: vi.fn(),
}))

vi.mock('../ui', () => ({
  useToast: () => ({ error: vi.fn() }),
}))

vi.mock('../DateRangePicker', () => ({
  DateRangePicker: () => <div data-testid="date-filter" />,
}))

vi.mock('../CoachLedgerOverview', () => ({
  CoachLedgerOverview: () => <div data-testid="ledger-overview" />,
}))

vi.mock('../PerformanceStatistics', () => ({
  PerformanceStatistics: ({ section }: { section: string }) => (
    <div data-testid="performance-section" data-section={section} />
  ),
}))

const mockedFetchAllPaginated = vi.mocked(fetchAllPaginated)

describe('StatisticsTab shared ledger', () => {
  beforeEach(() => {
    mockedFetchAllPaginated.mockReset()
    mockedFetchAllPaginated.mockResolvedValue([])
  })

  it('keeps the four simple report sections', async () => {
    render(<StatisticsTab isMobile={false} />)

    expect(screen.getByRole('button', { name: '教練數據' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '教學／駕駛' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '指定單堂' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '指定售出' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '商品' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '教練數據' }))
    expect(screen.getByTestId('ledger-overview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '商品' }))
    expect(screen.getByTestId('performance-section')).toHaveAttribute('data-section', 'product')
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalled())
  })

  it('locks the coach view to the supplied coach', async () => {
    render(<StatisticsTab isMobile autoFilterCoachId="coach-1" />)

    expect(screen.queryByLabelText('篩選教練')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '教練數據' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ledger-overview')).not.toBeInTheDocument()
    await waitFor(() => expect(mockedFetchAllPaginated).toHaveBeenCalled())
  })
})
