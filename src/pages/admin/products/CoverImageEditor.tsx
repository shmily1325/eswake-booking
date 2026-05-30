import { useMemo, useState } from 'react'
import { ImageUploader } from './ImageUploader'
import { getProductImageSearchLinks } from './brandSearch'
import {
  importProductCoverFromUrl,
  resolveProductImageCandidates,
  type ImageCandidate,
} from '../../../utils/fetchProductCoverImage'
import { uploadProductImage } from '../../../utils/imageUpload'
import { useToast } from '../../../components/ui'

interface CoverImageEditorProps {
  value: string | null
  path?: string | null
  productId?: string | null
  brand: string
  model: string
  /** 第一個 SKU 貨號，用來搜尋海芒果等經銷商 */
  vendorCode?: string | null
  disabled?: boolean
  onChange: (next: { url: string | null; path: string | null }) => void
  onUpload?: (newPath: string) => void
}

export function CoverImageEditor({
  value,
  path,
  productId,
  brand,
  model,
  vendorCode,
  disabled,
  onChange,
  onUpload,
}: CoverImageEditorProps) {
  const toast = useToast()
  const [urlInput, setUrlInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [candidates, setCandidates] = useState<ImageCandidate[]>([])

  const searchLinks = useMemo(
    () => getProductImageSearchLinks(brand, model, vendorCode),
    [brand, model, vendorCode],
  )

  const busy = resolving || importing

  const handleUploadFile = async (file: File) => {
    setImporting(true)
    try {
      const result = await uploadProductImage(file, {
        storageFolder: 'covers',
        entityId: productId,
      })
      onUpload?.(result.path)
      onChange({ url: result.publicUrl, path: result.path })
      setUrlInput('')
      setCandidates([])
      toast.success('封面圖已上傳')
    } catch (e) {
      console.error('[CoverImageEditor] upload failed', e)
      toast.error(e instanceof Error ? e.message : '圖片上傳失敗')
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
      await handleImport(list[0].url, { quiet: true })
      if (list.length > 1) {
        toast.success(`已匯入第 1 張，下方還有 ${list.length - 1} 張可換`)
      } else {
        toast.success('封面圖已匯入')
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

  const handleImport = async (imageUrl: string, opts?: { quiet?: boolean }) => {
    setImporting(true)
    try {
      const result = await importProductCoverFromUrl(imageUrl, productId)
      onUpload?.(result.path)
      onChange({ url: result.publicUrl, path: result.path })
      setUrlInput('')
      if (!opts?.quiet) toast.success('封面圖已匯入')
    } catch (e) {
      console.error('[CoverImageEditor] import failed', e)
      toast.error(e instanceof Error ? e.message : '匯入失敗')
    } finally {
      setImporting(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#444',
    marginBottom: 6,
  }

  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#6b7280',
    margin: '0 0 10px 0',
    lineHeight: 1.5,
  }

  const inputStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #d8d8d8',
    borderRadius: 8,
    boxSizing: 'border-box',
  }

  return (
    <div>
      <label style={labelStyle}>商城封面（官圖）</label>
      <p style={hintStyle}>
        給 /shop 列表與詳情主圖用。SKU 實拍照保留在下方規格區，不會被覆蓋。
        可貼商品頁網址，或從 Google 複製圖片後按「從剪貼簿貼上」／Ctrl+V。
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <ImageUploader
          value={value}
          path={path}
          entityId={productId}
          storageFolder="covers"
          disabled={disabled || busy}
          onChange={onChange}
          onUpload={onUpload}
          size={112}
        />

        <div style={{ flex: 1, minWidth: 200, display: 'grid', gap: 8 }}>
          {searchLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none', display: 'block' }}
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
              disabled={disabled || busy}
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
              disabled={disabled || busy}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid #d8d8d8',
                background: disabled || busy ? '#f3f4f6' : '#fff',
                cursor: disabled || busy ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              從剪貼簿貼上
            </button>
            <button
              type="button"
              onClick={() => void handleResolve()}
              disabled={disabled || busy || !urlInput.trim()}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid #d8d8d8',
                background: disabled || busy ? '#f3f4f6' : '#fff',
                cursor: disabled || busy ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {resolving ? '解析中…' : importing ? '匯入中…' : '從 URL 抓圖'}
            </button>
          </div>

          {candidates.length > 1 && (
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                其他候選（點縮圖可換封面）：
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {candidates.map((c) => (
                  <button
                    key={c.url}
                    type="button"
                    onClick={() => void handleImport(c.url)}
                    disabled={disabled || busy}
                    title={c.source}
                    style={{
                      width: 72,
                      height: 90,
                      padding: 0,
                      border: '2px solid #e5e7eb',
                      borderRadius: 8,
                      overflow: 'hidden',
                      cursor: disabled || busy ? 'not-allowed' : 'pointer',
                      background: '#fafafa',
                    }}
                  >
                    <img
                      src={c.url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
