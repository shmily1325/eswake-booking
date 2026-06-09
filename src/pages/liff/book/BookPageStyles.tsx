/** 預約表單互動樣式（按壓、選取過渡） */
export function BookPageStyles() {
  return (
    <style>
      {`
        .book-segment-btn {
          transition: transform 0.12s ease, border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .book-segment-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .book-chip-btn {
          transition: transform 0.1s ease, border-color 0.15s, background 0.15s, color 0.15s;
        }
        .book-chip-btn:active:not(:disabled) {
          transform: scale(0.97);
        }
        .book-primary-btn:active:not(:disabled) {
          transform: scale(0.99);
        }
        .book-primary-btn {
          transition: transform 0.1s ease, opacity 0.15s;
        }
      `}
    </style>
  )
}
