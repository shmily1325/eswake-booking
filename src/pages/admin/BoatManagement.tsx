import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { getLocalDateString, getLocalTimestamp } from '../../utils/date'
import type { Boat, BoatUnavailableDate } from '../../types/booking'
import { Button, Badge, useToast, ToastContainer } from '../../components/ui'
import { designSystem } from '../../styles/designSystem'

export function BoatManagement() {
    const user = useAuthUser()
    const toast = useToast()
    const [loading, setLoading] = useState(true)
    const [boats, setBoats] = useState<Boat[]>([])
    const [unavailableDates, setUnavailableDates] = useState<BoatUnavailableDate[]>([])
    const [activeTab, setActiveTab] = useState<'boats' | 'pricing'>('boats') // Tab 切換
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [newBoatName, setNewBoatName] = useState('')
    const [newBoatColor, setNewBoatColor] = useState('#1976d2')
    const [addLoading, setAddLoading] = useState(false)
    const [unavailableDialogOpen, setUnavailableDialogOpen] = useState(false)
    const [selectedBoat, setSelectedBoat] = useState<Boat | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [reason, setReason] = useState('')
    const [unavailableLoading, setUnavailableLoading] = useState(false)
    const { isMobile } = useResponsive()
    
    // 月份篩選
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const [selectedMonth, setSelectedMonth] = useState(currentMonth)
    
    // 價格設定狀態
    const [editingPrices, setEditingPrices] = useState<{[key: string]: {balance: string, vip: string}}>({})
    const [savingPrices, setSavingPrices] = useState<{[key: string]: boolean}>({})

    useEffect(() => {
        if (user) loadData()
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
                // 自定義排序順序（與 useGlobalCache 保持一致）
                const order = ['G23', 'G21', '黑豹', '粉紅', '200', '彈簧床']
                const sortedBoats = boatsData.sort((a, b) => {
                    return order.indexOf(a.name) - order.indexOf(b.name)
                })
                setBoats(sortedBoats)
            }
            if (unavailableData) setUnavailableDates(unavailableData)
        } catch (error) {
            console.error('載入失敗:', error)
        } finally {
            setLoading(false)
        }
    }

    // 過濾該月份的維修記錄
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
            setNewBoatColor('#1976d2')
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

            toast.success(boat.is_active ? '船隻已停用' : '船隻已啟用')
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

            setUnavailableDialogOpen(false)
            setSelectedBoat(null)
            setStartDate('')
            setEndDate('')
            setStartTime('')
            setEndTime('')
            setReason('')
            toast.success('維修/停用時段已設定')
            loadData()
        } catch (error) {
            toast.error('設定維修/停用失敗：' + (error as Error).message)
        } finally {
            setUnavailableLoading(false)
        }
    }

    const handleDeleteUnavailable = async (record: BoatUnavailableDate) => {
        if (!confirm('確定要刪除這個維修/停用記錄嗎？')) return

        try {
            const { error } = await supabase
                .from('boat_unavailable_dates')
                .update({ is_active: false }) // 軟刪除
                .eq('id', record.id)

            if (error) throw error

            toast.success('記錄已刪除')
            loadData()
        } catch (error) {
            toast.error('刪除記錄失敗：' + (error as Error).message)
        }
    }

    const openUnavailableDialog = (boat: Boat) => {
        setSelectedBoat(boat)
        const dateStr = getLocalDateString()
        setStartDate(dateStr)
        setEndDate(dateStr)
        setStartTime('')
        setEndTime('')
        setReason('')
        setUnavailableDialogOpen(true)
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

    // 計算預覽價格
    const calculatePrice = (pricePerHour: number | null, minutes: number): string => {
        if (!pricePerHour) return '-'
        return `$${Math.ceil(pricePerHour * minutes / 60).toLocaleString()}`
    }

    if (loading) {
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                載入中...
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: '80px' }}>
            <PageHeader user={user!} title="船隻管理" showBaoLink={true} />

            <div style={{
                maxWidth: '1000px',
                margin: '0 auto',
                padding: isMobile ? '20px 16px' : '40px 20px'
            }}>
                {/* 標題與操作按鈕 */}
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: '16px',
                    marginBottom: '30px'
                }}>
                    <h1 style={{
                        margin: 0,
                        fontSize: isMobile ? '24px' : '32px',
                        color: '#333',
                        fontWeight: 'bold'
                    }}>
                        🚤 船隻管理
                    </h1>

                    {activeTab === 'boats' && (
                        <Button
                            variant="outline"
                            size="medium"
                            onClick={() => setAddDialogOpen(true)}
                            icon={<span>➕</span>}
                        >
                            新增船隻
                        </Button>
                    )}
                </div>

                {/* Tab 切換 */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    borderBottom: '2px solid #e0e0e0',
                    marginBottom: '20px'
                }}>
                    <button
                        onClick={() => setActiveTab('boats')}
                        style={{
                            padding: isMobile ? '12px 16px' : '14px 28px',
                            background: activeTab === 'boats' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'boats' ? '3px solid #2196F3' : '3px solid transparent',
                            color: activeTab === 'boats' ? '#2196F3' : '#666',
                            fontWeight: activeTab === 'boats' ? 'bold' : 'normal',
                            fontSize: isMobile ? '14px' : '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '-2px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        船隻列表
                    </button>
                    <button
                        onClick={() => setActiveTab('pricing')}
                        style={{
                            padding: isMobile ? '12px 16px' : '14px 28px',
                            background: activeTab === 'pricing' ? 'white' : 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'pricing' ? '3px solid #2196F3' : '3px solid transparent',
                            color: activeTab === 'pricing' ? '#2196F3' : '#666',
                            fontWeight: activeTab === 'pricing' ? 'bold' : 'normal',
                            fontSize: isMobile ? '14px' : '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '-2px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        💰 價格設定
                    </button>
                </div>

                {/* 船隻列表 Tab */}
                {activeTab === 'boats' && (
                    <>
                        {/* 說明提示 */}
                        <div style={{
                            background: '#e3f2fd',
                            padding: isMobile ? '12px 16px' : '14px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '14px',
                            color: '#0d47a1',
                            border: '1px solid #bbdefb',
                            lineHeight: '1.6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ flexShrink: 0 }}>💡</span>
                                <div>
                                    <div style={{ marginBottom: '4px' }}>
                                        <strong>維修/停用</strong>：設定特定日期或時段船隻不可預約。
                                    </div>
                                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                        若不指定時間，則視為<strong>全天停用</strong>。若指定時間（例如 10:00-12:00），則該時段外仍可預約。
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 月份選擇器 */}
                        <div style={{
                            marginBottom: '20px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: isMobile ? 'wrap' : 'nowrap',
                            gap: '12px',
                            background: '#f8f9fa',
                            padding: isMobile ? '12px' : '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '14px',
                                color: '#666'
                            }}>
                                <span>📅</span>
                                <span>查看維修記錄</span>
                            </div>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                style={{
                                    padding: '8px 12px',
                                    border: '2px solid #2196F3',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    background: 'white',
                                    color: '#1565c0',
                                    fontWeight: '600',
                                    minWidth: isMobile ? '100%' : '150px'
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
                        gap: '15px'
                    }}>
                        {boats.map(boat => {
                        // 先過濾該船的維修記錄，再按月份過濾
                        const boatAllUnavailable = unavailableDates.filter(d => d.boat_id === boat.id)
                        const boatUnavailable = filterUnavailableByMonth(boatAllUnavailable, selectedMonth)
                        const isActive = boat.is_active

                        return (
                            <div
                                key={boat.id}
                                style={{
                                    background: 'white',
                                    borderRadius: '12px',
                                    padding: isMobile ? '16px' : '20px',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    borderTop: `4px solid ${boat.color}`,
                                    opacity: isActive ? 1 : 0.8,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {/* 船隻名稱 + 狀態 */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '16px',
                                    gap: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{
                                            margin: 0,
                                            fontSize: isMobile ? '20px' : '22px',
                                            fontWeight: 'bold',
                                            color: '#333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            {boat.name}
                                            {!isActive && (
                                                <Badge variant="danger" size="small">
                                                    已停用
                                                </Badge>
                                            )}
                                        </h3>
                                    </div>

                                    {/* 操作按鈕 */}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <Button
                                            variant={isActive ? 'danger' : 'success'}
                                            size="small"
                                            onClick={() => handleToggleStatus(boat)}
                                            style={isActive ? { background: '#fff', color: designSystem.colors.danger[500], border: `1px solid ${designSystem.colors.danger[500]}` } : {}}
                                        >
                                            {isActive ? '停用' : '啟用'}
                                        </Button>
                                    </div>
                                </div>

                                {/* 維修/停用記錄 */}
                                {boatUnavailable.length > 0 && (
                                    <div style={{
                                        marginBottom: '14px',
                                        padding: isMobile ? '12px' : '14px',
                                        background: '#fff3e0',
                                        borderRadius: '10px',
                                        border: '1px solid #ffe0b2'
                                    }}>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: '600',
                                            marginBottom: '10px',
                                            color: '#e65100'
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
                                                    borderBottom: '1px solid rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <span style={{
                                                    flex: 1,
                                                    color: '#555',
                                                    lineHeight: '1.4'
                                                }}>
                                                    {/* 顯示日期和時間 */}
                                                    {record.start_date === record.end_date ? (
                                                        // 單日維修
                                                        <>
                                                            {record.start_date}
                                                            {record.start_time && record.end_time && (
                                                                <span style={{ fontWeight: 'bold', marginLeft: '6px', color: '#d84315' }}>
                                                                    {record.start_time}-{record.end_time}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        // 跨日維修
                                                        <>
                                                            {record.start_time ? (
                                                                // 有指定時間：顯示完整的起止日期時間
                                                                <>
                                                                    <span style={{ fontWeight: 'bold', color: '#d84315' }}>
                                                                        {record.start_date} {record.start_time}
                                                                    </span>
                                                                    <span style={{ margin: '0 4px' }}>~</span>
                                                                    <span style={{ fontWeight: 'bold', color: '#d84315' }}>
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
                                                        padding: '2px 8px',
                                                        background: '#fff',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        color: '#666'
                                                    }}>
                                                        {record.reason}
                                                    </span>
                                                </span>
                                                <Button
                                                    variant="danger"
                                                    size="small"
                                                    onClick={() => handleDeleteUnavailable(record)}
                                                    style={{ alignSelf: isMobile ? 'flex-start' : 'center' }}
                                                >
                                                    刪除
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 設定維修按鈕 */}
                                <Button
                                    variant="outline"
                                    size="medium"
                                    onClick={() => openUnavailableDialog(boat)}
                                    fullWidth
                                    style={{
                                        background: '#e3f2fd',
                                        color: '#1565c0',
                                        border: '2px solid #bbdefb',
                                    }}
                                >
                                    設定維修/停用
                                </Button>
                            </div>
                        )
                    })}
                    </div>
                )}

                {/* 價格設定 Tab */}
                {activeTab === 'pricing' && (
                    <>
                        {/* 說明提示 */}
                        <div style={{
                            background: '#fff9e6',
                            padding: isMobile ? '12px 16px' : '14px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            fontSize: '14px',
                            color: '#8b6914',
                            border: '1px solid #ffe8a3',
                            lineHeight: '1.6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                <span style={{ flexShrink: 0 }}>💡</span>
                                <div>
                                    <div style={{ marginBottom: '4px' }}>
                                        <strong>價格計算公式</strong>：實際金額 = Math.ceil(每小時價格 * 分鐘數 / 60)
                                    </div>
                                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                        例如：$10800/小時 * 30分鐘 / 60 = $5400
                                    </div>
                                    <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                                        • <strong>儲值價格</strong>：用於扣儲值時的金額<br />
                                        • <strong>VIP票券價格</strong>：用於 VIP 票券時的金額
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 價格設定列表 */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr',
                            gap: '15px'
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
                                            background: 'white',
                                            borderRadius: '12px',
                                            padding: isMobile ? '16px' : '24px',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                            borderTop: `4px solid ${boat.color}`
                                        }}
                                    >
                                        {/* 船隻名稱 */}
                                        <h3 style={{
                                            margin: '0 0 20px 0',
                                            fontSize: isMobile ? '20px' : '22px',
                                            fontWeight: 'bold',
                                            color: '#333',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px'
                                        }}>
                                            {boat.name}
                                            {boat.name.includes('彈簧床') && (
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
                                                    color: '#555'
                                                }}>
                                                    儲值價格（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', color: '#666' }}>$</span>
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
                                                            padding: '10px 12px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #e0e0e0',
                                                            fontSize: '16px',
                                                            outline: 'none',
                                                            transition: 'border-color 0.2s'
                                                        }}
                                                        onFocus={(e) => e.target.style.borderColor = '#2196F3'}
                                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
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
                                                    color: '#555'
                                                }}>
                                                    VIP 票券價格（每小時）
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', color: '#666' }}>$</span>
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
                                                            padding: '10px 12px',
                                                            borderRadius: '8px',
                                                            border: '2px solid #e0e0e0',
                                                            fontSize: '16px',
                                                            outline: 'none',
                                                            transition: 'border-color 0.2s'
                                                        }}
                                                        onFocus={(e) => e.target.style.borderColor = '#2196F3'}
                                                        onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* 價格預覽 */}
                                        <div style={{
                                            background: '#f5f5f5',
                                            padding: '12px 16px',
                                            borderRadius: '8px',
                                            marginBottom: '16px',
                                            fontSize: '13px',
                                            color: '#666'
                                        }}>
                                            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#333' }}>
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
                                            onClick={() => handleUpdatePrice(boat)}
                                            disabled={saving}
                                            fullWidth
                                        >
                                            {saving ? '儲存中...' : '💾 儲存價格'}
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* 新增船隻彈窗 */}
            {addDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '30px',
                        maxWidth: '400px', width: '100%'
                    }}>
                        <h2 style={{ marginTop: 0 }}>新增船隻</h2>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>船隻名稱</label>
                            <input
                                type="text"
                                value={newBoatName}
                                onChange={(e) => setNewBoatName(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '8px' }}>代表色</label>
                            <input
                                type="color"
                                value={newBoatColor}
                                onChange={(e) => setNewBoatColor(e.target.value)}
                                style={{ width: '100%', height: '40px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Button variant="outline" onClick={() => setAddDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                            <Button variant="primary" onClick={handleAddBoat} disabled={addLoading} style={{ flex: 1 }}>確定</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 設定維修彈窗 */}
            {unavailableDialogOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, padding: '20px'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '30px',
                        maxWidth: '400px', width: '100%'
                    }}>
                        <h2 style={{ marginTop: 0 }}>設定維修/停用</h2>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>開始日期</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>結束日期</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>
                                    {startDate === endDate ? '開始時間' : '第一天時間'} (選填)
                                </label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <select
                                        value={startTime ? startTime.split(':')[0] : ''}
                                        onChange={(e) => {
                                            const hour = e.target.value
                                            if (!hour) {
                                                setStartTime('')
                                            } else {
                                                const minute = startTime ? startTime.split(':')[1] : '00'
                                                setStartTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 24 }, (_, i) => {
                                            const hour = String(i).padStart(2, '0')
                                            return <option key={hour} value={hour}>{hour}</option>
                                        })}
                                    </select>
                                    <select
                                        value={startTime ? startTime.split(':')[1] : ''}
                                        onChange={(e) => {
                                            const minute = e.target.value
                                            if (!minute) {
                                                setStartTime('')
                                            } else {
                                                const hour = startTime ? startTime.split(':')[0] : '08'
                                                setStartTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        <option value="00">00</option>
                                        <option value="15">15</option>
                                        <option value="30">30</option>
                                        <option value="45">45</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '5px' }}>
                                    {startDate === endDate ? '結束時間' : '最後一天時間'} (選填)
                                </label>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <select
                                        value={endTime ? endTime.split(':')[0] : ''}
                                        onChange={(e) => {
                                            const hour = e.target.value
                                            if (!hour) {
                                                setEndTime('')
                                            } else {
                                                const minute = endTime ? endTime.split(':')[1] : '00'
                                                setEndTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        {Array.from({ length: 24 }, (_, i) => {
                                            const hour = String(i).padStart(2, '0')
                                            return <option key={hour} value={hour}>{hour}</option>
                                        })}
                                    </select>
                                    <select
                                        value={endTime ? endTime.split(':')[1] : ''}
                                        onChange={(e) => {
                                            const minute = e.target.value
                                            if (!minute) {
                                                setEndTime('')
                                            } else {
                                                const hour = endTime ? endTime.split(':')[0] : '08'
                                                setEndTime(`${hour}:${minute}`)
                                            }
                                        }}
                                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
                                    >
                                        <option value="">--</option>
                                        <option value="00">00</option>
                                        <option value="15">15</option>
                                        <option value="30">30</option>
                                        <option value="45">45</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '15px', lineHeight: '1.5' }}>
                            {startDate === endDate ? (
                                <>
                                    💡 <strong>單日維修：</strong>時間留空表示全天停用<br/>
                                    　 例如：13:30-15:00 表示當天 13:30 到 15:00 不可用
                                </>
                            ) : (
                                <>
                                    💡 <strong>跨日維修：</strong>時間留空表示這幾天全天停用<br/>
                                    　 例如：第一天 13:30、最後一天 15:00<br/>
                                    　 表示從第一天 13:30 開始到最後一天 15:00 結束
                                </>
                            )}
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>原因</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="例如：引擎保養"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Button variant="outline" onClick={() => setUnavailableDialogOpen(false)} style={{ flex: 1 }}>取消</Button>
                            <Button variant="warning" onClick={handleAddUnavailable} disabled={unavailableLoading} style={{ flex: 1, background: '#e65100' }}>確定</Button>
                        </div>
                    </div>
                </div>
            )}
            
            <ToastContainer messages={toast.messages} onClose={toast.closeToast} />
        </div>
    )
}
