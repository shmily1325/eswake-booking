import { useState, useEffect } from 'react'

export const useResponsive = () => {
  const [isMobile, setIsMobile] = useState(false)
  const [isLandscape, setIsLandscape] = useState(false)

  useEffect(() => {
    const checkResponsive = () => {
      setIsMobile(window.innerWidth < 768)
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024)
    }

    checkResponsive()
    window.addEventListener('resize', checkResponsive)
    window.addEventListener('orientationchange', checkResponsive)

    return () => {
      window.removeEventListener('resize', checkResponsive)
      window.removeEventListener('orientationchange', checkResponsive)
    }
  }, [])

  return { isMobile, isLandscape }
}

