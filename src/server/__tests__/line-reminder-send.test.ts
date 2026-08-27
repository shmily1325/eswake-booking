import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

import handler from '../../../api/line-reminder-send'

type QueryResult = {
  data: unknown
  error: { message: string } | null
}

const getUserMock = vi.fn()
const fromMock = vi.fn()
let queryResults: Record<string, QueryResult>
let queryBuilders: Record<string, ReturnType<typeof queryBuilder>>

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  }
  builder.select.mockReturnValue(builder)
  builder.ilike.mockReturnValue(builder)
  builder.limit.mockReturnValue(builder)
  builder.in.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  return builder
}

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

function request(
  body: unknown = {
    date: '2026-08-28',
    recipients: [{ memberId: 'member-1', message: 'Reminder' }],
  },
  authorization = 'Bearer valid-jwt',
) {
  return {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body,
  } as VercelRequest
}

function setUser(email = 'callumbao1122@gmail.com', id = 'operator-id') {
  getUserMock.mockResolvedValue({
    data: { user: { id, email } },
    error: null,
  })
}

describe('manual LINE reminder send API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-channel-token'

    queryResults = {
      editor_users: { data: [], error: null },
      view_users: { data: [], error: null },
      line_bindings: {
        data: [{ member_id: 'member-1', line_user_id: 'server-line-user-1' }],
        error: null,
      },
    }
    queryBuilders = {}
    fromMock.mockImplementation((table: string) => {
      const builder = queryBuilder(queryResults[table] ?? { data: [], error: null })
      queryBuilders[table] = builder
      return builder
    })
    createClientMock.mockReturnValue({
      auth: { getUser: getUserMock },
      from: fromMock,
    })
    setUser()
  })

  it('accepts POST only', async () => {
    const response = responseMock()
    const req = { method: 'GET', headers: {} } as VercelRequest

    await handler(req, response as unknown as VercelResponse)

    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'POST')
    expect(response.status).toHaveBeenCalledWith(405)
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('requires and verifies a bearer Supabase JWT', async () => {
    const missingResponse = responseMock()
    await handler(request(undefined, ''), missingResponse as unknown as VercelResponse)

    expect(missingResponse.status).toHaveBeenCalledWith(401)
    expect(getUserMock).not.toHaveBeenCalled()

    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid token' },
    })
    const invalidResponse = responseMock()
    await handler(request(), invalidResponse as unknown as VercelResponse)

    expect(getUserMock).toHaveBeenCalledWith('valid-jwt')
    expect(invalidResponse.status).toHaveBeenCalledWith(401)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('allows configured permission-table users and rejects other users', async () => {
    setUser('viewer@example.com')
    queryResults.view_users = { data: [{ email: 'viewer@example.com' }], error: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200 } as Response)
    const allowedResponse = responseMock()

    await handler(request(), allowedResponse as unknown as VercelResponse)

    expect(queryBuilders.editor_users.eq).toHaveBeenCalledWith('email', 'viewer@example.com')
    expect(queryBuilders.view_users.eq).toHaveBeenCalledWith('email', 'viewer@example.com')
    expect(allowedResponse.status).toHaveBeenCalledWith(200)

    vi.clearAllMocks()
    setUser('outsider@example.com')
    queryResults.view_users = { data: [], error: null }
    const deniedResponse = responseMock()
    await handler(request(), deniedResponse as unknown as VercelResponse)

    expect(deniedResponse.status).toHaveBeenCalledWith(403)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it.each([
    [
      'duplicate member IDs',
      {
        date: '2026-08-28',
        recipients: [
          { memberId: 'member-1', message: 'One' },
          { memberId: 'member-1', message: 'Two' },
        ],
      },
    ],
    [
      'over 100 recipients',
      {
        date: '2026-08-28',
        recipients: Array.from({ length: 101 }, (_, index) => ({
          memberId: `member-${index}`,
          message: 'Reminder',
        })),
      },
    ],
    [
      'an empty message',
      {
        date: '2026-08-28',
        recipients: [{ memberId: 'member-1', message: '   ' }],
      },
    ],
    [
      'an oversized message',
      {
        date: '2026-08-28',
        recipients: [{ memberId: 'member-1', message: 'x'.repeat(5_001) }],
      },
    ],
    [
      'an invalid calendar date',
      {
        date: '2026-02-30',
        recipients: [{ memberId: 'member-1', message: 'Reminder' }],
      },
    ],
  ])('rejects %s', async (_label, body) => {
    const response = responseMock()

    await handler(request(body), response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(400)
    expect(fromMock).not.toHaveBeenCalledWith('line_bindings')
  })

  it('queries only active push-capable bindings and never trusts a client LINE user ID', async () => {
    queryResults.line_bindings = {
      data: [{ member_id: 'member-1', line_user_id: 'server-line-user-1' }],
      error: null,
    }
    const lineFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)
    const response = responseMock()
    const body = {
      date: '2026-08-28',
      recipients: [
        {
          memberId: 'member-1',
          message: 'First reminder',
          line_user_id: 'attacker-controlled-line-user',
        },
        { memberId: 'member-without-push', message: 'Second reminder' },
      ],
    }

    await handler(request(body), response as unknown as VercelResponse)

    expect(queryBuilders.line_bindings.in).toHaveBeenCalledWith(
      'member_id',
      ['member-1', 'member-without-push'],
    )
    expect(queryBuilders.line_bindings.eq).toHaveBeenCalledWith('status', 'active')
    expect(queryBuilders.line_bindings.eq).toHaveBeenCalledWith('can_push', true)
    expect(lineFetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(lineFetch.mock.calls[0][1]?.body))).toEqual({
      to: 'server-line-user-1',
      messages: [{ type: 'text', text: 'First reminder' }],
    })
    expect(response.json).toHaveBeenCalledWith({
      results: [
        { memberId: 'member-1', ok: true },
        {
          memberId: 'member-without-push',
          ok: false,
          error: 'No active push-capable LINE binding',
        },
      ],
    })
  })

  it('returns LINE partial failures', async () => {
    setUser('editor@example.com', 'editor-user-id')
    queryResults.editor_users = { data: [{ email: 'editor@example.com' }], error: null }
    queryResults.line_bindings = {
      data: [
        { member_id: 'member-1', line_user_id: 'line-user-1' },
        { member_id: 'member-2', line_user_id: 'line-user-2' },
      ],
      error: null,
    }
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
    const response = responseMock()
    const body = {
      date: '2026-08-28',
      recipients: [
        { memberId: 'member-1', message: 'Secret first message' },
        { memberId: 'member-2', message: 'Secret second message' },
      ],
    }

    await handler(request(body), response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith({
      results: [
        { memberId: 'member-1', ok: true },
        { memberId: 'member-2', ok: false, error: 'LINE API returned HTTP 429' },
      ],
    })
  })
})
