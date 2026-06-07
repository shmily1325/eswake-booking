import liff from '@line/liff'

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/** LINE WebView 内嵌 iframe 常无法播放，改以外部浏览器／YouTube App 开启 */
export function openYoutubeVideo(videoId: string): void {
  const url = youtubeWatchUrl(videoId)
  try {
    if (liff.isInClient()) {
      liff.openWindow({ url, external: true })
      return
    }
  } catch {
    // fallback below
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) window.location.href = url
}
