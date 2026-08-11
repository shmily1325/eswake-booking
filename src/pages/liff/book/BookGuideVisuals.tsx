import type { CSSProperties, ReactNode } from 'react'

import { designSystem } from '../../../styles/designSystem'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import type { BookI18nStrings } from './liffBookingI18n'

const c = designSystem.colors

type Tone = 'ok' | 'warn' | 'no'

const toneMap: Record<Tone, { bg: string; fg: string; mark: string }> = {
  ok: { bg: c.success[50], fg: c.success[700], mark: '✓' },
  warn: { bg: c.warning[50], fg: c.warning[700], mark: '!' },
  no: { bg: c.danger[50], fg: c.danger[700], mark: '✕' },
}

const footnote: CSSProperties = {
  marginTop: 14,
  padding: '10px 12px',
  background: T.surfaceMuted,
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: T.smallRadius,
  fontSize: ty.caption,
  color: T.muted,
  lineHeight: 1.55,
}

const pill = (tone: Tone): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  flexShrink: 0,
  padding: '5px 10px',
  borderRadius: 999,
  background: toneMap[tone].bg,
  color: toneMap[tone].fg,
  fontSize: ty.caption,
  fontWeight: 700,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
})

const rowLabel: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: ty.body,
  fontWeight: 600,
  color: T.ink,
  lineHeight: 1.45,
}

function MonoIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: T.inkSoft,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  )
}

const BRING_ICONS: ReactNode[] = [
  <path key="shirt" d="M4 7l4-3h8l4 3v3l-3-1v11H7V9L4 10V7z" />,
  <path key="shorts" d="M6 6h12v4l-2 8H8L6 10V6zM12 6v14" />,
  <g key="bottle">
    <circle cx="12" cy="8" r="3" />
    <path d="M12 11v9M9 20h6" />
  </g>,
  <path key="towel" d="M5 7h14v12H5zM5 11h14" />,
]

const AVOID_ICONS: ReactNode[] = [
  <g key="goggles">
    <circle cx="9" cy="12" r="3" />
    <circle cx="15" cy="12" r="3" />
    <path d="M12 12h0" />
  </g>,
  <g key="glasses">
    <circle cx="9" cy="12" r="3.5" />
    <circle cx="15" cy="12" r="3.5" />
    <path d="M12.5 12h-1" />
  </g>,
  <g key="jewelry">
    <circle cx="9" cy="14" r="3" />
    <path d="M15 8l3 3-5 5" />
  </g>,
]

export function GuideCancelTimeline({
  steps,
  weatherNote,
}: {
  steps: BookI18nStrings['guide']['cancelPolicy']['steps']
  weatherNote: string
}) {
  return (
    <div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {steps.map((step, i) => {
          const last = i === steps.length - 1
          return (
            <li
              key={step.when}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'stretch',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: T.ink,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    lineHeight: 1,
                  }}
                >
                  {i + 1}
                </span>
                {!last ? (
                  <span style={{ flex: 1, width: 2, minHeight: 14, background: T.borderSubtle, margin: '4px 0' }} />
                ) : null}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 10px',
                  paddingBottom: last ? 0 : 14,
                }}
              >
                <span style={rowLabel}>{step.when}</span>
                <span style={pill(step.tone)}>
                  <span aria-hidden>{toneMap[step.tone].mark}</span>
                  {step.action}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <div style={footnote}>{weatherNote}</div>
    </div>
  )
}

export function GuideGearGrid({
  bringHeading,
  bring,
  avoidHeading,
  avoid,
  notes,
}: {
  bringHeading: string
  bring: readonly string[]
  avoidHeading: string
  avoid: readonly string[]
  notes: readonly string[]
}) {
  const colHead = (ok: boolean): CSSProperties => ({
    fontSize: ty.caption,
    fontWeight: 700,
    color: ok ? c.success[700] : c.danger[700],
    marginBottom: 10,
    letterSpacing: '0.01em',
  })

  const itemRow: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    fontSize: ty.body,
    fontWeight: 500,
    color: T.inkSoft,
    lineHeight: 1.4,
  }

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div>
          <div style={colHead(true)}>{bringHeading}</div>
          {bring.map((label, i) => (
            <div key={label} style={itemRow}>
              <span style={{ color: c.success[500], fontWeight: 700, width: 14, flexShrink: 0 }} aria-hidden>✓</span>
              <MonoIcon>{BRING_ICONS[i] ?? BRING_ICONS[0]}</MonoIcon>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={colHead(false)}>{avoidHeading}</div>
          {avoid.map((label, i) => (
            <div key={label} style={itemRow}>
              <span style={{ color: c.danger[500], fontWeight: 700, width: 14, flexShrink: 0 }} aria-hidden>✕</span>
              <MonoIcon>{AVOID_ICONS[i] ?? AVOID_ICONS[0]}</MonoIcon>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={footnote}>
        {notes.map((line, i) => (
          <div key={line} style={{ marginTop: i === 0 ? 0 : 6 }}>{line}</div>
        ))}
      </div>
    </div>
  )
}

export function GuideArrivalSteps({
  heading,
  steps,
  landmark,
}: {
  heading: string
  steps: BookI18nStrings['guide']['directions']['arrivalSteps']['steps']
  landmark: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: ty.body, fontWeight: 700, color: T.ink, marginBottom: 12 }}>{heading}</div>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {steps.map((step, i) => (
          <li
            key={step.label}
            style={{
              background: T.surfaceMuted,
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: T.smallRadius,
              padding: '12px 8px',
              textAlign: 'center',
              minWidth: 0,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.info[500],
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              {i + 1}
            </span>
            <div style={{ fontSize: ty.caption, fontWeight: 600, color: T.ink, lineHeight: 1.4 }}>{step.label}</div>
            {step.detail ? (
              <div style={{ marginTop: 6, fontSize: ty.micro, color: T.muted, lineHeight: 1.4 }}>{step.detail}</div>
            ) : null}
          </li>
        ))}
      </ol>
      <div style={{ ...footnote, marginTop: 12 }}>{landmark}</div>
    </div>
  )
}
