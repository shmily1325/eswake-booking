import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { ES_BRAND } from '../../../lib/esBrandTokens'

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
        <BrandCopyrightBlock
          subtitle={ES_BRAND.schoolTitle}
          style={{ fontSize: 11, color: '#9ca3af' }}
        />
      </div>
    </footer>
  )
}
