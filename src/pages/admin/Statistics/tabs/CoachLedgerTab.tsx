import { StatisticsTab } from '../../../../components/StatisticsTab'
import { useResponsive } from '../../../../hooks/useResponsive'

export function CoachLedgerTab() {
  const { isMobile } = useResponsive()
  return <StatisticsTab isMobile={isMobile} />
}
