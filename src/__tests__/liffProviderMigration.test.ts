import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/192_migrate_liff_provider_binding.sql'),
  'utf8',
)
const api = readFileSync(
  resolve(process.cwd(), 'api/liff-member-access.ts'),
  'utf8',
)

describe('LIFF provider migration', () => {
  it('records the source channel and push capability', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS source_channel_id TEXT')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS can_push BOOLEAN NOT NULL DEFAULT FALSE')
    expect(migration).toContain('p_source_channel_id TEXT')
    expect(migration).toContain('p_can_push BOOLEAN DEFAULT FALSE')
  })

  it('deactivates the previous provider binding before activating the new one', () => {
    expect(migration).toMatch(
      /UPDATE public\.line_bindings\s+SET status = 'inactive'\s+WHERE member_id = v_member_id\s+AND line_user_id <> p_line_user_id\s+AND status = 'active';/,
    )
    expect(migration).toContain('ON CONFLICT (line_user_id) DO UPDATE')
    expect(migration.indexOf("SET status = 'inactive'")).toBeLessThan(
      migration.indexOf('INSERT INTO public.line_bindings'),
    )
  })

  it('keeps the existing phone and birthday registration behavior', () => {
    expect(migration).toContain(
      "regexp_replace(COALESCE(m.phone, ''), '[^0-9]', '', 'g') = v_clean_phone",
    )
    expect(migration).toMatch(
      /UPDATE public\.members\s+SET birthday = to_char\(p_birthday, 'YYYY-MM-DD'\)\s+WHERE id = v_member_id;/,
    )
  })

  it('verifies the LIFF access token channel before using its identity', () => {
    expect(api).toContain("'https://api.line.me/oauth2/v2.1/verify'")
    expect(api).toContain('verification.client_id')
    expect(api).toContain('configuredLiffChannelIds()')
    expect(api).toContain('allowedChannelIds.has(channelId)')
    expect(api).toContain("'https://api.line.me/v2/profile'")
  })

  it('only marks explicitly configured provider channels as push-capable', () => {
    expect(api).toContain('process.env.LINE_PUSH_LIFF_CHANNEL_IDS')
    expect(api).toContain('canPush: pushCapableLiffChannelIds().has(channelId)')
    expect(api).toContain('p_source_channel_id: lineIdentity.channelId')
    expect(api).toContain('p_can_push: lineIdentity.canPush')
  })
})
