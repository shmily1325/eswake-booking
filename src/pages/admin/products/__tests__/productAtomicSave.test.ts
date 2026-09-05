import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SaveProductWithVariantsInput } from '../api'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('../../../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}))

import { saveProductWithVariants } from '../api'

function payload(): SaveProductWithVariantsInput {
  return {
    product_id: null,
    skip_identity_check: false,
    apply_size_chart_to_model: false,
    product: {
      category: 'lifejacket',
      brand: 'FOLLOW',
      model: 'Test',
      model_year: 2027,
      color: 'Black',
      description: null,
      size_chart_id: null,
      cover_images: [],
      cover_image_url: null,
      cover_image_path: null,
      is_public: true,
    },
    variants: [{
      draft_index: 0,
      id: null,
      pending_delete: false,
      label_code: 'ESFOLLOWVEST001',
      vendor_code: null,
      attributes: { size: 'M' },
      price: 1000,
      member_price: null,
      stock: 1,
      accept_pre_order: false,
      pre_order_until: null,
      cover_image_url: null,
      cover_image_path: null,
      cover_images: [],
      image_url: null,
      image_path: null,
      discount_preset_id: null,
    }],
  }
}

describe('saveProductWithVariants', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('sends the complete product draft through the atomic RPC', async () => {
    rpcMock.mockResolvedValue({
      data: {
        success: true,
        product_id: 'product-1',
        variants: [{ draft_index: 0, id: 'variant-1', label_code: 'ESFOLLOWVEST001' }],
      },
      error: null,
    })

    const result = await saveProductWithVariants(payload())

    expect(rpcMock).toHaveBeenCalledWith('save_product_with_variants', {
      p_payload: payload(),
    })
    expect(result.product_id).toBe('product-1')
  })

  it('surfaces a transaction rejection without treating it as success', async () => {
    rpcMock.mockResolvedValue({
      data: { success: false, error: '標籤代碼已被使用' },
      error: null,
    })

    await expect(saveProductWithVariants(payload()))
      .rejects.toThrow('標籤代碼已被使用')
  })
})
