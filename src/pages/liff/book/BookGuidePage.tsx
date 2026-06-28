import { useState } from 'react'

import { buildOaHomeUrl } from '../../shop/lib/lineDeepLink'
import { useBookLocale } from './BookLocaleContext'
import { BookGuideAccordion } from './BookGuideAccordion'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookPage,
  bookSectionSub,
  guideBulletList,
  guideGroupHeading,
  guideNoteBox,
} from './bookStyles'
import {
  BUS_DIRECTIONS_VIDEO_ID,
  DIRECTIONS_VIDEO_ID,
  visitMapUrl,
} from './liffBookingGuide'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BookCopyrightFooter } from './BookCopyrightFooter'

function GuideBullets({ items }: { items: readonly string[] }) {
  return (
    <ul style={guideBulletList}>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function GuideAddressRow({ address, mapQuery, copyLabel, copiedLabel }: {
  address: string
  mapQuery: string
  copyLabel: string
  copiedLabel: string
}) {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
      <a
        href={visitMapUrl(mapQuery)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: T.estimateAccent, fontWeight: 600, textDecoration: 'underline' }}
      >
        {address}
      </a>
      <button
        type="button"
        onClick={() => void copyAddress()}
        style={{
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: 999,
          background: 'white',
          color: copied ? T.estimateAccent : T.muted,
          fontSize: ty.caption,
          fontWeight: 500,
          padding: '4px 10px',
          cursor: 'pointer',
        }}
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  )
}

export function BookGuidePage() {
  const { s } = useBookLocale()
  const g = s.guide

  const sections = [
    {
      id: 'after-booking',
      title: g.afterBooking.title,
      content: <GuideBullets items={g.afterBooking.items} />,
    },
    {
      id: 'cancel-policy',
      title: g.cancelPolicy.title,
      content: <GuideBullets items={g.cancelPolicy.items} />,
    },
    {
      id: 'what-to-bring',
      title: g.whatToBring.title,
      content: (
        <>
          <div style={guideGroupHeading}>{g.whatToBring.clothing.heading}</div>
          <GuideBullets items={g.whatToBring.clothing.items} />
          <div style={{ ...guideNoteBox, marginTop: 10 }}>{g.whatToBring.clothing.avoid}</div>
          <div style={{ ...guideGroupHeading, marginTop: 14 }}>{g.whatToBring.wetsuit.heading}</div>
          <p style={{ margin: 0 }}>{g.whatToBring.wetsuit.text}</p>
          <div style={{ ...guideGroupHeading, marginTop: 14 }}>{g.whatToBring.personal.heading}</div>
          <GuideBullets items={g.whatToBring.personal.items} />
          <div style={{ ...guideGroupHeading, marginTop: 14 }}>{g.whatToBring.facilities.heading}</div>
          <GuideBullets items={g.whatToBring.facilities.items} />
        </>
      ),
    },
    {
      id: 'directions',
      title: g.directions.title,
      content: (
        <>
          <div style={{ fontWeight: 600, color: T.ink, marginBottom: 6 }}>{g.directions.addressLabel}</div>
          <GuideAddressRow
            address={g.directions.address}
            mapQuery={g.directions.mapQuery}
            copyLabel={g.copyAddress}
            copiedLabel={g.copyAddressDone}
          />
          <div style={{ ...guideNoteBox, marginTop: 12 }}>{g.directions.gateNote}</div>
          <p style={{ margin: '10px 0 0', color: T.muted, fontSize: ty.caption, lineHeight: 1.55 }}>
            {g.directions.landmark}
          </p>
          <div style={{ ...guideGroupHeading, marginTop: 16 }}>{g.directions.driving.heading}</div>
          <p style={{ margin: '0 0 10px', color: T.muted, fontSize: ty.caption, lineHeight: 1.55 }}>
            {g.directions.driving.note}
          </p>
          <BookVideoPlayer
            variant="compact"
            videoId={DIRECTIONS_VIDEO_ID}
            title={g.directions.driving.videoLabel}
            label={g.directions.driving.videoLabel}
          />
          <div style={{ ...guideGroupHeading, marginTop: 16 }}>{g.directions.parking.heading}</div>
          <GuideBullets items={[g.directions.parking.car, g.directions.parking.scooter]} />
          <div style={{ ...guideGroupHeading, marginTop: 16 }}>{g.directions.transit.heading}</div>
          <GuideBullets items={g.directions.transit.lines} />
          <div style={{ marginTop: 10 }}>
            <BookVideoPlayer
              variant="compact"
              videoId={BUS_DIRECTIONS_VIDEO_ID}
              title={g.directions.transit.videoLabel}
              label={g.directions.transit.videoLabel}
            />
          </div>
        </>
      ),
    },
  ]

  return (
    <main style={{ ...bookPage, padding: '16px 16px 24px' }}>
      <p style={{ ...bookSectionSub, marginTop: 0, marginBottom: 16 }}>{g.intro}</p>

      <BookGuideAccordion sections={sections} />

      <BookCopyrightFooter
        subtitle={ES_BRAND.guideAreaLabel}
        link={{ href: buildOaHomeUrl(), label: g.lineContact }}
      />
    </main>
  )
}
