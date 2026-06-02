import { describe, expect, it } from 'vitest'
import {
  assignmentSnapshotKey,
  computeAssignmentChanges,
  getDbSnapshot,
  normalizeRequiresDriver,
  resolveConcurrentAssignmentChanges,
  type AssignmentSnapshot,
  type DbAssignmentMaps,
} from '../coachAssignmentSaveUtils'

const coaches = [
  { id: 'coach-a', name: 'PAPA' },
  { id: 'coach-b', name: 'Kevin' },
  { id: 'coach-c', name: 'Casper' },
]

function emptyDb(): DbAssignmentMaps {
  return {
    coaches: new Map(),
    drivers: new Map(),
    bookings: new Map(),
  }
}

function snapshot(overrides: Partial<AssignmentSnapshot> = {}): AssignmentSnapshot {
  return {
    coachIds: [],
    driverIds: [],
    notes: '',
    requiresDriver: false,
    ...overrides,
  }
}

describe('coachAssignmentSaveUtils', () => {
  describe('normalizeRequiresDriver', () => {
    it('只有 true 才算需要駕駛', () => {
      expect(normalizeRequiresDriver(true)).toBe(true)
      expect(normalizeRequiresDriver(false)).toBe(false)
      expect(normalizeRequiresDriver(null)).toBe(false)
      expect(normalizeRequiresDriver(undefined)).toBe(false)
    })
  })

  describe('assignmentSnapshotKey', () => {
    it('教練與駕駛順序不同仍視為相同', () => {
      const a = snapshot({ coachIds: ['coach-b', 'coach-a'], driverIds: ['coach-c'] })
      const b = snapshot({ coachIds: ['coach-a', 'coach-b'], driverIds: ['coach-c'] })
      expect(assignmentSnapshotKey(a)).toBe(assignmentSnapshotKey(b))
    })
  })

  describe('computeAssignmentChanges', () => {
    it('應正確描述駕駛變更', () => {
      const changes = computeAssignmentChanges(
        snapshot(),
        snapshot({ driverIds: ['coach-b'] }),
        coaches
      )
      expect(changes).toEqual(['駕駛：無 → Kevin'])
    })

    it('覆蓋他人修改時應以 DB 現況為舊值', () => {
      const changes = computeAssignmentChanges(
        snapshot({ driverIds: ['coach-b'] }),
        snapshot({ driverIds: ['coach-c'] }),
        coaches
      )
      expect(changes).toEqual(['駕駛：Kevin → Casper'])
    })
  })

  describe('getDbSnapshot', () => {
    it('requires_driver 為 null 時應視為 false', () => {
      const db = emptyDb()
      db.bookings.set(1, { schedule_notes: null, requires_driver: null })
      expect(getDbSnapshot(1, db).requiresDriver).toBe(false)
    })
  })

  describe('resolveConcurrentAssignmentChanges', () => {
    it('無外部修改時全部進 toSave', () => {
      const pending = [{
        bookingId: 1,
        baseline: snapshot(),
        userIntent: snapshot({ driverIds: ['coach-b'] }),
        changes: ['駕駛：無 → Kevin'],
      }]
      const db = emptyDb()
      db.bookings.set(1, { schedule_notes: null, requires_driver: false })

      const result = resolveConcurrentAssignmentChanges(pending, db, coaches)
      expect(result.toSave).toHaveLength(1)
      expect(result.silentSkips).toHaveLength(0)
      expect(result.overwriteConflicts).toHaveLength(0)
    })

    it('他人已存相同結果時應 silent skip', () => {
      const pending = [{
        bookingId: 1,
        baseline: snapshot(),
        userIntent: snapshot({ driverIds: ['coach-b'] }),
        changes: ['駕駛：無 → Kevin'],
      }]
      const db = emptyDb()
      db.drivers.set(1, ['coach-b'])
      db.bookings.set(1, { schedule_notes: null, requires_driver: false })

      const result = resolveConcurrentAssignmentChanges(pending, db, coaches)
      expect(result.toSave).toHaveLength(0)
      expect(result.silentSkips).toHaveLength(1)
      expect(result.overwriteConflicts).toHaveLength(0)
    })

    it('他人已存不同結果時應標記 overwrite conflict', () => {
      const pending = [{
        bookingId: 1,
        baseline: snapshot(),
        userIntent: snapshot({ driverIds: ['coach-c'] }),
        changes: ['駕駛：無 → Casper'],
      }]
      const db = emptyDb()
      db.drivers.set(1, ['coach-b'])
      db.bookings.set(1, { schedule_notes: null, requires_driver: false })

      const result = resolveConcurrentAssignmentChanges(pending, db, coaches)
      expect(result.toSave).toHaveLength(0)
      expect(result.silentSkips).toHaveLength(0)
      expect(result.overwriteConflicts).toHaveLength(1)
      expect(result.overwriteConflicts[0].changes).toEqual(['駕駛：Kevin → Casper'])
    })

    it('requires_driver null 與 false 不應誤判為外部修改', () => {
      const pending = [{
        bookingId: 1,
        baseline: snapshot({ requiresDriver: false }),
        userIntent: snapshot({ driverIds: ['coach-b'], requiresDriver: false }),
        changes: ['駕駛：無 → Kevin'],
      }]
      const db = emptyDb()
      db.drivers.set(1, ['coach-b'])
      db.bookings.set(1, { schedule_notes: null, requires_driver: null })

      const result = resolveConcurrentAssignmentChanges(pending, db, coaches)
      expect(result.silentSkips).toHaveLength(1)
      expect(result.overwriteConflicts).toHaveLength(0)
    })

    it('混合情境：一部份 silent skip、一部份正常儲存', () => {
      const pending = [
        {
          bookingId: 1,
          baseline: snapshot(),
          userIntent: snapshot({ driverIds: ['coach-b'] }),
          changes: ['駕駛：無 → Kevin'],
        },
        {
          bookingId: 2,
          baseline: snapshot(),
          userIntent: snapshot({ driverIds: ['coach-c'] }),
          changes: ['駕駛：無 → Casper'],
        },
      ]
      const db = emptyDb()
      db.drivers.set(1, ['coach-b'])
      db.bookings.set(1, { schedule_notes: null, requires_driver: false })
      db.bookings.set(2, { schedule_notes: null, requires_driver: false })

      const result = resolveConcurrentAssignmentChanges(pending, db, coaches)
      expect(result.silentSkips).toHaveLength(1)
      expect(result.silentSkips[0].bookingId).toBe(1)
      expect(result.toSave).toHaveLength(1)
      expect(result.toSave[0].bookingId).toBe(2)
    })
  })
})
