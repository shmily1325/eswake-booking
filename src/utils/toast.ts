// 全局 Toast API - 可在任何地方使用（包括非 React 組件）

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastEvent {
  type: ToastType
  message: string
  duration?: number
}

type ToastListener = (event: ToastEvent) => void

class ToastManager {
  private listeners: ToastListener[] = []

  subscribe(listener: ToastListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private emit(event: ToastEvent) {
    this.listeners.forEach(listener => listener(event))
  }

  success(message: string, duration?: number) {
    this.emit({ type: 'success', message, duration })
  }

  error(message: string, duration?: number) {
    this.emit({ type: 'error', message, duration })
  }

  warning(message: string, duration?: number) {
    this.emit({ type: 'warning', message, duration })
  }

  info(message: string, duration?: number) {
    this.emit({ type: 'info', message, duration })
  }
}

export const toast = new ToastManager()

