import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast, ToastContainer } from '../../components/ui'
import { designSystem, getCardStyle } from '../../styles/designSystem'
import { isAdmin } from '../../utils/auth'

interface BindingStats {
  total: number
  bound: number
  rate: number
}

interface BoundMember {
  id: string
  name: string
  nickname: string | null
  phone: string | null
  line_user_id: string
}

interface UnboundMember {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

export function LineBindingStatus() {
  const user = useAuthUser()
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  // 權限檢查：只有管理員可以進入
  useEffect(() => {
    if (user && !isAdmin(user)) {
      toast.error('您沒有權限訪問此頁面')
      navigate('/')
    }
  }, [user, navigate, toast])
  
  // LINE 綁定資料
  const [loading, setLoading] = useState(true)
  const [bindingStats, setBindingStats] = useState<BindingStats | null>(null)
  const [boundMembersList, setBoundMembersList] = useState<BoundMember[]>([])
  const [unboundMembers, setUnboundMembers] = useState<UnboundMember[]>([])
  const [showBindingList, setShowBindingList] = useState<'bound' | 'unbound' | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  useEffect(() => {
    loadLineBindings()
  }, [])

  const loadLineBindings = async () => {
    setLoading(true)
    try {
      // 查詢所有 LINE 綁定
      const { data: bindings } = await supabase
        .from('line_bindings')
        .select('member_id, line_user_id, phone, members:member_id(id, name, nickname, phone)')
        .eq('status', 'active')
      
      // 建立會員綁定列表（包含 line_user_id）
      const boundList: BoundMember[] = []
      bindings?.forEach(b => {
        if (b.members) {
          const member = b.members as any
          boundList.push({ 
            id: member.id,
            name: member.name,
            nickname: member.nickname,
            phone: member.phone,
            line_user_id: b.line_user_id 
          })
        }
      })
      setBoundMembersList(boundList)
      
      // 統計
      const { data: allMembers } = await supabase
        .from('members')
        .select('id')
        .eq('status', 'active')
      
      const total = allMembers?.length || 0
      const bound = bindings?.length || 0
      setBindingStats({
        total,
        bound,
        rate: total > 0 ? Math.round((bound / total) * 100) : 0
      })
      
      // 未綁定會員
      const boundIds = bindings?.map(b => b.member_id).filter(Boolean) || []
      const { data: unbound } = await supabase
        .from('members')
        .select('id, name, nickname, phone')
        .eq('status', 'active')
        .not('id', 'in', `(${boundIds.length > 0 ? boundIds.join(',') : 'null'})`)
        .order('name')
      setUnboundMembers(unbound || [])
    } catch (error) {
      console.error('載入綁定失敗:', error)
      toast.error('載入綁定資料失敗')
    } finally {
      setLoading(false)
    }
  }
  
  // 過濾會員
  const filteredBoundMembers = boundMembersList.filter(m => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(query) ||
      (m.nickname?.toLowerCase() || '').includes(query) ||
      (m.phone || '').includes(query)
    )
  })
  
  const filteredUnboundMembers = unboundMembers.filter(m => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      m.name.toLowerCase().includes(query) ||
      (m.nickname?.toLowerCase() || '').includes(query) ||
      (m.phone || '').includes(query)
    )
  })

  const lineGreen = '#06C755'

  return (
    <div style={{
      minHeight: '100vh',
      background: designSystem.colors.background.main,
      padding: isMobile ? '12px' : '20px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <PageHeader title="📱 LINE 綁定狀態" user={user} showBaoLink={true} />
        
        {/* 綁定統計 */}
        <div style={getCardStyle(isMobile)}>
          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: designSystem.colors.text.secondary }}>
              載入中...
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '15px', color: designSystem.colors.text.primary }}>
                    📊 LINE 綁定率
                  </span>
                  <span style={{ fontSize: '24px', fontWeight: '700', color: lineGreen }}>
                    {bindingStats?.bound || 0} / {bindingStats?.total || 0}
                  </span>
                  <span style={{ fontSize: '16px', color: designSystem.colors.text.secondary }}>
                    ({bindingStats?.rate || 0}%)
                  </span>
                </div>
                <button
                  onClick={loadLineBindings}
                  style={{
                    padding: '8px 16px',
                    background: designSystem.colors.primary[500],
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  🔄 重新整理
                </button>
              </div>

              {/* 進度條 */}
              <div style={{
                marginTop: '16px',
                background: designSystem.colors.border.main,
                borderRadius: '10px',
                height: '20px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${bindingStats?.rate || 0}%`,
                  height: '100%',
                  background: lineGreen,
                  borderRadius: '10px',
                  transition: 'width 0.5s ease'
                }} />
              </div>

              {/* 切換按鈕 */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => setShowBindingList(showBindingList === 'bound' ? null : 'bound')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: showBindingList === 'bound' ? designSystem.colors.success[50] : 'white',
                    border: `2px solid ${showBindingList === 'bound' ? designSystem.colors.success[500] : designSystem.colors.border.main}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: showBindingList === 'bound' ? designSystem.colors.success[700] : designSystem.colors.text.primary,
                    cursor: 'pointer'
                  }}
                >
                  ✅ 已綁定 ({boundMembersList.length})
                </button>
                <button
                  onClick={() => setShowBindingList(showBindingList === 'unbound' ? null : 'unbound')}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: showBindingList === 'unbound' ? designSystem.colors.danger[50] : 'white',
                    border: `2px solid ${showBindingList === 'unbound' ? designSystem.colors.danger[500] : designSystem.colors.border.main}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: showBindingList === 'unbound' ? designSystem.colors.danger[700] : designSystem.colors.text.primary,
                    cursor: 'pointer'
                  }}
                >
                  ❌ 未綁定 ({unboundMembers.length})
                </button>
              </div>
            </>
          )}
        </div>

        {/* 搜尋 */}
        {showBindingList && (
          <div style={getCardStyle(isMobile)}>
            <input
              type="text"
              placeholder="🔍 搜尋會員姓名或電話..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${designSystem.colors.border.main}`,
                borderRadius: '8px',
                fontSize: isMobile ? '16px' : '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* 已綁定列表 */}
        {showBindingList === 'bound' && (
          <div style={getCardStyle(isMobile)}>
            <h3 style={{ 
              margin: '0 0 16px', 
              fontSize: '15px', 
              fontWeight: '600', 
              color: designSystem.colors.success[700] 
            }}>
              ✅ 已綁定會員 ({filteredBoundMembers.length})
            </h3>
            
            {filteredBoundMembers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: designSystem.colors.text.secondary }}>
                {searchQuery ? '沒有符合的會員' : '尚無已綁定會員'}
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
                gap: '8px' 
              }}>
                {filteredBoundMembers.map((m) => (
                  <div key={m.id} style={{ 
                    padding: '12px 16px',
                    background: designSystem.colors.success[50],
                    borderRadius: '8px',
                    border: `1px solid ${designSystem.colors.success[500]}40`
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: designSystem.colors.success[700]
                    }}>
                      ✅ {m.nickname || m.name}
                    </div>
                    {m.nickname && m.name !== m.nickname && (
                      <div style={{ fontSize: '12px', color: designSystem.colors.success[500] }}>
                        {m.name}
                      </div>
                    )}
                    {m.phone && (
                      <div style={{ fontSize: '12px', color: designSystem.colors.success[500], marginTop: '2px' }}>
                        📞 {m.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 未綁定列表 */}
        {showBindingList === 'unbound' && (
          <div style={getCardStyle(isMobile)}>
            <h3 style={{ 
              margin: '0 0 16px', 
              fontSize: '15px', 
              fontWeight: '600', 
              color: designSystem.colors.danger[700] 
            }}>
              ❌ 未綁定會員 ({filteredUnboundMembers.length})
            </h3>
            
            {filteredUnboundMembers.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: designSystem.colors.text.secondary }}>
                {searchQuery ? '沒有符合的會員' : '所有會員都已綁定！🎉'}
              </div>
            ) : (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', 
                gap: '8px' 
              }}>
                {filteredUnboundMembers.map(m => (
                  <div key={m.id} style={{ 
                    padding: '12px 16px',
                    background: designSystem.colors.danger[50],
                    borderRadius: '8px',
                    border: `1px solid ${designSystem.colors.danger[500]}40`
                  }}>
                    <div style={{ 
                      fontSize: '14px', 
                      fontWeight: '600',
                      color: designSystem.colors.danger[700]
                    }}>
                      {m.nickname || m.name}
                    </div>
                    {m.nickname && m.name !== m.nickname && (
                      <div style={{ fontSize: '12px', color: designSystem.colors.danger[500] }}>
                        {m.name}
                      </div>
                    )}
                    {m.phone && (
                      <div style={{ fontSize: '12px', color: designSystem.colors.danger[500], marginTop: '2px' }}>
                        📞 {m.phone}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 說明 */}
        <div style={getCardStyle(isMobile)}>
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: '600', color: designSystem.colors.text.primary }}>
            📝 說明
          </h3>
          <div style={{ 
            fontSize: '13px', 
            color: designSystem.colors.text.secondary,
            lineHeight: '1.8'
          }}>
            <p style={{ margin: '0 0 8px' }}>
              LINE 綁定狀態顯示會員是否已將 LINE 帳號與系統綁定。
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <strong>✅ 已綁定</strong>：會員可以在 LIFF 頁面查看自己的預約
            </p>
            <p style={{ margin: 0 }}>
              <strong>❌ 未綁定</strong>：會員尚未綁定 LINE，無法使用 LIFF 功能
            </p>
          </div>
        </div>
      </div>

      <Footer />
      <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
    </div>
  )
}

