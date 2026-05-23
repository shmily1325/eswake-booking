/**
 * 從 lifejackets.xlsx 把所有內嵌圖抽出來，命名成方便人眼配對的格式：
 *
 *   row<RR>__<brand>_<model>__<size_or_age>__<color>.<ext>
 *   例：row02__LF_Heartbreaker-Cga__XS__粉橘.jpg
 *
 * 不做 DB match、不上傳。
 * 抽完後你用檔案總管的「大圖示」檢視縮圖，對著前端「商品管理」一張張選檔上傳即可。
 *
 * Excel 裡 anchor 對不到 row 的圖（例如 row=45 但表只有 43 row），
 * 也會盡量抽出來，命名為 row??__anchor<row>__#<n>.<ext>，你自己看是哪些 SKU。
 *
 * 用法：node extract-images.mjs
 */

import ExcelJS from 'exceljs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readdirSync, unlinkSync, mkdirSync, writeFileSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const XLSX = join(HERE, 'lifejackets.xlsx')
const OUT_DIR = join(HERE, 'extracted')

// 依 Excel 截圖：A 品牌 B 型號 C 空 D 貨號 E 尺寸 F 顏色 G 數量 H 售價 I 圖
const COL_BRAND = 1
const COL_MODEL = 2
const COL_VENDOR = 4
const COL_SIZE = 5
const COL_COLOR = 6

function cellText(ws, row, col) {
  const v = ws.getCell(row, col).value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object' && 'text' in v) return String(v.text).trim()
  if (typeof v === 'object' && 'result' in v) return String(v.result).trim()
  return String(v).trim()
}

function safe(s) {
  return (s || '')
    .replace(/[()（）]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '-')
}

/** 從 Excel size raw 抽出簡短 token：Teen/Adult/Child/Infant 或 size 字母 */
function shortSize(raw) {
  if (!raw) return ''
  const r = raw.trim()
  const ageMatch = r.match(/(Teen|Adult|Child|Infant)/i)
  if (ageMatch) return ageMatch[1]
  // size 開頭：可能是 XS / S / M / L / XL / 2XL / XS6 / S8 / M10 / L12 / 4XL
  const sizeMatch = r.match(/^(\d?XL|XS\d*|S\d*|M\d*|L\d*|XL\d*|XXL|XXXL|\d?XL)/i)
  if (sizeMatch) return sizeMatch[1].toUpperCase()
  return safe(r.split(/[（(]/)[0]) // 退而求其次：取第一個括號前的內容
}

async function main() {
  if (!existsSync(XLSX)) {
    console.error(`找不到 ${XLSX}`)
    process.exit(1)
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR)
  for (const f of readdirSync(OUT_DIR)) {
    try {
      unlinkSync(join(OUT_DIR, f))
    } catch {}
  }

  console.log(`讀取 ${XLSX} ...`)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(XLSX)
  const ws = wb.worksheets[0]
  const images = ws.getImages()
  console.log(`工作表：${ws.name}, ${ws.rowCount} row, ${images.length} 張圖`)
  console.log()

  // 收集每個 row 的資料
  const rowMeta = new Map()
  for (let r = 2; r <= ws.rowCount; r++) {
    const vendor = cellText(ws, r, COL_VENDOR)
    if (vendor) {
      rowMeta.set(r, {
        brand: cellText(ws, r, COL_BRAND),
        model: cellText(ws, r, COL_MODEL),
        vendor,
        size: cellText(ws, r, COL_SIZE),
        color: cellText(ws, r, COL_COLOR),
      })
    }
  }

  let exported = 0
  let outOfRange = 0
  const usedNames = new Set()
  const rowsWithImage = new Set()

  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    const tlRow = (img.range?.tl?.nativeRow ?? img.range?.tl?.row ?? 0) + 1
    const brRow = (img.range?.br?.nativeRow ?? img.range?.br?.row ?? tlRow - 1) + 1

    const data = wb.getImage(img.imageId)
    if (!data) continue
    const ext = data.extension || 'png'

    // 範圍內每個有 vendor 的 row 各放一份
    const targets = []
    for (let r = tlRow; r <= brRow; r++) {
      if (rowMeta.has(r)) targets.push(r)
    }
    if (targets.length === 0 && rowMeta.has(tlRow)) targets.push(tlRow)

    if (targets.length === 0) {
      // anchor 對不到表內 row（例如 row=45 表只到 43）
      outOfRange++
      let filename = `_unmatched__anchor${tlRow}__#${i + 1}.${ext}`
      let n = 1
      while (usedNames.has(filename)) {
        filename = `_unmatched__anchor${tlRow}__#${i + 1}__${n}.${ext}`
        n++
      }
      usedNames.add(filename)
      writeFileSync(join(OUT_DIR, filename), data.buffer)
      continue
    }

    for (const r of targets) {
      const m = rowMeta.get(r)
      const sizeTok = shortSize(m.size)
      const padR = String(r).padStart(2, '0')
      let base = `row${padR}__${safe(m.brand)}_${safe(m.model)}__${sizeTok}__${safe(m.color)}`
      let filename = `${base}.${ext}`
      let n = 1
      while (usedNames.has(filename)) {
        filename = `${base}__${n}.${ext}`
        n++
      }
      usedNames.add(filename)
      writeFileSync(join(OUT_DIR, filename), data.buffer)
      rowsWithImage.add(r)
      exported++
    }
  }

  // 列出有 vendor 但沒拿到圖的 row（通常就是被 _unmatched 那批 cover 的）
  const rowsMissingImage = []
  for (const [r, meta] of rowMeta) {
    if (!rowsWithImage.has(r)) rowsMissingImage.push({ row: r, ...meta })
  }

  console.log('='.repeat(60))
  console.log(`✓ 已抽出 ${exported} 張 (對到 row 的)`)
  if (outOfRange > 0) {
    console.log(`⚠ ${outOfRange} 張 anchor 在表外，存成 _unmatched__... 開頭`)
  }
  if (rowsMissingImage.length > 0) {
    console.log()
    console.log(`📋 ${rowsMissingImage.length} 個 SKU 沒拿到圖 (要從 _unmatched 那批裡找出對應)：`)
    for (const r of rowsMissingImage) {
      console.log(
        `   row${String(r.row).padStart(2, '0')}  ${r.brand}  ${r.model}  ${r.vendor}  ${r.size}  ${r.color}`,
      )
    }
  }
  console.log()
  console.log(`資料夾：${OUT_DIR}`)
  console.log()
  console.log('下一步：')
  console.log('  1. 用「檔案總管」開上面那個資料夾，切換到「大圖示」檢視看縮圖')
  console.log('  2. 對照前端「商品管理」每個 SKU，把對應的 jpg 拖進編輯頁的圖框')
  console.log('  3. 上傳完儲存即可，不需要 upload-images.mjs')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
