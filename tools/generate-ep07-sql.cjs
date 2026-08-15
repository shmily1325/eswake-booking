/**
 * Generate Follow EP07 2027 pre-order seed SQL.
 * One product card per color; model name does NOT include color.
 * price NULL, stock 0, availability pre_order.
 */
const fs = require('fs')
const path = require('path')

const YEAR = 2027
const BRAND = 'Follow'

const MENS_VEST = ['TEEN', 'S', 'M', 'L', 'XL']
const ASSET_VEST = ['S', 'M', 'L', 'XL']
const LADIES_UK = ['4', '6', '8', '8DD', '10']
const LADIES_LETTER = ['XS', 'S', 'M', 'MDD', 'L']
const CGA_MENS = ['S', 'M', 'L', 'XL']
const CGA_LADIES = ['XS', 'S', 'M', 'L']
const CGA_YOUTH = ['CHILD', 'YOUTH']
const CGA_INFANT = ['INFANT']
const MENS_NEO = ['S', 'M', 'L', 'XL']
const COMPANY_NEO = ['XS', 'S', 'M']
const LADIES_NEO = ['XS', 'S', 'M', 'L']
const HELMET = ['XS', 'S', 'M', 'L']
const CORP_TOWEL = ['S', 'L']
const NORMAL_TOWEL = ['OS']

/** @type {Array<{category:string, model:string, vendor:string, colors:string[], sizes:string[], attrs?: (size:string, color:string)=>Record<string,string>}>} */
const items = []

function vest(model, vendor, colors, sizes, gender) {
  items.push({
    category: 'lifejacket',
    model,
    vendor,
    colors,
    sizes,
    attrs: (size, color) => {
      const a = { gender, color, size }
      if (size === 'TEEN') {
        a.age_group = 'Teen'
      } else if (size === 'INFANT') {
        a.age_group = 'Infant'
        delete a.gender
      } else if (size === 'CHILD') {
        a.age_group = 'Child'
        delete a.gender
      } else if (size === 'YOUTH') {
        a.age_group = 'Teen'
        delete a.gender
      } else {
        a.age_group = 'Adult'
      }
      return a
    },
  })
}

function wetsuit(model, vendor, colors, sizes, gender, extra = {}) {
  items.push({
    category: 'wetsuit',
    model,
    vendor,
    colors,
    sizes,
    attrs: (size, color) => ({ gender, size, color, ...extra }),
  })
}

function helmet(model, vendor, colors, sizes) {
  items.push({
    category: 'wb_helmet',
    model,
    vendor,
    colors,
    sizes,
    attrs: (size, color) => ({ size, color }),
  })
}

function apparel(model, vendor, colors, sizes) {
  items.push({
    category: 'apparel',
    model,
    vendor,
    colors,
    sizes,
    attrs: (size, color) => ({ size, color }),
  })
}

function handle(model, vendor, colors) {
  items.push({
    category: 'wb_handle',
    model,
    vendor,
    colors,
    sizes: [''],
    attrs: (_size, color) => ({ color }),
  })
}

// ===== MENS VESTS =====
vest('ANTHEM P1', 'FE07201-CE', ['BLACK'], MENS_VEST, 'Male')
vest('AFFIX', 'FE05101-CE', ['SILVER', 'RUST'], MENS_VEST, 'Male')
vest('GRATIS', 'FE05102-CE', ['BLACK', 'CHARCOAL'], MENS_VEST, 'Male')
vest('ATG', 'FE07203-CE', ['BLACK', 'KHAKI'], MENS_VEST, 'Male')
vest('ASSOCIATE', 'FE07204-CE', ['BLACK', 'BLACK/SAND'], MENS_VEST, 'Male')
vest('015Y P1', 'FE07208-CE', ['BLACK', 'DENIM'], MENS_VEST, 'Male')
vest('ASSET', 'FE05104-C', ['BLACK', 'SLATE', 'PURPLE'], ASSET_VEST, 'Male')
vest('RESIN', 'FE07205-CE', ['BLACK', 'RED', 'ORANGE', 'STONE'], MENS_VEST, 'Male')
vest('SECTION', 'FE03206-CE', ['BLACK/PETINA', 'BLACK', 'BROWN', 'BLACK/STONE'], MENS_VEST, 'Male')
vest('COMPANY', 'FE07206-CE', ['BLACK', 'OLIVE', 'RED', 'MUSTARD'], MENS_VEST, 'Male')

// ===== LADIES VESTS =====
vest('SERENE P1', 'FE07301-CE', ['BLACK'], LADIES_UK, 'Female')
vest('CLEO', 'FE05302-CE', ['CORAL', 'BLACK/GOLD', 'SILVER'], LADIES_LETTER, 'Female')
vest('THERA', 'FE07302-CE', ['SLATE', 'MELON', 'RAVEN'], LADIES_UK, 'Female')
vest('EVIE P1', 'FE07305-CE', ['NAVY', 'OCEAN', 'MINT'], LADIES_UK, 'Female')
vest('FORTUNE', 'FE05303-C', ['BLACK', 'PURPLE', 'PINK/RED'], LADIES_LETTER, 'Female')
vest('FINESSE', 'FE05304-CE', ['OLIVE', 'BROWN', 'PINK/STONE'], LADIES_LETTER, 'Female')
vest('RESIRA', 'FE07307-CE', ['BLUE', 'PINK', 'MINT', 'PURPLE'], LADIES_UK, 'Female')
vest('STUDIO', 'FE07306-CE', ['YELLOW CREAM', 'PASTEL BLUE', 'PASTEL PINK', 'BLACK'], LADIES_UK, 'Female')

// ===== CGA =====
vest('FLEET', 'FE07210-CGA', ['GREY', 'BLACK', 'BLUE/BLACK'], CGA_MENS, 'Male')
vest('NIKKS', 'FE07310-CGA', ['PINK', 'PASTEL BLUE', 'MELON'], CGA_LADIES, 'Female')
vest('GROMMY INFANT CGA', 'FE07308-CGA', ['TEAL', 'PURPLE', 'BLACK', 'ORANGE'], CGA_INFANT, 'Female')
vest('GROMMY YOUTH CGA', 'FE07309-CGA', ['TEAL', 'PURPLE', 'BLACK', 'ORANGE'], CGA_YOUTH, 'Female')

// ===== MENS NEOPRENE =====
wetsuit('P1 CONTROL NEO JACKET', 'FE05401', ['BLACK'], MENS_NEO, 'Male')
wetsuit('COMPANY NEO JACKET', 'FE05402', ['BLACK', 'KHAKI'], COMPANY_NEO, 'Male')
wetsuit('P1 3/2mm STEAMER', 'FE04501', ['BLACK', 'MAROON'], MENS_NEO, 'Male', { thickness: '3/2', coverage: '全身' })
wetsuit('P1 4/3mm STEAMER', 'FE04502', ['BLACK'], MENS_NEO, 'Male', { thickness: '4/3', coverage: '全身' })
wetsuit('P1 2/2mm L/S SPRING', 'FE04503', ['BLACK', 'MAROON'], MENS_NEO, 'Male', { thickness: '2/2', coverage: '半身' })
wetsuit('P1 1mm L/S SPRING', 'FE04510', ['BLACK'], MENS_NEO, 'Male', { thickness: '1', coverage: '半身' })
wetsuit('P1 2mm WETTY TOP', 'FE04504', ['BLACK', 'MAROON'], MENS_NEO, 'Male', { thickness: '2', coverage: '半身' })
wetsuit('P1 1mm WETTY TOP', 'FE04505', ['BLACK'], MENS_NEO, 'Male', { thickness: '1', coverage: '半身' })
wetsuit('FZ 1mm WETTY TOP', 'FE04506', ['BLACK'], MENS_NEO, 'Male', { thickness: '1', coverage: '半身' })

// ===== LADIES NEOPRENE =====
wetsuit('P1 LADIES 2/2mm L/S SPRING', 'FE04507', ['BLACK', 'MAROON'], LADIES_NEO, 'Female', { thickness: '2/2', coverage: '半身' })
wetsuit('LADIES FZ WETTY TOP', 'FE04508', ['BLACK', 'SLATE'], LADIES_NEO, 'Female', { thickness: '1', coverage: '半身' })
wetsuit('LADIES WETSUIT SHORTS', 'FE04509', ['BLACK', 'SLATE'], LADIES_NEO, 'Female', { coverage: '半身' })

// ===== ROPES / HANDLES =====
handle('PRO PACKAGE', 'FE03100', ['GREEN', 'WHITE'])
handle('PRO HANDLE', 'FE01101', ['GREEN', 'WHITE'])
handle('PRO MAINLINE', 'FE01102', ['GREEN', 'WHITE'])
handle('TEAM PACKAGE', 'FE03109', ['PURPLE/CIRCLE', 'TEAL/HEX', 'RED/OVAL', 'FLURO CIRCLE'])
handle('TEAM HANDLE', 'FE01103', ['PURPLE/CIRCLE', 'TEAL/HEX', 'RED/OVAL', 'FLURO CIRCLE'])
handle('TEAM FUSION ROPE', 'FE01104', ['PURPLE', 'TEAL', 'RED', 'FLURO YELLOW'])
handle('THE BASIC PACKAGE', 'FE05105', ['PINK', 'BLACK/WHITE', 'FLURO YELLOW', 'BLUE'])
handle('SURF PACKAGE', 'FE01106', ['FLURO YELLOW', 'BLACK/WHITE', 'PINK', 'TEAL'])
handle('SURF 2 UP PACKAGE', 'FE01107', ['GREY/BLUE', 'LAVENDER'])
handle('TOW SURF PACKAGE', 'FE03108', ['RED/WHITE'])
handle('T BAR CONNECT', 'F13120', ['BLACK'])

// ===== HELMETS =====
helmet('PRO HELMET', 'FE04414', ['MATTE BLACK', 'TAUPE', 'WHITE', 'CHARCOAL'], HELMET)
helmet('SAFETY FIRST HELMET', 'F13715', ['BLACK', 'OLIVE', 'CHARCOAL', 'WHITE', 'OCEAN'], HELMET)

// ===== TOWELS =====
apparel('CORP TOWLIE', 'FE06403', ['HOT PINK', 'STEEL GREY', 'BLACK', 'ROYAL BLUE'], CORP_TOWEL)
apparel('NORMAL TOWEL', 'FE06404', ['BLACK'], NORMAL_TOWEL)

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function attrsJson(obj) {
  const clean = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue
    clean[k] = v
  }
  return sqlStr(JSON.stringify(clean)) + '::jsonb'
}

let productCount = 0
let variantCount = 0

const lines = []
lines.push('-- Follow EP07 2027 pre-order seed')
lines.push('-- brand=Follow, model_year=2027, price=NULL, stock=0, availability=pre_order')
lines.push('-- One product card per color; model name does NOT include color (color in attributes).')
lines.push('-- Categories: lifejacket / wetsuit / wb_handle / wb_helmet / apparel')
lines.push('-- Run once in Supabase SQL editor. Safe to re-run only if you delete these rows first.')
lines.push('')
lines.push('DO $$')
lines.push('DECLARE')
lines.push('  pid uuid;')
lines.push('BEGIN')
lines.push('')

for (const item of items) {
  for (const color of item.colors) {
    productCount += 1
    lines.push(`  -- ${item.category} / ${item.model} / ${color} (${item.vendor})`)
    lines.push(
      `  INSERT INTO products (category, brand, model, model_year, is_public, is_active)`,
    )
    lines.push(
      `  VALUES (${sqlStr(item.category)}, ${sqlStr(BRAND)}, ${sqlStr(item.model)}, ${YEAR}, true, true)`,
    )
    lines.push(`  RETURNING id INTO pid;`)
    lines.push('')

    const variantRows = []
    for (const size of item.sizes) {
      variantCount += 1
      const attrs = item.attrs(size, color)
      variantRows.push(
        `    (pid, ${sqlStr(item.vendor)}, ${attrsJson(attrs)}, NULL, 0, 'pre_order')`,
      )
    }
    lines.push(
      `  INSERT INTO product_variants (product_id, vendor_code, attributes, price, stock, availability)`,
    )
    lines.push(`  VALUES`)
    lines.push(variantRows.join(',\n') + ';')
    lines.push('')
  }
}

lines.push(`  RAISE NOTICE 'Follow EP07 2027 seeded: % products, % variants', ${productCount}, ${variantCount};`)
lines.push('END $$;')
lines.push('')
lines.push(`-- Summary: ${productCount} products, ${variantCount} variants`)
lines.push(`-- Verify:`)
lines.push(`-- SELECT p.category, p.brand, p.model, p.model_year, v.vendor_code, v.attributes->>'color' AS color,`)
lines.push(`--        v.attributes->>'size' AS size, v.availability, v.price, v.stock`)
lines.push(`-- FROM products p`)
lines.push(`-- JOIN product_variants v ON v.product_id = p.id`)
lines.push(`-- WHERE p.brand = 'Follow' AND p.model_year = 2027`)
lines.push(`-- ORDER BY p.category, p.model, color, size;`)
lines.push('')

const out = path.join(__dirname, '..', 'migrations', '176_seed_follow_ep07_2027_preorder.sql')
fs.writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`Wrote ${out}`)
console.log(`products=${productCount} variants=${variantCount}`)
