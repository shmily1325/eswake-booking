import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import { chipBtn, fieldLabel, selectionDetail } from './bookStyles'

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
        <div style={fieldLabel}>{s.step2.experienceSingle}</div>
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
  const partialOptions = Array.from({ length: Math.max(0, headcount - 1) }, (_, i) => i + 1)

  return (
    <div>
      <div style={fieldLabel}>{s.step2.experienceMulti}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'all_first'), width: '100%', padding: '12px 14px' }}
          onClick={() => apply({ beginnerCount: headcount })}
        >
          {s.step2.allFirstTime}
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'all_exp'), width: '100%', padding: '12px 14px' }}
          onClick={() => apply({ beginnerCount: 0 })}
        >
          {s.step2.allExperienced}
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'partial'), width: '100%', padding: '12px 14px' }}
          onClick={() => apply({ beginnerCount: mode === 'partial' ? beginnerCount! : 1 })}
        >
          {s.step2.partialFirstTime}
        </button>
      </div>

      {mode === 'partial' ? (
        <div style={{ marginTop: 12 }}>
          <div style={fieldLabel}>{s.step2.partialCountLabel}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {partialOptions.map(n => (
              <button
                key={n}
                type="button"
                className="book-chip-btn"
                style={{ ...chipBtn(beginnerCount === n), minWidth: 52, padding: '10px 14px' }}
                onClick={() => apply({ beginnerCount: n })}
              >
                {s.step2.nFirstTime(n)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {detail ? <div style={selectionDetail}>{detail}</div> : null}
    </div>
  )
}
