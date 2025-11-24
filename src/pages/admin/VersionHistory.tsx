import { Link } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { UserMenu } from '../../components/UserMenu'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { Card } from '../../components/ui'

// 從 package.json 讀取版本號
const APP_VERSION = '0.92.0'

interface ChangelogEntry {
  version: string
  date: string
  changes: {
    icon: string
    description: string
  }[]
}

const changelog: ChangelogEntry[] = [
  {
    version: '0.92.0',
    date: '2025-04-29',
    changes: [
      { icon: '✨', description: '桌面重新整修維護' },
      { icon: '🎨', description: '排班界面優化調整' },
      { icon: '📱', description: '預約系統穩定維護' },
    ]
  },
  {
    version: '0.91.0',
    date: '2025-04-15',
    changes: [
      { icon: '✅', description: '會員儲值查詢功能增強' },
      { icon: '📋', description: '預約表單操作更順暢' },
      { icon: '🔧', description: '系統穩定性提升' },
    ]
  },
  {
    version: '0.90.0',
    date: '2025-04-01',
    changes: [
      { icon: '🚤', description: '船隻管理功能完善' },
      { icon: '👥', description: '會員資料管理優化' },
      { icon: '📊', description: '報表功能改進' },
      { icon: '🐛', description: '修正一些小問題' },
    ]
  }
]


export function VersionHistory() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #f8f9fa 0%, #e9ecef 100%)',
      padding: isMobile ? '20px' : '40px 20px'
    }}>
      <div style={{
        maxWidth: '900px',
        width: '100%',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '40px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <Link
                to="/bao"
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255, 255, 255, 0.7)',
                  color: '#333',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: isMobile ? '13px' : '14px',
                  border: '1px solid rgba(224, 224, 224, 0.5)',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.borderColor = '#000'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.7)'
                  e.currentTarget.style.borderColor = 'rgba(224, 224, 224, 0.5)'
                }}
              >
                ← BAO
              </Link>
            </div>
            <UserMenu user={user} />
          </div>

          {/* Title Section */}
          <div style={{
            textAlign: 'center',
            marginTop: '30px'
          }}>
            <div style={{
              fontSize: isMobile ? '60px' : '80px',
              marginBottom: '15px'
            }}>
              📋
            </div>
            <h1 style={{
              margin: '0 0 10px 0',
              fontSize: isMobile ? '28px' : '36px',
              fontWeight: '800',
              color: '#000',
              letterSpacing: '1px'
            }}>
              版本控管
            </h1>
            <p style={{
              margin: '0',
              fontSize: isMobile ? '14px' : '16px',
              color: '#666',
              fontWeight: '500'
            }}>
              ES Wake Booking v{APP_VERSION}
            </p>
          </div>
        </div>

        {/* Current Version Card */}
        <Card
          variant="highlighted"
          style={{
            marginBottom: '30px',
            background: 'linear-gradient(135deg, rgba(74, 144, 226, 0.1) 0%, rgba(25, 118, 210, 0.05) 100%)',
            border: '2px solid #4a90e2'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            marginBottom: '15px'
          }}>
            <div style={{
              fontSize: '32px'
            }}>
              ✨
            </div>
            <div>
              <h2 style={{
                margin: '0 0 5px 0',
                fontSize: isMobile ? '20px' : '24px',
                fontWeight: '700',
                color: '#000'
              }}>
                當前版本
              </h2>
              <p style={{
                margin: 0,
                fontSize: isMobile ? '14px' : '16px',
                color: '#666',
                fontWeight: '500'
              }}>
                v{APP_VERSION} ({new Date().toLocaleDateString('zh-TW')})
              </p>
            </div>
          </div>
          <div style={{
            padding: '15px',
            background: 'rgba(255, 255, 255, 0.7)',
            borderRadius: '12px',
            fontSize: isMobile ? '14px' : '15px',
            color: '#555',
            lineHeight: '1.6'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '600' }}>✅ 目前系統運作狀況：</p>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>系統運作穩定</li>
              <li>所有功能正常</li>
              <li>定期維護更新中</li>
            </ul>
          </div>
        </Card>

        {/* Changelog Timeline */}
        <div>
          <h2 style={{
            margin: '0 0 25px 0',
            fontSize: isMobile ? '22px' : '26px',
            fontWeight: '700',
            color: '#333',
            paddingBottom: '12px',
            borderBottom: '2px solid rgba(0, 0, 0, 0.1)'
          }}>
            📜 更新歷程
          </h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {changelog.map((entry, index) => (
              <Card
                key={entry.version}
                hoverable
                style={{
                  position: 'relative',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Version Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '15px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <div style={{
                      background: index === 0 
                        ? 'linear-gradient(135deg, #4a90e2 0%, #1976d2 100%)'
                        : 'linear-gradient(135deg, #9e9e9e 0%, #757575 100%)',
                      color: 'white',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}>
                      v{entry.version}
                    </div>
                    {index === 0 && (
                      <span style={{
                        background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        最新
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: isMobile ? '13px' : '14px',
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    {entry.date}
                  </div>
                </div>

                {/* Changes List */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {entry.changes.map((change, changeIndex) => (
                    <div
                      key={changeIndex}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        background: 'rgba(248, 249, 250, 0.6)',
                        borderRadius: '8px',
                        borderLeft: '3px solid #4a90e2'
                      }}
                    >
                      <span style={{
                        fontSize: '20px',
                        flexShrink: 0
                      }}>
                        {change.icon}
                      </span>
                      <span style={{
                        fontSize: isMobile ? '14px' : '15px',
                        color: '#333',
                        flex: 1,
                        lineHeight: '1.5'
                      }}>
                        {change.description}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* System Info Card */}
        <Card
          variant="glass"
          style={{
            marginTop: '40px',
            textAlign: 'center'
          }}
        >
          <div style={{
            fontSize: isMobile ? '14px' : '15px',
            color: '#666',
            lineHeight: '1.8'
          }}>
            <p style={{ margin: '0 0 10px 0', fontWeight: '600', color: '#333' }}>
              💡 關於版本記錄
            </p>
            <p style={{ margin: 0 }}>
              這裡記錄系統的所有更新和維護內容<br />
              讓大家知道我們一直在進步！
            </p>
          </div>
        </Card>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}

