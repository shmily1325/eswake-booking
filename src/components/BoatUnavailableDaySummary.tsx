import { useMemo } from 'react'
import type { BoatUnavailableBlock } from '../utils/boatUnavailableDay'
import { formatUnavailableRange } from '../utils/boatUnavailableDay'

interface BoatRef {
  id: number
  name: string
}

interface BoatUnavailableDaySummaryProps {
  blocks: BoatUnavailableBlock[]
  boats: BoatRef[]
  isMobile: boolean
}

export function BoatUnavailableDaySummary({
  blocks,
  boats,
  isMobile,
}: BoatUnavailableDaySummaryProps) {
  const lines = useMemo(() => {
    if (blocks.length === 0) return []
    const nameById = new Map(boats.map((b) => [b.id, b.name]))
    const sorted = [...blocks].sort(
      (a, b) => a.boatId - b.boatId || a.startMin - b.startMin
    )
    return sorted.map((block, idx) => {
      const boatName = nameById.get(block.boatId) || `船 #${block.boatId}`
      const range = formatUnavailableRange(block.startMin, block.endMin)
      const reason = block.reason?.trim()
      return {
        key: `${block.boatId}-${block.startMin}-${block.endMin}-${idx}`,
        boatName,
        range,
        reason,
      }
    })
  }, [blocks, boats])

  if (lines.length === 0) return null

  return (
    <div
      style={{
        marginBottom: isMobile ? '12px' : '16px',
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #ede7f6 0%, #e8eaf6 100%)',
        border: '1px solid #b39ddb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: isMobile ? '13px' : '14px',
          color: '#4527a0',
          marginBottom: '8px',
        }}
      >
        今日船隻維修／停用
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: '1.1em',
          fontSize: isMobile ? '12px' : '13px',
          color: '#4a148c',
          lineHeight: 1.65,
        }}
      >
        {lines.map((line) => (
          <li key={line.key} style={{ marginBottom: '2px' }}>
            <strong>{line.boatName}</strong>：{line.range}
            {line.reason ? `（${line.reason}）` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
