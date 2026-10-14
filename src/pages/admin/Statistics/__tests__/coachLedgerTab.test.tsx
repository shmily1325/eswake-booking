import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { CoachLedgerTab } from '../tabs/CoachLedgerTab'

vi.mock('../../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true }),
}))

vi.mock('../../../../components/StatisticsTab', () => ({
  StatisticsTab: ({
    isMobile,
    autoFilterCoachId,
  }: {
    isMobile: boolean
    autoFilterCoachId?: string
  }) => (
    <div
      data-testid="shared-coach-ledger"
      data-mobile={String(isMobile)}
      data-coach-id={autoFilterCoachId ?? 'all'}
    />
  ),
}))

describe('Coach ledger Dashboard', () => {
  it('reuses the administrator version of the shared ledger', () => {
    render(<CoachLedgerTab />)

    expect(screen.getByTestId('shared-coach-ledger')).toHaveAttribute('data-mobile', 'true')
    expect(screen.getByTestId('shared-coach-ledger')).toHaveAttribute('data-coach-id', 'all')
  })
})
