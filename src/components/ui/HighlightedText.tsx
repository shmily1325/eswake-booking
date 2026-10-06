import type { CSSProperties, ReactNode } from 'react'

interface HighlightedTextProps {
  text: string | null | undefined
  query: string
  highlightStyle?: CSSProperties
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function HighlightedText({
  text,
  query,
  highlightStyle,
}: HighlightedTextProps): ReactNode {
  const value = text ?? ''
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return value

  const tokens = Array.from(new Set(trimmedQuery.split(/\s+/).filter(Boolean)))
    .sort((a, b) => b.length - a.length)
  const normalizedTokens = new Set(
    tokens.map((token) => token.toLocaleLowerCase('zh-TW'))
  )
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi')
  const parts = value.split(pattern)
  return parts.map((part, index) =>
    normalizedTokens.has(part.toLocaleLowerCase('zh-TW')) ? (
      <mark
        key={`${part}-${index}`}
        style={{
          background: '#fff1a8',
          color: 'inherit',
          borderRadius: 3,
          padding: '0 1px',
          ...highlightStyle,
        }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}
