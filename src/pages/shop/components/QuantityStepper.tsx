interface QuantityStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
}

/**
 * 數量選擇器：「− [數字] +」，含手動輸入。
 *
 * - 預設 min = 1（商城不允許 0 數量）
 * - max 可以給有限庫存，但商城選擇「不擋」缺貨變體，所以一般不傳 max
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
}: QuantityStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => {
    const next = value + 1
    onChange(typeof max === 'number' ? Math.min(max, next) : next)
  }

  return (
    <div className="inline-flex items-stretch border border-gray-300 rounded-md overflow-hidden bg-white">
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        className="w-10 h-10 flex items-center justify-center text-xl text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10)
          if (Number.isFinite(v)) {
            const clamped = Math.max(min, typeof max === 'number' ? Math.min(max, v) : v)
            onChange(clamped)
          }
        }}
        className="w-14 h-10 text-center border-x border-gray-300 outline-none focus:bg-zinc-50"
      />
      <button
        type="button"
        onClick={inc}
        disabled={typeof max === 'number' && value >= max}
        className="w-10 h-10 flex items-center justify-center text-xl text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}
