import { ES_BRAND } from '../../../lib/esBrandTokens'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

/** 預約／行前須知頁底部版權 */
export function BookCopyrightFooter({
  subtitle = ES_BRAND.bookingAreaLabel,
}: {
  subtitle?: string
}) {
  return (
    <BrandCopyrightBlock
      subtitle={subtitle}
      style={{
        padding: '16px 16px 8px',
        textAlign: 'center',
        color: T.mutedLight,
        fontSize: ty.caption,
      }}
    />
  )
}
