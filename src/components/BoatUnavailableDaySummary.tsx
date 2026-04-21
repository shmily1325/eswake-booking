import { useMemo, type ReactNode } from 'react'
import type { BoatUnavailableBlock } from '../utils/boatUnavailableDay'
import { formatUnavailableRange } from '../utils/boatUnavailableDay'
import type { RestrictionDayBlock } from '../utils/restrictionDayBlocks'

interface BoatRef {
  id: number
  name: string
}

interface BoatUnavailableDaySummaryProps {
  blocks: BoatUnavailableBlock[]
  boats: BoatRef[]
  isMobile: boolean
  /** 當日公告／受理限制時段（與預約衝突判定相同資料來源） */
  restrictionBlocks?: RestrictionDayBlock[]
}

function BombLine({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
      }}
    >
      <span aria-hidden style={{ flexShrink: 0, lineHeight: 1.5 }}>
        💣
      </span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}

export function BoatUnavailableDaySummary({
  blocks,
  boats,
  isMobile,
  restrictionBlocks = [],
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

  const restrictionLines = useMemo(() => {
    if (!restrictionBlocks.length) return []
    const sorted = [...restrictionBlocks].sort((a, b) => a.startMin - b.startMin)
    return sorted.map((r, idx) => ({
      key: `restriction-${r.startMin}-${r.endMin}-${idx}`,
      range: formatUnavailableRange(r.startMin, r.endMin),
      detail: r.content?.trim() || '受理受限',
    }))
  }, [restrictionBlocks])

  if (lines.length === 0 && restrictionLines.length === 0) return null

  const bodyStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '4px',
    fontSize: isMobile ? '12px' : '13px',
    color: '#4a148c',
    lineHeight: 1.65,
  }

  const sectionTitleStyle = {
    fontWeight: 700 as const,
    fontSize: isMobile ? '13px' : '14px',
    color: '#4527a0',
    marginBottom: '8px',
  }

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
      {lines.length > 0 && (
        <>
          <div style={sectionTitleStyle}>今日船隻維修／停用</div>
          <div style={bodyStyle}>
            {lines.map((line) => (
              <BombLine key={line.key}>
                <strong>{line.boatName}</strong>：{line.range}
                {line.reason ? `（${line.reason}）` : ''}
              </BombLine>
            ))}
          </div>
        </>
      )}

      {restrictionLines.length > 0 && (
        <>
          <div
            style={{
              ...sectionTitleStyle,
              marginTop: lines.length > 0 ? '14px' : 0,
            }}
          >
            今日公告／受理限制
          </div>
          <div style={bodyStyle}>
            {restrictionLines.map((row) => (
              <BombLine key={row.key}>
                {row.range}：{row.detail}
              </BombLine>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
