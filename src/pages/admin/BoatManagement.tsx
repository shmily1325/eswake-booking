import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { Footer } from '../../components/Footer'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import type { Boat, BoatUnavailableDate } from '../../types/booking'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'
import {
  designSystem,
  getPageContentShellStyle,
} from '../../styles/designSystem'
import { hasEditorFeatureAsync, isAdmin } from '../../utils/auth'
import { sortBoatsByDisplayOrder } from '../../utils/boatUtils'
import { isFacility, isLandCourse } from '../../utils/facility'
import {
  AdminModal,
  AdminModalHeader,
  adminTextInputStyle,
  DateRangeFields,
  FormFieldLabel,
  HintBox,
  TimeSelectField,
} from '../../components/admin/AdminFormUi'

const pageBg = designSystem.colors.background.main
const cardBorder = `1px solid ${designSystem.colors.border.light}`
const cardShadow = designSystem.shadows.elevation[1]
const defaultBoatColor = designSystem.colors.info[500]

export function BoatManagement() {
    const user = useAuthUser()
    const navigate = useNavigate()
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [hasAccess, setHasAccess] = useState(false)
    const [boats, setBoats] = useState<Boat[]>([])
    const [unavailableDates, setUnavailableDates] = useState<BoatUnavailableDate[]>([])
    const [activeTab, setActiveTab] = useState<'boats' | 'pricing'>('boats') // Tab 切換
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newBoatName, setNewBoatName] = useState('')
    const [newBoatColor, setNewBoatColor] = useState(defaultBoatColor)
    const [addLoading, setAddLoading] = useState(false)
    const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false)
    const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [reason, setReason] = useState('')
    const [unavailableLoading, setUnavailableLoading] = useState(false)
    const [editingUnavailableId, setEditingUnavailableId] = useState<number | null>(null)
    const [unavailableMultiDay, setUnavailableMultiDay] = useState(false)
    const { isMobile } = useResponsive()
    
    // 月份篩選
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    
    // 價格設定狀態
    const [editingPrices, setEditingPrices] = useState<{[key: string]: {balance: string, vip: string}}>({})
    const [savingPrices, setSavingPrices] = useState<{[key: string]: boolean}>({})
    
    // 說明展開狀態
    const [showHelp, setShowHelp] = useState(false)

    // 權限檢查
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) return
            
            const canAccess = await hasEditorFeatureAsync(user, 'can_boats')
            if (!canAccess) {
                toast.error('您沒有權限訪問此頁面')
                navigate('/')
                return
            }
            
            setHasAccess(true)
            loadData()
        }
        
        checkAccess()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const loadData = async () => {
        try {
            const { data: boatsData } = await supabase
                .from('boats')
                .select('*')
                .order('id')

            // 查詢所有維修記錄（包括歷史記錄）
            const { data: unavailableData } = await supabase
                .from('boat_unavailable_dates')
                .select('*')
                .eq('is_active', true)
                .order('start_date', { ascending: false })

            if (boatsData) {
                setBoats(sortBoatsByDisplayOrder(boatsData))
            }
            if (unavailableData) setUnavailableDates(unavailableData)
        } catch (error) {
            console.error('載入失敗:', error)
        } finally {
            setLoading(false)
        }
    }

    const filterUnavailableByMonth = (unavailables: BoatUnavailableDate[], month: string): BoatUnavailableDate[] => {
        const [year, monthNum] = month.split('-').map(Number)
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`
        const lastDay = new Date(year, monthNum, 0).getDate()
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        return unavailables.filter(unavailable => {
            // 如果維修的開始或結束日期在該月份內，就顯示
            return (unavailable.start_date <= endDate && unavailable.end_date >= startDate)
        })
    }

    const handleAddBoat = async () => {
        if (!newBoatName.trim()) {
            toast.warning('請輸入船隻名稱')
            return
        }

        setAddLoading(true)
        try {
            const { error } = await supabase
                .from('boats')
                .insert([{
                    name: newBoatName.trim(),
                    color: newBoatColor,
                    is_active: true,
                    created_at: getLocalTimestamp()
                }])

            if (error) throw error

            toast.success('船隻新增成功！')
            setNewBoatName('')
            setNewBoatColor(defaultBoatColor)
            setAddDialogOpen(false)
            loadData()
        } catch (error) {
            toast.error('新增船隻失敗：' + (error as Error).message)
        } finally {
            setAddLoading(false)
        }
    }

    const handleToggleStatus = async (boat: Boat) => {
        try {
            const { error } = await supabase
                .from('boats')
                .update({ is_active: !boat.is_active })
                .eq('id', boat.id)

            if (error) throw error

            toast.success(boat.is_active ? '💣船隻已燒毀' : '船隻已啟用')
            loadData()
        } catch (error) {
            toast.error('更新狀態失敗：' + (error as Error).message)
        }
    }

    const handleAddUnavailable = async () => {
        if (!selectedBoat) return
        if (!startDate || !endDate) {
            toast.warning('請選擇日期')
            return
        }

        if (endDate < startDate) {
            toast.warning('結束日期不能早於開始日期')
            return
        }

        // 如果有填時間，必須兩個都填
        if ((startTime && !endTime) || (!startTime && endTime)) {
            toast.warning('請完整填寫開始與結束時間，或兩者皆留空(代表全天)')
            return
        }

        if (startTime && endTime && startDate === endDate && endTime <= startTime) {
            toast.warning('結束時間必須晚於開始時間')
            return
        }

        setUnavailableLoading(true)
        try {
            if (editingUnavailableId != null) {
                const { error } = await supabase
                    .from('boat_unavailable_dates')
                    .update({
                        boat_id: selectedBoat.id,
                        start_date: startDate,
                        end_date: endDate,
                        start_time: startTime || null,
                        end_time: endTime || null,
                        reason: reason || '維修保養',
                        updated_at: getLocalTimestamp(),
                    })
                    .eq('id', editingUnavailableId)

                if (error) throw error
                toast.success('維修/停用時段已更新')
            } else {
                const { error } = await supabase
                    .from('boat_unavailable_dates')
                    .insert([{
                        boat_id: selectedBoat.id,
                        start_date: startDate,
                        end_date: endDate,
                        start_time: startTime || null,
                        end_time: endTime || null,
                        reason: reason || '維修保養',
                        created_by: user?.id || null,
                        created_at: getLocalTimestamp()
                    }])

                if (error) throw error
                toast.success('維修/停用時段已設定')
            }

            setUnavailableDialogOpen(false)
            setEditingUnavailableId(null)
            setSelectedBoat(null)
            setStartDate('')
            setEndDate('')
            setStartTime('')
            setEndTime('')
            setReason('')
            loadData()
        } catch (error) {
            toast.error(
                editingUnavailableId != null
                    ? '更新維修/停用失敗：' + (error as Error).message
                    : '設定維修/停用失敗：' + (error as Error).message
            )
        } finally {
            setUnavailableLoading(false)
        }
    }

    const handleDeleteUnavailable = async (record: BoatUnavailableDate) => {
        if (!confirm('確定要刪除這個維修/停用記錄嗎？')) return

        try {
            const { error } = await supabase
                .from('boat_unavailable_dates')
                .delete()
                .eq('id', record.id)

            if (error) throw error

            toast.success('記錄已刪除')
            loadData()
        } catch (error) {
            toast.error('刪除記錄失敗：' + (error as Error).message)
        }
    }

    const unavailableTimeToForm = (t: string | null | undefined): string => {
        if (!t) return ''
        const m = t.match(/^(\d{1,2}):(\d{2})/)
        if (!m) return ''
        return `${m[1].padStart(2, '0')}:${m[2]}`
    }

    const openUnavailableDialog = (boat: Boat) => {
        setEditingUnavailableId(null)
        setSelectedBoat(boat)
        setUnavailableMultiDay(false)
        const dateStr = getLocalDateString()
        setStartDate(dateStr)
        setEndDate(dateStr)
        setStartTime('')
        setEndTime('')
        setReason('')
        setUnavailableDialogOpen(true)
    }

    const openEditUnavailableDialog = (boat: Boat, record: BoatUnavailableDate) => {
        setEditingUnavailableId(record.id)
        setSelectedBoat(boat)
        setUnavailableMultiDay(record.start_date !== record.end_date)
        setStartDate(record.start_date)
        setEndDate(record.end_date)
        setStartTime(unavailableTimeToForm(record.start_time))
        setEndTime(unavailableTimeToForm(record.end_time))
        setReason(record.reason || '')
        setUnavailableDialogOpen(true)
    }

    const closeUnavailableDialog = () => {
        setUnavailableDialogOpen(false)
        setEditingUnavailableId(null)
        setSelectedBoat(null)
        setUnavailableMultiDay(false)
        setStartDate('')
        setEndDate('')
        setStartTime('')
        setEndTime('')
        setReason('')
    }

    const isUnavailableSingleDay = startDate === endDate

    const handleUnavailableStartChange = (v: string) => {
        setStartDate(v)
        if (!unavailableMultiDay) setEndDate(v)
        else if (endDate < v) setEndDate(v)
    }

    const handleUnavailableEndChange = (v: string) => {
        setEndDate(v)
    }

    const handleUnavailableMultiDayChange = (v: boolean) => {
        setUnavailableMultiDay(v)
        if (!v && startDate) setEndDate(startDate)
    }

    // 初始化編輯價格
    const initEditingPrice = (boat: Boat) => {
        if (!editingPrices[boat.id]) {
            setEditingPrices(prev => ({
                ...prev,
                [boat.id]: {
                    balance: String(boat.balance_price_per_hour || ''),
                    vip: String(boat.vip_price_per_hour || '')
                }
            }))
        }
    }

    // 更新船隻價格
    const handleUpdatePrice = async (boat: Boat) => {
        const prices = editingPrices[boat.id]
        if (!prices) return

        const balancePrice = prices.balance ? parseInt(prices.balance) : null
        const vipPrice = prices.vip ? parseInt(prices.vip) : null

        // 驗證
        if (balancePrice && balancePrice < 0) {
            toast.warning('價格不能為負數')
            return
        }
        if (vipPrice && vipPrice < 0) {
            toast.warning('價格不能為負數')
            return
        }

        setSavingPrices(prev => ({ ...prev, [boat.id]: true }))
        try {
            const { error } = await supabase
                .from('boats')
                .update({
                    balance_price_per_hour: balancePrice,
                    vip_price_per_hour: vipPrice
                })
                .eq('id', boat.id)

            if (error) throw error

            toast.success('價格更新成功！')
            loadData()
        } catch (error) {
            toast.error('更新價格失敗：' + (error as Error).message)
        } finally {
            setSavingPrices(prev => ({ ...prev, [boat.id]: false }))
        }
    }

    // 計算預覽價格（無條件捨去）
    const calculatePrice = (pricePerHour: number | null, minutes: number): string => {
        if (!pricePerHour) return '-'
        return `$${Math.floor(pricePerHour * minutes / 60).toLocaleString()}`
    }

    if (loading || !hasAccess) {
        return (
            <div style={{
                padding: isMobile ? '12px 16px' : '20px',
                minHeight: '100dvh',
                background: pageBg,
                paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            }}>
                <div style={getPageContentShellStyle(isMobile)}>
                    <PageHeader user={user!} title="船隻管理" showBaoLink={isAdmin(user)} />
                    <div style={{
                        padding: '40px',
                        textAlign: 'center',
                        fontSize: '15px',
                        color: designSystem.colors.text.secondary,
                    }}>
                        載入中...
                    </div>
                    <Footer />
                </div>
            </div>
        )
    }

    return (
        <div style={{
            padding: isMobile ? '12px 16px' : '20px',
            minHeight: '100dvh',
            background: pageBg,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        }}>
            <div style={getPageContentShellStyle(isMobile)}>
                <PageHeader user={user!} title="船隻管理" showBaoLink={isAdmin(user)} />

                {/* Tab + primary action */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '4px',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                }}>
                    <div style={{
                        display: 'flex',
                        gap: '4px',
                        background: designSystem.colors.secondary[100],
                        borderRadius: designSystem.borderRadius.lg,
                        padding: '4px',
                        width: 'fit-content',
                        maxWidth: '100%',
                    }}>
                        <button
                            data-track="boat_tab_list"
                            onClick={() => setActiveTab('boats')}
                            style={{
                                padding: isMobile ? '9px 16px' : '10px 20px',
                                background: activeTab === 'boats' ? designSystem.colors.background.card : 'transparent',
                                border: 'none',
                                borderRadius: designSystem.borderRadius.md,
                                boxShadow: activeTab === 'boats' ? designSystem.shadows.xs : 'none',
                                color: activeTab === 'boats' ? designSystem.colors.text.primary : designSystem.colors.text.disabled,
                                fontWeight: activeTab === 'boats' ? 600 : 500,
                                fontSize: isMobile ? '13px' : '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            船隻列表
                        </button>
                        <button
                            data-track="boat_tab_pricing"
                            onClick={() => setActiveTab('pricing')}
                            style={{
                                padding: isMobile ? '9px 16px' : '10px 20px',
                                background: activeTab === 'pricing' ? designSystem.colors.background.card : 'transparent',
                                border: 'none',
                                borderRadius: designSystem.borderRadius.md,
                                boxShadow: activeTab === 'pricing' ? designSystem.shadows.xs : 'none',
                                color: activeTab === 'pricing' ? designSystem.colors.text.primary : designSystem.colors.text.disabled,
                                fontWeight: activeTab === 'pricing' ? 600 : 500,
                                fontSize: isMobile ? '13px' : '14px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            價格設定
                        </button>
                    </div>
                    <div style={{ flex: 1 }} />
                    {activeTab === 'boats' && (
                        <Button
                            variant="primary"
                            size="medium"
                            data-track="boat_add"
                            onClick={() => setAddDialogOpen(true)}
                        >
                            新增船隻
                        </Button>
                    )}
                </div>

                {/* 船隻列表 Tab */}
                {activeTab === 'boats' && (
                    <>
                        <div
                            style={{
                                background: showHelp ? designSystem.colors.background.card : 'transparent',
                                padding: showHelp ? '14px 16px' : '4px 0',
                                borderRadius: designSystem.borderRadius.lg,
                                marginBottom: showHelp ? '20px' : '12px',
                                fontSize: '14px',
                                color: designSystem.colors.text.secondary,
                                border: showHelp ? cardBorder : 'none',
                                boxShadow: showHelp ? cardShadow : 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            data-track="boat_help_toggle"
                            onClick={() => setShowHelp(!showHelp)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{
                                    fontWeight: 500,
                                    color: showHelp ? designSystem.colors.text.secondary : designSystem.colors.text.disabled,
                                }}>
                                    {showHelp ? '功能說明' : '說明'}
                                </span>
                                <span style={{ fontSize: '12px', color: designSystem.colors.text.disabled }}>
                                    {showHelp ? '收起' : '展開'}
                                </span>
                            </div>
                            {showHelp && (
                                <div style={{ marginTop: '12px', lineHeight: '1.7' }}>
                                    <div>維修/停用：設定特定日期或時段船隻不可預約。</div>
                                    <div style={{ fontSize: '13px', marginTop: '4px', color: designSystem.colors.text.disabled }}>
                                        若不指定時間，則視為全天停用。若指定時間（例如 10:00–12:00），則該時段外仍可預約。
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}>
                            <span style={{ fontSize: '14px', color: designSystem.colors.text.secondary }}>
                                查看維修記錄
                            </span>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{
                                    flex: 1,
                                    minWidth: 0,
                                    padding: '12px 14px',
                                    border: cardBorder,
                                    borderRadius: designSystem.borderRadius.lg,
                                    fontSize: '16px',
                                    cursor: 'pointer',
                                    background: designSystem.colors.background.card,
                                    boxShadow: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    </>
                )}

                {/* 船隻列表 */}
                {activeTab === 'boats' && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                        gap: isMobile ? '12px' : '16px',
                    }}>
                        {boats.map(boat => {
                        // 先過濾該船的維修記錄，再按月份過濾
                        const boatAllUnavailable = unavailableDates.filter(d => d.boat_id === boat.id)
                        const boatUnavailable = filterUnavailableByMonth(boatAllUnavailable, selectedMonth)
                        const isActive = boat.is_active
                        const showMaintenance = !isLandCourse(boat.name)

                        return (
                            <div
                                key={boat.id}
                                style={{
                                    background: designSystem.colors.background.card,
                                    borderRadius: designSystem.borderRadius.lg,
                                    padding: isMobile ? '16px' : '20px',
                                    boxShadow: cardShadow,
                                    border: cardBorder,
                                    borderTop: `3px solid ${boat.color}`,
                                    opacity: isActive ? 1 : 0.8,
                                    transition: 'all 0.2s',
                                }}
                            >
                                {/* 船隻名稱 + 狀態 */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px',
                                    gap: '12px',
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            margin: 0,
                                            fontSize: isMobile ? '18px' : '20px',
                                            fontWeight: 650,
                                            color: designSystem.colors.text.primary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                        }}>
                                            {boat.name}
                                            {!isActive && (
                                                <Badge variant="danger" size="small">
                                                    已燒毀
                                                </Badge>
                                            )}
                                        </h3>
                                    </div>

                                    {/* 操作按鈕 */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button
                                            variant={isActive ? 'danger' : 'success'}
                                            size="small"
                                            data-track="boat_toggle_status"
                                            onClick={() => handleToggleStatus(boat)}
                                            style={isActive ? { background: '#fff', color: designSystem.colors.danger[700], border: `1px solid ${designSystem.colors.danger[500]}55`, boxShadow: 'none' } : {}}
                                        >
                                            {isActive ? '燒毀' : '啟用'}
                                        </Button>
                                    </div>
                                </div>

                                {/* 維修/停用記錄 */}
                                {showMaintenance && boatUnavailable.length > 0 && (
                                    <div style={{
                                        marginBottom: '14px',
                                        padding: isMobile ? '14px' : '16px',
                                        background: designSystem.colors.warning[50],
                                        borderRadius: designSystem.borderRadius.lg,
                                        border: `1px solid ${designSystem.colors.warning[500]}24`
                                    }}>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            marginBottom: '10px',
                                            color: designSystem.colors.warning[700]
                                        }}>
                                            維修/停用排程
                                        </div>
                                        {boatUnavailable.map(record => (
                                            <div
                                                key={record.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: isMobile ? 'flex-start' : 'center',
                                                    flexDirection: isMobile ? 'column' : 'row',
                                                    padding: '8px 0',
                                                    fontSize: '13px',
                                                    gap: isMobile ? '8px' : '12px',
                                                    borderBottom: `1px solid ${designSystem.colors.warning[500]}18`
                                                }}
                                            >
                                                <span style={{
                                                    flex: 1,
                                                    color: designSystem.colors.text.secondary,
                                                    lineHeight: '1.4'
                                                }}>
                                                    {/* 顯示日期和時間 */}
                                                    {record.start_date === record.end_date ? (
                                                        // 單日維修
                                                        <>
                                                            <span style={{ fontWeight: 700, color: designSystem.colors.warning[700] }}>
                                                                {record.start_date}
                                                                {record.start_time && record.end_time && (
                                                                    <> {record.start_time}-{record.end_time}</>
                                                                )}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        // 跨日維修
                                                        <>
                                                            {record.start_time ? (
                                                                // 有指定時間：顯示完整的起止日期時間
                                                                <>
                                                                    <span style={{ fontWeight: 700, color: designSystem.colors.warning[700] }}>
                                                                        {record.start_date} {record.start_time}
                                                                    </span>
                                                                    <span style={{ margin: '0 4px' }}>~</span>
                                                                    <span style={{ fontWeight: 700, color: designSystem.colors.warning[700] }}>
                                                                        {record.end_date} {record.end_time}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                // 無指定時間：只顯示日期範圍（全天）
                                                                `${record.start_date} ~ ${record.end_date}`
                                                            )}
                                                        </>
                                                    )}
                                                    <span style={{
                                                        marginLeft: '8px',
                                                        padding: '3px 9px',
                                                        background: '#fff',
                                                        borderRadius: designSystem.borderRadius.full,
                                                        fontSize: '12px',
                                                        color: designSystem.colors.text.secondary,
                                                        boxShadow: designSystem.shadows.xs
                                                    }}>
                                                        {record.reason}
                                                    </span>
                                                </span>
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '8px',
                                                    flexShrink: 0,
                                                    alignSelf: isMobile ? 'flex-start' : 'center'
                                                }}>
                                                    <Button
                                                        variant="outline"
                                                        size="small"
                                                        data-track="boat_edit_unavailable"
                                                        onClick={() => openEditUnavailableDialog(boat, record)}
                                                    >
                                                        編輯
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="small"
                                                        data-track="boat_delete_unavailable"
                                                        onClick={() => handleDeleteUnavailable(record)}
                                                    >
                                                        刪除
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 設定維修按鈕 */}
                                {showMaintenance && (
                                    <Button
                                        variant="outline"
                                        size="medium"
                                        data-track="boat_unavailable_dialog"
                                        onClick={() => openUnavailableDialog(boat)}
                                        fullWidth
                                        style={{
                                            background: '#ffffff',
                                            color: designSystem.colors.text.primary,
                                            border: `1px solid ${designSystem.colors.border.light}`,
                                            boxShadow: designSystem.shadows.xs,
                                        }}
                                    >
                                        設定維修/停用
                                    </Button>
                                )}
                            </div>
                        )
                    })}
                    </div>
                )}

                {/* 價格設定 Tab */}
                {activeTab === 'pricing' && (
                    <>
                        <div style={{
                            marginBottom: '20px',
                            fontSize: '14px',
                            color: designSystem.colors.text.secondary,
                            lineHeight: '1.6',
                        }}>
                            <div style={{ marginBottom: '4px' }}>
                                價格計算：實際金額 = Math.floor(每小時價格 × 分鐘數 / 60)
                            </div>
                            <div style={{ fontSize: '13px', color: designSystem.colors.text.disabled }}>
                                例如：$10800/小時 × 30分鐘 / 60 = $5400。儲值價格用於扣儲值；VIP 票券價格用於 VIP 票券。
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gap: isMobile ? '12px' : '16px',
                        }}>
                            {boats.map(boat => {
                                initEditingPrice(boat)
                                const editing = editingPrices[boat.id] || { balance: '', vip: '' }
                                const saving = savingPrices[boat.id] || false
                                const balancePrice = editing.balance ? parseInt(editing.balance) : null
                                const vipPrice = editing.vip ? parseInt(editing.vip) : null

                                return (
                                    <div
                                        key={boat.id}
                                        style={{
                                            background: designSystem.colors.background.card,
                                            borderRadius: designSystem.borderRadius.lg,
                                            padding: isMobile ? '16px' : '20px',
                                            boxShadow: cardShadow,
                                            border: cardBorder,
                                            borderTop: `3px solid ${boat.color}`,
                                        }}
                                    >
                                        <h3 style={{
                                            margin: '0 0 16px 0',
                                            fontSize: isMobile ? '18px' : '20px',
                                            fontWeight: 650,
                                            color: designSystem.colors.text.primary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                        }}>
                                            {boat.name}
                                            {isFacility(boat.name) && (
                                                <Badge variant="info" size="small">
                                                    不收船費
                                                </Badge>
                                            )}
                                        </h3>

                                        {/* 價格輸入 */}
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                            gap: '16px',
                                            marginBottom: '16px'
                                        }}>
                                            {/* 儲值價格 */}
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: designSystem.colors.text.secondary
                                                }}>
                                                    儲值價格（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', color: designSystem.colors.text.secondary }}>$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editing.balance}
                                                        onChange={(e) => {
                                                            const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                                                            setEditingPrices(prev => ({
                                                                ...prev,
                                                                [boat.id]: { ...editing, balance: numValue }
                                                            }))
                                                        }}
                                                        placeholder="未設定"
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px 14px',
                                                            borderRadius: designSystem.borderRadius.lg,
                                                            border: `1px solid ${designSystem.colors.border.light}`,
                                                            fontSize: '16px',
                                                            outline: 'none',
                                                            background: '#fff',
                                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                                            boxShadow: designSystem.shadows.xs
                                                        }}
                                                        onFocus={(e) => e.target.style.borderColor = designSystem.colors.primary[400]}
                                                        onBlur={(e) => e.target.style.borderColor = designSystem.colors.border.light}
                                                    />
                                                </div>
                                            </div>

                                            {/* VIP 票券價格 */}
                                            <div>
                                                <label style={{
                                                    display: 'block',
                                                    marginBottom: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: '600',
                                                    color: designSystem.colors.text.secondary
                                                }}>
                                                    VIP 票券價格（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', color: designSystem.colors.text.secondary }}>$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editing.vip}
                                                        onChange={(e) => {
                                                            const numValue = e.target.value.replace(/\D/g, '') // 只允許數字
                                                            setEditingPrices(prev => ({
                                                                ...prev,
                                                                [boat.id]: { ...editing, vip: numValue }
                                                            }))
                                                        }}
                                                        placeholder="未設定"
                                                        style={{
                                                            flex: 1,
                                                            padding: '12px 14px',
                                                            borderRadius: designSystem.borderRadius.lg,
                                                            border: `1px solid ${designSystem.colors.border.light}`,
                                                            fontSize: '16px',
                                                            outline: 'none',
                                                            background: '#fff',
                                                            transition: 'border-color 0.2s, box-shadow 0.2s',
                                                            boxShadow: designSystem.shadows.xs
                                                        }}
                                                        onFocus={(e) => e.target.style.borderColor = designSystem.colors.primary[400]}
                                                        onBlur={(e) => e.target.style.borderColor = designSystem.colors.border.light}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 價格預覽 */}
                                        <div style={{
                                            background: designSystem.colors.secondary[50],
                                            padding: isMobile ? '12px 14px' : '14px 16px',
                                            borderRadius: designSystem.borderRadius.lg,
                                            marginBottom: '16px',
                                            fontSize: '13px',
                                            color: designSystem.colors.text.secondary,
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: '8px', color: designSystem.colors.text.primary }}>
                                                價格預覽
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                                                gap: '12px'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>儲值價格</div>
                                                    <div>20分: {calculatePrice(balancePrice, 20)}</div>
                                                    <div>30分: {calculatePrice(balancePrice, 30)}</div>
                                                    <div>40分: {calculatePrice(balancePrice, 40)}</div>
                                                    <div>60分: {calculatePrice(balancePrice, 60)}</div>
                                                    <div>90分: {calculatePrice(balancePrice, 90)}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>VIP 票券價格</div>
                                                    <div>20分: {calculatePrice(vipPrice, 20)}</div>
                                                    <div>30分: {calculatePrice(vipPrice, 30)}</div>
                                                    <div>40分: {calculatePrice(vipPrice, 40)}</div>
                                                    <div>60分: {calculatePrice(vipPrice, 60)}</div>
                                                    <div>90分: {calculatePrice(vipPrice, 90)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 儲存按鈕 */}
                                        <Button
                                            variant="primary"
                                            size="medium"
                                            data-track="boat_save_price"
                                            onClick={() => handleUpdatePrice(boat)}
                                            disabled={saving}
                                            fullWidth
                                        >
                                            {saving ? '儲存中...' : '儲存價格'}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                <Footer />
            </div>

            {/* 新增船隻彈窗 */}
            {addDialogOpen && (
                <AdminModal
                    isMobile={isMobile}
                    maxWidth={400}
                    onClose={() => { if (!addLoading) setAddDialogOpen(false) }}
                >
                    <AdminModalHeader title="新增船隻" accent="blue" />
                    <div style={{ marginBottom: '16px' }}>
                        <FormFieldLabel>船隻名稱</FormFieldLabel>
                        <input
                            type="text"
                            value={newBoatName}
                            onChange={(e) => setNewBoatName(e.target.value)}
                            placeholder="例如：G23"
                            style={adminTextInputStyle}
                        />
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                        <FormFieldLabel>代表色</FormFieldLabel>
                        <input
                            type="color"
                            value={newBoatColor}
                            onChange={(e) => setNewBoatColor(e.target.value)}
                            style={{
                                width: '100%',
                                height: '44px',
                                padding: '4px',
                                border: cardBorder,
                                borderRadius: designSystem.borderRadius.lg,
                                background: designSystem.colors.secondary[50],
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                        <Button variant="primary" data-track="boat_add_confirm" onClick={handleAddBoat} disabled={addLoading} style={{ flex: 1 }}>
                            {addLoading ? '新增中…' : '確定'}
                        </Button>
                    </div>
                </AdminModal>
            )}

            {/* 設定維修彈窗 */}
            {unavailableDialogOpen && (
                <AdminModal
                    isMobile={isMobile}
                    maxWidth={420}
                    onClose={() => { if (!unavailableLoading) closeUnavailableDialog() }}
                >
                    <AdminModalHeader
                        title={editingUnavailableId != null ? '編輯維修/停用' : '新增維修/停用'}
                        subtitle={selectedBoat?.name}
                        accent="orange"
                    />

                    <DateRangeFields
                        startDate={startDate}
                        endDate={endDate}
                        onStartChange={handleUnavailableStartChange}
                        onEndChange={handleUnavailableEndChange}
                        multiDay={unavailableMultiDay}
                        onMultiDayChange={handleUnavailableMultiDayChange}
                        trackPrefix="boat_unavailable"
                    />

                    <div style={{ marginBottom: '16px' }}>
                        <FormFieldLabel>時段（留空＝整天停用）</FormFieldLabel>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <TimeSelectField
                                value={startTime}
                                onChange={setStartTime}
                                label={isUnavailableSingleDay ? '開始時間' : '第一天時間'}
                            />
                            <TimeSelectField
                                value={endTime}
                                onChange={setEndTime}
                                label={isUnavailableSingleDay ? '結束時間' : '最後一天時間'}
                            />
                        </div>
                        <HintBox>
                            {isUnavailableSingleDay ? (
                                <>單日：時間留空表示全天停用；例如 13:30–15:00 表示當天該時段不可用。</>
                            ) : (
                                <>跨日：時間留空表示這幾天全天停用；中間日期亦視為全天。</>
                            )}
                        </HintBox>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <FormFieldLabel optional>原因</FormFieldLabel>
                        <input
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例如：引擎保養"
                            style={adminTextInputStyle}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <Button variant="outline" onClick={closeUnavailableDialog} style={{ flex: 1 }}>取消</Button>
                        <Button
                            variant="warning"
                            data-track="boat_unavailable_confirm"
                            onClick={handleAddUnavailable}
                            disabled={unavailableLoading}
                            style={{ flex: 1 }}
                        >
                            {unavailableLoading
                                ? (editingUnavailableId != null ? '儲存中…' : '新增中…')
                                : (editingUnavailableId != null ? '儲存' : '新增')}
                        </Button>
                    </div>
                </AdminModal>
            )}
            
            <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
        </div>
    )
}
