import type { CSSProperties, ReactElement } from 'react'

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

/** Accordion 標題用的線條圖示（固定 20px、繼承文字色） */
export function GuideSectionIcon({ name }: { name: 'checklist' | 'calendar' | 'shirt' | 'pin' }) {
  const paths: Record<typeof name, ReactElement> = {
    checklist: (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
        <path d="M8 9.5l2 2 3.5-3.5M8 16h8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
    shirt: <path d="M8.5 3.5L5 5.5 3.5 9l3 1.5V20.5h11V10.5l3-1.5L19 5.5l-3.5-2a3.5 3.5 0 01-7 0z" />,
    pin: (
      <>
        <path d="M12 21.5s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" />
        <circle cx="12" cy="10.5" r="2.5" />
      </>
    ),
  }

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
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
  facilitiesNote,
  facilities,
  facilityIcons,
}: {
  bringHeading: string
  bring: readonly string[]
  bringIcons: readonly string[]
  avoidHeading: string
  avoid: readonly string[]
  avoidIcons: readonly string[]
  facilitiesNote: string
  facilities: readonly string[]
  facilityIcons: readonly string[]
}) {
  const colHead = (ok: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: ty.caption,
    fontWeight: 700,
    color: ok ? c.success[700] : c.danger[700],
    marginBottom: 10,
    letterSpacing: '0.01em',
  })

  const headMark = (ok: boolean): CSSProperties => ({
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: ok ? c.success[500] : c.danger[500],
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
  })

  const itemRow = (last: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    padding: '8px 0',
    borderBottom: last ? 'none' : `1px solid ${T.borderSubtle}`,
    fontSize: ty.body,
    fontWeight: 600,
    color: T.ink,
    lineHeight: 1.4,
  })

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
          <div style={colHead(true)}>
            <span style={headMark(true)} aria-hidden>✓</span>
            {bringHeading}
          </div>
          {bring.map((label, i) => (
            <div key={label} style={itemRow(i === bring.length - 1)}>
              {bringIcons[i] ? <GearIcon src={bringIcons[i]} /> : null}
              <span style={{ minWidth: 0 }}>{label}</span>
            </div>
          ))}
        </div>
        <div style={{ borderLeft: `1px dashed ${T.borderSubtle}`, paddingLeft: 14 }}>
          <div style={colHead(false)}>
            <span style={headMark(false)} aria-hidden>✕</span>
            {avoidHeading}
          </div>
          {avoid.map((label, i) => (
            <div key={label} style={itemRow(i === avoid.length - 1)}>
              {avoidIcons[i] ? <GearIcon src={avoidIcons[i]} /> : null}
              <span style={{ color: c.danger[500], fontWeight: 700, flexShrink: 0 }} aria-hidden>×</span>
              <span style={{ minWidth: 0 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...footnote, marginTop: 16, padding: '12px 10px' }}>
        <div
          style={{
            fontSize: ty.caption,
            color: T.inkSoft,
            lineHeight: 1.5,
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {facilitiesNote}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: 0,
          }}
        >
          {facilities.map((label, i) => (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                textAlign: 'center',
                minWidth: 0,
                padding: '0 4px',
                borderLeft: i === 0 ? 'none' : `1px solid ${T.borderSubtle}`,
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
              <span style={{ fontSize: ty.micro, fontWeight: 600, color: T.inkSoft, lineHeight: 1.3 }}>{label}</span>
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
          gap: 10,
          alignItems: 'start',
        }}
      >
        {steps.map((step, i) => (
          <li
            key={step.label}
            style={{
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
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: c.info[500],
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
                lineHeight: 1,
              }}
            >
              {i + 1}
            </span>
            <div style={{ fontSize: ty.caption, fontWeight: 700, color: T.ink, lineHeight: 1.4 }}>{step.label}</div>
            {stepIcons[i] ? (
              <img
                src={stepIcons[i]}
                alt=""
                aria-hidden
                loading="lazy"
                style={{ width: '100%', maxWidth: 84, height: 66, objectFit: 'contain', marginTop: 8 }}
              />
            ) : null}
            {step.details?.length ? (
              <div style={{ marginTop: 6, display: 'grid', gap: 2 }}>
                {step.details.map(line => (
                  <div key={line} style={{ fontSize: ty.micro, color: T.muted, lineHeight: 1.4 }}>{line}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div style={{ ...footnote, marginTop: 12 }}>{landmark}</div>
    </div>
  )
}
