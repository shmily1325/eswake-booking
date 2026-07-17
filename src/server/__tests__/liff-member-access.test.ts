import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const rpcMock = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: rpcMock }),
}))

import handler from '../../../api/liff-member-access'

function responseMock() {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response
}

describe('LIFF member access API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    rpcMock.mockReset()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  it('rejects requests without a valid LINE access token', async () => {
    const response = responseMock()
    const req = {
      method: 'POST',
      headers: {},
      body: { action: 'profile' },
    } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('derives the RPC identity from LINE instead of request data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'verified-line-user' }),
    } as Response)
    rpcMock.mockResolvedValue({
      data: { success: true, member: null },
      error: null,
    })
    const response = responseMock()
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: {
        action: 'profile',
        lineUserId: 'attacker-supplied-user',
        recordLogin: true,
      },
    } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(rpcMock).toHaveBeenCalledWith('get_liff_member_profile', {
      p_line_user_id: 'verified-line-user',
      p_record_login: true,
    })
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('loads member and orders with one LINE verification', async () => {
    const lineFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ userId: 'verified-line-user' }),
    } as Response)
    rpcMock
      .mockResolvedValueOnce({
        data: { success: true, member: { id: 'member-1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, orders: [{ id: 'order-1' }] },
        error: null,
      })
    const response = responseMock()
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { action: 'bootstrap' },
    } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(lineFetch).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenNthCalledWith(1, 'get_liff_member_profile', {
      p_line_user_id: 'verified-line-user',
      p_record_login: true,
    })
    expect(rpcMock).toHaveBeenNthCalledWith(2, 'get_liff_shop_orders', {
      p_line_user_id: 'verified-line-user',
    })
    expect(response.json).toHaveBeenCalledWith({
      success: true,
      member: { id: 'member-1' },
      orders: [{ id: 'order-1' }],
    })
  })
})
