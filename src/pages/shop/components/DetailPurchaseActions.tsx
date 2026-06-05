import { SHOP_DETAIL } from '../lib/shopCopy'

interface DetailPurchaseActionsProps {
  canPurchase: boolean
  onAddToCart: () => void
  onDirectInquiry: () => void
  layout: 'stacked' | 'sticky'
}

export function DetailPurchaseActions({
  canPurchase,
  onAddToCart,
  onDirectInquiry,
  layout,
}: DetailPurchaseActionsProps) {
  if (layout === 'sticky') {
    return (
      <div className="flex flex-1 min-w-0 gap-2">
        <button
          type="button"
          onClick={onDirectInquiry}
          disabled={!canPurchase}
          className="flex-1 min-w-0 h-11 px-3 rounded-md bg-black text-white text-sm font-semibold hover:bg-zinc-800 active:bg-zinc-700 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
        >
          <LineIcon className="w-4 h-4 shrink-0" />
          {SHOP_DETAIL.lineInquiry}
        </button>
        <button
          type="button"
          onClick={onAddToCart}
          disabled={!canPurchase}
          aria-label={SHOP_DETAIL.addToCart}
          className="shrink-0 h-11 w-11 rounded-md border-2 border-black bg-white text-black hover:bg-gray-50 active:bg-gray-100 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed inline-flex items-center justify-center"
        >
          <CartIcon className="w-5 h-5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        type="button"
        onClick={onDirectInquiry}
        disabled={!canPurchase}
        className="flex-1 h-12 px-4 rounded-md bg-black text-white font-semibold hover:bg-zinc-800 active:bg-zinc-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm inline-flex items-center justify-center gap-2"
      >
        <LineIcon className="w-5 h-5 shrink-0" />
        {SHOP_DETAIL.lineInquiry}
      </button>
      <button
        type="button"
        onClick={onAddToCart}
        disabled={!canPurchase}
        className="flex-1 h-12 px-4 rounded-md bg-white text-black font-semibold border-2 border-black hover:bg-gray-50 active:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
      >
        <CartIcon className="w-5 h-5 shrink-0" />
        {SHOP_DETAIL.addToCart}
      </button>
    </div>
  )
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12.5a2 2 0 0 0 2 1.5h8a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  )
}

function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3C6.48 3 2 6.74 2 11.31c0 4.05 3.54 7.46 8.32 8.16.32.07.76.21.87.49.1.25.07.64.03.9l-.14.85c-.04.25-.2.99.86.54 1.06-.45 5.73-3.38 7.82-5.78C20.95 14.96 22 13.27 22 11.31 22 6.74 17.52 3 12 3zM8.34 13.74h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v2.95h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53zm1.79-.52c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm4.07 0c0 .22-.14.42-.36.49-.06.02-.11.03-.17.03-.16 0-.32-.07-.42-.21l-1.83-2.49v2.19c0 .29-.23.52-.52.52-.29 0-.52-.23-.52-.52V9.74c0-.22.14-.42.36-.49.06-.02.11-.03.17-.03.16 0 .32.08.41.21l1.84 2.49V9.74c0-.29.23-.52.52-.52.29 0 .52.23.52.52v3.48zm3.32-2.27c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48c.29 0 .52.23.52.52 0 .29-.23.53-.52.53h-2c-.29 0-.52-.24-.52-.52V9.74c0-.29.23-.52.52-.52h2c.29 0 .52.23.52.52 0 .29-.23.52-.52.52h-1.48v.71h1.48z" />
    </svg>
  )
}
