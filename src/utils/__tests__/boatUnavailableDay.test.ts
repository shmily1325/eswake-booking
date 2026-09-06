import { describe, expect, it } from 'vitest'
import {
  getMaintenanceAnnouncementsForDate,
  mergeOverlappingMaintenanceAnnouncements,
  type BoatMaintenanceAnnouncement,
} from '../boatUnavailableDay'

const maintenance = (
  overrides: Partial<BoatMaintenanceAnnouncement> = {}
): BoatMaintenanceAnnouncement => ({
  boatId: 1,
  boatName: 'G21',
  reason: '維修保養',
  startDate: '2026-09-05',
  startTime: null,
  endDate: '2026-09-06',
  endTime: null,
  ...overrides,
})

describe('mergeOverlappingMaintenanceAnnouncements', () => {
  it('同船重疊區間合併成一條時間軸', () => {
    const result = mergeOverlappingMaintenanceAnnouncements([
      maintenance(),
      maintenance({
        startDate: '2026-09-06',
        endDate: '2026-09-08',
      }),
    ])

    expect(result).toEqual([
      maintenance({
        startDate: '2026-09-05',
        endDate: '2026-09-08',
      }),
    ])
  })

  it('不同原因去重後保留在合併公告', () => {
    const result = mergeOverlappingMaintenanceAnnouncements([
      maintenance({ reason: '換油' }),
      maintenance({
        reason: '測試',
        startDate: '2026-09-06',
        endDate: '2026-09-08',
      }),
    ])

    expect(result[0].reason).toBe('換油、測試')
  })

  it('同船未重疊時維持兩條', () => {
    const result = mergeOverlappingMaintenanceAnnouncements([
      maintenance({ endDate: '2026-09-05' }),
      maintenance({
        startDate: '2026-09-06',
        endDate: '2026-09-08',
      }),
    ])

    expect(result).toHaveLength(2)
  })

  it('不同船即使重疊也不合併', () => {
    const result = mergeOverlappingMaintenanceAnnouncements([
      maintenance(),
      maintenance({ boatId: 2, boatName: '粉紅' }),
    ])

    expect(result).toHaveLength(2)
  })

  it('先合併完整區間，再篩選指定日期仍有效的公告', () => {
    const result = getMaintenanceAnnouncementsForDate([
      maintenance(),
      maintenance({
        startDate: '2026-09-06',
        endDate: '2026-09-08',
      }),
      maintenance({
        startDate: '2026-08-01',
        endDate: '2026-08-02',
      }),
    ], '2026-09-07')

    expect(result).toEqual([
      maintenance({
        startDate: '2026-09-05',
        endDate: '2026-09-08',
      }),
    ])
  })
})
