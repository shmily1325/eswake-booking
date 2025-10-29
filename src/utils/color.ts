/**
 * Calculate luminance of a hex color
 * Returns a value between 0 (darkest) and 1 (lightest)
 */
export function getLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  
  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  
  // Calculate luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Get contrasting text color (black or white) based on background color
 * @param bgColor - Background color in hex format (e.g., "#FF0000" or "FF0000")
 * @returns "#000000" for dark text or "#FFFFFF" for light text
 */
export function getContrastingTextColor(bgColor: string): string {
  const luminance = getLuminance(bgColor)
  // Use white text on dark backgrounds, black text on light backgrounds
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

