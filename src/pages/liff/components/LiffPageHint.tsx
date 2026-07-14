import type { ReactNode } from 'react'
import { LIFF_THEME, LIFF_TYPE } from '../liffUiStyles'

/** 全站共用一句（頁尾／空狀態用，不再頂部佔位） */
export const LIFF_CONTACT_LINE = '需協助請私訊官方'

export function LiffContactBar() {
  return (
    <div
      style={{
        fontSize: LIFF_TYPE.caption,
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
        fontSize: LIFF_TYPE.caption,
        color: LIFF_THEME.mutedLight,
        textAlign: 'center',
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  )
}
