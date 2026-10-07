/**
 * Design thinking (docs/design.md)
 * - Primary task: 找到學生，查看剩餘時數，必要時回報／修正時數。
 * - Avoid dashboard feel: no stat-card wall, no dense table, no explanatory callouts.
 * - Hierarchy: search/list → current balance → ledger; rare edits stay in dialogs.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMemberSearch } from '../../../hooks/useMemberSearch'
import { designSystem, getButtonStyle, getFontSize, getInputStyle, getLabelStyle } from '../../../styles/designSystem'
import { getLocalDateString } from '../../../utils/date'
import { useToast } from '../../../components/ui'
import {
  createCoachDesignatedCredit,
  fetchCoachDesignatedEligibleReports,
  fetchCoachDesignatedStudentDetail,
  fetchCoachDesignatedStudents,
  updateCoachDesignatedEntry,
  voidCoachDesignatedEntry,
} from './api'
import { buildCoachDesignatedBatches } from './fifo'
import {
  createCoachDesignatedShareImages,
  downloadCoachDesignatedImages,
  type CoachDesignatedShareRow,
} from './shareImages'
import type {
  CoachDesignatedEligibleReport,
  CoachDesignatedEntry,
  CoachDesignatedStudent,
  CoachDesignatedViewMode,
} from './types'

interface CoachDesignatedHoursProps {
  coachId: string
  isMobile: boolean
}

type ListFilter = 'active' | 'used' | 'all'

function displayName(student: CoachDesignatedStudent): string {
  return student.nickname || student.name
}

function compactDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function createRequestKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function dialogBackdrop(isMobile: boolean): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: isMobile ? 'flex-end' : 'center',
    justifyContent: 'center',
    padding: isMobile ? 0 : 16,
    zIndex: 1200,
  }
}

function dialogSurface(isMobile: boolean): React.CSSProperties {
  return {
    width: '100%',
    maxWidth: 520,
    maxHeight: isMobile ? '92dvh' : '85vh',
    overflowY: 'auto',
    padding: isMobile ? 18 : 24,
    borderRadius: isMobile
      ? `${designSystem.borderRadius.xl} ${designSystem.borderRadius.xl} 0 0`
      : designSystem.borderRadius.xl,
    background: designSystem.colors.background.card,
  }
}

export function CoachDesignatedHours({ coachId, isMobile }: CoachDesignatedHoursProps) {
  const toast = useToast()
  const memberSearch = useMemberSearch()
  const [students, setStudents] = useState<CoachDesignatedStudent[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [entries, setEntries] = useState<CoachDesignatedEntry[]>([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ListFilter>('active')
  const [viewMode, setViewMode] = useState<CoachDesignatedViewMode>('ledger')
  const [creditOpen, setCreditOpen] = useState(false)
  const [creditMemberId, setCreditMemberId] = useState<string | null>(null)
  const [creditDate, setCreditDate] = useState(getLocalDateString())
  const [creditMinutes, setCreditMinutes] = useState('')
  const [creditNote, setCreditNote] = useState('')
  const [creditRequestKey, setCreditRequestKey] = useState(createRequestKey)
  const [eligibleReports, setEligibleReports] = useState<CoachDesignatedEligibleReport[]>([])
  const [eligibleReportLimit, setEligibleReportLimit] = useState(5)
  const [selectedReportIds, setSelectedReportIds] = useState<Set<number>>(new Set())
  const [selectedReportMinutes, setSelectedReportMinutes] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [editingEntry, setEditingEntry] = useState<CoachDesignatedEntry | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')

  const selectedStudent = students.find((student) => student.member_id === selectedMemberId) || null
  const batches = useMemo(() => buildCoachDesignatedBatches(entries), [entries])
  const parsedEditMinutes = Number(editMinutes)
  const originalEditDelta = editingEntry?.delta_minutes ?? 0
  const nextEditDelta = editingEntry
    ? (editingEntry.entry_type === 'credit' ? parsedEditMinutes : -parsedEditMinutes)
    : 0
  const balanceAfterEdit = Number.isFinite(parsedEditMinutes)
    ? balance - originalEditDelta + nextEditDelta
    : balance
  const balanceAfterVoid = balance - originalEditDelta

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchCoachDesignatedStudents(coachId)
      setStudents(next)
      if (!isMobile && next.length > 0) {
        setSelectedMemberId((current) => current || next[0].member_id)
      }
    } catch (error) {
      console.error(error)
      toast.error('無法載入指定課學生')
    } finally {
      setLoading(false)
    }
  }, [coachId, isMobile, toast])

  const loadDetail = useCallback(async (memberId: string) => {
    setDetailLoading(true)
    try {
      const detail = await fetchCoachDesignatedStudentDetail(coachId, memberId)
      setEntries(detail.entries)
      setBalance(detail.balance)
    } catch (error) {
      console.error(error)
      toast.error('無法載入指定課明細')
    } finally {
      setDetailLoading(false)
    }
  }, [coachId, toast])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  useEffect(() => {
    if (selectedMemberId) void loadDetail(selectedMemberId)
    else {
      setEntries([])
      setBalance(0)
    }
  }, [loadDetail, selectedMemberId])

  useEffect(() => {
    if (!creditMemberId) {
      setEligibleReports([])
      setEligibleReportLimit(5)
      return
    }
    setEligibleReportLimit(5)
    fetchCoachDesignatedEligibleReports(coachId, creditMemberId)
      .then(setEligibleReports)
      .catch((error) => {
        console.error(error)
        toast.error('無法載入既有回報')
      })
  }, [coachId, creditMemberId, toast])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return students.filter((student) => {
      if (filter === 'active' && student.balance === 0) return false
      if (filter === 'used' && student.balance !== 0) return false
      if (!normalized) return true
      return [student.name, student.nickname || '']
        .some((value) => value.toLowerCase().includes(normalized))
    })
  }, [students, query, filter])

  const visibleEligibleReports = eligibleReports.slice(0, eligibleReportLimit)

  const resetCreditDialog = () => {
    setCreditOpen(false)
    setCreditMemberId(null)
    setCreditDate(getLocalDateString())
    setCreditMinutes('')
    setCreditNote('')
    setCreditRequestKey(createRequestKey())
    setEligibleReports([])
    setEligibleReportLimit(5)
    setSelectedReportIds(new Set())
    setSelectedReportMinutes({})
    memberSearch.reset()
  }

  const submitCredit = async () => {
    const minutes = Number(creditMinutes)
    if (!creditMemberId || !Number.isFinite(minutes) || minutes <= 0) {
      toast.warning('請選擇會員並輸入正確分鐘')
      return
    }
    setSaving(true)
    try {
      const selectedReports = eligibleReports.filter((report) =>
        selectedReportIds.has(report.participant_id),
      )
      const invalidReport = selectedReports.find((report) => {
        const deductionMinutes = Number(
          selectedReportMinutes[report.participant_id] ?? report.duration_min,
        )
        return !Number.isFinite(deductionMinutes)
          || deductionMinutes <= 0
          || deductionMinutes > report.duration_min
      })
      if (invalidReport) {
        toast.warning(`扣除分鐘需介於 1～${invalidReport.duration_min} 分`)
        return
      }
      await createCoachDesignatedCredit({
        coachId,
        memberId: creditMemberId,
        minutes,
        occurredAt: `${creditDate}T12:00:00+08:00`,
        note: creditNote,
        reportDeductions: selectedReports.map((report) => ({
          participant_id: report.participant_id,
          deduct: true,
          minutes: Number(
            selectedReportMinutes[report.participant_id] ?? report.duration_min,
          ),
        })),
        requestKey: creditRequestKey,
      })
      toast.success('指定課時數已新增')
      const nextMemberId = creditMemberId
      resetCreditDialog()
      await loadStudents()
      setSelectedMemberId(nextMemberId)
      await loadDetail(nextMemberId)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : '新增時數失敗')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (entry: CoachDesignatedEntry) => {
    setEditingEntry(entry)
    setEditMinutes(String(entry.minutes))
    setEditDate(entry.occurred_at.slice(0, 10))
    setEditNote(entry.note || '')
  }

  const saveEdit = async () => {
    if (!editingEntry) return
    const minutes = Number(editMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) {
      toast.warning('分鐘必須大於 0')
      return
    }
    setSaving(true)
    try {
      await updateCoachDesignatedEntry({
        entryId: editingEntry.id,
        minutes,
        occurredAt: editingEntry.entry_type === 'credit'
          ? `${editDate}T12:00:00+08:00`
          : null,
        note: editingEntry.entry_type === 'credit' ? editNote : null,
      })
      setEditingEntry(null)
      if (selectedMemberId) await loadDetail(selectedMemberId)
      await loadStudents()
      toast.success('指定課紀錄已修改')
    } catch (error) {
      console.error(error)
      toast.error('修改失敗')
    } finally {
      setSaving(false)
    }
  }

  const voidEntry = async () => {
    if (!editingEntry || !confirm('確定取消這筆指定課紀錄？')) return
    setSaving(true)
    try {
      await voidCoachDesignatedEntry(editingEntry.id)
      setEditingEntry(null)
      if (selectedMemberId) await loadDetail(selectedMemberId)
      await loadStudents()
      toast.success('指定課紀錄已取消')
    } catch (error) {
      console.error(error)
      toast.error('取消失敗')
    } finally {
      setSaving(false)
    }
  }

  const saveImages = async (
    title: string,
    rows: CoachDesignatedShareRow[],
    remainingMinutes: number,
    openingMinutes?: number,
  ) => {
    if (!selectedStudent) return
    setSaving(true)
    try {
      const files = await createCoachDesignatedShareImages({
        studentName: displayName(selectedStudent),
        title,
        rows,
        remainingMinutes,
        openingMinutes,
      })
      const shareData: ShareData = { files, title: `${displayName(selectedStudent)}指定課` }
      if (isMobile && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        downloadCoachDesignatedImages(files)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      console.error(error)
      toast.error('無法產生指定課圖片')
    } finally {
      setSaving(false)
    }
  }

  const ledgerRows: CoachDesignatedShareRow[] = entries
    .slice()
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    .map((entry) => ({
      date: compactDate(entry.occurred_at),
      detail: entry.entry_type === 'credit' ? (entry.note || '增加時數') : (entry.boat_name || '上課'),
      minutes: entry.delta_minutes,
    }))

  const listPanel = (
    <section>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜尋已有指定課的學生"
          aria-label="搜尋指定課學生"
          style={{ ...getInputStyle(isMobile), flex: 1 }}
        />
        <button
          type="button"
          data-track="coach_designated_add_open"
          onClick={() => setCreditOpen(true)}
          style={getButtonStyle('primary', 'medium', isMobile)}
        >
          增加時數
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          ['active', '進行中'],
          ['used', '已用完'],
          ['all', '全部'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-track={`coach_designated_filter_${value}`}
            onClick={() => setFilter(value)}
            style={{
              ...getButtonStyle(filter === value ? 'primary' : 'outline', 'small', isMobile),
              minHeight: isMobile ? 42 : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        style={{
          border: `1px solid ${designSystem.colors.border.light}`,
          borderRadius: designSystem.borderRadius.xl,
          overflow: 'hidden',
          background: designSystem.colors.background.card,
        }}
      >
        {loading ? (
          <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>載入中...</div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>目前沒有符合的學生</div>
        ) : filteredStudents.map((student, index) => (
          <button
            key={student.member_id}
            type="button"
            data-track="coach_designated_student_open"
            onClick={() => setSelectedMemberId(student.member_id)}
            style={{
              width: '100%',
              minHeight: isMobile ? 64 : 58,
              padding: '12px 14px',
              border: 0,
              borderBottom: index < filteredStudents.length - 1
                ? `1px solid ${designSystem.colors.border.light}`
                : 0,
              background: selectedMemberId === student.member_id
                ? designSystem.colors.background.hover
                : designSystem.colors.background.card,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: getFontSize('bodyLarge', isMobile) }}>
                {displayName(student)}
              </span>
              <span style={{ color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
                最近異動 {compactDate(student.last_activity_at)}
              </span>
            </span>
            <span
              style={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: student.balance < 0
                  ? designSystem.colors.warning[700]
                  : designSystem.colors.text.primary,
              }}
            >
              {student.balance} 分
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  const detailPanel = selectedStudent ? (
    <section>
      {isMobile && (
        <button
          type="button"
          onClick={() => setSelectedMemberId(null)}
          style={{ ...getButtonStyle('ghost', 'small', true), marginBottom: 8 }}
        >
          返回學生
        </button>
      )}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: getFontSize('h2', isMobile), fontWeight: 700 }}>
          {displayName(selectedStudent)}｜指定課
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: getFontSize('h1', isMobile),
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {balance} 分鐘
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button type="button" data-track="coach_designated_add_open" onClick={() => {
          setCreditMemberId(selectedStudent.member_id)
          memberSearch.selectMemberById(selectedStudent.member_id, displayName(selectedStudent))
          setCreditOpen(true)
        }} style={getButtonStyle('primary', 'medium', isMobile)}>
          增加時數
        </button>
        <button
          type="button"
          data-track="coach_designated_save_ledger_image"
          disabled={saving || entries.length === 0}
          onClick={() => void saveImages('指定課流水', ledgerRows, balance)}
          style={getButtonStyle('outline', 'medium', isMobile)}
        >
          {saving ? '產生中...' : '儲存圖片'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          ['ledger', '流水'],
          ['batches', '分批'],
        ] as const).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            data-track={`coach_designated_view_${mode}`}
            onClick={() => setViewMode(mode)}
            style={{
              ...getButtonStyle(viewMode === mode ? 'primary' : 'outline', 'medium', isMobile),
              flex: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {detailLoading ? (
        <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>載入中...</div>
      ) : viewMode === 'ledger' ? (
        <EntryList entries={entries} isMobile={isMobile} onEdit={openEdit} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {batches.unallocatedDeductions.length > 0 && (
            <div
              style={{
                padding: 14,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.warning[50],
                color: designSystem.colors.warning[700],
              }}
            >
              待補時數 {batches.unallocatedDeductions.reduce((sum, item) => sum + item.minutes, 0)} 分鐘
            </div>
          )}
          {batches.batches.map((batch) => {
            const rows = batch.allocations.map((allocation) => ({
              date: compactDate(allocation.entry.occurred_at),
              detail: allocation.entry.boat_name || '上課',
              minutes: -allocation.minutes,
            }))
            return (
              <div
                key={batch.credit.id}
                style={{
                  padding: 16,
                  borderRadius: designSystem.borderRadius.xl,
                  border: `1px solid ${designSystem.colors.border.light}`,
                  background: designSystem.colors.background.card,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{batch.credit.occurred_at.slice(0, 10)} 增加時數</div>
                    <div style={{ color: designSystem.colors.text.secondary, marginTop: 4 }}>
                      起始 {batch.credit.minutes} 分｜剩餘 {batch.remaining} 分
                    </div>
                  </div>
                  <button
                    type="button"
                    data-track="coach_designated_save_batch_image"
                    onClick={() => void saveImages(
                      `${batch.credit.occurred_at.slice(0, 10)} 增加時數`,
                      rows,
                      batch.remaining,
                      batch.credit.minutes,
                    )}
                    style={getButtonStyle('outline', 'small', isMobile)}
                  >
                    儲存圖片
                  </button>
                </div>
                {batch.allocations.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {batch.allocations.map((allocation) => (
                      <div
                        key={`${allocation.entry.id}-${allocation.minutes}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '8px 0',
                          borderTop: `1px solid ${designSystem.colors.border.light}`,
                        }}
                      >
                        <span>{compactDate(allocation.entry.occurred_at)} · {allocation.entry.boat_name || '上課'}</span>
                        <span>−{allocation.minutes} 分</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  ) : (
    <div style={{ padding: 32, color: designSystem.colors.text.secondary, textAlign: 'center' }}>
      選擇學生查看指定課時數
    </div>
  )

  return (
    <>
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          gap: 24,
        }}
      >
        {(!isMobile || !selectedMemberId) && listPanel}
        {(!isMobile || selectedMemberId) && detailPanel}
      </div>

      {creditOpen && (
        <div style={dialogBackdrop(isMobile)} onClick={resetCreditDialog}>
          <div style={dialogSurface(isMobile)} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: '0 0 18px', fontSize: getFontSize('h2', isMobile) }}>增加指定課時數</h2>
            {!creditMemberId && (
              <div style={{ marginBottom: 14, position: 'relative' }}>
                <label style={getLabelStyle(isMobile)}>選擇學生</label>
                <input
                  value={memberSearch.searchTerm}
                  onChange={(event) => memberSearch.handleSearchChange(event.target.value)}
                  style={getInputStyle(isMobile)}
                  placeholder="搜尋全部會員"
                />
                {memberSearch.filteredMembers.length > 0 && (
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: 'auto',
                      border: `1px solid ${designSystem.colors.border.light}`,
                      borderRadius: designSystem.borderRadius.md,
                    }}
                  >
                    {memberSearch.filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          memberSearch.selectMember(member)
                          setCreditMemberId(member.id)
                        }}
                        style={{
                          width: '100%',
                          padding: 12,
                          border: 0,
                          borderBottom: `1px solid ${designSystem.colors.border.light}`,
                          background: 'white',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        {member.nickname || member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {creditMemberId && (
              <div style={{ marginBottom: 14, fontWeight: 600 }}>{memberSearch.searchTerm}</div>
            )}
            <label style={getLabelStyle(isMobile)}>日期</label>
            <input
              type="date"
              value={creditDate}
              onChange={(event) => setCreditDate(event.target.value)}
              style={getInputStyle(isMobile)}
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>增加分鐘</label>
            <input
              type="text"
              inputMode="numeric"
              value={creditMinutes}
              onChange={(event) => setCreditMinutes(event.target.value.replace(/\D/g, ''))}
              style={getInputStyle(isMobile)}
            />
            <div style={{ height: 12 }} />
            <label style={getLabelStyle(isMobile)}>備註</label>
            <input value={creditNote} onChange={(event) => setCreditNote(event.target.value)} style={getInputStyle(isMobile)} placeholder="例如：300 分送 30 分" />

            {visibleEligibleReports.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>選擇既有回報扣除</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleEligibleReports.map((report) => {
                    const selected = selectedReportIds.has(report.participant_id)
                    return (
                      <div
                        key={report.participant_id}
                        style={{
                          padding: selected ? '10px 12px 12px' : '4px 12px',
                          border: `1px solid ${
                            selected
                              ? designSystem.colors.primary[500]
                              : designSystem.colors.border.light
                          }`,
                          borderRadius: designSystem.borderRadius.lg,
                          background: selected
                            ? designSystem.colors.primary[50]
                            : designSystem.colors.background.card,
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minHeight: 44,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            data-track="coach_designated_existing_report_toggle"
                            checked={selected}
                            onChange={(event) => {
                              const checked = event.target.checked
                              setSelectedReportIds((current) => {
                                const next = new Set(current)
                                if (checked) next.add(report.participant_id)
                                else next.delete(report.participant_id)
                                return next
                              })
                              setSelectedReportMinutes((current) => {
                                const next = { ...current }
                                if (checked) {
                                  next[report.participant_id] = String(report.duration_min)
                                } else {
                                  delete next[report.participant_id]
                                }
                                return next
                              })
                            }}
                            style={{ width: 20, height: 20, flex: '0 0 auto' }}
                          />
                          <span style={{ lineHeight: 1.45 }}>
                            {report.booking_start_at.slice(0, 16).replace('T', ' ')} · {report.boat_name || '上課'} · {report.duration_min} 分
                          </span>
                        </label>
                        {selected && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              marginLeft: 30,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span style={{ fontSize: getFontSize('bodySmall', isMobile) }}>扣除</span>
                            <input
                              aria-label={`扣除分鐘，上限 ${report.duration_min} 分`}
                              type="text"
                              inputMode="numeric"
                              value={selectedReportMinutes[report.participant_id] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value.replace(/\D/g, '')
                                setSelectedReportMinutes((current) => ({
                                  ...current,
                                  [report.participant_id]: value,
                                }))
                              }}
                              style={{
                                ...getInputStyle(isMobile),
                                width: 88,
                                minHeight: 44,
                                padding: '8px 10px',
                              }}
                            />
                            <span
                              style={{
                                color: designSystem.colors.text.secondary,
                                fontSize: getFontSize('bodySmall', isMobile),
                              }}
                            >
                              分（最多 {report.duration_min}）
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {eligibleReportLimit < eligibleReports.length && (
                    <button
                      type="button"
                      data-track="coach_designated_load_older_reports"
                      onClick={() => setEligibleReportLimit((current) => current + 5)}
                      style={{
                        ...getButtonStyle('outline', 'medium', isMobile),
                        width: '100%',
                        minHeight: 44,
                      }}
                    >
                      顯示更早回報（尚有 {eligibleReports.length - eligibleReportLimit} 筆）
                    </button>
                  )}
                </div>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 20,
                padding: '12px 0',
                position: 'sticky',
                bottom: isMobile ? -18 : -24,
                zIndex: 2,
                background: designSystem.colors.background.card,
                borderTop: `1px solid ${designSystem.colors.border.light}`,
              }}
            >
              <button type="button" onClick={resetCreditDialog} style={{ ...getButtonStyle('outline', 'medium', isMobile), flex: 1 }}>取消</button>
              <button type="button" data-track="coach_designated_add_submit" disabled={saving} onClick={() => void submitCredit()} style={{ ...getButtonStyle('primary', 'medium', isMobile), flex: 1 }}>
                {saving ? '儲存中...' : '確認新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEntry && (
        <div style={dialogBackdrop(isMobile)} onClick={() => setEditingEntry(null)}>
          <div style={dialogSurface(isMobile)} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ margin: '0 0 18px', fontSize: getFontSize('h2', isMobile) }}>
              {editingEntry.entry_type === 'credit' ? '修改增加時數' : '修改本次扣除'}
            </h2>
            {editingEntry.entry_type === 'credit' && (
              <>
                <label style={getLabelStyle(isMobile)}>日期</label>
                <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} style={getInputStyle(isMobile)} />
                <div style={{ height: 12 }} />
              </>
            )}
            <label style={getLabelStyle(isMobile)}>分鐘</label>
            <input value={editMinutes} onChange={(event) => setEditMinutes(event.target.value.replace(/\D/g, ''))} style={getInputStyle(isMobile)} />
            {editingEntry.entry_type === 'credit' && (
              <>
                <div style={{ height: 12 }} />
                <label style={getLabelStyle(isMobile)}>備註</label>
                <input value={editNote} onChange={(event) => setEditNote(event.target.value)} style={getInputStyle(isMobile)} />
              </>
            )}
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: designSystem.borderRadius.lg,
                background: designSystem.colors.background.main,
                color: designSystem.colors.text.secondary,
              }}
            >
              修改後剩餘：<strong style={{ color: designSystem.colors.text.primary }}>{balanceAfterEdit} 分</strong>
              <div style={{ marginTop: 4, fontSize: getFontSize('bodySmall', isMobile) }}>
                若取消此筆，剩餘將為 {balanceAfterVoid} 分
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button" data-track="coach_designated_entry_void" onClick={() => void voidEntry()} style={getButtonStyle('danger', 'medium', isMobile)}>取消此筆</button>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={() => setEditingEntry(null)} style={getButtonStyle('outline', 'medium', isMobile)}>返回</button>
              <button type="button" data-track="coach_designated_entry_save" disabled={saving} onClick={() => void saveEdit()} style={getButtonStyle('primary', 'medium', isMobile)}>儲存</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function EntryList({
  entries,
  isMobile,
  onEdit,
}: {
  entries: CoachDesignatedEntry[]
  isMobile: boolean
  onEdit: (entry: CoachDesignatedEntry) => void
}) {
  return (
    <div
      style={{
        border: `1px solid ${designSystem.colors.border.light}`,
        borderRadius: designSystem.borderRadius.xl,
        overflow: 'hidden',
        background: designSystem.colors.background.card,
      }}
    >
      {entries.length === 0 ? (
        <div style={{ padding: 24, color: designSystem.colors.text.secondary }}>尚無時數紀錄</div>
      ) : entries.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          data-track="coach_designated_entry_open"
          onClick={() => onEdit(entry)}
          style={{
            width: '100%',
            minHeight: isMobile ? 62 : 56,
            padding: '11px 14px',
            border: 0,
            borderBottom: index < entries.length - 1
              ? `1px solid ${designSystem.colors.border.light}`
              : 0,
            background: designSystem.colors.background.card,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span>
            <span style={{ display: 'block', color: designSystem.colors.text.secondary, fontSize: getFontSize('bodySmall', isMobile) }}>
              {compactDate(entry.occurred_at)}
            </span>
            <span>{entry.entry_type === 'credit' ? (entry.note || '增加時數') : (entry.boat_name || '上課')}</span>
          </span>
          <span
            style={{
              fontWeight: 700,
              color: entry.delta_minutes >= 0
                ? designSystem.colors.success[700]
                : designSystem.colors.danger[700],
            }}
          >
            {entry.delta_minutes >= 0 ? '+' : '−'}{Math.abs(entry.delta_minutes)} 分
          </span>
        </button>
      ))}
    </div>
  )
}
