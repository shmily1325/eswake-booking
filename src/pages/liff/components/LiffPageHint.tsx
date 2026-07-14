import type { ReactNode } from 'react'
import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME } from '../liffUiStyles'

/** 全站共用一句（頁尾／空狀態用，不再頂部佔位） */
export const LIFF_CONTACT_LINE = '需協助請私訊官方'

export function LiffContactBar() {
  return (
    <div
      style={{
        fontSize: getFontSizePx('bodySmall', true),
        color: LIFF_THEME.mutedLight,
        textAlign: 'center',
        lineHeight: 1.4,
      }}
    >
      {LIFF_CONTACT_LINE}
    </div>
  )
}

/** 分頁底部說明（quiet caption，非 hint box） */
export function LiffPageHint({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: `1px solid ${LIFF_THEME.rowDivider}`,
        fontSize: getFontSizePx('bodySmall', true),
        color: LIFF_THEME.mutedLight,
        textAlign: 'center',
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  )
}
