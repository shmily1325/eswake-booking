import { supabase } from '../lib/supabase'

export interface ImageCandidate {
  url: string
  source: string
}

export interface ImportedProductImage {
  path: string
  publicUrl: string
}

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('請先登入')
  return token
}

async function postProductImageApi<T>(body: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch('/api/fetch-product-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as { error?: string } & T
  if (!res.ok) {
    throw new Error(data.error ?? `請求失敗（${res.status}）`)
  }
  return data
}

/** 從商品頁或直接圖片 URL 解析候選官圖 */
export async function resolveProductImageCandidates(url: string): Promise<ImageCandidate[]> {
  const data = await postProductImageApi<{ candidates: ImageCandidate[] }>({
    action: 'resolve',
    url: url.trim(),
  })
  return data.candidates ?? []
}

/** 下載候選圖並上傳到 Storage（covers/ 路徑） */
export async function importProductCoverFromUrl(
  imageUrl: string,
  productId?: string | null,
): Promise<ImportedProductImage> {
  return postProductImageApi<ImportedProductImage>({
    action: 'import',
    imageUrl: imageUrl.trim(),
    productId: productId ?? null,
  })
}
