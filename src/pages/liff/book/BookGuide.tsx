import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { BookHeader } from '../../book/BookHeader'
import { BookLayout } from '../../book/BookLayout'
import { BookGuidePage } from './BookGuidePage'
import { BookLocaleProvider, useBookLocale } from './BookLocaleContext'

function BookGuideShell() {
  const { s } = useBookLocale()
  return (
    <>
      <BookHeader pageTitle={s.guide.headerTitle} />
      <BookGuidePage />
    </>
  )
}

export function PublicBookGuide() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/book/guide'])
  return (
    <BookLocaleProvider>
      <BookLayout>
        <BookGuideShell />
      </BookLayout>
    </BookLocaleProvider>
  )
}
