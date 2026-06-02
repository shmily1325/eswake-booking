/** 全站共用一句（放 LiffMyBookings 內容區頂部，各分頁不再重複） */
export const LIFF_CONTACT_LINE = '需協助請私訊官方'

export function LiffContactBar() {
  return (
    <div
      style={{
        fontSize: '12px',
        color: '#999',
        textAlign: 'center',
        marginBottom: '12px',
        lineHeight: 1.4,
      }}
    >
      {LIFF_CONTACT_LINE}
    </div>
  )
}
