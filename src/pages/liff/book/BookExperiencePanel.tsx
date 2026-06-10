import { triggerHaptic } from '../../../utils/haptic'
import { BookHeadcountStepper } from './BookHeadcountStepper'
import { useBookLocale } from './BookLocaleContext'
import { chipBtn, fieldLabel, selectionDetail } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

interface BookExperiencePanelProps {
  headcount: number
  beginnerCount: number | null
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
  if (headcount === 1) {
    return beginnerCount === 1 ? s.step2.firstTimeDetail : s.step2.experiencedNote
  }
  const mode = resolveMultiMode(headcount, beginnerCount)
  if (mode === 'all_first') return s.step2.firstTimeDetail
  if (mode === 'all_exp') return s.step2.experiencedNote
  if (mode === 'partial') return s.step2.partialDetail(beginnerCount, headcount)
  return null
}

export function BookExperiencePanel({
  headcount,
  beginnerCount,
  onSyncPeople,
}: BookExperiencePanelProps) {
  const { s } = useBookLocale()

  const apply = (patch: { headcount?: number; beginnerCount?: number }) => {
    triggerHaptic('light')
    onSyncPeople(patch)
  }

  const detail = experienceDetail(headcount, beginnerCount, s)

  if (headcount === 1) {
    return (
      <div>
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
        {detail ? <div style={selectionDetail}>{detail}</div> : null}
      </div>
    )
  }

  const mode = resolveMultiMode(headcount, beginnerCount)
  const partialMax = Math.max(1, headcount - 1)

  return (
    <div>
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

      {mode !== 'partial' ? (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button
            type="button"
            onClick={() => apply({ beginnerCount: 1 })}
            style={{
              padding: 0,
              border: 'none',
              background: 'none',
              color: T.muted,
              fontSize: ty.caption,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {s.step2.mixedExperienceToggle}
          </button>
        </div>
      ) : null}

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

      {detail ? <div style={selectionDetail}>{detail}</div> : null}
    </div>
  )
}
