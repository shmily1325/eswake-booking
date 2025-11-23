import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { designSystem, getInputStyle, getTextStyle } from '../../styles/designSystem'
import { useRequireAdmin, clearPermissionCache, SUPER_ADMINS } from '../../utils/auth'
import { Button, Card, Badge } from '../../components/ui'

interface PermissionManagementProps {
  user: User
}

interface AllowedUser {
  id: string
  email: string
  created_at: string | null
  created_by: string | null
  notes: string | null
}

interface AdminUser {
  id: string
  email: string
  created_at: string | null
  created_by: string | null
  notes: string | null
}

// 隱藏的管理員（不在列表中顯示）
const HIDDEN_ADMINS = [
  'pjpan0511@gmail.com',
  'minlin1325@gmail.com'
]

export function PermissionManagement({ user }: PermissionManagementProps) {
  useRequireAdmin(user) // 只有管理員可以進入
  const { isMobile } = useResponsive()
  
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingUser, setAddingUser] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // 載入白名單
      const { data: allowedData, error: allowedError } = await supabase
        .from('allowed_users')
        .select('*')
        .order('email')

      if (allowedError) throw allowedError

      // 載入管理員列表
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .order('email')

      if (adminError) throw adminError

      setAllowedUsers(allowedData || [])
      setAdminUsers(adminData || [])
      
      // 清除權限緩存，強制重新載入
      clearPermissionCache()
    } catch (err) {
      setError('載入失敗: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAllowedUser = async () => {
    if (!newEmail.trim()) {
      setError('請輸入 Email')
      return
    }

    if (!newEmail.includes('@')) {
      setError('請輸入有效的 Email')
      return
    }

    setAddingUser(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase
        .from('allowed_users')
        .insert([{
          email: newEmail.trim().toLowerCase(),
          created_by: user.email,
          notes: null
        }])

      if (error) {
        if (error.code === '23505') {
          throw new Error('此 Email 已在白名單中')
        }
        throw error
      }

      setSuccess(`✅ 已將 ${newEmail} 加入白名單`)
      setNewEmail('')
      loadData()
    } catch (err) {
      setError('新增失敗: ' + (err as Error).message)
    } finally {
      setAddingUser(false)
    }
  }

  const handleRemoveAllowedUser = async (id: string, email: string) => {
    if (SUPER_ADMINS.includes(email)) {
      setError('無法刪除超級管理員')
      return
    }

    if (!confirm(`確定要將 ${email} 從白名單移除？\n移除後此用戶將無法登入系統。`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('allowed_users')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess(`✅ 已將 ${email} 從白名單移除`)
      loadData()
    } catch (err) {
      setError('刪除失敗: ' + (err as Error).message)
    }
  }

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setError('請輸入 Email')
      return
    }

    if (!newAdminEmail.includes('@')) {
      setError('請輸入有效的 Email')
      return
    }

    setAddingAdmin(true)
    setError('')
    setSuccess('')

    try {
      // 先加入管理員列表
      const { error: adminError } = await supabase
        .from('admin_users')
        .insert([{
          email: newAdminEmail.trim().toLowerCase(),
          created_by: user.email,
          notes: null
        }])

      if (adminError) {
        if (adminError.code === '23505') {
          throw new Error('此 Email 已是管理員')
        }
        throw adminError
      }

      // 同時加入白名單（使用 upsert）
      await supabase
        .from('allowed_users')
        .upsert([{
          email: newAdminEmail.trim().toLowerCase(),
          created_by: user.email,
          notes: '管理員'
        }], {
          onConflict: 'email',
          ignoreDuplicates: true
        })

      setSuccess(`✅ 已將 ${newAdminEmail} 加入管理員`)
      setNewAdminEmail('')
      loadData()
    } catch (err) {
      setError('新增失敗: ' + (err as Error).message)
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (id: string, email: string) => {
    if (SUPER_ADMINS.includes(email)) {
      setError('無法刪除超級管理員')
      return
    }

    if (!confirm(`確定要將 ${email} 從管理員移除？`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccess(`✅ 已將 ${email} 從管理員移除`)
      loadData()
    } catch (err) {
      setError('刪除失敗: ' + (err as Error).message)
    }
  }

  // 過濾掉隱藏的管理員
  const visibleAdmins = adminUsers.filter(admin => !HIDDEN_ADMINS.includes(admin.email))
  
  // 過濾掉隱藏的白名單用戶
  const visibleAllowedUsers = allowedUsers.filter(user => !HIDDEN_ADMINS.includes(user.email))

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...getTextStyle('h2', isMobile), color: designSystem.colors.text.secondary }}>載入中...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: designSystem.colors.background.main }}>
      <PageHeader user={user} title="權限管理" showBaoLink={true} />
      
      <div style={{ flex: 1, padding: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ ...getTextStyle('h1', isMobile), marginBottom: isMobile ? designSystem.spacing.lg : designSystem.spacing.xl }}>
          🔐 權限管理
        </h1>

        {/* 錯誤訊息 */}
        {error && (
          <Card
            variant="default"
            style={{
              background: '#ffebee',
              color: designSystem.colors.danger,
              borderLeft: `4px solid ${designSystem.colors.danger}`,
            }}
          >
            ❌ {error}
          </Card>
        )}

        {/* 成功訊息 */}
        {success && (
          <Card
            variant="default"
            style={{
              background: '#e8f5e9',
              color: designSystem.colors.success,
              borderLeft: `4px solid ${designSystem.colors.success}`,
            }}
          >
            {success}
          </Card>
        )}

        {/* 管理員列表 */}
        <Card style={{ marginBottom: designSystem.spacing.xl }}>
          <h2 style={{ ...getTextStyle('h2', isMobile), marginBottom: designSystem.spacing.md }}>
            👑 管理員列表
          </h2>
          <p style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.lg }}>
            管理員可以存取 BAO 後台和排班功能
          </p>

          {/* 新增管理員 */}
          <div style={{ 
            display: 'flex', 
            gap: designSystem.spacing.md, 
            marginBottom: designSystem.spacing.lg,
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <input
              type="email"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="輸入 Email 新增管理員"
              style={{
                ...getInputStyle(isMobile),
                flex: 1,
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddAdmin()
                }
              }}
            />
            <Button
              variant="primary"
              size="medium"
              onClick={handleAddAdmin}
              disabled={addingAdmin}
            >
              {addingAdmin ? '新增中...' : '➕ 新增'}
            </Button>
          </div>

          {/* 管理員列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.sm }}>
            {visibleAdmins.map((admin) => {
              const isSuperAdmin = SUPER_ADMINS.includes(admin.email)
              return (
                <div
                  key={admin.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: designSystem.spacing.md,
                    background: designSystem.colors.background.card,
                    border: `1px solid ${designSystem.colors.border}`,
                    borderRadius: designSystem.borderRadius.md,
                    flexWrap: 'wrap',
                    gap: designSystem.spacing.sm
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ ...getTextStyle('body', isMobile), fontWeight: '600' }}>
                      {admin.email}
                      {isSuperAdmin && (
                        <Badge
                          variant="warning"
                          size="small"
                          style={{
                            marginLeft: designSystem.spacing.sm,
                            background: '#ffd700',
                            color: '#000',
                          }}
                        >
                          超級管理員
                        </Badge>
                      )}
                    </div>
                    <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                      加入時間：{admin.created_at ? new Date(admin.created_at).toLocaleDateString('zh-TW') : '-'}
                    </div>
                  </div>
                  {!isSuperAdmin && (
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                    >
                      移除
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* 白名單列表 */}
        <Card>
          <h2 style={{ ...getTextStyle('h2', isMobile), marginBottom: designSystem.spacing.md }}>
            📋 登入白名單
          </h2>
          <p style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary, marginBottom: designSystem.spacing.lg }}>
            只有在白名單中的用戶才能登入系統
          </p>

          {/* 新增白名單用戶 */}
          <div style={{ 
            display: 'flex', 
            gap: designSystem.spacing.md, 
            marginBottom: designSystem.spacing.lg,
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="輸入 Email 加入白名單"
              style={{
                ...getInputStyle(isMobile),
                flex: 1,
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddAllowedUser()
                }
              }}
            />
            <Button
              variant="primary"
              size="medium"
              onClick={handleAddAllowedUser}
              disabled={addingUser}
            >
              {addingUser ? '新增中...' : '➕ 新增'}
            </Button>
          </div>

          {/* 白名單列表 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: designSystem.spacing.sm }}>
            {visibleAllowedUsers.map((allowedUser) => {
              const isSuperAdmin = SUPER_ADMINS.includes(allowedUser.email)
              const isAdmin = adminUsers.some(admin => admin.email === allowedUser.email)
              
              return (
                <div
                  key={allowedUser.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: designSystem.spacing.md,
                    background: designSystem.colors.background.card,
                    border: `1px solid ${designSystem.colors.border}`,
                    borderRadius: designSystem.borderRadius.md,
                    flexWrap: 'wrap',
                    gap: designSystem.spacing.sm
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ ...getTextStyle('body', isMobile), fontWeight: '600' }}>
                      {allowedUser.email}
                      {isAdmin && (
                        <Badge
                          variant="info"
                          size="small"
                          style={{ marginLeft: designSystem.spacing.sm }}
                        >
                          管理員
                        </Badge>
                      )}
                    </div>
                    <div style={{ ...getTextStyle('bodySmall', isMobile), color: designSystem.colors.text.secondary }}>
                      加入時間：{allowedUser.created_at ? new Date(allowedUser.created_at).toLocaleDateString('zh-TW') : '-'}
                    </div>
                  </div>
                  {!isSuperAdmin && (
                    <Button
                      variant="danger"
                      size="small"
                      onClick={() => handleRemoveAllowedUser(allowedUser.id, allowedUser.email)}
                    >
                      移除
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Footer />
    </div>
  )
}

