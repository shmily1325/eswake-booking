import { useRouteDocumentMeta } from '../../../lib/useRouteDocumentMeta'
import { ROUTE_OG_BY_PATH } from '../../../lib/routeOgMeta'
import { useLiffMember } from '../useLiffMember'
import { ErrorView } from '../components/ErrorView'
import { BookBootScreen } from './BookBootScreen'
import { BookBindingGate } from './BookBindingGate'
import { BookLocaleProvider } from './BookLocaleContext'
import type { BookWizardMode } from './bookWizardTypes'
import { isLiffBookEnabled, resolveLiffBookId } from './liffBookingConfig'
import { BookWizardCore, NotEnabledView } from './BookWizardCore'

export function LiffBook() {
  useRouteDocumentMeta(ROUTE_OG_BY_PATH['/liff/book'])
  return (
    <BookLocaleProvider>
      <LiffBookInner mode="liff" />
    </BookLocaleProvider>
  )
}

function LiffBookInner({ mode }: { mode: BookWizardMode }) {
  const {
    loading: liffLoading,
    bootPhase: liffBootPhase,
    error: liffError,
    member,
    lineUserId,
    lineDisplayName,
    shouldShowBindingForm,
    bindingFormProps,
    skipBinding,
    retryInit,
  } = useLiffMember({
    requireBinding: false,
    trackIconId: 'liff_book_open',
    liffId: resolveLiffBookId(),
    nonBlockingBinding: true,
    readyBeforeProfile: true,
    lightMember: true,
  })

  if (!isLiffBookEnabled()) return <NotEnabledView />
  if (liffError) return <ErrorView error={liffError} onRetry={() => void retryInit()} />
  if (liffLoading) {
    return (
      <BookBootScreen
        phase={liffBootPhase}
        onRetry={() => void retryInit()}
      />
    )
  }
  if (mode === 'liff' && shouldShowBindingForm) {
    return <BookBindingGate {...bindingFormProps} onSkip={skipBinding} />
  }

  return (
    <BookWizardCore
      mode={mode}
      member={member}
      lineUserId={lineUserId}
      lineDisplayName={lineDisplayName}
    />
  )
}
