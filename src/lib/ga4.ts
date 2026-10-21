const DEFAULT_GA4_MEASUREMENT_ID = 'G-H5KLGJRDGZ'
const GA4_SCRIPT_ID = 'eswake-ga4'

type Ga4Parameter = string | number | boolean | undefined
type Ga4Parameters = Record<string, Ga4Parameter>
type GtagCommand = [command: string, ...args: unknown[]]

declare global {
  interface Window {
    dataLayer?: ArrayLike<unknown>[]
    gtag?: (...args: GtagCommand) => void
  }
}

let initialized = false

function measurementId(): string {
  return import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim() || DEFAULT_GA4_MEASUREMENT_ID
}

function officialSiteReferrer(): boolean {
  if (!document.referrer) return false
  try {
    const hostname = new URL(document.referrer).hostname.toLowerCase()
    return hostname === 'www.eswakeschool.com' || hostname === 'eswakeschool.com'
  } catch {
    return false
  }
}

/** 僅由公開預約入口呼叫，避免後台與商店流量混入預約追蹤。 */
export function initializePublicBookingGa4() {
  if (initialized || typeof window === 'undefined' || typeof document === 'undefined') return
  initialized = true

  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    // gtag.js expects the native Arguments object, matching Google's official snippet.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
  }

  const id = measurementId()
  window.gtag('js', new Date())
  window.gtag('config', id, {
    cookie_domain: 'auto',
  })

  if (!document.getElementById(GA4_SCRIPT_ID)) {
    const script = document.createElement('script')
    script.id = GA4_SCRIPT_ID
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
    document.head.appendChild(script)
  }

  window.gtag('event', 'booking_landing', {
    source_site: officialSiteReferrer() ? 'official_site' : 'other',
  })
}

/** 非阻塞送出 GA4 預約漏斗事件；不得放入姓名、電話等個資。 */
export function trackPublicBookingEvent(
  eventName: 'booking_request',
  parameters: Ga4Parameters = {},
) {
  if (!initialized) return
  window.gtag?.('event', eventName, parameters)
}
