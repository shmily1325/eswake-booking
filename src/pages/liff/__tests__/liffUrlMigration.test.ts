import { describe, expect, it } from 'vitest'
import { resolveRuntimeLiffId } from '../liffUrl'

describe('resolveRuntimeLiffId', () => {
  const legacy = '2008652154-legacyApp'
  const migration = '1656777386-newApp'

  it('keeps the primary LIFF when no migration ID is configured', () => {
    expect(resolveRuntimeLiffId(legacy, undefined, '?liffClientId=2008652154')).toBe(legacy)
  })

  it('selects the migration LIFF for its LINE client ID', () => {
    expect(resolveRuntimeLiffId(legacy, migration, '?liffClientId=1656777386')).toBe(migration)
  })

  it('keeps the legacy LIFF for the legacy LINE client ID', () => {
    expect(resolveRuntimeLiffId(legacy, migration, '?liffClientId=2008652154')).toBe(legacy)
  })

  it('defaults to the primary LIFF outside the LINE redirect', () => {
    expect(resolveRuntimeLiffId(legacy, migration, '')).toBe(legacy)
  })

  it('does not trust an unknown LINE client ID', () => {
    expect(resolveRuntimeLiffId(legacy, migration, '?liffClientId=9999999999')).toBe(legacy)
  })
})
