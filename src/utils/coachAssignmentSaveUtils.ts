export type AssignmentSnapshot = {
  coachIds: string[]
  driverIds: string[]
  notes: string
  requiresDriver: boolean
}

export type CoachRef = { id: string; name: string }

export type PendingAssignmentChange = {
  bookingId: number
  baseline: AssignmentSnapshot
  userIntent: AssignmentSnapshot
  changes: string[]
}

export type DbAssignmentMaps = {
  coaches: Map<number, string[]>
  drivers: Map<number, string[]>
  bookings: Map<number, { schedule_notes: string | null; requires_driver: boolean | null }>
}

export function sortedIdsKey(ids: string[]): string {
  return [...ids].sort().join(',')
}

export function assignmentSnapshotKey(s: AssignmentSnapshot): string {
  return [
    sortedIdsKey(s.coachIds),
    sortedIdsKey(s.driverIds),
    s.notes || '',
    s.requiresDriver ? '1' : '0',
  ].join('|')
}

export function normalizeRequiresDriver(value: boolean | null | undefined): boolean {
  return value === true
}

export function computeAssignmentChanges(
  from: AssignmentSnapshot,
  to: AssignmentSnapshot,
  coaches: CoachRef[]
): string[] {
  const changes: string[] = []

  if (sortedIdsKey(from.coachIds) !== sortedIdsKey(to.coachIds)) {
    const oldCoachNames = from.coachIds
      .map(id => coaches.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、')
    const newCoachNames = to.coachIds
      .map(id => coaches.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、')
    changes.push(`教練：${oldCoachNames || '無'} → ${newCoachNames || '無'}`)
  }

  if (sortedIdsKey(from.driverIds) !== sortedIdsKey(to.driverIds)) {
    const oldDriverNames = from.driverIds
      .map(id => coaches.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、')
    const newDriverNames = to.driverIds
      .map(id => coaches.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join('、')
    changes.push(`駕駛：${oldDriverNames || '無'} → ${newDriverNames || '無'}`)
  }

  if (from.notes !== to.notes) {
    changes.push(`排班註解：${from.notes || '無'} → ${to.notes || '無'}`)
  }

  if (from.requiresDriver !== to.requiresDriver) {
    changes.push(`需要駕駛：${from.requiresDriver ? '是' : '否'} → ${to.requiresDriver ? '是' : '否'}`)
  }

  return changes
}

export function describeSnapshotSummary(snapshot: AssignmentSnapshot, coaches: CoachRef[]): string {
  const coachNames = snapshot.coachIds
    .map(id => coaches.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join('、')
  const driverNames = snapshot.driverIds
    .map(id => coaches.find(c => c.id === id)?.name)
    .filter(Boolean)
    .join('、')
  const parts = [`教練 ${coachNames || '無'}`, `駕駛 ${driverNames || '無'}`]
  if (snapshot.notes) {
    parts.push(`排班註解 ${snapshot.notes}`)
  }
  return parts.join('、')
}

export function getDbSnapshot(bookingId: number, db: DbAssignmentMaps): AssignmentSnapshot {
  const bookingRow = db.bookings.get(bookingId)
  return {
    coachIds: db.coaches.get(bookingId) || [],
    driverIds: db.drivers.get(bookingId) || [],
    notes: bookingRow?.schedule_notes || '',
    requiresDriver: normalizeRequiresDriver(bookingRow?.requires_driver),
  }
}

export type ConcurrentSaveResolution = {
  toSave: PendingAssignmentChange[]
  silentSkips: Array<{ bookingId: number; dbState: AssignmentSnapshot }>
  overwriteConflicts: PendingAssignmentChange[]
}

export function resolveConcurrentAssignmentChanges(
  pending: PendingAssignmentChange[],
  db: DbAssignmentMaps,
  coaches: CoachRef[]
): ConcurrentSaveResolution {
  const toSave: PendingAssignmentChange[] = []
  const silentSkips: Array<{ bookingId: number; dbState: AssignmentSnapshot }> = []
  const overwriteConflicts: PendingAssignmentChange[] = []

  for (const item of pending) {
    const dbState = getDbSnapshot(item.bookingId, db)
    const externallyModified = assignmentSnapshotKey(item.baseline) !== assignmentSnapshotKey(dbState)

    if (!externallyModified) {
      toSave.push(item)
      continue
    }

    if (assignmentSnapshotKey(item.userIntent) === assignmentSnapshotKey(dbState)) {
      silentSkips.push({ bookingId: item.bookingId, dbState })
      continue
    }

    overwriteConflicts.push({
      ...item,
      changes: computeAssignmentChanges(dbState, item.userIntent, coaches),
    })
  }

  return { toSave, silentSkips, overwriteConflicts }
}
