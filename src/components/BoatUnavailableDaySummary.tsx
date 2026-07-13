import { useMemo, type ReactNode } from 'react'
import type { BoatUnavailableBlock } from '../utils/boatUnavailableDay'
import { formatUnavailableRange } from '../utils/boatUnavailableDay'
import type { RestrictionDayBlock } from '../utils/restrictionDayBlocks'
import {
  getDayViewAssignmentDatePrefix,
  normalizeAnnouncementContent,
  type DayViewAssignmentAnnouncement,
} from '../utils/announcement'
import { designSystem } from '../styles/designSystem'

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
  /** 當日純文字交辦（無受理限制） */
  assignmentAnnouncements?: DayViewAssignmentAnnouncement[]
}

function MarkerLine({ children, color }: { children: ReactNode; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          marginTop: '7px',
        }}
      />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}

function AssignmentLine({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 0,
      }}
    >
      <span style={{ flexShrink: 0, whiteSpace: 'pre' }}>{' - '}</span>
      <span style={{ flex: '1 1 0%', minWidth: 0, whiteSpace: 'pre-wrap' }}>{children}</span>
    </div>
  )
}

export function BoatUnavailableDaySummary({
  blocks,
  boats,
  isMobile,
  restrictionBlocks = [],
  assignmentAnnouncements = [],
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

  const assignmentLines = useMemo(() => {
    return assignmentAnnouncements.map((a) => {
      const prefix = getDayViewAssignmentDatePrefix(a)
      const content = normalizeAnnouncementContent(a.content)
      return {
        key: `assignment-${a.id}`,
        text: `${prefix}${content}`,
      }
    })
  }, [assignmentAnnouncements])

  if (lines.length === 0 && restrictionLines.length === 0 && assignmentLines.length === 0) {
    return null
  }

  const bodyStyle = {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '4px',
    fontSize: isMobile ? '12px' : '13px',
    color: designSystem.colors.text.primary,
    lineHeight: 1.65,
  }

  const sectionTitleStyle = {
    fontWeight: 700 as const,
    fontSize: isMobile ? '13px' : '14px',
    color: designSystem.colors.warning[700],
    marginBottom: '8px',
  }

  return (
    <div
      style={{
        marginBottom: isMobile ? '12px' : '16px',
        padding: isMobile ? '12px 14px' : '14px 18px',
        borderRadius: designSystem.borderRadius.lg,
        background: designSystem.colors.warning[50],
        border: `1px solid ${designSystem.colors.warning[500]}33`,
        boxShadow: designSystem.shadows.xs,
      }}
    >
      {assignmentLines.length > 0 && (
        <>
          <div style={sectionTitleStyle}>交辦事項</div>
          <div style={bodyStyle}>
            {assignmentLines.map((row) => (
              <AssignmentLine key={row.key}>{row.text}</AssignmentLine>
            ))}
          </div>
        </>
      )}

      {lines.length > 0 && (
        <>
          <div
            style={{
              ...sectionTitleStyle,
              marginTop: assignmentLines.length > 0 ? '14px' : 0,
            }}
          >
            船隻停用
          </div>
          <div style={bodyStyle}>
            {lines.map((line) => (
              <MarkerLine key={line.key} color={designSystem.colors.warning[500]}>
                <strong>{line.boatName}</strong>：{line.range}
                {line.reason ? `（${line.reason}）` : ''}
              </MarkerLine>
            ))}
          </div>
        </>
      )}

      {restrictionLines.length > 0 && (
        <>
          <div
            style={{
              ...sectionTitleStyle,
              marginTop: lines.length > 0 || assignmentLines.length > 0 ? '14px' : 0,
            }}
          >
            預約限制
          </div>
          <div style={bodyStyle}>
            {restrictionLines.map((row) => (
              <MarkerLine key={row.key} color={designSystem.colors.warning[500]}>
                {row.range}：{row.detail}
              </MarkerLine>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
