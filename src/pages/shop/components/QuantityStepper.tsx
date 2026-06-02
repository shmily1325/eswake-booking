import { PrimaryNumericInput } from '../../../components/ui/numericInputs'

interface QuantityStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
}

/** 商城數量（同課程紫框數字輸入，非 ± stepper） */
export function QuantityStepper({ value, min = 1, max, onChange }: QuantityStepperProps) {
  return (
    <PrimaryNumericInput
      value={value}
      min={min}
      placeholder="1"
      onChange={(n) => {
        const next = typeof max === 'number' ? Math.min(max, n) : n
        onChange(next)
      }}
      suffix={<span style={{ fontSize: 14, color: '#666' }}>件</span>}
    />
  )
}
