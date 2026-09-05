import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Button, useToast } from '../../../components/ui'
import { ConfirmModal } from '../../../components/ui/Modal'
import {
  designSystem,
  getButtonStyle,
  getFontSize,
  getInputStyle,
} from '../../../styles/designSystem'
import {
  createManagedProductBrand,
  fetchManagedProductBrands,
  normalizeProductBrandName,
  renameManagedProductBrand,
  setManagedProductBrandActive,
  type ManagedProductBrand,
} from './productBrandApi'

interface ProductBrandSelectorProps {
  value: string
  onChange: (value: string) => void
  currentUserEmail?: string | null
  disabled?: boolean
  isMobile: boolean
}

type PendingAction =
  | { kind: 'rename'; brand: ManagedProductBrand; nextName: string }
  | { kind: 'deactivate'; brand: ManagedProductBrand }

const { colors, borderRadius, spacing, zIndex } = designSystem

export function ProductBrandSelector({
  value,
  onChange,
  currentUserEmail,
  disabled = false,
  isMobile,
}: ProductBrandSelectorProps) {
  const toast = useToast()
  const [brands, setBrands] = useState<ManagedProductBrand[]>([])
  const [loading, setLoading] = useState(true)
  const [managerOpen, setManagerOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const load = useCallback(async (showError = false) => {
    try {
      setBrands(await fetchManagedProductBrands())
    } catch (error) {
      console.error('[ProductBrandSelector] load failed', error)
      if (showError) toast.error('載入品牌清單失敗')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    if (!managerOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !pendingAction) setManagerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [managerOpen, busy, pendingAction])

  const options = useMemo(() => {
    const byName = new Map<string, string>()
    for (const brand of brands) {
      if (brand.is_active) byName.set(brand.name, brand.name)
    }
    const current = normalizeProductBrandName(value)
    if (current) byName.set(current, current)
    return Array.from(byName.values()).sort((a, b) => a.localeCompare(b))
  }, [brands, value])

  const closeManager = () => {
    if (busy) return
    setManagerOpen(false)
    setAdding(false)
    setNewName('')
    setEditingId(null)
    setEditingName('')
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const created = await createManagedProductBrand(newName, currentUserEmail)
      onChange(created.name)
      setNewName('')
      setAdding(false)
      await load()
      toast.success(`已新增並選取 ${created.name}`)
    } catch (error) {
      console.error('[ProductBrandSelector] create failed', error)
      toast.error(error instanceof Error ? error.message : '新增品牌失敗')
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (brand: ManagedProductBrand) => {
    setBusy(true)
    try {
      await setManagedProductBrandActive(brand.id, true, currentUserEmail)
      await load()
      toast.success(`已恢復 ${brand.name}`)
    } catch (error) {
      console.error('[ProductBrandSelector] restore failed', error)
      toast.error('恢復品牌失敗')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    if (!pendingAction) return
    setBusy(true)
    try {
      if (pendingAction.kind === 'rename') {
        const oldName = pendingAction.brand.name
        const renamed = await renameManagedProductBrand(
          pendingAction.brand.id,
          pendingAction.nextName,
          currentUserEmail,
        )
        if (normalizeProductBrandName(value) === oldName) onChange(renamed.name)
        setEditingId(null)
        setEditingName('')
        toast.success(`已改為 ${renamed.name}`)
      } else {
        await setManagedProductBrandActive(
          pendingAction.brand.id,
          false,
          currentUserEmail,
        )
        toast.success(`已停用 ${pendingAction.brand.name}`)
      }
      setPendingAction(null)
      await load()
    } catch (error) {
      console.error('[ProductBrandSelector] update failed', error)
      toast.error(error instanceof Error ? error.message : '更新品牌失敗')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: CSSProperties = {
    ...getInputStyle(isMobile),
    width: '100%',
    boxSizing: 'border-box',
    background: colors.background.card,
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: spacing.sm,
          alignItems: 'stretch',
        }}
      >
        <select
          value={normalizeProductBrandName(value)}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || loading}
          style={inputStyle}
        >
          <option value="">{loading ? '載入品牌中…' : '請選擇品牌'}</option>
          {options.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          disabled={disabled || loading}
          style={{
            ...getButtonStyle('outline', isMobile ? 'large' : 'medium', isMobile),
            minWidth: isMobile ? 72 : 64,
            paddingInline: spacing.md,
          }}
        >
          管理
        </button>
      </div>

      {managerOpen && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeManager()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex.modal,
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: isMobile ? 0 : spacing.xl,
            background: 'rgba(0, 0, 0, 0.48)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-brand-manager-title"
            style={{
              width: '100%',
              maxWidth: isMobile ? 'none' : 560,
              maxHeight: isMobile ? '88dvh' : '82vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: isMobile
                ? `${borderRadius.xl} ${borderRadius.xl} 0 0`
                : borderRadius.xl,
              background: colors.background.card,
              boxShadow: designSystem.shadows.elevation[24],
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderBottom: `1px solid ${colors.border.light}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  id="product-brand-manager-title"
                  style={{
                    margin: 0,
                    color: colors.text.primary,
                    fontSize: getFontSize('h2', isMobile),
                  }}
                >
                  管理品牌
                </h2>
                <p
                  style={{
                    margin: `${spacing.xs} 0 0`,
                    color: colors.text.secondary,
                    fontSize: getFontSize('bodySmall', isMobile),
                  }}
                >
                  商品頁只顯示使用中的品牌
                </p>
              </div>
              <Button variant="outline" size={isMobile ? 'large' : 'small'} onClick={closeManager} disabled={busy}>
                完成
              </Button>
            </header>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: spacing.lg,
                paddingBottom: isMobile
                  ? `max(${spacing.xl}, env(safe-area-inset-bottom))`
                  : spacing.lg,
              }}
            >
              {adding ? (
                <div
                  style={{
                    display: 'grid',
                    gap: spacing.sm,
                    marginBottom: spacing.xl,
                  }}
                >
                  <label
                    htmlFor="new-product-brand"
                    style={{
                      color: colors.text.secondary,
                      fontSize: getFontSize('bodySmall', isMobile),
                      fontWeight: 600,
                    }}
                  >
                    新品牌名稱
                  </label>
                  <input
                    id="new-product-brand"
                    autoFocus
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    placeholder="例如 HYPERLITE"
                    disabled={busy}
                    style={inputStyle}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                    <Button
                      variant="outline"
                      size={isMobile ? 'large' : 'medium'}
                      disabled={busy}
                      onClick={() => {
                        setAdding(false)
                        setNewName('')
                      }}
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size={isMobile ? 'large' : 'medium'}
                      disabled={busy || !normalizeProductBrandName(newName)}
                      onClick={() => void handleCreate()}
                    >
                      {busy ? '新增中…' : '新增並選取'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  fullWidth
                  variant="primary"
                  size={isMobile ? 'large' : 'medium'}
                  disabled={busy}
                  onClick={() => setAdding(true)}
                  style={{ marginBottom: spacing.xl }}
                >
                  新增品牌
                </Button>
              )}

              <div style={{ display: 'grid', gap: spacing.md }}>
                {brands.map((brand) => {
                  const editing = editingId === brand.id
                  return (
                    <div
                      key={brand.id}
                      style={{
                        paddingBottom: spacing.md,
                        borderBottom: `1px solid ${colors.border.light}`,
                        opacity: brand.is_active ? 1 : 0.65,
                      }}
                    >
                      {editing ? (
                        <div style={{ display: 'grid', gap: spacing.sm }}>
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(event) => setEditingName(event.target.value)}
                            disabled={busy}
                            style={inputStyle}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                            <Button
                              variant="outline"
                              size={isMobile ? 'large' : 'small'}
                              disabled={busy}
                              onClick={() => {
                                setEditingId(null)
                                setEditingName('')
                              }}
                            >
                              取消
                            </Button>
                            <Button
                              variant="primary"
                              size={isMobile ? 'large' : 'small'}
                              disabled={
                                busy ||
                                !normalizeProductBrandName(editingName) ||
                                normalizeProductBrandName(editingName) === brand.name
                              }
                              onClick={() =>
                                setPendingAction({
                                  kind: 'rename',
                                  brand,
                                  nextName: normalizeProductBrandName(editingName),
                                })
                              }
                            >
                              儲存名稱
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: spacing.sm,
                            minHeight: isMobile ? 52 : 44,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                color: colors.text.primary,
                                fontSize: getFontSize('body', isMobile),
                                fontWeight: 600,
                              }}
                            >
                              {brand.name}
                            </div>
                            <div
                              style={{
                                marginTop: spacing.xs,
                                color: colors.text.secondary,
                                fontSize: getFontSize('caption', isMobile),
                              }}
                            >
                              {brand.is_active ? `${brand.productCount} 款商品` : `已停用 · ${brand.productCount} 款商品`}
                            </div>
                          </div>
                          {brand.is_active ? (
                            <>
                              <Button
                                variant="outline"
                                size={isMobile ? 'large' : 'small'}
                                disabled={busy}
                                onClick={() => {
                                  setEditingId(brand.id)
                                  setEditingName(brand.name)
                                }}
                              >
                                改名
                              </Button>
                              <Button
                                variant="outline"
                                size={isMobile ? 'large' : 'small'}
                                disabled={busy}
                                onClick={() => setPendingAction({ kind: 'deactivate', brand })}
                              >
                                停用
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size={isMobile ? 'large' : 'small'}
                              disabled={busy}
                              onClick={() => void handleRestore(brand)}
                            >
                              恢復
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      <ConfirmModal
        isOpen={pendingAction != null}
        title={pendingAction?.kind === 'rename' ? '確認改名' : '確認停用'}
        message={
          pendingAction?.kind === 'rename'
            ? `將「${pendingAction.brand.name}」改為「${pendingAction.nextName}」，並同步更新 ${pendingAction.brand.productCount} 款商品。`
            : pendingAction
              ? `停用「${pendingAction.brand.name}」後，新增商品時將無法選取；現有 ${pendingAction.brand.productCount} 款商品不受影響。`
              : ''
        }
        confirmText={pendingAction?.kind === 'rename' ? '確認改名' : '確認停用'}
        cancelText="取消"
        variant={pendingAction?.kind === 'deactivate' ? 'warning' : 'default'}
        isLoading={busy}
        onClose={() => {
          if (!busy) setPendingAction(null)
        }}
        onConfirm={() => void handleConfirm()}
      />
    </>
  )
}
