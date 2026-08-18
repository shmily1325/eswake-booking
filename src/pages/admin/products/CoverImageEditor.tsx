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
import { designSystem, getFontSize } from '../../../styles/designSystem'
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
  /** 被點選的封面（顯示單一操作列，避免每張圖都塞按鈕） */
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [dragFromKey, setDragFromKey] = useState<string | null>(null)

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

  const commit = (next: DraftCoverImage[]) => {
    imagesRef.current = next
    onChange(next)
  }

  const removeAt = (idx: number) => {
    commit(imagesRef.current.filter((_, i) => i !== idx))
    setSelectedKey(null)
  }

  const moveToPrimary = (idx: number) => {
    if (idx <= 0) return
    const next = [...imagesRef.current]
    const [item] = next.splice(idx, 1)
    next.unshift(item)
    commit(next)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= imagesRef.current.length) return
    const next = [...imagesRef.current]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    commit(next)
  }

  /** 拖曳排序：把 from 插到 to 的位置（不是互換，比較符合直覺） */
  const reorder = (from: number, to: number) => {
    if (from === to) return
    const next = [...imagesRef.current]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    commit(next)
  }

  const { colors, borderRadius } = designSystem
  const labelStyle: React.CSSProperties = {
    fontSize: getFontSize('caption', Boolean(compact)),
    fontWeight: 600,
    color: colors.text.primary,
    marginBottom: 6,
    display: 'block',
  }
  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 140,
    padding: '8px 10px',
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border.main}`,
    fontSize: getFontSize('bodySmall', false),
    background: colors.background.card,
    color: colors.text.primary,
  }
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border.main}`,
    background: disabled || busy ? colors.secondary[100] : colors.background.card,
    color: colors.text.primary,
    cursor: disabled || busy ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    fontSize: getFontSize('bodySmall', false),
  }

  return (
    <div>
      <label style={labelStyle}>
        封面
        <span style={{ fontWeight: 400, color: colors.text.disabled, marginLeft: 6 }}>
          {images.length}/{MAX_VARIANT_COVER_IMAGES}
        </span>
      </label>

      {images.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, idx) => {
              const selected = img.clientKey === selectedKey
              return (
                <div
                  key={img.clientKey}
                  draggable={!disabled && images.length > 1}
                  onDragStart={() => setDragFromKey(img.clientKey)}
                  onDragEnd={() => setDragFromKey(null)}
                  onDragOver={(e) => {
                    if (dragFromKey && dragFromKey !== img.clientKey) e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!dragFromKey) return
                    const from = imagesRef.current.findIndex((x) => x.clientKey === dragFromKey)
                    if (from >= 0) reorder(from, idx)
                    setDragFromKey(null)
                  }}
                  onClick={() => setSelectedKey(selected ? null : img.clientKey)}
                  role="button"
                  aria-label={`封面 ${idx + 1}${idx === 0 ? '（主圖）' : ''}`}
                  title={images.length > 1 ? '點選可調整；可直接拖曳排序' : undefined}
                  style={{
                    width: thumbSize,
                    height: Math.round((thumbSize * 5) / 4),
                    borderRadius: borderRadius.sm,
                    overflow: 'hidden',
                    border: selected
                      ? `1.5px solid ${colors.primary[500]}`
                      : idx === 0
                        ? `1.5px solid ${colors.primary[500]}`
                        : `1px solid ${colors.border.light}`,
                    position: 'relative',
                    background: colors.secondary[50],
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: dragFromKey === img.clientKey ? 0.4 : 1,
                  }}
                >
                  <img
                    src={img.url}
                    alt={`封面 ${idx + 1}`}
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: 4,
                      bottom: 4,
                      fontSize: getFontSize('caption', true),
                      background: colors.primary[900],
                      color: colors.background.card,
                      padding: '1px 5px',
                      borderRadius: 4,
                    }}
                  >
                    {idx === 0 ? '主圖' : idx + 1}
                  </span>
                </div>
              )
            })}
          </div>

          {!disabled && selectedKey != null && (() => {
            const idx = images.findIndex((x) => x.clientKey === selectedKey)
            if (idx < 0) return null
            return (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  marginTop: 8,
                  padding: '6px 0',
                }}
              >
                <span style={{ fontSize: getFontSize('caption', true), color: colors.text.secondary }}>
                  第 {idx + 1} 張{idx === 0 ? '（主圖）' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  style={{ ...buttonStyle, padding: '4px 10px', fontSize: 12 }}
                >
                  ← 前移
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === images.length - 1}
                  style={{ ...buttonStyle, padding: '4px 10px', fontSize: 12 }}
                >
                  後移 →
                </button>
                <button
                  type="button"
                  onClick={() => moveToPrimary(idx)}
                  disabled={idx === 0}
                  style={{ ...buttonStyle, padding: '4px 10px', fontSize: 12 }}
                >
                  設為主圖
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(idx)}
                  style={{
                    ...buttonStyle,
                    padding: '4px 10px',
                    fontSize: getFontSize('caption', true),
                    color: colors.danger[700],
                  }}
                >
                  移除
                </button>
              </div>
            )
          })()}
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
                fontSize: getFontSize('bodySmall', Boolean(compact)),
                color: colors.text.secondary,
                textDecoration: 'underline',
                textUnderlineOffset: 2,
                display: 'block',
              }}
            >
              {link.label}
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
              <div style={{ fontSize: getFontSize('caption', true), color: colors.text.secondary, marginBottom: 6 }}>
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
                      border: `1px solid ${colors.border.light}`,
                      borderRadius: borderRadius.sm,
                      overflow: 'hidden',
                      cursor: disabled || busy ? 'not-allowed' : 'pointer',
                      background: colors.background.card,
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
