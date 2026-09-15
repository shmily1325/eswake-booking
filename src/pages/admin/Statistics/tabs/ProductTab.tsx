import { useResponsive } from '../../../../hooks/useResponsive'
import { ShopSettlementStatisticsTab } from '../../orders/ShopSettlementStatisticsTab'

interface ProductTabProps {
  onLoadComplete: () => void
}

/**
 * Dashboard 與商品統計共用同一套資料與互動，
 * 僅省略查帳用途的結帳明細。
 */
export function ProductTab({ onLoadComplete }: ProductTabProps) {
  const { isMobile } = useResponsive()

  return (
    <ShopSettlementStatisticsTab
      isMobile={isMobile}
      hideSettlementDetails
      onLoadComplete={onLoadComplete}
    />
  )
}
