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
    process.env.VITE_LIFF_ID = '2008652154-legacy-app'
    delete process.env.VITE_LIFF_MIGRATION_ID
    delete process.env.LINE_LIFF_ALLOWED_CHANNEL_IDS
    delete process.env.LINE_PUSH_LIFF_CHANNEL_IDS
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
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ client_id: '2008652154', expires_in: 3600, scope: 'profile' }),
      } as Response)
      .mockResolvedValueOnce({
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
    const lineFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ client_id: '2008652154', expires_in: 3600, scope: 'profile' }),
      } as Response)
      .mockResolvedValueOnce({
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

    expect(lineFetch).toHaveBeenCalledTimes(2)
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

  it('rejects a valid LINE token issued for an unconfigured channel', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ client_id: '9999999999', expires_in: 3600, scope: 'profile' }),
    } as Response)
    const response = responseMock()
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer other-channel-token' },
      body: { action: 'profile' },
    } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('marks a binding push-capable only for an explicitly configured channel', async () => {
    process.env.VITE_LIFF_MIGRATION_ID = '1656777386-new-app'
    process.env.LINE_PUSH_LIFF_CHANNEL_IDS = '1656777386'
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ client_id: '1656777386', expires_in: 3600, scope: 'profile openid' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 'new-provider-user' }),
      } as Response)
    rpcMock.mockResolvedValue({
      data: { success: true, member: { id: 'member-1' } },
      error: null,
    })
    const response = responseMock()
    const req = {
      method: 'POST',
      headers: { authorization: 'Bearer new-provider-token' },
      body: {
        action: 'bind',
        phone: '0912345678',
        birthday: '1990-01-01',
      },
    } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(rpcMock).toHaveBeenCalledWith('bind_liff_member', {
      p_line_user_id: 'new-provider-user',
      p_phone: '0912345678',
      p_birthday: '1990-01-01',
      p_source_channel_id: '1656777386',
      p_can_push: true,
    })
    expect(response.status).toHaveBeenCalledWith(200)
  })
})
