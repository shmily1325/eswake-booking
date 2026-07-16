import type { VercelRequest } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeBackupRequest } from '../backup-auth.js'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

function request(method: string, token?: string): VercelRequest {
  return {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  } as VercelRequest
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.CRON_SECRET
  delete process.env.VITE_SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

describe('authorizeBackupRequest', () => {
  it('rejects automated GET requests without the cron secret', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    await expect(authorizeBackupRequest(request('GET'))).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('rejects an incorrect cron secret', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    await expect(authorizeBackupRequest(request('GET', 'wrong-secret'))).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('accepts the configured cron secret', async () => {
    process.env.CRON_SECRET = 'expected-secret'
    await expect(authorizeBackupRequest(request('GET', 'expected-secret'))).resolves.toEqual({
      ok: true,
    })
  })

  it('rejects manual requests without a signed-in user', async () => {
    await expect(authorizeBackupRequest(request('POST'))).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
  })

  it('rejects a signed-in non-admin', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'staff@example.com' } },
          error: null,
        }),
      },
    } as never)

    await expect(authorizeBackupRequest(request('POST', 'user-token'))).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
  })

  it('accepts a signed-in super admin', async () => {
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'minlin1325@gmail.com' } },
          error: null,
        }),
      },
    } as never)

    await expect(authorizeBackupRequest(request('POST', 'user-token'))).resolves.toEqual({
      ok: true,
    })
  })
})
