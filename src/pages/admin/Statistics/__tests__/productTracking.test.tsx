import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProductTab } from '../tabs/ProductTab'

vi.mock('../../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: true }),
}))

vi.mock('../../../admin/orders/ShopSettlementStatisticsTab', () => ({
  ShopSettlementStatisticsTab: ({
    isMobile,
    hideSettlementDetails,
  }: {
    isMobile: boolean
    hideSettlementDetails: boolean
  }) => (
    <div
      data-testid="shared-product-statistics"
      data-mobile={String(isMobile)}
      data-hide-details={String(hideSettlementDetails)}
    />
  ),
}))

describe('Product Dashboard', () => {
  it('reuses product statistics without settlement details', () => {
    render(<ProductTab onLoadComplete={vi.fn()} />)

    expect(screen.getByTestId('shared-product-statistics')).toHaveAttribute(
      'data-mobile',
      'true',
    )
    expect(screen.getByTestId('shared-product-statistics')).toHaveAttribute(
      'data-hide-details',
      'true',
    )
  })
})
