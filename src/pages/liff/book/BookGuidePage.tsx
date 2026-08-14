import { useEffect, useState } from 'react'

import { buildOaHomeUrl } from '../../shop/lib/lineDeepLink'
import { useBookLocale } from './BookLocaleContext'
import { BookGuideAccordion } from './BookGuideAccordion'
import {
  GuideArrivalSteps,
  GuideCancelTimeline,
  GuideGearGrid,
  GuideOnsiteShop,
  GuideSectionIcon,
} from './BookGuideVisuals'
import { BookVideoPlayer } from './BookVideoPlayer'
import {
  bookPage,
  guideBulletList,
  guideCopyBtn,
  guideGroupHeading,
  guideGroupHeadingSpaced,
  guideMetaText,
} from './bookStyles'
import {
  ARRIVAL_ICONS,
  BUS_DIRECTIONS_VIDEO_ID,
  DIRECTIONS_GUIDE_IMAGE,
  DIRECTIONS_VIDEO_ID,
  FACILITY_ICONS,
  GEAR_ICONS,
  ONSITE_SHOP_IMAGE,
  preloadGuideImages,
  visitMapUrl,
} from './liffBookingGuide'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BookCopyrightFooter } from './BookCopyrightFooter'

const GEAR_BRING_ICONS = [
  GEAR_ICONS.tank,
  GEAR_ICONS.bikini,
  GEAR_ICONS.shorts,
  GEAR_ICONS.sunscreen,
  GEAR_ICONS.towel,
]
const GEAR_AVOID_ICONS = [
  GEAR_ICONS.goggles,
  GEAR_ICONS.glasses,
  GEAR_ICONS.jewelry,
  GEAR_ICONS.cotton,
]
const ARRIVAL_STEP_ICONS = [ARRIVAL_ICONS.gate, ARRIVAL_ICONS.line, ARRIVAL_ICONS.park]

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
        style={guideCopyBtn(copied)}
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  )
}

export function BookGuidePage() {
  const { s } = useBookLocale()
  const g = s.guide

  useEffect(() => preloadGuideImages(), [])

  const sections = [
    {
      id: 'after-booking',
      title: g.afterBooking.title,
      icon: <GuideSectionIcon name="checklist" />,
      content: (
        <>
          <GuideBullets items={g.afterBooking.items} />
          <GuideOnsiteShop
            image={ONSITE_SHOP_IMAGE}
            alt={g.afterBooking.onsiteShop.alt}
            notes={g.afterBooking.onsiteShop.notes}
          />
        </>
      ),
    },
    {
      id: 'cancel-policy',
      title: g.cancelPolicy.title,
      icon: <GuideSectionIcon name="calendar" />,
      content: (
        <GuideCancelTimeline
          steps={g.cancelPolicy.steps}
          weatherNote={g.cancelPolicy.weatherNote}
        />
      ),
    },
    {
      id: 'what-to-bring',
      title: g.whatToBring.title,
      icon: <GuideSectionIcon name="shirt" />,
      content: (
        <GuideGearGrid
          bringHeading={g.whatToBring.bringHeading}
          bring={g.whatToBring.bring}
          bringIcons={GEAR_BRING_ICONS}
          avoidHeading={g.whatToBring.avoidHeading}
          avoid={g.whatToBring.avoid}
          avoidIcons={GEAR_AVOID_ICONS}
          facilitiesNote={g.whatToBring.facilitiesNote}
          facilities={g.whatToBring.facilities}
          facilityIcons={FACILITY_ICONS}
        />
      ),
    },
    {
      id: 'directions',
      title: g.directions.title,
      icon: <GuideSectionIcon name="pin" />,
      content: (
        <>
          <GuideArrivalSteps
            heading={g.directions.arrivalSteps.heading}
            steps={g.directions.arrivalSteps.steps}
            stepIcons={ARRIVAL_STEP_ICONS}
            parkingNote={g.directions.arrivalSteps.parkingNote}
            landmark={g.directions.landmark}
          />
          <div style={guideGroupHeading}>{g.directions.addressLabel}</div>
          <GuideAddressRow
            address={g.directions.address}
            mapQuery={g.directions.mapQuery}
            copyLabel={g.copyAddress}
            copiedLabel={g.copyAddressDone}
          />
          <a
            href={DIRECTIONS_GUIDE_IMAGE}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 14, textDecoration: 'none' }}
          >
            <img
              src={DIRECTIONS_GUIDE_IMAGE}
              alt={g.directions.arrivalMapAlt}
              loading="lazy"
              decoding="async"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                borderRadius: T.controlRadius,
                border: `1px solid ${T.borderSubtle}`,
                background: T.surfaceMuted,
              }}
            />
            <div style={{
              marginTop: 8,
              fontSize: ty.caption,
              color: T.muted,
              textAlign: 'center',
              lineHeight: 1.45,
            }}>
              {g.directions.arrivalMapCaption}
            </div>
          </a>
          <div style={guideGroupHeadingSpaced}>{g.directions.driving.heading}</div>
          <p style={{ ...guideMetaText, margin: '0 0 10px' }}>
            {g.directions.driving.note}
          </p>
          <BookVideoPlayer
            variant="compact"
            videoId={DIRECTIONS_VIDEO_ID}
            title={g.directions.driving.videoLabel}
            label={g.directions.driving.videoLabel}
          />
          <div style={guideGroupHeadingSpaced}>{g.directions.transit.heading}</div>
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
      <BookGuideAccordion sections={sections} />

      <BookCopyrightFooter
        subtitle={ES_BRAND.guideAreaLabel}
        link={{ href: buildOaHomeUrl(), label: g.lineContact }}
      />
    </main>
  )
}
