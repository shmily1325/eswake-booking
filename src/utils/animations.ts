/**
 * 動畫工具函數
 * 提供常用的動畫效果和過渡
 */

// 動畫持續時間常數
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const

// 動畫緩動函數
export const EASING = {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const

// 淡入動畫
export function fadeIn(duration = ANIMATION_DURATION.normal): React.CSSProperties {
  return {
    animation: `fadeIn ${duration}ms ${EASING.easeOut}`,
  }
}

// 淡出動畫
export function fadeOut(duration = ANIMATION_DURATION.normal): React.CSSProperties {
  return {
    animation: `fadeOut ${duration}ms ${EASING.easeIn}`,
  }
}

// 滑入動畫
export function slideIn(
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  duration = ANIMATION_DURATION.normal
): React.CSSProperties {
  return {
    animation: `slideIn${direction.charAt(0).toUpperCase() + direction.slice(1)} ${duration}ms ${EASING.easeOut}`,
  }
}

// 滑出動畫
export function slideOut(
  direction: 'left' | 'right' | 'up' | 'down' = 'down',
  duration = ANIMATION_DURATION.normal
): React.CSSProperties {
  return {
    animation: `slideOut${direction.charAt(0).toUpperCase() + direction.slice(1)} ${duration}ms ${EASING.easeIn}`,
  }
}

// 縮放動畫
export function scale(
  duration = ANIMATION_DURATION.normal
): React.CSSProperties {
  return {
    animation: `scaleEffect ${duration}ms ${EASING.easeOut}`,
    animationFillMode: 'both',
  }
}

// 彈跳動畫
export function bounce(duration = ANIMATION_DURATION.slow): React.CSSProperties {
  return {
    animation: `bounce ${duration}ms ${EASING.bounce}`,
  }
}

// 搖晃動畫（用於錯誤提示）
export function shake(duration = ANIMATION_DURATION.slow): React.CSSProperties {
  return {
    animation: `shake ${duration}ms ${EASING.easeInOut}`,
  }
}

// 脈衝動畫
export function pulse(duration = ANIMATION_DURATION.slow): React.CSSProperties {
  return {
    animation: `pulse ${duration}ms ${EASING.easeInOut} infinite`,
  }
}

// 旋轉動畫
export function rotate(duration = 1000): React.CSSProperties {
  return {
    animation: `rotate ${duration}ms linear infinite`,
  }
}

// 滑動刪除動畫
export function swipeToDelete(direction: 'left' | 'right' = 'left'): React.CSSProperties {
  return {
    animation: `swipe${direction.charAt(0).toUpperCase() + direction.slice(1)} ${ANIMATION_DURATION.normal}ms ${EASING.sharp}`,
  }
}

// CSS 動畫關鍵幀
export const animationKeyframes = `
  /* 淡入淡出 */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  /* 滑入動畫 */
  @keyframes slideInUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideInDown {
    from {
      transform: translateY(-20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideInLeft {
    from {
      transform: translateX(-20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideInRight {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  /* 滑出動畫 */
  @keyframes slideOutUp {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-20px);
      opacity: 0;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(20px);
      opacity: 0;
    }
  }

  @keyframes slideOutLeft {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(-100%);
      opacity: 0;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  /* 縮放動畫 */
  @keyframes scaleEffect {
    from {
      transform: scale(0.95);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* 彈跳動畫 */
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  /* 搖晃動畫 */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }

  /* 脈衝動畫 */
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  /* 旋轉動畫 */
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* 滑動刪除 */
  @keyframes swipeLeft {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(-100%); opacity: 0; }
  }

  @keyframes swipeRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`

// 將動畫 CSS 注入到頁面
export function injectAnimationStyles() {
  if (typeof document === 'undefined') return

  const styleId = 'animation-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = animationKeyframes
  document.head.appendChild(style)
}
