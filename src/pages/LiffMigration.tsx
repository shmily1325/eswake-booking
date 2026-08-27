import { useEffect, useMemo, useState } from 'react'
import { Footer } from '../components/Footer'
import { PageHeader } from '../components/PageHeader'
import { PageShell } from '../components/PageShell'
import { useAuthUser } from '../contexts/AuthContext'
import { useResponsive } from '../hooks/useResponsive'
import { supabase } from '../lib/supabase'
import {
  designSystem,
  getBadgeStyle,
  getButtonStyle,
  getFontSize,
} from '../styles/designSystem'

type MigrationStatus = 'linked' | 'rebind' | 'unlinked'
type Filter = 'all' | MigrationStatus

type MemberRow = {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

type BindingRow = {
  member_id: string | null
  can_push: boolean
  last_liff_login_at: string | null
}

type MigrationMember = MemberRow & {
  migrationStatus: MigrationStatus
  lastLiffLoginAt: string | null
}

const STATUS_META: Record<
  MigrationStatus,
  { label: string; badge: 'success' | 'warning' | 'default' }
> = {
  linked: { label: 'LINE 已綁定', badge: 'success' },
  rebind: { label: '需重新綁定', badge: 'warning' },
  unlinked: { label: 'LINE 未綁定', badge: 'default' },
}

function formatLastLogin(value: string | null): string {
  if (!value) return '尚無登入紀錄'
  return `最後登入 ${value.replace('T', ' ').slice(0, 16)}`
}

export function LiffMigration() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [members, setMembers] = useState<MigrationMember[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProgress = async () => {
    setLoading(true)
    setError(null)
    try {
      const [membersResult, bindingsResult] = await Promise.all([
        supabase
          .from('members')
          .select('id, name, nickname, phone')
          .eq('status', 'active')
          .order('nickname', { ascending: true, nullsFirst: false }),
        supabase
          .from('line_bindings')
          .select('member_id, can_push, last_liff_login_at')
          .eq('status', 'active'),
      ])

      if (membersResult.error) throw membersResult.error
      if (bindingsResult.error) throw bindingsResult.error

      const bindingsByMember = new Map<string, BindingRow>()
      for (const binding of (bindingsResult.data || []) as BindingRow[]) {
        if (binding.member_id) bindingsByMember.set(binding.member_id, binding)
      }

      setMembers(
        ((membersResult.data || []) as MemberRow[]).map(member => {
          const binding = bindingsByMember.get(member.id)
          return {
            ...member,
            migrationStatus: !binding
              ? 'unlinked'
              : binding.can_push
                ? 'linked'
                : 'rebind',
            lastLiffLoginAt: binding?.last_liff_login_at || null,
          }
        }),
      )
    } catch (loadError) {
      console.error('載入 LIFF 搬移進度失敗:', loadError)
      setError('無法載入搬移進度，請確認資料庫搬移已完成。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProgress()
  }, [])

  const counts = useMemo(
    () => ({
      linked: members.filter(member => member.migrationStatus === 'linked').length,
      rebind: members.filter(member => member.migrationStatus === 'rebind').length,
      unlinked: members.filter(member => member.migrationStatus === 'unlinked').length,
    }),
    [members],
  )
  const migrationTotal = counts.linked + counts.rebind
  const migrationRate = migrationTotal === 0
    ? 0
    : Math.round((counts.linked / migrationTotal) * 100)
  const visibleMembers = filter === 'all'
    ? members
    : members.filter(member => member.migrationStatus === filter)

  const cardStyle = {
    padding: isMobile ? '14px' : '18px',
    marginBottom: isMobile ? '10px' : '14px',
    border: `1px solid ${designSystem.colors.border.light}`,
    borderRadius: designSystem.borderRadius.lg,
    background: designSystem.colors.background.card,
    boxShadow: designSystem.shadows.elevation[1],
  } as const

  return (
    <PageShell variant="focused" mobilePadding="12px" desktopPadding="20px">
      <PageHeader title="LIFF 搬移" user={user} />

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: designSystem.spacing.md,
          }}
        >
          <div>
            <div
              style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
                marginBottom: '4px',
              }}
            >
              搬移率
            </div>
            <div
              style={{
                color: designSystem.colors.text.primary,
                fontSize: isMobile ? '30px' : '36px',
                fontWeight: 700,
                lineHeight: 1.1,
              }}
            >
              {migrationRate}%
            </div>
            <div
              style={{
                color: designSystem.colors.text.secondary,
                fontSize: getFontSize('caption', isMobile),
                marginTop: '6px',
              }}
            >
              {counts.linked} / {migrationTotal} 位原已綁定會員
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadProgress()}
            disabled={loading}
            style={getButtonStyle('outline', 'small', isMobile)}
          >
            {loading ? '更新中…' : '重新整理'}
          </button>
        </div>

        <div
          style={{
            height: '10px',
            overflow: 'hidden',
            marginTop: designSystem.spacing.md,
            borderRadius: '999px',
            background: designSystem.colors.secondary[100],
          }}
        >
          <div
            style={{
              width: `${migrationRate}%`,
              height: '100%',
              borderRadius: '999px',
              background: designSystem.colors.success[500],
              transition: 'width 180ms ease',
            }}
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: designSystem.spacing.sm,
            marginBottom: designSystem.spacing.md,
          }}
        >
          {([
            { value: 'all', label: '全部', count: members.length },
            { value: 'linked', label: STATUS_META.linked.label, count: counts.linked },
            { value: 'rebind', label: STATUS_META.rebind.label, count: counts.rebind },
            { value: 'unlinked', label: STATUS_META.unlinked.label, count: counts.unlinked },
          ] as const).map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              style={{
                ...getButtonStyle(filter === option.value ? 'primary' : 'outline', 'small', isMobile),
              }}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>

        {error ? (
          <div style={{ color: designSystem.colors.danger[700], lineHeight: 1.5 }}>{error}</div>
        ) : !loading && visibleMembers.length === 0 ? (
          <div style={{ color: designSystem.colors.text.secondary }}>此分類目前沒有會員。</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleMembers.map(member => {
              const meta = STATUS_META[member.migrationStatus]
              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: designSystem.spacing.sm,
                    padding: isMobile ? '11px 10px' : '12px',
                    border: `1px solid ${designSystem.colors.border.light}`,
                    borderRadius: designSystem.borderRadius.md,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: designSystem.colors.text.primary,
                        fontSize: getFontSize('body', isMobile),
                        fontWeight: 600,
                      }}
                    >
                      {member.nickname || member.name}
                    </div>
                    <div
                      style={{
                        color: designSystem.colors.text.secondary,
                        fontSize: getFontSize('caption', isMobile),
                        marginTop: '2px',
                      }}
                    >
                      {formatLastLogin(member.lastLiffLoginAt)}
                    </div>
                  </div>
                  <span style={getBadgeStyle(meta.badge, 'small')}>{meta.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <Footer />
    </PageShell>
  )
}
