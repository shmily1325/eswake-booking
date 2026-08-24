import { useEffect, useState } from 'react'
import type { SizeChartRow } from '../../admin/products/types'

export function ProductSizeChart({ chart }: { chart: SizeChartRow }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <details className="group mt-4 border-y border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-semibold text-zinc-900">
          <span>尺寸表</span>
          <span className="text-gray-400 transition-transform group-open:rotate-180" aria-hidden>
            ⌄
          </span>
        </summary>
        <div className="pb-4">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full cursor-zoom-in rounded-lg border border-gray-100 bg-white p-2"
            aria-label={`放大 ${chart.name}`}
          >
            <img
              src={chart.image_url}
              alt={chart.name}
              className="mx-auto max-h-[520px] w-auto max-w-full object-contain"
              loading="lazy"
            />
          </button>
          <p className="mt-2 text-center text-xs text-gray-500">點圖片放大查看</p>
        </div>
      </details>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={chart.name}
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl text-zinc-900 shadow"
            aria-label="關閉尺寸表"
          >
            ×
          </button>
          <img
            src={chart.image_url}
            alt={chart.name}
            className="max-h-full max-w-full rounded bg-white object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
