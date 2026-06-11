import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { BookHeader } from '../../book/BookHeader'
import { BookLayout } from '../../book/BookLayout'
import { BookLocaleProvider } from './BookLocaleContext'
import { isLiffBookEnabled } from './liffBookingConfig'
import { BookWizardCore, NotEnabledView } from './BookWizardCore'

export function PublicBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/book'])
  return (
    <BookLocaleProvider>
      <BookLayout>
        <BookHeader />
        {isLiffBookEnabled() ? (
          <BookWizardCore mode="public" usePublicChrome />
        ) : (
          <NotEnabledView />
        )}
      </BookLayout>
    </BookLocaleProvider>
  )
}
