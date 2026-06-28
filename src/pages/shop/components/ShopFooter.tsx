import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { ES_BRAND, esBrandOfficialContact } from '../../../lib/esBrandTokens'
import { resolveBookPublicUrl } from '../../liff/book/bookPaths'
import { buildOaHomeUrl } from '../lib/lineDeepLink'

const footerLinkClass =
  'text-gray-600 hover:text-gray-900 font-semibold no-underline'

/** Shop 各頁共用 footer（列表／詳情／購物車） */
export function ShopFooter() {
  return (
    <footer className="mt-8 border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col items-center text-center gap-3">
        <EsBrandLockup
          variant="onLight"
          align="center"
          logoSize={36}
          style={{ justifyContent: 'center' }}
        />
        <p className="text-sm text-gray-500 m-0">
          <a
            href={buildOaHomeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={footerLinkClass}
          >
            {esBrandOfficialContact()}
          </a>
          <span aria-hidden className="mx-1.5">·</span>
          <a
            href={resolveBookPublicUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={footerLinkClass}
          >
            {ES_BRAND.bookingAreaLabel}
          </a>
        </p>
        <BrandCopyrightBlock
          subtitle={ES_BRAND.shopAreaLabel}
          style={{ fontSize: 11, color: '#9ca3af' }}
        />
      </div>
    </footer>
  )
}
