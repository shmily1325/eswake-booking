/**
 * 商品圖片：前端壓縮 + 上傳到 Supabase Storage（bucket: product-images）
 *
 * 注意：bucket 在 migration 107 設定為 public，因此可直接用 publicUrl 顯示。
 * 換圖時應呼叫 removeProductImage() 把舊檔刪掉，避免 Storage 容量被無效檔佔滿。
 */

import { supabase } from '../lib/supabase'

const BUCKET = 'product-images'

/** 壓縮選項，預設足以對應一般商品圖（單一主圖） */
export interface CompressOptions {
  /** 最大寬度（像素），會等比縮放，預設 1024 */
  maxWidth?: number
  /** 最大高度（像素），預設 1024 */
  maxHeight?: number
  /** 輸出 quality（0-1），預設 0.82 */
  quality?: number
  /** 輸出格式，預設保留原格式（jpg/png/webp） */
  outputType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

/**
 * 用 canvas 壓縮圖片，回傳 Blob。
 * 在過大的圖也能避免上傳超過 5MB 限制（Storage bucket 上限）。
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<Blob> {
  const { maxWidth = 1024, maxHeight = 1024, quality = 0.82 } = options

  // 預設輸出 jpeg 以最大化壓縮率，但 png 透明圖保留 png
  const outputType: string = options.outputType ?? (file.type === 'image/png' ? 'image/png' : 'image/jpeg')

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('讀取檔案失敗'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('圖片解析失敗'))
    el.src = dataUrl
  })

  let { width, height } = img
  // 等比縮放至 maxWidth/maxHeight 內
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  width = Math.round(width * ratio)
  height = Math.round(height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('無法建立繪圖環境')
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('圖片壓縮失敗'))
      },
      outputType,
      quality,
    )
  })
}

/** 從 mime type 推斷副檔名 */
function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return 'jpg'
}

export interface UploadProductImageResult {
  /** Storage 內路徑，存到 product_variants.image_path 用於日後刪除 */
  path: string
  /** Public URL，存到 product_variants.image_url 用於顯示 */
  publicUrl: string
}

/**
 * 上傳商品圖片：先壓縮，再丟到 Supabase Storage。
 * 路徑格式：variants/{variantId or 'new'}/{timestamp}-{rand}.{ext}
 * 用 timestamp + rand 避免快取問題與並發碰撞。
 */
export async function uploadProductImage(
  file: File,
  opts: {
    variantId?: string | null
    /** Storage 子目錄：variants（SKU 圖）或 covers（商城封面） */
    storageFolder?: 'variants' | 'covers'
    /** 對應 variants/{id} 或 covers/{id} 的 id；新建時用 'new' */
    entityId?: string | null
    compress?: CompressOptions
  } = {},
): Promise<UploadProductImageResult> {
  const compressed = await compressImage(file, opts.compress)
  const ext = extFromMime(compressed.type || file.type)
  const folder = opts.storageFolder ?? 'variants'
  const entity = opts.entityId ?? opts.variantId ?? 'new'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${folder}/${entity}/${filename}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false,
    contentType: compressed.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

/**
 * 刪除商品圖片（換圖或刪除商品時呼叫）。
 * 失敗時印 warning 但不 throw，避免阻擋主流程（圖片殘留可由清理腳本處理）。
 */
export async function removeProductImage(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([path])
    if (error) {
      // 圖片殘留只是空間問題，不影響功能
      console.warn('[removeProductImage] failed to remove', path, error)
    }
  } catch (err) {
    console.warn('[removeProductImage] unexpected error', path, err)
  }
}
