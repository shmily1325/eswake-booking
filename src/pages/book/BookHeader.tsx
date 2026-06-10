import { EsBrandLockup } from '../../components/EsBrandLockup'
import { BookLocaleToggle, useBookLocale } from '../liff/book/BookLocaleContext'

/** /book 頂部：黑底品牌列（對標 ShopHeader） */
export function BookHeader() {
  const { s } = useBookLocale()

  return (
    <header className="sticky top-0 z-30 bg-black text-white border-b border-white/10">
      <div
        className="px-4 min-h-14 py-2 flex items-center"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
      >
        <EsBrandLockup
          brand={s.header.brand}
          subtitle={s.header.title}
          logoSize={28}
          trailing={<BookLocaleToggle />}
          style={{ marginBottom: 0, alignItems: 'center', width: '100%' }}
        />
      </div>
    </header>
  )
}
