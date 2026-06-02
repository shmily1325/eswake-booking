/** 導覽／卡片上的數字角標（待結帳等） */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  const label = count > 99 ? '99+' : String(count)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        marginLeft: 6,
        borderRadius: 9,
        background: '#e53935',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </span>
  )
}
