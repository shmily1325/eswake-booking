import { triggerHaptic } from '../../../utils/haptic'
import { useBookLocale } from './BookLocaleContext'
import {
  chipBtn,
  experienceChipBtn,
  experienceChipNote,
  experienceChipTitle,
  fieldLabel,
} from './bookStyles'

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

  if (headcount === 1) {
    return (
      <div>
        <div style={fieldLabel}>{s.step2.experienceSingle}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <button
            type="button"
            className="book-chip-btn"
            style={experienceChipBtn(beginnerCount === 1)}
            onClick={() => apply({ beginnerCount: 1 })}
          >
            <div style={experienceChipTitle}>{s.step2.firstTime}</div>
            <div style={experienceChipNote(beginnerCount === 1)}>
              <div>{s.step2.firstTimeLand}</div>
              <div>{s.step2.firstTimeWater}</div>
            </div>
          </button>
          <button
            type="button"
            className="book-chip-btn"
            style={experienceChipBtn(beginnerCount === 0)}
            onClick={() => apply({ beginnerCount: 0 })}
          >
            <div style={experienceChipTitle}>{s.step2.experienced}</div>
            <div style={experienceChipNote(beginnerCount === 0)}>
              {s.step2.experiencedNote}
            </div>
          </button>
        </div>
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
          style={{ ...chipBtn(mode === 'all_first'), width: '100%', textAlign: 'left', padding: '12px 14px' }}
          onClick={() => apply({ beginnerCount: headcount })}
        >
          {s.step2.allFirstTime}
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'all_exp'), width: '100%', textAlign: 'left', padding: '12px 14px' }}
          onClick={() => apply({ beginnerCount: 0 })}
        >
          {s.step2.allExperienced}
        </button>
        <button
          type="button"
          className="book-chip-btn"
          style={{ ...chipBtn(mode === 'partial'), width: '100%', textAlign: 'left', padding: '12px 14px' }}
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
                style={chipBtn(beginnerCount === n)}
                onClick={() => apply({ beginnerCount: n })}
              >
                {s.step2.nFirstTime(n)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
