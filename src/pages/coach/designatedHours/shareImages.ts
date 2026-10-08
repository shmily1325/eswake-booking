export interface CoachDesignatedShareRow {
  date: string
  detail: string
  minutes: number
  note?: string | null
}

export interface CoachDesignatedShareInput {
  studentName: string
  title: string
  openingMinutes?: number
  remainingMinutes: number
  rows: CoachDesignatedShareRow[]
}

const ROWS_PER_IMAGE = 12
const WIDTH = 1170

export function paginateCoachDesignatedRows(
  rows: CoachDesignatedShareRow[],
): CoachDesignatedShareRow[][] {
  if (rows.length === 0) return [[]]
  const pages: CoachDesignatedShareRow[][] = []
  for (let index = 0; index < rows.length; index += ROWS_PER_IMAGE) {
    pages.push(rows.slice(index, index + ROWS_PER_IMAGE))
  }
  return pages
}

export function coachDesignatedImageFilename(studentName: string, page: number): string {
  const safeName = studentName.replace(/[\\/:*?"<>|]/g, '-').trim() || '學生'
  return `ESWake-${safeName}-指定課-${page}.png`
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('無法產生指定課圖片'))
    }, 'image/png')
  })
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function fitText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (context.measureText(value).width <= maxWidth) return value
  let fitted = value
  while (fitted.length > 1 && context.measureText(`${fitted}…`).width > maxWidth) {
    fitted = fitted.slice(0, -1)
  }
  return `${fitted}…`
}

export async function createCoachDesignatedShareImages(
  input: CoachDesignatedShareInput,
): Promise<File[]> {
  const pages = paginateCoachDesignatedRows(input.rows)

  const files: File[] = []
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageRows = pages[pageIndex]
    const noteCount = pageRows.filter((row) => row.note).length
    const height = 400 + pageRows.length * 106 + noteCount * 44
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('此裝置無法產生指定課圖片')

    context.fillStyle = '#f4f5f7'
    context.fillRect(0, 0, WIDTH, height)

    context.fillStyle = '#1d1d1f'
    context.font = '700 58px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
    context.fillText(`${input.studentName}｜指定課`, 64, 92)
    context.fillStyle = '#6b7280'
    context.font = '400 34px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
    context.fillText(input.title, 64, 145)

    drawRoundedRect(context, 64, 190, WIDTH - 128, height - 270, 30)
    context.fillStyle = '#ffffff'
    context.fill()
    context.strokeStyle = '#e5e7eb'
    context.lineWidth = 2
    context.stroke()

    let y = 265
    if (input.openingMinutes != null) {
      context.fillStyle = '#6b7280'
      context.font = '500 34px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
      context.fillText(`起始 ${input.openingMinutes} 分鐘`, 112, y)
      y += 72
    }

    pageRows.forEach((row, rowIndex) => {
      if (rowIndex > 0 || input.openingMinutes != null) {
        context.strokeStyle = '#eef0f3'
        context.beginPath()
        context.moveTo(112, y - 42)
        context.lineTo(WIDTH - 112, y - 42)
        context.stroke()
      }
      context.fillStyle = '#4b5563'
      context.font = '400 32px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
      context.fillText(row.date, 112, y)
      context.fillStyle = '#1d1d1f'
      context.font = '500 34px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
      context.fillText(fitText(context, row.detail, 560), 350, y)
      context.textAlign = 'right'
      context.fillStyle = row.minutes >= 0 ? '#2f6f50' : '#a23f3f'
      context.font = '700 36px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
      context.fillText(`${row.minutes >= 0 ? '+' : '−'}${Math.abs(row.minutes)}`, WIDTH - 112, y)
      context.textAlign = 'left'
      if (row.note) {
        context.fillStyle = row.note.includes('已逾使用期限') ? '#a23f3f' : '#8b919b'
        context.font = '400 27px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
        context.fillText(fitText(context, row.note, WIDTH - 462), 350, y + 42)
        y += 44
      }
      y += 106
    })

    context.strokeStyle = '#e5e7eb'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(112, height - 170)
    context.lineTo(WIDTH - 112, height - 170)
    context.stroke()

    context.fillStyle = '#1d1d1f'
    context.font = '700 44px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
    context.textAlign = 'right'
    context.fillText(`剩餘 ${input.remainingMinutes} 分`, WIDTH - 112, height - 92)
    context.textAlign = 'left'

    if (pages.length > 1) {
      context.fillStyle = '#8b919b'
      context.font = '400 25px -apple-system, BlinkMacSystemFont, "PingFang TC", sans-serif'
      context.textAlign = 'right'
      context.fillText(`${pageIndex + 1} / ${pages.length}`, WIDTH - 64, height - 30)
      context.textAlign = 'left'
    }

    const blob = await canvasToBlob(canvas)
    files.push(new File(
      [blob],
      coachDesignatedImageFilename(input.studentName, pageIndex + 1),
      { type: 'image/png', lastModified: Date.now() },
    ))
  }
  return files
}

export function downloadCoachDesignatedImages(files: File[]) {
  files.forEach((file) => {
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
