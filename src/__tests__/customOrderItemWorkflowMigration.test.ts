import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'migrations/235_custom_order_item_workflow.sql'), 'utf8')

describe('custom order item workflow migration', () => {
  it('stores confirmation and arrival on the exact order line', () => {
    expect(migration).toContain('custom_order_confirmed_at TIMESTAMPTZ')
    expect(migration).toContain('custom_order_arrived_at TIMESTAMPTZ')
    expect(migration).toContain("v_item.sale_mode_snapshot <> 'custom_order'")
  })

  it('locks confirmed specs until staff explicitly reopens them', () => {
    expect(migration).toContain('CREATE TRIGGER lock_confirmed_custom_order_item')
    expect(migration).toContain('NEW.selected_options IS DISTINCT FROM OLD.selected_options')
    expect(migration).toContain('客訂規格已確認，請先重新開放編輯')
  })

  it('reserves only the arrived custom item and sends it directly to pending payment', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.mark_custom_order_item_arrived')
    expect(migration).toContain('stock = stock + v_qty_open')
    expect(migration).toContain('reserved_qty = reserved_qty + v_qty_open')
    expect(migration).toContain('qty_pending_bill = qty_pending_bill + v_qty_open')
  })

  it('removes synthetic custom-order stock when arrival is cancelled or voided', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.adjust_custom_order_inventory_transition')
    expect(migration).toContain('GREATEST(0, OLD.qty_pending_bill - NEW.qty_pending_bill)')
    expect(migration).toContain('stock = stock - v_remove')
  })
})
