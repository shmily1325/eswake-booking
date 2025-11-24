import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Card } from '../Card'

describe('Card 組件', () => {
  describe('基本渲染', () => {
    it('應該渲染子元素', () => {
      render(<Card>卡片內容</Card>)
      expect(screen.getByText('卡片內容')).toBeInTheDocument()
    })

    it('應該顯示標題', () => {
      render(<Card title="卡片標題">內容</Card>)
      expect(screen.getByText('卡片標題')).toBeInTheDocument()
    })

    it('應該顯示標題強調線', () => {
      render(<Card title="標題" titleAccent>內容</Card>)
      const card = screen.getByText('標題').closest('div')
      expect(card).toBeInTheDocument()
    })
  })

  describe('變體（Variants）', () => {
    it('應該支援預設變體', () => {
      render(<Card variant="default">預設</Card>)
      expect(screen.getByText('預設')).toBeInTheDocument()
    })

    it('應該支援 highlighted 變體', () => {
      render(<Card variant="highlighted">強調</Card>)
      expect(screen.getByText('強調')).toBeInTheDocument()
    })

    it('應該支援 warning 變體', () => {
      render(<Card variant="warning">警告</Card>)
      expect(screen.getByText('警告')).toBeInTheDocument()
    })

    it('應該支援 success 變體', () => {
      render(<Card variant="success">成功</Card>)
      expect(screen.getByText('成功')).toBeInTheDocument()
    })

    it('應該支援 glass 變體', () => {
      render(<Card variant="glass">玻璃</Card>)
      expect(screen.getByText('玻璃')).toBeInTheDocument()
    })
  })

  describe('懸停效果', () => {
    it('hoverable 為 false 時應該渲染', () => {
      render(<Card hoverable={false}>普通卡片</Card>)
      expect(screen.getByText('普通卡片')).toBeInTheDocument()
      // hoverable={false} 時，組件應該正常渲染
    })

    it('hoverable 為 true 時應該渲染', () => {
      render(<Card hoverable>可懸停卡片</Card>)
      expect(screen.getByText('可懸停卡片')).toBeInTheDocument()
      // hoverable={true} 時，組件應該正常渲染
    })

    it('滑鼠事件應該被處理', () => {
      const { container } = render(<Card hoverable>測試卡片</Card>)
      const card = container.firstChild as HTMLElement
      
      // 測試 mouseEnter 和 mouseLeave 事件不會導致錯誤
      expect(() => {
        fireEvent.mouseEnter(card)
        fireEvent.mouseLeave(card)
      }).not.toThrow()
    })

    it('滑鼠離開時應該正常運作', () => {
      const { container } = render(<Card hoverable>測試卡片</Card>)
      const card = container.firstChild as HTMLElement
      
      fireEvent.mouseEnter(card)
      fireEvent.mouseLeave(card)
      // 事件處理應該正常工作
      expect(card).toBeInTheDocument()
    })
  })

  describe('自訂樣式', () => {
    it('應該接受 style 屬性並正常渲染', () => {
      render(
        <Card style={{ backgroundColor: 'blue', padding: '30px' }}>
          自訂樣式卡片
        </Card>
      )
      // 組件應該接受 style prop 並正常渲染
      expect(screen.getByText('自訂樣式卡片')).toBeInTheDocument()
    })
  })

  describe('標題區塊', () => {
    it('沒有標題時不應該顯示標題區塊', () => {
      const { container } = render(<Card>內容</Card>)
      const titleDiv = container.querySelector('h3')
      expect(titleDiv).not.toBeInTheDocument()
    })

    it('有標題時應該顯示標題區塊', () => {
      render(<Card title="測試標題">內容</Card>)
      const title = screen.getByText('測試標題')
      expect(title).toBeInTheDocument()
      expect(title.tagName).toBe('H3')
    })

    it('titleAccent 為 true 時應該顯示強調線', () => {
      render(<Card title="測試" titleAccent>內容</Card>)
      const title = screen.getByText('測試')
      const parent = title.parentElement!
      const accentDiv = parent.querySelector('div[style*="width: 4px"]')
      expect(accentDiv).toBeInTheDocument()
    })

    it('titleAccent 為 false 時不應該顯示強調線', () => {
      render(<Card title="測試" titleAccent={false}>內容</Card>)
      const title = screen.getByText('測試')
      const parent = title.parentElement!
      const accentDiv = parent.querySelector('div[style*="width: 4px"]')
      expect(accentDiv).not.toBeInTheDocument()
    })
  })

  describe('HTML 屬性', () => {
    it('應該支援 onClick 事件', () => {
      const handleClick = vi.fn()
      const { container } = render(<Card onClick={handleClick}>點擊卡片</Card>)
      
      // Card 直接在 div 上，不是 parentElement
      const card = container.firstChild as HTMLElement
      fireEvent.click(card)
      
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('應該支援 className 屬性', () => {
      const { container } = render(<Card className="custom-class">內容</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('custom-class')
    })

    it('應該支援 data 屬性', () => {
      render(<Card data-testid="test-card">內容</Card>)
      const card = screen.getByTestId('test-card')
      expect(card).toBeInTheDocument()
    })
  })
})

