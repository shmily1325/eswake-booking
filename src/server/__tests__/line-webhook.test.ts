import { createHmac } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())
vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

import handler from '../../../api/line-webhook'

const rpcMock = vi.fn()

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

function request(rawBody: string, signature?: string): VercelRequest {
  return {
    method: 'POST',
    headers: signature ? { 'x-line-signature': signature } : {},
    body: rawBody,
  } as VercelRequest
}

function sign(rawBody: string): string {
  return createHmac('sha256', 'channel-secret').update(rawBody).digest('base64')
}

describe('LINE webhook contact capture', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    process.env.LINE_CHANNEL_SECRET = 'channel-secret'
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'access-token'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role'
    createClientMock.mockReturnValue({ rpc: rpcMock })
    rpcMock.mockResolvedValue({ data: true, error: null })
  })

  it('rejects requests whose raw-body signature is invalid', async () => {
    const response = responseMock()
    await handler(request('{"events":[]}', 'invalid'), response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(401)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('stores identity metadata without storing message text', async () => {
    const rawBody = JSON.stringify({
      events: [{
        type: 'message',
        timestamp: 1_788_000_000_000,
        webhookEventId: 'event-1',
        source: { type: 'user', userId: 'U123' },
        message: { type: 'text', text: '芝麻開門 private content' },
      }],
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ displayName: 'Test User', pictureUrl: 'https://example.com/a.jpg' }),
    } as Response)
    const response = responseMock()

    await handler(request(rawBody, sign(rawBody)), response as unknown as VercelResponse)

    expect(rpcMock).toHaveBeenCalledWith('record_line_webhook_contact_event', expect.objectContaining({
      p_webhook_event_id: 'event-1',
      p_line_user_id: 'U123',
      p_event_type: 'message',
      p_display_name: 'Test User',
      p_friend_status: 'friend',
    }))
    expect(JSON.stringify(rpcMock.mock.calls[0])).not.toContain('private content')
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('marks unfollow events blocked without requesting a profile', async () => {
    const rawBody = JSON.stringify({
      events: [{
        type: 'unfollow',
        timestamp: 1_788_000_000_000,
        webhookEventId: 'event-2',
        source: { type: 'user', userId: 'U456' },
      }],
    })
    const lineFetch = vi.spyOn(globalThis, 'fetch')
    const response = responseMock()

    await handler(request(rawBody, sign(rawBody)), response as unknown as VercelResponse)

    expect(lineFetch).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith(
      'record_line_webhook_contact_event',
      expect.objectContaining({ p_friend_status: 'blocked' }),
    )
  })
})
