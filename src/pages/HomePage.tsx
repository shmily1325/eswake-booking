import { Link } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { UserMenu } from '../components/UserMenu'
import { DailyAnnouncement } from '../components/DailyAnnouncement'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalDateString } from '../utils/date'
import { isAdmin, isEditorAsync, hasViewAccess, isMemberPhoneOnlyEditor } from '../utils/auth'
import { supabase } from '../lib/supabase'
import { useState, useEffect, type CSSProperties } from 'react'

// 菜單按鈕 Skeleton 組件
function MenuButtonSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '35px 20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
        border: '1px solid rgba(224, 224, 224, 0.5)'
      }}
    >
      {/* Icon skeleton */}
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        marginBottom: '5px',
      }} />
      {/* Title skeleton */}
      <div style={{
        width: isMobile ? '60px' : '70px',
        height: isMobile ? '16px' : '18px',
        borderRadius: '4px',
        background: 'linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />
    </div>
  )
}

export function HomePage() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [isCoach, setIsCoach] = useState(false)
  const [isEditorUser, setIsEditorUser] = useState(false)
  const [hasViewPermission, setHasViewPermission] = useState(false)
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  
  // Detect V2 environment
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const isV2Environment = supabaseUrl.includes('v2') || supabaseUrl.includes('staging')
  const userIsAdmin = isAdmin(user)
  
  // 合併所有權限檢查，一次性載入
  useEffect(() => {
    const loadAllPermissions = async () => {
      if (!user) {
        setIsCoach(false)
        setIsEditorUser(false)
        setHasViewPermission(false)
        setPermissionsLoading(false)
        return
      }

      setPermissionsLoading(true)

      try {
        // 並行執行所有權限檢查
        const [coachResult, editorResult, viewAccessResult] = await Promise.all([
          // 1. 檢查是否為教練
          user.email 
            ? supabase.from('coaches').select('id').eq('user_email', user.email).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          // 2. 檢查是否為小編
          !userIsAdmin ? isEditorAsync(user) : Promise.resolve(false),
          // 3. 檢查一般權限
          hasViewAccess(user)
        ])

        // 設置教練狀態
        setIsCoach(!coachResult.error && !!coachResult.data)
        
        // 設置小編狀態（只有小編且不是管理員才顯示小編入口）
        setIsEditorUser(editorResult === true && !userIsAdmin)
        
        // 設置一般權限
        setHasViewPermission(viewAccessResult)
      } catch (error) {
        console.error('載入權限失敗:', error)
        setIsCoach(false)
        setIsEditorUser(false)
        setHasViewPermission(false)
      } finally {
        setPermissionsLoading(false)
      }
    }

    loadAllPermissions()
  }, [user, userIsAdmin])
  
  type HomeMenuItem = {
    title: string
    icon: string
    link: string
    subtitle?: string
    isAdmin?: boolean
    isCoach?: boolean
    isEditor?: boolean
    requiresViewAccess?: boolean
    alwaysShow?: boolean
    /** 顯示為停用卡片，不可點擊 */
    disabled?: boolean
    /** 僅列在 MEMBER_PHONE_ONLY_EDITORS（或環境變數）的帳號可見 */
    phoneEditorOnly?: boolean
  }

  const menuItemsMain: HomeMenuItem[] = [
    {
      title: '今日預約',
      icon: '📅',
      link: '/coach-daily',
      alwaysShow: true
    },
    {
      title: '預約表',
      icon: '📝',
      link: `/day?date=${getLocalDateString()}`,
      requiresViewAccess: true
    },
    {
      title: '教練回報',
      icon: '✅',
      link: '/my-report',
      isCoach: true
    },
    {
      title: '預約查詢',
      icon: '🔍',
      link: '/search',
      requiresViewAccess: true
    },
    {
      title: '明日提醒',
      icon: '⏰',
      link: '/tomorrow',
      requiresViewAccess: true
    },
    {
      title: '編輯記錄',
      icon: '📋',
      link: '/audit-log',
      requiresViewAccess: true
    },
    {
      title: '排班',
      icon: '📆',
      link: '/coach-assignment',
      isEditor: true
    },
    {
      title: '船隻管理',
      icon: '🚤',
      link: '/boats',
      isEditor: true
    },
    {
      title: '會員電話',
      icon: '📱',
      link: '/member-phone-edit',
      phoneEditorOnly: true
    },
    {
      title: 'BAO',
      icon: '🔧',
      link: '/bao',
      isAdmin: true
    }
  ]

  /** 橫線下方：區間時數合計（已停用，主視覺維持原樣，小標提示已燒毀） */
  const menuItemsBelowDivider: HomeMenuItem[] = [
    {
      title: '區間時數合計',
      icon: '⏱️',
      subtitle: '💣 已燒毀',
      link: '/boat-usage-hours',
      alwaysShow: true,
      disabled: true
    }
  ]

  const filterVisibleMenuItems = (items: HomeMenuItem[]) =>
    items.filter((item) => {
      if (item.alwaysShow) return true
      if (item.phoneEditorOnly) {
        return Boolean(user && isMemberPhoneOnlyEditor(user))
      }
      if (item.isAdmin && !userIsAdmin) return false
      if (item.isCoach && !isCoach) return false
      if (item.isEditor && !isEditorUser) return false
      if (item.requiresViewAccess) return hasViewPermission
      return true
    })

  const visibleMainMenu = filterVisibleMenuItems(menuItemsMain)
  const visibleBelowDivider = filterVisibleMenuItems(menuItemsBelowDivider)

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ 
        maxWidth: '600px', 
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header with Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '50px'
        }}>
          <img 
            src="/logo_circle (black).png" 
            alt="ES Wake Logo"
            style={{
              width: '140px',
              height: '140px',
              objectFit: 'contain',
              marginBottom: '20px',
              borderRadius: '50%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          />
          <h1 style={{ 
            margin: '0 0 20px 0',
            fontSize: isMobile ? '32px' : '42px',
            fontWeight: '800',
            color: '#000',
            letterSpacing: '2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            ES WAKE
          </h1>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '15px'
          }}>
            <UserMenu user={user} />
          </div>
        </div>

        {/* Daily Announcement */}
        <DailyAnnouncement />

        {/* Menu Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
          gap: '15px',
          marginBottom: '30px'
        }}>
          {/* Skeleton shimmer 動畫樣式 */}
          <style>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          
          {/* 載入中顯示 Skeleton */}
          {permissionsLoading ? (
            <>
              {Array.from({ length: isMobile ? 4 : 6 }).map((_, index) => (
                <MenuButtonSkeleton key={index} isMobile={isMobile} />
              ))}
            </>
          ) : (
            <>
              {visibleMainMenu.map((item) => (
                <Link
                  key={`main-${item.link}-${item.title}`}
                  to={item.link}
                  data-track={`nav_${item.link.replace(/^\//, '') || 'home'}`}
                  style={{
                    textDecoration: 'none',
                    background: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px',
                    padding: '35px 20px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    border: '1px solid rgba(224, 224, 224, 0.5)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-5px)'
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'
                    e.currentTarget.style.borderColor = '#000'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                    e.currentTarget.style.borderColor = '#e0e0e0'
                  }}
                  onTouchStart={(e) => {
                    e.currentTarget.style.transform = 'scale(0.97)'
                    e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.1)'
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                  }}
                >
                  <div style={{
                    fontSize: '42px',
                    marginBottom: '5px',
                  }}>
                    {item.icon}
                  </div>

                  <h2 style={{
                    margin: 0,
                    fontSize: isMobile ? '16px' : '18px',
                    fontWeight: '600',
                    color: '#000',
                    letterSpacing: '0.5px'
                  }}>
                    {item.title}
                  </h2>

                  {item.subtitle && (
                    <p style={{
                      margin: 0,
                      fontSize: isMobile ? '12px' : '13px',
                      color: '#999',
                      fontStyle: 'italic'
                    }}>
                      {item.subtitle}
                    </p>
                  )}
                </Link>
              ))}

              {visibleBelowDivider.length > 0 && (
                <>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      margin: '12px 0 8px',
                      width: '100%'
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: '1px',
                        background: 'rgba(0, 0, 0, 0.12)'
                      }}
                    />
                    <span
                      style={{
                        fontSize: isMobile ? '11px' : '12px',
                        fontWeight: 600,
                        color: 'rgba(0, 0, 0, 0.45)',
                        letterSpacing: '0.12em',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      小胖
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '1px',
                        background: 'rgba(0, 0, 0, 0.12)'
                      }}
                    />
                  </div>
                  {visibleBelowDivider.map((item) => {
                    const cardBaseStyle: CSSProperties = {
                      textDecoration: 'none',
                      background: 'rgba(255, 255, 255, 0.7)',
                      backdropFilter: 'blur(10px)',
                      borderRadius: '16px',
                      padding: '35px 20px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '12px',
                      border: '1px solid rgba(224, 224, 224, 0.5)'
                    }
                    const disabledExtra: CSSProperties = item.disabled
                      ? {
                          opacity: 0.62,
                          pointerEvents: 'none',
                          cursor: 'not-allowed'
                        }
                      : { cursor: 'pointer' }

                    const inner = (
                      <>
                        <div
                          style={{
                            fontSize: '42px',
                            marginBottom: '5px'
                          }}
                        >
                          {item.icon}
                        </div>

                        <h2
                          style={{
                            margin: 0,
                            fontSize: isMobile ? '16px' : '18px',
                            fontWeight: '600',
                            color: item.disabled ? '#444' : '#000',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {item.title}
                        </h2>

                        {item.subtitle && (
                          <p
                            style={{
                              margin: 0,
                              marginTop: '2px',
                              fontSize: isMobile ? '12px' : '13px',
                              color: item.disabled ? '#6a4c93' : '#999',
                              fontStyle: item.disabled ? 'normal' : 'italic',
                              fontWeight: item.disabled ? 600 : 400,
                              letterSpacing: '0.02em'
                            }}
                          >
                            {item.subtitle}
                          </p>
                        )}
                      </>
                    )

                    if (item.disabled) {
                      return (
                        <div
                          key={`below-${item.link}-${item.title}`}
                          role="group"
                          aria-disabled
                          aria-label={`${item.title}（已停用）`}
                          style={{ ...cardBaseStyle, ...disabledExtra }}
                        >
                          {inner}
                        </div>
                      )
                    }

                    return (
                      <Link
                        key={`below-${item.link}-${item.title}`}
                        to={item.link}
                        data-track={`nav_${item.link.replace(/^\//, '') || 'home'}`}
                        style={{ ...cardBaseStyle, ...disabledExtra }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-5px)'
                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)'
                          e.currentTarget.style.borderColor = '#000'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                          e.currentTarget.style.borderColor = '#e0e0e0'
                        }}
                        onTouchStart={(e) => {
                          e.currentTarget.style.transform = 'scale(0.97)'
                          e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.1)'
                        }}
                        onTouchEnd={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                        }}
                        onTouchCancel={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)'
                          e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                        }}
                      >
                        {inner}
                      </Link>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer with Copyright */}
        <div style={{
          textAlign: 'center',
          marginTop: '40px',
          paddingTop: '30px',
          borderTop: '1px solid rgba(0, 0, 0, 0.1)',
          color: '#666',
          fontSize: isMobile ? '12px' : '14px'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            © {new Date().getFullYear()} ES Wake. All Rights Reserved.
          </p>
          <p style={{ margin: 0, fontSize: isMobile ? '11px' : '12px', opacity: 0.7 }}>
            滑水預約管理系統
          </p>
        </div>
      </div>

      {/* Version indicator */}
      {isV2Environment && (
        <div style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '10px 18px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '2px solid rgba(255, 255, 255, 0.3)'
        }}>
          <span style={{ fontSize: '18px' }}>✨</span>
          <span>V3</span>
        </div>
      )}
    </div>
  )
}

