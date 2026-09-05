import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'migrations/215_atomic_product_variant_save.sql'),
  'utf8',
)

describe('atomic product save migration', () => {
  it('preflights SKU ownership and locks rows before mutation', () => {
    const preflight = migration.indexOf('-- Preflight and lock every existing SKU')
    const mutation = migration.indexOf('-- Mutation phase:')

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.save_product_with_variants(p_payload JSONB)',
    )
    expect(preflight).toBeGreaterThanOrEqual(0)
    expect(mutation).toBeGreaterThan(preflight)
    expect(migration.slice(preflight, mutation)).toContain('FOR UPDATE;')
    expect(migration.slice(preflight, mutation)).toContain(
      'v_existing_variant.product_id <> v_product_id',
    )
    expect(migration.slice(preflight, mutation)).not.toContain(
      'UPDATE public.product_variants',
    )
  })

  it('keeps product, SKU, and same-model size-chart writes in one RPC', () => {
    const mutation = migration.indexOf('-- Mutation phase:')
    const body = migration.slice(mutation)

    expect(body).toContain('INSERT INTO public.products')
    expect(body).toContain('UPDATE public.products')
    expect(body).toContain('UPDATE public.product_variants')
    expect(body).toContain('INSERT INTO public.product_variants')
    expect(body).toContain("'apply_size_chart_to_model'")
    expect(body).toContain('WHEN unique_violation THEN')
  })

  it('requires authenticated product-editor permission', () => {
    expect(migration).toContain("auth.role() <> 'authenticated'")
    expect(migration).toContain('editor.can_products = TRUE')
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.save_product_with_variants(JSONB)',
    )
  })
})
