import { useRef, useState } from 'react'
import { uploadProductImage } from '../../../utils/imageUpload'
import { useToast } from '../../../components/ui'

interface ImageUploaderProps {
  /** 目前圖片 URL（沒有則顯示空白上傳區） */
  value: string | null | undefined
  /** 對應的 storage path（資訊用，不會在這裡刪檔） */
  path?: string | null
  /** @deprecated 請改用 entityId + storageFolder */
  variantId?: string | null
  /** Storage 子目錄，預設 variants */
  storageFolder?: 'variants' | 'covers'
  /** 路徑中的 id 段；新建尚無 id 時可留空（會用 new） */
  entityId?: string | null
  /** 上傳完成或刪除時的回呼，回傳新的 url + path（刪除時兩者都是 null） */
  onChange: (next: { url: string | null; path: string | null }) => void
  /**
   * 上傳成功後通知（給 ProductEditView 紀錄成 "session upload"）。
   * 真正的 storage 刪檔交給 ProductEditView 在 save / cancel 時統一處理，
   * 避免「上傳完換圖、最後又取消編輯」造成 DB 引用到已刪檔的 broken reference。
   */
  onUpload?: (newPath: string) => void
  /** 顯示尺寸（px），預設 96 */
  size?: number
  /** 唯讀（不可上傳/刪除） */
  disabled?: boolean
}

export function ImageUploader({
  value,
  variantId,
  storageFolder = 'variants',
  entityId,
  onChange,
  onUpload,
  size = 96,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [uploading, setUploading] = useState(false)

  const handleSelect = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // reset 讓同一張圖也能再選
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('請選擇圖片檔')
      return
    }
    setUploading(true)
    try {
      const result = await uploadProductImage(file, {
        storageFolder,
        entityId: entityId ?? variantId,
      })
      onUpload?.(result.path)
      onChange({ url: result.publicUrl, path: result.path })
    } catch (err) {
      console.error('[ImageUploader] upload failed', err)
      toast.error(err instanceof Error ? err.message : '圖片上傳失敗')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled || uploading) return
    // 只在 UI 端標記為「已移除」；實際 storage 檔由 ProductEditView 在 save 時統一刪
    onChange({ url: null, path: null })
  }

  // portrait 直式：寬度 = size、高度 = size * 16/9（手機直拍比例）
  const containerStyle: React.CSSProperties = {
    width: size,
    height: Math.round((size * 16) / 9),
    borderRadius: 12,
    border: value ? '1px solid #e0e0e0' : '2px dashed #c8c8c8',
    background: value ? '#fff' : '#fafafa',
    cursor: disabled || uploading ? 'not-allowed' : 'pointer',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: '#888',
    fontSize: size >= 80 ? 13 : 11,
    transition: 'border-color 0.15s',
    userSelect: 'none',
  }

  return (
    <div
      onClick={handleSelect}
      style={containerStyle}
      role="button"
      aria-label={disabled ? (value ? '商品圖片' : '無圖片') : value ? '更換圖片' : '上傳圖片'}
      title={disabled ? (value ? '商品圖片' : '尚未上傳圖片') : value ? '點選更換圖片' : '點選上傳圖片'}
    >
      {value ? (
        <>
          <img
            src={value}
            alt="商品圖"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
          />
          {!disabled && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              aria-label="刪除圖片"
              title="刪除圖片"
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            >
              ×
            </button>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
          <div style={{ fontSize: size >= 80 ? 24 : 18 }}>📷</div>
          <div style={{ marginTop: 4 }}>
            {uploading ? '上傳中…' : disabled ? '無圖片' : '上傳圖片'}
          </div>
        </div>
      )}
      {uploading && value && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#444',
          }}
        >
          上傳中…
        </div>
      )}
      {/*
        accept="image/*"：限定圖片檔
        不設 capture：手機會跳出原生選單（相簿 / 拍照 / 檔案），不會直接強制開相機
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
