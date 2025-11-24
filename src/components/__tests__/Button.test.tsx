import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Button } from '../Button'

describe('Button 組件', () => {
  describe('基本渲染', () => {
    it('應該渲染按鈕文字', () => {
      render(<Button>點擊我</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('點擊我')
    })

    it('應該應用預設類型 button', () => {
      render(<Button>測試</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
    })

    it('應該應用自訂類型', () => {
      render(<Button type="submit">提交</Button>)
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
    })
  })

  describe('變體（Variants）', () => {
    it('應該支援不同的變體', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('尺寸（Size）', () => {
    it('應該支援不同的尺寸', () => {
      const { rerender } = render(<Button size="small">Small</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button size="medium">Medium</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()

      rerender(<Button size="large">Large</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('點擊事件', () => {
    it('應該在點擊時觸發 onClick', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>點擊</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('禁用狀態下不應該觸發 onClick', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} disabled>點擊</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('載入狀態下不應該觸發 onClick', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} isLoading>點擊</Button>)
      
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('禁用狀態', () => {
    it('應該正確設置 disabled 屬性', () => {
      render(<Button disabled>禁用按鈕</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('載入狀態應該禁用按鈕', () => {
      render(<Button isLoading>載入中</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('載入狀態', () => {
    it('載入時應該顯示「處理中...」', () => {
      render(<Button isLoading>提交</Button>)
      expect(screen.getByText('處理中...')).toBeInTheDocument()
    })

    it('載入時應該顯示 spinner', () => {
      render(<Button isLoading>提交</Button>)
      const button = screen.getByRole('button')
      // Spinner 是一個 SVG
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('非載入狀態不應該顯示「處理中...」', () => {
      render(<Button>提交</Button>)
      expect(screen.queryByText('處理中...')).not.toBeInTheDocument()
    })
  })

  describe('圖標', () => {
    it('應該在左側顯示圖標', () => {
      const icon = <span data-testid="icon">🔥</span>
      render(<Button icon={icon} iconPosition="left">按鈕</Button>)
      
      const button = screen.getByRole('button')
      const iconElement = screen.getByTestId('icon')
      expect(iconElement).toBeInTheDocument()
      // 圖標應該在文字前面
      expect(button.textContent).toMatch(/🔥.*按鈕/)
    })

    it('應該在右側顯示圖標', () => {
      const icon = <span data-testid="icon">→</span>
      render(<Button icon={icon} iconPosition="right">按鈕</Button>)
      
      const button = screen.getByRole('button')
      const iconElement = screen.getByTestId('icon')
      expect(iconElement).toBeInTheDocument()
      // 圖標應該在文字後面
      expect(button.textContent).toMatch(/按鈕.*→/)
    })

    it('載入狀態不應該顯示圖標', () => {
      const icon = <span data-testid="icon">🔥</span>
      render(<Button icon={icon} isLoading>按鈕</Button>)
      
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
      expect(screen.getByText('處理中...')).toBeInTheDocument()
    })
  })

  describe('全寬', () => {
    it('fullWidth 為 true 時應該寬度為 100%', () => {
      render(<Button fullWidth>全寬按鈕</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: '100%' })
    })

    it('fullWidth 為 false 時應該寬度為 auto', () => {
      render(<Button fullWidth={false}>正常按鈕</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveStyle({ width: 'auto' })
    })
  })

  describe('自訂樣式', () => {
    it('應該應用自訂樣式', () => {
      render(
        <Button style={{ backgroundColor: 'red', padding: '20px' }}>
          自訂樣式
        </Button>
      )
      const button = screen.getByRole('button')
      // 檢查樣式物件是否包含自訂值
      expect(button.style.backgroundColor).toBe('red')
      expect(button.style.padding).toBe('20px')
    })
  })

  describe('滑鼠懸停效果', () => {
    it('應該在滑鼠懸停時改變樣式（非禁用狀態）', () => {
      render(<Button>懸停測試</Button>)
      const button = screen.getByRole('button')
      
      fireEvent.mouseEnter(button)
      expect(button.style.opacity).toBe('0.9')
      expect(button.style.transform).toBe('translateY(-1px)')
      
      fireEvent.mouseLeave(button)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expect(button.style.opacity).toBe('1')
      expect(button.style.transform).toBe('translateY(0)')
    })

    it('禁用狀態下不應該有懸停效果', () => {
      render(<Button disabled>禁用測試</Button>)
      const button = screen.getByRole('button')
      
      fireEvent.mouseEnter(button)
      // 禁用狀態下，opacity 應該保持 0.6，不應該變成 0.9
      expect(button.style.opacity).not.toBe('0.9')
    })

    it('ghost 變體不應該有懸停效果', () => {
      render(<Button variant="ghost">Ghost 按鈕</Button>)
      const button = screen.getByRole('button')
      
      fireEvent.mouseEnter(button)
      // ghost 變體不應該有 opacity 和 transform 變化
      expect(button.style.opacity).not.toBe('0.9')
    })
  })
})

