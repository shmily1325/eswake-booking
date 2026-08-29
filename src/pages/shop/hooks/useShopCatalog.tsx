import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchAllProductsWithVariants } from '../../admin/products/api'
import type { ProductWithVariants } from '../../admin/products/types'
import {
  isShopCatalogFresh,
  mergeShopCatalogProduct,
  prepareShopCatalog,
} from '../lib/shopCatalogCache'

interface ShopCatalogValue {
  products: ProductWithVariants[]
  ready: boolean
  error: string | null
  ensureLoaded: () => Promise<void>
  refresh: () => Promise<void>
  getProduct: (productId: string) => ProductWithVariants | null
  mergeProduct: (product: ProductWithVariants) => void
}

const ShopCatalogContext = createContext<ShopCatalogValue | null>(null)

export function ShopCatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const readyRef = useRef(false)
  const fetchedAtRef = useRef(0)
  const inflightRef = useRef<Promise<void> | null>(null)

  const refresh = useCallback((): Promise<void> => {
    if (inflightRef.current) return inflightRef.current

    const request = (async () => {
      try {
        const list = await fetchAllProductsWithVariants({ publicOnly: true })
        setProducts(prepareShopCatalog(list))
        fetchedAtRef.current = Date.now()
        setError(null)
      } catch (loadError) {
        console.error('[shop] catalog', loadError)
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      } finally {
        readyRef.current = true
        setReady(true)
        inflightRef.current = null
      }
    })()

    inflightRef.current = request
    return request
  }, [])

  const ensureLoaded = useCallback((): Promise<void> => {
    if (!readyRef.current || !isShopCatalogFresh(fetchedAtRef.current)) {
      return refresh()
    }
    return Promise.resolve()
  }, [refresh])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        readyRef.current &&
        !isShopCatalogFresh(fetchedAtRef.current)
      ) {
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refresh])

  const getProduct = useCallback(
    (productId: string) => products.find((product) => product.id === productId) ?? null,
    [products],
  )
  const mergeProduct = useCallback((product: ProductWithVariants) => {
    setProducts((current) => mergeShopCatalogProduct(current, product))
  }, [])

  const value = useMemo<ShopCatalogValue>(
    () => ({
      products,
      ready,
      error,
      ensureLoaded,
      refresh,
      getProduct,
      mergeProduct,
    }),
    [products, ready, error, ensureLoaded, refresh, getProduct, mergeProduct],
  )

  return (
    <ShopCatalogContext.Provider value={value}>
      {children}
    </ShopCatalogContext.Provider>
  )
}

export function useShopCatalog(): ShopCatalogValue {
  const context = useContext(ShopCatalogContext)
  if (!context) {
    throw new Error('useShopCatalog must be used within ShopCatalogProvider')
  }
  return context
}
