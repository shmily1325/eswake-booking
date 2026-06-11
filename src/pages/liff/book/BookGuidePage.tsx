import { Link } from 'react-router-dom'

import { useBookLocale } from './BookLocaleContext'
import { BookGuideAccordion } from './BookGuideAccordion'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookPage,
  bookSectionSub,
  bookSectionTitle,
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

function GuideBullets({ items }: { items: readonly string[] }) {
  return (
    <ul style={guideBulletList}>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
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
          <a
            href={visitMapUrl(g.directions.mapQuery)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.estimateAccent, fontWeight: 600, textDecoration: 'underline' }}
          >
            {g.directions.address}
          </a>
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
      <h1 style={{ ...bookSectionTitle, fontSize: ty.display, marginBottom: 6 }}>{g.pageTitle}</h1>
      <p style={{ ...bookSectionSub, marginBottom: 16 }}>{g.intro}</p>

      <BookGuideAccordion sections={sections} defaultOpenId="after-booking" />

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link
          to="/book"
          style={{
            display: 'inline-block',
            padding: '12px 20px',
            borderRadius: 999,
            border: `1px solid ${T.borderSubtle}`,
            background: T.cardBg,
            color: T.inkSoft,
            fontSize: ty.body,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {g.backToBook}
        </Link>
      </div>
    </main>
  )
}
