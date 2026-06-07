import liff from '@line/liff'

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeEmbedUrl(videoId: string, autoplay = false): string {
  const params = new URLSearchParams({
    rel: '0',
    playsinline: '1',
    modestbranding: '1',
  })
  if (autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/** 內嵌無法播放時，改以外部瀏覽器／YouTube App 開啟 */
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
