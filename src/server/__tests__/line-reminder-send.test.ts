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
const rpcMock = vi.fn()
let queryResults: Record<string, QueryResult>
let queryBuilders: Record<string, ReturnType<typeof queryBuilder>>

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    not: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
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
  builder.is.mockReturnValue(builder)
  builder.not.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.maybeSingle.mockReturnValue(builder)
  builder.single.mockReturnValue(builder)
  builder.insert.mockReturnValue(builder)
  builder.update.mockReturnValue(builder)
  builder.upsert.mockReturnValue(builder)
  builder.delete.mockReturnValue(builder)
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
  const normalizedBody = body && typeof body === 'object' && Array.isArray((body as { recipients?: unknown }).recipients)
    ? {
        ...(body as Record<string, unknown>),
        recipients: ((body as { recipients: unknown[] }).recipients).map((value) => {
          if (!value || typeof value !== 'object') return value
          const recipient = value as Record<string, unknown>
          if (typeof recipient.memberId !== 'string' || recipient.recipientKey) return recipient
          return {
            ...recipient,
            recipientKey: `member:${recipient.memberId}`,
            contactName: recipient.memberId,
            bookingIds: [],
          }
        }),
      }
    : body
  return {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body: normalizedBody,
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
      rpc: rpcMock,
    })
    rpcMock.mockResolvedValue({ data: null, error: null })
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

  it('serves staff-only reminder contact lists through the existing API route', async () => {
    queryResults.line_webhook_contacts = {
      data: [{ line_user_id: 'U1', display_name: 'Guest' }],
      error: null,
    }
    queryResults.line_reminder_mappings = {
      data: [{ id: 'map-1', line_user_id: 'U1', contact_name: 'Guest' }],
      error: null,
    }
    const lineFetch = vi.spyOn(globalThis, 'fetch')
    const response = responseMock()

    await handler(request({ action: 'list' }), response as unknown as VercelResponse)

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith({
      contacts: [{ line_user_id: 'U1', display_name: 'Guest', formal_binding: null }],
      mappings: [{ id: 'map-1', line_user_id: 'U1', contact_name: 'Guest' }],
      guests: [],
    })
    expect(lineFetch).not.toHaveBeenCalled()
  })

  it('restricts reminder mapping mutations to configured managers', async () => {
    setUser('viewer@example.com')
    queryResults.view_users = { data: [{ email: 'viewer@example.com' }], error: null }
    const response = responseMock()

    await handler(
      request({ action: 'set_guest_active', guestId: 'guest-1', isActive: false }),
      response as unknown as VercelResponse,
    )

    expect(response.status).toHaveBeenCalledWith(403)
    expect(response.json).toHaveBeenCalledWith({
      error: 'LINE reminder manager permission required',
    })
    expect(fromMock).not.toHaveBeenCalledWith('line_reminder_guests')
  })

  it('does not let view-only staff change booking guest mappings', async () => {
    setUser('viewer@example.com')
    queryResults.view_users = { data: [{ email: 'viewer@example.com' }], error: null }
    queryResults.editor_users = { data: [], error: null }
    const response = responseMock()

    await handler(
      request({ action: 'sync_booking_guests', bookingId: 101, guests: [] }),
      response as unknown as VercelResponse,
    )

    expect(response.status).toHaveBeenCalledWith(403)
    expect(response.json).toHaveBeenCalledWith({
      error: 'Booking editor permission required',
    })
    expect(queryBuilders.editor_users.eq).toHaveBeenCalledWith('can_schedule', true)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('searches reusable non-members without exposing formally bound LINE accounts', async () => {
    queryResults.line_reminder_guests = {
      data: [
        {
          id: 'guest-1',
          line_user_id: 'U1',
          name: '吳穎',
          line_contact: { display_name: 'LINE 吳迪', friend_status: 'friend' },
        },
        {
          id: 'guest-2',
          line_user_id: 'U2',
          name: '吳小明',
          line_contact: { display_name: 'LINE 小明', friend_status: 'friend' },
        },
      ],
      error: null,
    }
    queryResults.line_bindings = {
      data: [{ line_user_id: 'U2' }],
      error: null,
    }
    const response = responseMock()

    await handler(
      request({ action: 'search_guests', query: '吳' }),
      response as unknown as VercelResponse,
    )

    expect(response.json).toHaveBeenCalledWith({
      guests: [
        {
          id: 'guest-1',
          line_user_id: 'U1',
          name: '吳穎',
          line_contact: { display_name: 'LINE 吳迪', friend_status: 'friend' },
        },
      ],
    })
  })

  it('creates an optional reusable non-member record', async () => {
    queryResults.line_webhook_contacts = {
      data: { line_user_id: 'U1', friend_status: 'friend' },
      error: null,
    }
    queryResults.line_bindings = { data: null, error: null }
    queryResults.line_reminder_guests = {
      data: {
        id: 'guest-1',
        line_user_id: 'U1',
        name: '吳穎',
        normalized_name: '吳穎',
        is_active: true,
      },
      error: null,
    }
    const response = responseMock()

    await handler(
      request({ action: 'save_guest', lineUserId: 'U1', name: '吳穎' }),
      response as unknown as VercelResponse,
    )

    expect(queryBuilders.line_reminder_guests.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        line_user_id: 'U1',
        name: '吳穎',
        normalized_name: '吳穎',
      }),
      { onConflict: 'line_user_id' },
    )
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('moves existing saved-guest booking mappings when its LINE account changes', async () => {
    queryResults.line_webhook_contacts = {
      data: { line_user_id: 'U2', friend_status: 'friend' },
      error: null,
    }
    queryResults.line_bindings = { data: null, error: null }
    queryResults.line_reminder_guests = {
      data: {
        id: 'guest-1',
        line_user_id: 'U2',
        name: '吳穎',
        normalized_name: '吳穎',
        is_active: true,
      },
      error: null,
    }
    queryResults.line_reminder_mappings = { data: null, error: null }
    const response = responseMock()

    await handler(
      request({
        action: 'save_guest',
        guestId: 'guest-1',
        lineUserId: 'U2',
        name: '吳穎',
      }),
      response as unknown as VercelResponse,
    )

    expect(queryBuilders.line_reminder_mappings.update).toHaveBeenCalledWith(
      expect.objectContaining({ line_user_id: 'U2' }),
    )
    expect(queryBuilders.line_reminder_mappings.eq).toHaveBeenCalledWith(
      'guest_id',
      'guest-1',
    )
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('loads multiple saved guests for one booking', async () => {
    queryResults.line_reminder_mappings = {
      data: [
        {
          contact_name: '吳穎',
          guest: { id: 'guest-1', line_user_id: 'U1', name: '吳穎', is_active: true },
        },
        {
          contact_name: '小安',
          guest: { id: 'guest-2', line_user_id: 'U2', name: '小安', is_active: true },
        },
      ],
      error: null,
    }
    const response = responseMock()

    await handler(
      request({ action: 'get_booking_guests', bookingId: 101 }),
      response as unknown as VercelResponse,
    )

    expect(response.json).toHaveBeenCalledWith({
      guests: [
        expect.objectContaining({ id: 'guest-1', booking_name: '吳穎' }),
        expect.objectContaining({ id: 'guest-2', booking_name: '小安' }),
      ],
    })
  })

  it('syncs multiple saved guests to the same booking', async () => {
    queryResults.bookings = {
      data: { id: 101, contact_name: '吳穎, 小安' },
      error: null,
    }
    queryResults.line_reminder_guests = {
      data: [
        {
          id: 'guest-1',
          line_user_id: 'U1',
          name: '吳穎',
          is_active: true,
          line_contact: { friend_status: 'friend' },
        },
        {
          id: 'guest-2',
          line_user_id: 'U2',
          name: '小安',
          is_active: true,
          line_contact: { friend_status: 'friend' },
        },
      ],
      error: null,
    }
    queryResults.line_reminder_mappings = { data: [], error: null }
    queryResults.line_bindings = { data: [], error: null }
    const response = responseMock()

    await handler(
      request({
        action: 'sync_booking_guests',
        bookingId: 101,
        guests: [
          { guestId: '00000000-0000-4000-8000-000000000001', contactName: '吳穎' },
          { guestId: '00000000-0000-4000-8000-000000000002', contactName: '小安' },
        ],
      }),
      response as unknown as VercelResponse,
    )

    expect(response.status).toHaveBeenCalledWith(200)
    expect(response.json).toHaveBeenCalledWith({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith('sync_line_reminder_booking_guests', {
      p_booking_id: 101,
      p_guests: [
        { guestId: '00000000-0000-4000-8000-000000000001', contactName: '吳穎' },
        { guestId: '00000000-0000-4000-8000-000000000002', contactName: '小安' },
      ],
      p_operator_email: 'callumbao1122@gmail.com',
    })
  })

  it('updates one named person without replacing another mapping on the booking', async () => {
    queryResults.line_webhook_contacts = {
      data: { line_user_id: 'U2', friend_status: 'friend' },
      error: null,
    }
    queryResults.line_bindings = { data: null, error: null }
    queryResults.bookings = {
      data: { id: 101, contact_name: '吳穎, 小安', contact_phone: null },
      error: null,
    }
    queryResults.line_reminder_mappings = {
      data: { id: 'mapping-for-small-an' },
      error: null,
    }
    const response = responseMock()

    await handler(
      request({
        action: 'upsert_mapping',
        lineUserId: 'U2',
        bookingId: 101,
        contactName: '小安',
      }),
      response as unknown as VercelResponse,
    )

    expect(queryBuilders.line_reminder_mappings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_id: 101,
        contact_name: '小安',
        normalized_name: '小安',
        guest_id: null,
      }),
    )
    expect(response.status).toHaveBeenCalledWith(200)
  })

  it('updates an existing manual member mapping by mapping ID', async () => {
    queryResults.line_webhook_contacts = {
      data: { line_user_id: 'U1', friend_status: 'friend' },
      error: null,
    }
    queryResults.line_bindings = { data: null, error: null }
    queryResults.line_reminder_mappings = {
      data: { id: 'mapping-1' },
      error: null,
    }
    const response = responseMock()

    await handler(
      request({
        action: 'upsert_mapping',
        mappingId: 'mapping-1',
        lineUserId: 'U1',
        memberId: 'member-2',
      }),
      response as unknown as VercelResponse,
    )

    expect(queryBuilders.line_reminder_mappings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        line_user_id: 'U1',
        member_id: 'member-2',
        booking_id: null,
        guest_id: null,
      }),
    )
    expect(queryBuilders.line_reminder_mappings.eq).toHaveBeenCalledWith('id', 'mapping-1')
    expect(response.status).toHaveBeenCalledWith(200)
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
        { recipientKey: 'member:member-1', memberId: 'member-1', ok: true },
        {
          recipientKey: 'member:member-without-push',
          memberId: 'member-without-push',
          ok: false,
          error: 'No verified push-capable LINE recipient',
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
        { recipientKey: 'member:member-1', memberId: 'member-1', ok: true },
        {
          recipientKey: 'member:member-2',
          memberId: 'member-2',
          ok: false,
          error: 'LINE API returned HTTP 429',
        },
      ],
    })
  })

  it('validates reminder-only mappings and merges recipients sharing one LINE account', async () => {
    queryResults.line_bindings = { data: [], error: null }
    queryResults.line_reminder_mappings = {
      data: [
        {
          id: 'mapping-1',
          line_user_id: 'shared-line-user',
          member_id: null,
          booking_id: 1,
          normalized_name: 'guest one',
          contact_phone: '0912345678',
          line_contact: { friend_status: 'friend' },
        },
        {
          id: 'mapping-2',
          line_user_id: 'shared-line-user',
          member_id: null,
          booking_id: 2,
          normalized_name: 'guest two',
          contact_phone: null,
          line_contact: { friend_status: 'friend' },
        },
      ],
      error: null,
    }
    const lineFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response)
    const response = responseMock()

    await handler(request({
      date: '2026-08-28',
      recipients: [
        {
          recipientKey: 'guest:Guest One',
          memberId: null,
          mappingId: 'mapping-1',
          contactName: 'Guest One',
          contactPhone: '0912345678',
          bookingIds: [1],
          message: 'First',
        },
        {
          recipientKey: 'guest:Guest Two',
          memberId: null,
          mappingId: 'mapping-2',
          contactName: 'Guest Two',
          bookingIds: [2],
          message: 'Second',
        },
      ],
    }), response as unknown as VercelResponse)

    expect(queryBuilders.line_reminder_mappings.in).toHaveBeenCalledWith(
      'id',
      ['mapping-1', 'mapping-2'],
    )
    expect(lineFetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(lineFetch.mock.calls[0][1]?.body))).toEqual({
      to: 'shared-line-user',
      messages: [{ type: 'text', text: 'First\n\n──────────\n\nSecond' }],
    })
    expect(response.json).toHaveBeenCalledWith({
      results: [
        { recipientKey: 'guest:Guest One', memberId: null, ok: true },
        { recipientKey: 'guest:Guest Two', memberId: null, ok: true },
      ],
    })
  })

  it('rejects a reminder mapping for a different name on the same booking', async () => {
    queryResults.line_bindings = { data: [], error: null }
    queryResults.line_reminder_mappings = {
      data: [{
        id: 'mapping-1',
        line_user_id: 'line-user-1',
        member_id: null,
        booking_id: 101,
        normalized_name: '吳穎',
        contact_phone: null,
        line_contact: { friend_status: 'friend' },
      }],
      error: null,
    }
    const lineFetch = vi.spyOn(globalThis, 'fetch')
    const response = responseMock()

    await handler(request({
      date: '2026-08-28',
      recipients: [{
        recipientKey: 'guest:小安:101',
        memberId: null,
        mappingId: 'mapping-1',
        contactName: '小安',
        bookingIds: [101],
        message: 'Reminder',
      }],
    }), response as unknown as VercelResponse)

    expect(lineFetch).not.toHaveBeenCalled()
    expect(response.json).toHaveBeenCalledWith({
      results: [{
        recipientKey: 'guest:小安:101',
        memberId: null,
        ok: false,
        error: 'No verified push-capable LINE recipient',
      }],
    })
  })

  it('rejects reminder-only mappings after the LINE account formally binds', async () => {
    queryResults.line_bindings = {
      data: [{ line_user_id: 'line-user-1' }],
      error: null,
    }
    queryResults.line_reminder_mappings = {
      data: [{
        id: 'mapping-1',
        line_user_id: 'line-user-1',
        member_id: null,
        booking_id: 101,
        normalized_name: '吳穎',
        contact_phone: null,
        line_contact: { friend_status: 'friend' },
      }],
      error: null,
    }
    const lineFetch = vi.spyOn(globalThis, 'fetch')
    const response = responseMock()

    await handler(request({
      date: '2026-08-28',
      recipients: [{
        recipientKey: 'guest:吳穎:101',
        memberId: null,
        mappingId: 'mapping-1',
        contactName: '吳穎',
        bookingIds: [101],
        message: 'Reminder',
      }],
    }), response as unknown as VercelResponse)

    expect(lineFetch).not.toHaveBeenCalled()
    expect(response.json).toHaveBeenCalledWith({
      results: [{
        recipientKey: 'guest:吳穎:101',
        memberId: null,
        ok: false,
        error: 'No verified push-capable LINE recipient',
      }],
    })
  })
})
