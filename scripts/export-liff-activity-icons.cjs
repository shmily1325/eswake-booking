/**
 * 將活動 icon 去背（移除淺灰方塊底）並輸出 webp 縮圖
 * node scripts/export-liff-activity-icons.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'public/liff/book')
const SRC = {
  ws: path.join(OUT, 'source/ws-icon.png'),
  wb: path.join(OUT, 'source/wb-icon.png'),
}

function resolveSrc(code) {
  const p = SRC[code]
  if (!fs.existsSync(p)) throw new Error(`Missing source: ${p}`)
  return p
}

function keyGrayToAlpha(data) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const spread = Math.max(r, g, b) - Math.min(r, g, b)
    const lightNeutral = r >= 200 && g >= 200 && b >= 200 && spread <= 22
    const notWhite = Math.max(r, g, b) < 252
    if (lightNeutral && notWhite) data[i + 3] = 0
  }
}

async function exportIcon(code, size, suffix) {
  const input = resolveSrc(code)
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  keyGrayToAlpha(data)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 12 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(path.join(OUT, `${code}-thumb${suffix}.webp`))
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  await exportIcon('ws', 96, '')
  await exportIcon('ws', 192, '@2x')
  await exportIcon('wb', 96, '')
  await exportIcon('wb', 192, '@2x')
  console.log('Exported transparent icons to public/liff/book/')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
