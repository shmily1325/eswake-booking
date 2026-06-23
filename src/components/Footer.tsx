import { useResponsive } from '../hooks/useResponsive'
import { BrandCopyrightBlock } from './BrandCopyrightBlock'
import { ES_BRAND } from '../lib/esBrandTokens'

export function Footer() {
  const { isMobile } = useResponsive()

  return (
    <div style={{
      textAlign: 'center',
      marginTop: '40px',
      paddingTop: '30px',
      borderTop: '1px solid rgba(0, 0, 0, 0.1)',
      color: '#666',
      fontSize: isMobile ? '12px' : '14px'
    }}>
      <BrandCopyrightBlock
        subtitle={ES_BRAND.adminSystemLabel}
        subtitleOpacity={0.7}
        style={{ fontSize: 'inherit' }}
      />
    </div>
  )
}
