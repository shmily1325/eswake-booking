import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('public booking GA4', () => {
  beforeEach(() => {
    vi.resetModules()
    document.head.innerHTML = ''
    delete window.dataLayer
    delete window.gtag
  })

  it('initializes once and records the booking landing', async () => {
    const { initializePublicBookingGa4 } = await import('../ga4')

    initializePublicBookingGa4()
    initializePublicBookingGa4()

    const commands = window.dataLayer?.map(command => Array.from(command))
    expect(document.querySelectorAll('#eswake-ga4')).toHaveLength(1)
    expect(commands).toEqual(expect.arrayContaining([
      ['config', 'G-H5KLGJRDGZ', { cookie_domain: 'auto' }],
      ['event', 'booking_landing', { source_site: 'other' }],
    ]))
    expect(commands?.filter(command => command[1] === 'booking_landing')).toHaveLength(1)
  })

  it('records a booking request without personal data', async () => {
    const { initializePublicBookingGa4, trackPublicBookingEvent } = await import('../ga4')
    initializePublicBookingGa4()

    trackPublicBookingEvent('booking_request', {
      activity: 'WB',
      headcount: 2,
      coach_choice: 'none',
      date_count: 1,
    })

    const commands = window.dataLayer?.map(command => Array.from(command))
    expect(commands).toContainEqual([
      'event',
      'booking_request',
      {
        activity: 'WB',
        headcount: 2,
        coach_choice: 'none',
        date_count: 1,
      },
    ])
  })
})
