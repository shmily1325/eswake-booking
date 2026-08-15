import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageUploader, type ImageUploaderHandle } from './ImageUploader'
import { getProductImageSearchLinks } from './brandSearch'
import {
  importProductImageFromUrl,
  resolveProductImageCandidates,
  type ImageCandidate,
} from '../../../utils/fetchProductCoverImage'
import { uploadProductImage } from '../../../utils/imageUpload'
import { useToast } from '../../../components/ui'
import {
  createCoverImageClientKey,
  MAX_VARIANT_COVER_IMAGES,
  type DraftCoverImage,
} from './coverImages'

interface CoverImageEditorProps {
  images: DraftCoverImage[]
  entityId?: string | null
  storageFolder?: 'variants' | 'covers'
  brand: string
  model: string
  vendorCode?: string | null
  /** SKU 區塊用：精簡排版 */
  compact?: boolean
  disabled?: boolean
  onChange: (images: DraftCoverImage[]) => void
  onUpload?: (newPath: string) => void
}

export function CoverImageEditor({
  images,
  entityId,
  storageFolder = 'covers',
  brand,
  model,
  vendorCode,
  compact,
  disabled,
  onChange,
  onUpload,
}: CoverImageEditorProps) {
  const toast = useToast()
  const uploaderRef = useRef<ImageUploaderHandle>(null)
  /** 避免連續上傳時閉包讀到舊的 images，後寫蓋掉先寫 */
  const imagesRef = useRef(images)
  const [urlInput, setUrlInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [candidates, setCandidates] = useState<ImageCandidate[]>([])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  const searchLinks = useMemo(
    () => getProductImageSearchLinks(brand, model, vendorCode),
    [brand, model, vendorCode],
  )

  const busy = resolving || importing
  const atLimit = images.length >= MAX_VARIANT_COVER_IMAGES
  const thumbSize = compact ? 72 : 96

  const appendImage = (url: string, path: string) => {
    const current = imagesRef.current
    if (current.length >= MAX_VARIANT_COVER_IMAGES) {
      toast.error(`封面最多 ${MAX_VARIANT_COVER_IMAGES} 張`)
      return false
    }
    const next = [
      ...current,
      { clientKey: createCoverImageClientKey(), url, path },
    ]
    imagesRef.current = next
    onChange(next)
    return true
  }

  const handleUploadFile = async (file: File) => {
    if (imagesRef.current.length >= MAX_VARIANT_COVER_IMAGES) {
      toast.error(`封面最多 ${MAX_VARIANT_COVER_IMAGES} 張`)
      return
    }
    setImporting(true)
    try {
      const result = await uploadProductImage(file, { storageFolder, entityId })
      onUpload?.(result.path)
      const wasEmpty = imagesRef.current.length === 0
      if (appendImage(result.publicUrl, result.path)) {
        setUrlInput('')
        setCandidates([])
        toast.success(wasEmpty ? '封面已上傳' : '已加入封面圖')
      }
    } catch (e) {
      console.error('[CoverImageEditor] upload failed', e)
      toast.error(e instanceof Error ? e.message : '圖片上傳失敗')
    } finally {
      setImporting(false)
    }
  }

  const handleImport = async (
    imageUrl: string,
    opts?: { quiet?: boolean },
  ): Promise<boolean> => {
    if (imagesRef.current.length >= MAX_VARIANT_COVER_IMAGES) {
      toast.error(`封面最多 ${MAX_VARIANT_COVER_IMAGES} 張`)
      return false
    }
    setImporting(true)
    try {
      const result = await importProductImageFromUrl(imageUrl, {
        entityId,
        storageFolder,
      })
      onUpload?.(result.path)
      if (appendImage(result.publicUrl, result.path)) {
        setUrlInput('')
        if (!opts?.quiet) toast.success('封面已匯入')
        return true
      }
      return false
    } catch (e) {
      console.error('[CoverImageEditor] import failed', e)
      toast.error(e instanceof Error ? e.message : '匯入失敗')
      return false
    } finally {
      setImporting(false)
    }
  }

  const handleResolve = async (urlOverride?: string) => {
    const url = (urlOverride ?? urlInput).trim()
    if (!url) {
      toast.error('請貼上官網商品頁或圖片網址')
      return
    }
    if (urlOverride) setUrlInput(url)
    setResolving(true)
    setCandidates([])
    try {
      const list = await resolveProductImageCandidates(url)
      if (list.length === 0) {
        toast.error('找不到商品圖')
        return
      }
      setCandidates(list)
      const ok = await handleImport(list[0].url, { quiet: true })
      if (!ok) return
      if (list.length > 1) {
        toast.success(`已匯入第 1 張，下方還有 ${list.length - 1} 張可加`)
      } else {
        toast.success('封面已匯入')
      }
    } catch (e) {
      console.error('[CoverImageEditor] resolve failed', e)
      toast.error(e instanceof Error ? e.message : '解析網址失敗')
    } finally {
      setResolving(false)
    }
  }

  const clipboardImageToFile = (blob: Blob, mime: string): File => {
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg'
    return new File([blob], `paste.${ext}`, { type: mime })
  }

  const readClipboardImageFile = async (): Promise<File | null> => {
    if (!navigator.clipboard?.read) return null
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const mime = item.types.find((t) => t.startsWith('image/'))
      if (!mime) continue
      const blob = await item.getType(mime)
      return clipboardImageToFile(blob, mime)
    }
    return null
  }

  const pasteEventImageFile = (e: React.ClipboardEvent): File | null => {
    const items = e.clipboardData?.items
    if (!items) return null
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      const file = item.getAsFile()
      if (file) return file
    }
    return null
  }

  const handlePasteFromClipboard = async () => {
    if (disabled || busy) return
    try {
      const imageFile = await readClipboardImageFile()
      if (imageFile) {
        await handleUploadFile(imageFile)
        return
      }
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) {
        toast.error('剪貼簿是空的')
        return
      }
      setUrlInput(text)
      if (/^https?:\/\//i.test(text) || text.startsWith('//')) {
        await handleResolve(text)
      } else {
        toast.success('已貼上文字，確認後按「從 URL 抓圖」')
      }
    } catch (e) {
      console.error('[CoverImageEditor] clipboard read failed', e)
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        toast.error('無法讀取剪貼簿，請在輸入框用 Ctrl+V 貼上')
      } else {
        toast.error('讀取剪貼簿失敗')
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    if (disabled || busy) return
    const imageFile = pasteEventImageFile(e)
    if (imageFile) {
      e.preventDefault()
      void handleUploadFile(imageFile)
    }
  }

  const removeAt = (idx: number) => {
    const next = imagesRef.current.filter((_, i) => i !== idx)
    imagesRef.current = next
    onChange(next)
  }

  const moveToPrimary = (idx: number) => {
    if (idx <= 0) return
    const next = [...imagesRef.current]
    const [item] = next.splice(idx, 1)
    next.unshift(item)
    imagesRef.current = next
    onChange(next)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= imagesRef.current.length) return
    const next = [...imagesRef.current]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    imagesRef.current = next
    onChange(next)
  }

  const labelStyle: React.CSSProperties = {
    fontSize: compact ? 12 : 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    display: 'block',
  }
  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    margin: '0 0 8px',
    lineHeight: 1.4,
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d8d8d8',
    fontSize: 13,
  }
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #d8d8d8',
    background: disabled || busy ? '#f3f4f6' : '#fff',
    cursor: disabled || busy ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    fontSize: 13,
  }

  return (
    <div>
      <label style={labelStyle}>
        封面
        <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
          {images.length}/{MAX_VARIANT_COVER_IMAGES}
        </span>
      </label>
      {!compact && (
        <p style={hintStyle}>
          Shop 封面可多張。第 1 張為主圖；可從相簿、剪貼簿或 URL 加入。
        </p>
      )}
      {compact && (
        <p style={hintStyle}>可多張封面；第 1 張為主圖。相簿／貼上／URL。</p>
      )}

      {images.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 10,
          }}
        >
          {images.map((img, idx) => (
            <div
              key={img.clientKey}
              style={{
                width: thumbSize,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: thumbSize,
                  height: Math.round((thumbSize * 5) / 4),
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: idx === 0 ? '2px solid #111' : '1px solid #e5e7eb',
                  position: 'relative',
                  background: '#f3f4f6',
                }}
              >
                <img
                  src={img.url}
                  alt={`封面 ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {idx === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      fontSize: 10,
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}
                  >
                    主圖
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeAt(idx)}
                    aria-label="移除此封面"
                    title="移除"
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              {!disabled && images.length > 1 && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    style={{ ...buttonStyle, padding: '2px 6px', fontSize: 11 }}
                    title="左移"
                  >
                    ←
                  </button>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => moveToPrimary(idx)}
                      style={{ ...buttonStyle, padding: '2px 6px', fontSize: 11 }}
                      title="設為主圖"
                    >
                      主
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === images.length - 1}
                    style={{ ...buttonStyle, padding: '2px 6px', fontSize: 11 }}
                    title="右移"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          flexDirection: compact ? 'column' : 'row',
        }}
      >
        {!atLimit && (
          <ImageUploader
            ref={uploaderRef}
            value={null}
            entityId={entityId}
            storageFolder={storageFolder}
            disabled={disabled || busy || atLimit}
            onChange={(next) => {
              if (next.url && next.path) {
                onUpload?.(next.path)
                const wasEmpty = imagesRef.current.length === 0
                if (appendImage(next.url, next.path)) {
                  toast.success(wasEmpty ? '封面已上傳' : '已加入封面圖')
                }
              }
            }}
            onUpload={onUpload}
            size={thumbSize}
            emptyLabel="新增封面"
          />
        )}

        <div
          style={{
            flex: 1,
            minWidth: compact ? undefined : 200,
            width: compact ? '100%' : undefined,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => uploaderRef.current?.openPicker()}
              disabled={disabled || busy || atLimit}
              style={buttonStyle}
            >
              從相簿上傳
            </button>
          </div>

          {searchLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: compact ? 12 : 13,
                color: '#2563eb',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              🔍 {link.label}
            </a>
          ))}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onPaste={handlePaste}>
            <input
              style={inputStyle}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="貼官網商品頁或圖片網址"
              disabled={disabled || busy || atLimit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleResolve()
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handlePasteFromClipboard()}
              disabled={disabled || busy || atLimit}
              style={buttonStyle}
            >
              從剪貼簿貼上
            </button>
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={disabled || busy || atLimit || !urlInput.trim()}
              style={buttonStyle}
            >
              {resolving ? '解析中…' : importing ? '匯入中…' : '從 URL 抓圖'}
            </button>
          </div>

          {candidates.length > 1 && !atLimit && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                其他候選（點縮圖可再加入）：
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {candidates.slice(1).map((c) => (
                  <button
                    key={c.url}
                    type="button"
                    onClick={() => void handleImport(c.url)}
                    disabled={disabled || busy || atLimit}
                    title={c.source}
                    style={{
                      width: 56,
                      height: 70,
                      padding: 0,
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: disabled || busy ? 'not-allowed' : 'pointer',
                      background: '#fff',
                    }}
                  >
                    <img
                      src={c.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
