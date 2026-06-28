import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { BookHeadcountStepper } from './BookHeadcountStepper'
import { useBookLocale } from './BookLocaleContext'
import { chipBtn, fieldLabel, selectionDetail, stepFieldPrompt } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { ActivityChoice } from './types'

interface BookExperiencePanelProps {
  headcount: number
  beginnerCount: number | null
  activity: ActivityChoice | null
  onSyncPeople: (patch: { headcount?: number; beginnerCount?: number }) => void
}

type MultiMode = 'all_first' | 'all_exp' | 'partial'

function resolveMultiMode(headcount: number, beginnerCount: number | null): MultiMode | null {
  if (beginnerCount == null) return null
  if (beginnerCount >= headcount) return 'all_first'
  if (beginnerCount === 0) return 'all_exp'
  return 'partial'
}

function experienceDetail(
  headcount: number,
  beginnerCount: number | null,
  s: ReturnType<typeof useBookLocale>['s'],
): string | null {
  if (beginnerCount == null) return null
  if (beginnerCount > 0 && beginnerCount < headcount) {
    return s.step2.partialDetail(beginnerCount, headcount)
  }
  return null
}

const hintLine: CSSProperties = {
  fontSize: ty.caption,
  color: T.muted,
  textAlign: 'center',
  lineHeight: 1.45,
  marginTop: 8,
}

export function BookExperiencePanel({
  headcount,
  beginnerCount,
  activity,
  onSyncPeople,
}: BookExperiencePanelProps) {
  const { s } = useBookLocale()

  const apply = (patch: { headcount?: number; beginnerCount?: number }) => {
    triggerHaptic('light')
    onSyncPeople(patch)
  }

  const detail = experienceDetail(headcount, beginnerCount, s)
  const prompt = headcount === 1 ? s.step2.experienceSingle : s.step2.experienceMulti
  const showFirstTimeDetail = beginnerCount != null && beginnerCount > 0
  const showBothNote = activity === 'BOTH' && beginnerCount != null && beginnerCount > 0

  if (headcount === 1) {
    return (
      <div>
        <div style={stepFieldPrompt}>{prompt}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="book-chip-btn"
            style={{ ...chipBtn(beginnerCount === 1), flex: 1, padding: '12px 0' }}
            onClick={() => apply({ beginnerCount: 1 })}
          >
            {s.step2.firstTime}
          </button>
          <button
            type="button"
            className="book-chip-btn"
            style={{ ...chipBtn(beginnerCount === 0), flex: 1, padding: '12px 0' }}
            onClick={() => apply({ beginnerCount: 0 })}
          >
            {s.step2.experienced}
          </button>
        </div>
        {showFirstTimeDetail ? <div style={hintLine}>{s.step2.firstTimeDetail}</div> : null}
        {showBothNote ? <div style={hintLine}>{s.step2.bothPricingNote}</div> : null}
        {detail ? <div style={selectionDetail}>{detail}</div> : null}
      </div>
    )
  }

  const mode = resolveMultiMode(headcount, beginnerCount)
  const partialMax = Math.max(1, headcount - 1)

  return (
    <div>
      <div style={stepFieldPrompt}>{prompt}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'all_first'), flex: 1, padding: '12px 0' }}
          onClick={() => apply({ beginnerCount: headcount })}
        >
          {s.step2.allFirstTime}
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'all_exp'), flex: 1, padding: '12px 0' }}
          onClick={() => apply({ beginnerCount: 0 })}
        >
          {s.step2.allExperienced}
        </button>
      </div>

      <button
        type="button"
        className="book-chip-btn"
        style={{
          ...chipBtn(mode === 'partial'),
          width: '100%',
          marginTop: 8,
          padding: '12px 0',
        }}
        onClick={() => {
          if (mode === 'partial') return
          apply({ beginnerCount: 1 })
        }}
      >
        {s.step2.partialFirstTime}
      </button>

      {mode === 'partial' ? (
        <div style={{ marginTop: 12 }}>
          <div style={fieldLabel}>{s.step2.partialCountLabel}</div>
          <BookHeadcountStepper
            value={beginnerCount ?? 1}
            min={1}
            max={partialMax}
            onChange={n => apply({ beginnerCount: n })}
          />
        </div>
      ) : null}

      {showFirstTimeDetail ? <div style={hintLine}>{s.step2.firstTimeDetail}</div> : null}
      {showBothNote ? <div style={hintLine}>{s.step2.bothPricingNote}</div> : null}
      {detail ? <div style={selectionDetail}>{detail}</div> : null}
    </div>
  )
}
