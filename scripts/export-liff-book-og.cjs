/**
 * 從 photo/ 意象照輸出 LIFF book OG 圖（1200×630 webp，LINE / FB 分享預覽）
 *
 * 預設：
 *   og.webp       ← #31 滑水動作（預約表）
 *   og-guide.webp ← #31（行前須知）
 *
 * node scripts/export-liff-book-og.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'public/liff/book')
const PHOTO = path.join(ROOT, 'photo')

const SOURCE = {
  book: path.join(PHOTO, 'LINE_ALBUM_滑水意象照_260604_31.jpg'),
  guide: path.join(PHOTO, 'LINE_ALBUM_滑水意象照_260604_31.jpg'),
}

const OG_WIDTH = 1200
const OG_HEIGHT = 630

async function exportOg(src, filename) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source photo: ${src}`)
  }
  const dest = path.join(OUT, filename)
  await sharp(src)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: 'cover', position: 'attention' })
    .webp({ quality: 86 })
    .toFile(dest)
  const { size } = fs.statSync(dest)
  console.log(`  ${filename}  (${(size / 1024).toFixed(0)} KB)  ← ${path.basename(src)}`)
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  console.log(`Exporting OG ${OG_WIDTH}×${OG_HEIGHT} → public/liff/book/`)
  await exportOg(SOURCE.book, 'og.webp')
  await exportOg(SOURCE.guide, 'og-guide.webp')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
