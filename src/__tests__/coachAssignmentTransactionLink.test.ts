import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/coach/CoachAssignment.tsx'),
  'utf8',
)

describe('CoachAssignment transaction warning', () => {
  it('checks transactions through booking_participant_id', () => {
    expect(source).toContain(".in('booking_participant_id', participantIds)")
    expect(source).toContain('t.booking_participant_id')
    expect(source).not.toContain(".in('participant_id', participantIds)")
  })
})
