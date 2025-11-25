import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

interface Member {
  id: string
  name: string
  nickname: string | null
  phone: string | null
}

/**
 * 會員搜索 Hook
 * 處理會員列表載入、搜索過濾、選擇邏輯
 */
export function useMemberSearch() {
  const [members, setMembers] = useState<Member[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [manualName, setManualName] = useState('') // 手動輸入的名字

  // 載入會員列表
  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const { data } = await supabase
      .from('members')
      .select('id, name, nickname, phone, status')
      .eq('status', 'active')
      .order('name')
    
    if (data) {
      // Filter out status field for the component state
      const members = data.map(({ id, name, nickname, phone }) => ({
        id,
        name,
        nickname,
        phone
      }))
      setMembers(members)
    }
  }

  // 過濾會員（使用 useMemo 快取）
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return []
    
    const lowerSearch = searchTerm.toLowerCase()
    return members.filter(m =>
      m.name.toLowerCase().includes(lowerSearch) ||
      m.nickname?.toLowerCase().includes(lowerSearch) ||
      m.phone?.includes(searchTerm)
    )
  }, [members, searchTerm])

  // 處理會員選擇
  const selectMember = (member: Member) => {
    setSearchTerm(member.nickname || member.name)
    setSelectedMemberId(member.id)
    setManualName('')
    setShowDropdown(false)
  }

  // 處理手動輸入
  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setSelectedMemberId(null)
    setManualName(value)
    setShowDropdown(filteredMembers.length > 0)
  }

  // 重置所有狀態
  const reset = () => {
    setSearchTerm('')
    setSelectedMemberId(null)
    setManualName('')
    setShowDropdown(false)
  }

  // 獲取最終的聯絡人名稱（會員名或手動輸入）
  const getContactName = () => {
    return selectedMemberId ? searchTerm : manualName.trim()
  }

  return {
    members,
    searchTerm,
    selectedMemberId,
    showDropdown,
    manualName,
    filteredMembers,
    selectMember,
    handleSearchChange,
    setShowDropdown,
    reset,
    getContactName,
  }
}

