import type { CSSProperties } from 'react'

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

function GearIcon({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      style={{ width: 30, height: 30, flexShrink: 0, objectFit: 'contain' }}
    />
  )
}

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
  bringIcons,
  avoidHeading,
  avoid,
  avoidIcons,
  tip,
  facilities,
  facilityIcons,
}: {
  bringHeading: string
  bring: readonly string[]
  bringIcons: readonly string[]
  avoidHeading: string
  avoid: readonly string[]
  avoidIcons: readonly string[]
  tip: string
  facilities: readonly string[]
  facilityIcons: readonly string[]
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
    gap: 6,
    marginBottom: 8,
    fontSize: ty.body,
    fontWeight: 500,
    color: T.inkSoft,
    lineHeight: 1.4,
  }

  const mark = (ok: boolean): CSSProperties => ({
    color: ok ? c.success[500] : c.danger[500],
    fontWeight: 700,
    width: 12,
    flexShrink: 0,
    textAlign: 'center',
  })

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <div>
          <div style={colHead(true)}>{bringHeading}</div>
          {bring.map((label, i) => (
            <div key={label} style={itemRow}>
              <span style={mark(true)} aria-hidden>✓</span>
              {bringIcons[i] ? <GearIcon src={bringIcons[i]} /> : null}
              <span style={{ minWidth: 0 }}>{label}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={colHead(false)}>{avoidHeading}</div>
          {avoid.map((label, i) => (
            <div key={label} style={itemRow}>
              <span style={mark(false)} aria-hidden>✕</span>
              {avoidIcons[i] ? <GearIcon src={avoidIcons[i]} /> : null}
              <span style={{ minWidth: 0 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={footnote}>
        <div>{tip}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 6,
            marginTop: 12,
          }}
        >
          {facilities.map((label, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              {facilityIcons[i] ? (
                <img
                  src={facilityIcons[i]}
                  alt=""
                  aria-hidden
                  loading="lazy"
                  style={{ width: 36, height: 36, objectFit: 'contain' }}
                />
              ) : null}
              <span style={{ fontSize: ty.micro, color: T.muted, lineHeight: 1.3 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GuideArrivalSteps({
  heading,
  steps,
  stepIcons,
  landmark,
}: {
  heading: string
  steps: BookI18nStrings['guide']['directions']['arrivalSteps']['steps']
  stepIcons: readonly string[]
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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
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
            {stepIcons[i] ? (
              <img
                src={stepIcons[i]}
                alt=""
                aria-hidden
                loading="lazy"
                style={{ width: '100%', maxWidth: 76, height: 60, objectFit: 'contain', marginBottom: 8 }}
              />
            ) : null}
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
