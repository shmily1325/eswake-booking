import { describe, expect, it } from 'vitest'
import { buildSalespersonGroups } from '../ProductSalesStatistics'

describe('buildSalespersonGroups', () => {
  it('groups settled product amounts by salesperson and keeps unassigned separate', () => {
    const settlements = [
      {
        id: 's1',
        amount_total: 900,
        settled_at: '2026-09-15T10:00:00+08:00',
        items_snapshot: [
          { item_id: 'i1', qty: 1, line_total: 600 },
          { item_id: 'i2', qty: 2, line_total: 400 },
        ],
        order: { order_no: 'SO-1', contact_name: '客人', cancelled_at: null },
      },
    ]
    const itemMeta = new Map([
      ['i1', {
        salespersonCoachId: 'coach-1',
        salespersonName: 'Papa',
        productName: '商品 A',
      }],
      ['i2', {
        salespersonCoachId: null,
        salespersonName: '未指定',
        productName: '商品 B',
      }],
    ])

    const groups = buildSalespersonGroups(settlements, itemMeta)

    expect(groups).toHaveLength(2)
    expect(groups.find((group) => group.id === 'coach-1')).toMatchObject({
      name: 'Papa',
      qty: 1,
      total: 540,
    })
    expect(groups.find((group) => group.id === 'unassigned')).toMatchObject({
      qty: 2,
      total: 360,
    })
  })

  it('limits a coach personal report to that coach', () => {
    const settlements = [
      {
        id: 's1',
        amount_total: 1000,
        settled_at: '2026-09-15T10:00:00+08:00',
        items_snapshot: [
          { item_id: 'i1', qty: 1, line_total: 600 },
          { item_id: 'i2', qty: 1, line_total: 400 },
        ],
        order: { order_no: 'SO-1', contact_name: '客人', cancelled_at: null },
      },
    ]
    const itemMeta = new Map([
      ['i1', { salespersonCoachId: 'coach-1', salespersonName: 'Papa', productName: 'A' }],
      ['i2', { salespersonCoachId: 'coach-2', salespersonName: 'Sky', productName: 'B' }],
    ])

    expect(buildSalespersonGroups(settlements, itemMeta, 'coach-2')).toMatchObject([
      { id: 'coach-2', name: 'Sky', qty: 1, total: 400 },
    ])
  })
})
