interface ShopDetailQuantityProps {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
}

/** 詳情頁精簡數量（灰框 ±，非預約紫框） */
export function ShopDetailQuantity({
  value,
  min = 1,
  max = 99,
  onChange,
}: ShopDetailQuantityProps) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="減少數量"
        className="w-10 h-10 flex items-center justify-center text-lg text-zinc-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        −
      </button>
      <span
        className="w-10 text-center text-sm font-semibold text-zinc-900 tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="增加數量"
        className="w-10 h-10 flex items-center justify-center text-lg text-zinc-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}
