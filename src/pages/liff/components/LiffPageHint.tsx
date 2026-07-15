import type { ReactNode } from 'react'
import { getFontSizePx } from '../../../styles/designSystem'
import { LIFF_THEME } from '../liffUiStyles'

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
