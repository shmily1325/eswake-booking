import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProductTab } from '../tabs/ProductTab'

const mocks = vi.hoisted(() => ({
  trackView: vi.fn(),
  loadComplete: vi.fn(),
}))

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuthUser: () => ({ email: 'admin@example.com' }),
}))

vi.mock('../../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}))

vi.mock('../../../../utils/trackClick', () => ({
  trackClickDedupedWithin: mocks.trackView,
}))

vi.mock('../../../admin/orders/api', () => ({
  fetchSettlementsInRange: vi.fn().mockResolvedValue([{
    id: 'settlement-1',
    order_id: 'order-1',
    payment_method: 'cash',
    charge_member_id: null,
    amount_total: 100,
    items_snapshot: [{
      item_id: 'item-1',
      variant_id: 'variant-1',
      qty: 1,
      unit_price: 100,
      line_total: 100,
    }],
    notes: null,
    settled_by: null,
    settled_at: '2026-09-01T12:00:00+08:00',
    order_no: 'SO-1',
    contact_name: '客人',
    order_cancelled_at: null,
    charge_member_name: null,
  }]),
}))

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: () => Promise.resolve({
          data: [{
            id: 'variant-1',
            product: {
              id: 'product-1',
              brand: 'Ronix',
              model: 'One',
              model_year: 2026,
            },
          }],
          error: null,
        }),
      }),
    }),
  },
}))

describe('Product Dashboard tracking', () => {
  it('covers view, period, filters, ranking rows, and full statistics link', async () => {
    const { container } = render(
      <MemoryRouter>
        <ProductTab refreshToken={0} onLoadComplete={mocks.loadComplete} />
      </MemoryRouter>,
    )

    expect(mocks.trackView).toHaveBeenCalledWith(
      'dashboard_product_view',
      'admin@example.com',
      1_000,
    )
    expect(screen.getByRole('button', { name: '按月' })).toHaveAttribute(
      'data-track',
      'dashboard_product_period_monthly',
    )
    expect(screen.getByRole('button', { name: '按年' })).toHaveAttribute(
      'data-track',
      'dashboard_product_period_annual',
    )
    expect(screen.getByLabelText('選擇商品統計月份')).toHaveAttribute(
      'data-track',
      'dashboard_product_month_input',
    )
    expect(container.querySelector('[data-track^="dashboard_product_month_shortcut_"]')).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelector('[data-track="dashboard_product_brand_row"]')).toBeTruthy()
    })
    expect(container.querySelector('[data-track="dashboard_product_product_row"]')).toBeTruthy()
    expect(screen.getByRole('link', { name: '查看完整統計' })).toHaveAttribute(
      'data-track',
      'dashboard_product_full_statistics_link',
    )

    fireEvent.click(screen.getByRole('button', { name: '按年' }))
    expect(container.querySelector('[data-track^="dashboard_product_year_"]')).toBeTruthy()
    await screen.findByText('每月實收趨勢')
  })
})
