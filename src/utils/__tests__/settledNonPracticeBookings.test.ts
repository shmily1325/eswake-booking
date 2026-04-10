import { describe, it, expect } from 'vitest'
import { isDirectSettlementParticipantNotes } from '../settledNonPracticeBookings'

describe('isDirectSettlementParticipantNotes', () => {
  it('辨識現金結清備註', () => {
    expect(isDirectSettlementParticipantNotes('something [現金結清]')).toBe(true)
  })
  it('辨識匯款結清備註', () => {
    expect(isDirectSettlementParticipantNotes('[匯款結清]')).toBe(true)
  })
  it('辨識指定課不收費', () => {
    expect(isDirectSettlementParticipantNotes('x [指定課不收費]')).toBe(true)
  })
  it('辨識泛用結清', () => {
    expect(isDirectSettlementParticipantNotes('[結清]')).toBe(true)
  })
  it('空或無標記為 false', () => {
    expect(isDirectSettlementParticipantNotes(null)).toBe(false)
    expect(isDirectSettlementParticipantNotes('')).toBe(false)
    expect(isDirectSettlementParticipantNotes('一般備註')).toBe(false)
  })
})
