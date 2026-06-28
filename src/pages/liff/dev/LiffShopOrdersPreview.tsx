import { useState } from 'react'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { PREVIEW_SHOP_ORDERS } from '../__fixtures__/shopOrdersPreview'
import { LiffContactBar, LiffTabs, LiffStyles, ShopOrdersList } from '../components'
import { BrandCopyrightBlock } from '../../../components/BrandCopyrightBlock'
import { EsBrandLockup } from '../../../components/EsBrandLockup'
import type { TabType } from '../types'

type PreviewMode = 'orders' | 'empty' | 'loading'

/** 僅 dev：瀏覽器預覽 LIFF 商品分頁，無需 LINE 登入 */
export function LiffShopOrdersPreview() {
  const [mode, setMode] = useState<PreviewMode>('orders')
  const [activeTab, setActiveTab] = useState<TabType>('orders')

  const orders = mode === 'orders' ? PREVIEW_SHOP_ORDERS : []
  const loading = mode === 'loading'

  return (
    <div style={{ minHeight: '100vh', background: ES_BRAND.pageBg }}>
      <div style={{
        background: ES_BRAND.headerBg,
        padding: '20px',
        color: 'white',
        borderBottom: ES_BRAND.headerBorderBottom,
      }}>
        <EsBrandLockup subtitle={ES_BRAND.memberAreaLabel} logoSize={36} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 14, opacity: 0.9 }}>Fish 您好！</div>
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        padding: '12px 16px 0',
        flexWrap: 'wrap',
      }}>
        {(['orders', 'empty', 'loading'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: mode === m ? '2px solid #000' : '1px solid #ccc',
              background: mode === m ? '#fff' : '#f5f5f5',
              fontSize: 12,
              fontWeight: mode === m ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {m === 'orders' ? '有訂單' : m === 'empty' ? '空狀態' : '載入中'}
          </button>
        ))}
      </div>

      <LiffTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div style={{ padding: 16 }}>
        <LiffContactBar />
        {activeTab === 'orders' && (
          <ShopOrdersList
            orders={orders}
            loading={loading}
            onRefresh={async () => {}}
          />
        )}
        {activeTab !== 'orders' && (
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: 40,
            textAlign: 'center',
            color: '#888',
            fontSize: 14,
          }}>
            預覽僅渲染「商品」分頁；切換上方按鈕看不同狀態。
          </div>
        )}
      </div>

      <BrandCopyrightBlock
        subtitle={ES_BRAND.memberAreaLabel}
        style={{
          padding: 20,
          textAlign: 'center',
          color: '#999',
          fontSize: 12,
        }}
      />
      <LiffStyles />
    </div>
  )
}
