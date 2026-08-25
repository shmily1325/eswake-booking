/**
 * 產出 Follow 尺寸表 PNG／WebP（數字來自已核對的官方／P1 經銷商表）。
 * 用法：node tools/render-follow-size-charts.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'shop', 'size-charts')

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** @type {Array<{
 *   slug: string
 *   pngName: string
 *   kicker: string
 *   title: string
 *   headers: string[]
 *   rows: string[][]
 *   notes: string[]
 * }>} */
const charts = [
  {
    slug: 'follow-mens-vest',
    pngName: '男救生衣 Mens Vest 2027 原圖',
    kicker: 'FOLLOW  ·  TAPERED FIT',
    title: "Men's Vest  男救生衣",
    headers: ['Size', 'Chest 胸圍', 'Navel 腹圍'],
    rows: [
      ['TEEN', '71–79 cm', '65–71 cm'],
      ['XS', '79–85', '71–79'],
      ['S', '85–90', '79–85'],
      ['M', '90–95', '85–90'],
      ['L', '95–102', '90–95'],
      ['XL', '102–108', '95–102'],
      ['XXL', '108–119', '102–108'],
      ['3XL', '119–125', '108–119'],
    ],
    notes: ['偏小合身，介於兩碼選小碼。'],
  },
  {
    slug: 'follow-womens-vest',
    pngName: '女救生衣 Womens Vest 2027 原圖',
    kicker: 'FOLLOW  ·  TAILORED FIT',
    title: "Women's Vest  女救生衣",
    headers: ['Follow', 'US / UK', 'Chest 胸圍', 'Navel 腹圍'],
    rows: [
      ['XXS', '0 / 4', '72–78 cm', '68–73 cm'],
      ['XS', '2 / 6', '78–84', '73–78'],
      ['S', '4 / 8', '84–88', '78–83'],
      ['M', '6 / 10', '88–93', '83–88'],
      ['MDD', '6 / 10DD', '97–105', '83–88'],
      ['L', '8 / 12', '93–100', '88–93'],
      ['XL', '10 / 14', '97–105', '93–98'],
      ['XXL', '12 / 16', '105–110', '98–103'],
    ],
    notes: [],
  },
  {
    slug: 'follow-mens-cga',
    pngName: '男 CGA 2027 原圖',
    kicker: 'FOLLOW  ·  CGA',
    title: 'Men’s CGA  男 CGA',
    headers: ['Size', 'Chest 胸圍'],
    rows: [
      ['S', '89–95 cm'],
      ['M', '95–102'],
      ['L', '103–108'],
      ['XL', '108–114'],
      ['XXL', '114–121'],
      ['3XL', '121–127'],
    ],
    notes: [],
  },
  {
    slug: 'follow-womens-cga',
    pngName: '女 CGA 2027 原圖',
    kicker: 'FOLLOW  ·  CGA',
    title: 'Women’s CGA  女 CGA',
    headers: ['Size', 'Chest 胸圍'],
    rows: [
      ['S', '84–91 cm'],
      ['M', '91–99'],
      ['L', '99–107'],
      ['XL', '107–114'],
    ],
    notes: [],
  },
  {
    slug: 'follow-kids-cga',
    pngName: 'Kids CGA 2027 原圖',
    kicker: 'FOLLOW  ·  CGA',
    title: 'Kids CGA  兒童 CGA',
    headers: ['Size', 'Rider Weight 體重'],
    rows: [
      ['INFANT', '≤ 14 kg'],
      ['YOUTH', '25–40 kg'],
    ],
    notes: [],
  },
  {
    slug: 'follow-mens-wetsuit',
    pngName: '男防寒衣 Mens Wetsuit Neo 2027 原圖',
    kicker: 'FOLLOW  ·  P1 WETSUIT / NEO',
    title: "Men's Wetsuit  男防寒衣",
    headers: ['Size', 'Shoulders 肩', 'Chest 胸圍', 'Height 身高'],
    rows: [
      ['S', '41 cm', '88 cm', '157 cm'],
      ['M', '44.5', '93', '165'],
      ['L', '47', '98', '171'],
      ['XL', '49.5', '103', '176'],
      ['XXL', '52', '108', '181'],
    ],
    notes: ['以胸圍與身高為主。'],
  },
  {
    slug: 'follow-womens-wetsuit',
    pngName: '女防寒衣 Womens Wetsuit Neo 2027 原圖',
    kicker: 'FOLLOW  ·  WETSUIT / NEO',
    title: "Women's Wetsuit  女防寒衣",
    headers: ['Follow', 'AU / US'],
    rows: [
      ['XS', '6'],
      ['S', '8'],
      ['M', '10'],
      ['L', '12'],
    ],
    notes: [],
  },
  {
    slug: 'follow-helmet',
    pngName: 'Helmet 原圖',
    kicker: 'FOLLOW  ·  HELMET',
    title: 'Helmet  安全帽',
    headers: ['Size', 'Head Circumference 頭圍'],
    rows: [
      ['XS', '46–50 cm'],
      ['S', '50–54'],
      ['M', '54–58'],
      ['L', '58–62'],
    ],
    notes: [],
  },
]

function wrapNotes(notes, maxChars) {
  const lines = []
  for (const note of notes) {
    let rest = note
    while (rest.length > maxChars) {
      let cut = rest.lastIndexOf('，', maxChars)
      if (cut < 12) cut = rest.lastIndexOf(' ', maxChars)
      if (cut < 12) cut = maxChars
      lines.push(rest.slice(0, cut + 1).trim())
      rest = rest.slice(cut + 1).trim()
    }
    if (rest) lines.push(rest)
  }
  return lines
}

function buildSvg(chart) {
  const colCount = chart.headers.length
  const width = colCount >= 4 ? 1080 : 920
  const padX = 48
  const tableTop = 168
  const rowH = 52
  const headerH = 48
  const tableW = width - padX * 2
  const colW = tableW / colCount
  const noteLines = wrapNotes(chart.notes, colCount >= 4 ? 42 : 36)
  const notesTop = tableTop + headerH + chart.rows.length * rowH + 36
  const height = notesTop + noteLines.length * 28 + 56

  const headerCells = chart.headers
    .map((h, i) => {
      const x = padX + i * colW + colW / 2
      return `<text x="${x}" y="${tableTop + 32}" text-anchor="middle" fill="#fafafa" font-size="15" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700">${esc(h)}</text>`
    })
    .join('')

  const body = chart.rows
    .map((row, r) => {
      const y = tableTop + headerH + r * rowH
      const bg = r % 2 === 0 ? '#fafafa' : '#f4f4f5'
      const cells = row
        .map((cell, i) => {
          const x = padX + i * colW + colW / 2
          const weight = i === 0 ? '700' : '500'
          return `<text x="${x}" y="${y + 34}" text-anchor="middle" fill="#18181b" font-size="18" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="${weight}">${esc(cell)}</text>`
        })
        .join('')
      return `<rect x="${padX}" y="${y}" width="${tableW}" height="${rowH}" fill="${bg}"/>${cells}`
    })
    .join('')

  const noteSvg = noteLines
    .map((line, i) => {
      return `<text x="${padX}" y="${notesTop + i * 28}" fill="#52525b" font-size="15" font-family="ui-sans-serif, system-ui, sans-serif">${esc(line)}</text>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${padX}" y="52" fill="#a1a1aa" font-size="13" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" letter-spacing="3">${esc(chart.kicker)}</text>
  <text x="${padX}" y="108" fill="#18181b" font-size="34" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="800">${esc(chart.title)}</text>
  <rect x="${padX}" y="${tableTop}" width="${tableW}" height="${headerH}" fill="#18181b"/>
  ${headerCells}
  ${body}
  <rect x="${padX}" y="${tableTop}" width="${tableW}" height="${headerH + chart.rows.length * rowH}" fill="none" stroke="#e4e4e7" stroke-width="1"/>
  ${noteSvg}
</svg>`
}

mkdirSync(OUT_DIR, { recursive: true })

for (const chart of charts) {
  const svg = Buffer.from(buildSvg(chart))
  const png = await sharp(svg, { density: 192 }).png().toBuffer()
  const webp = await sharp(png).webp({ quality: 90, effort: 5 }).toBuffer()
  writeFileSync(join(OUT_DIR, `${chart.pngName}.png`), png)
  writeFileSync(join(OUT_DIR, `${chart.slug}.webp`), webp)
  console.log(`${chart.slug}  png ${Math.round(png.length / 1024)}KB  webp ${Math.round(webp.length / 1024)}KB`)
}
