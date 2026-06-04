type AtmosphereMode = 'default' | 'photo-only' | 'caption-bottom'

/**
 * 全 hero 共用暗幕：整體壓暗 + 底部漸層（標題區），拼貼／單張一致。
 */
export function HeroAtmosphere({ mode = 'default' }: { mode?: AtmosphereMode }) {
  if (mode === 'photo-only') {
    return (
      <>
        <div
          className="absolute inset-0 z-[1] bg-black/20 pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] h-[15%] bg-gradient-to-t from-black/30 to-transparent pointer-events-none"
          aria-hidden
        />
      </>
    )
  }

  if (mode === 'caption-bottom') {
    return (
      <>
        <div
          className="absolute inset-0 z-[1] bg-black/22 pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 z-[1] h-[20%] bg-gradient-to-b from-black/20 to-transparent pointer-events-none"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none"
          aria-hidden
        />
      </>
    )
  }

  return (
    <>
      <div
        className="absolute inset-0 z-[1] bg-black/25 pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-[1] bg-gradient-to-br from-black/45 from-0% via-black/15 via-38% to-transparent to-68% pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 z-[1] h-[22%] bg-gradient-to-t from-black/40 to-transparent pointer-events-none"
        aria-hidden
      />
    </>
  )
}
