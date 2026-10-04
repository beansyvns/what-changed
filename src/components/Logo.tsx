// The mark: a delta (Δ — the maths symbol for "change") drawn over two offset
// workbook pages, the original problem and the one where one thing changed.
export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="9" y="4" width="26" height="30" rx="2.5" fill="#F3E7CF" stroke="#D9C6A2" strokeWidth="1.2" transform="rotate(6 22 19)" />
      <rect x="4" y="6" width="26" height="30" rx="2.5" fill="#9E1B2F" />
      <path d="M17 13.5 L25.2 28 H8.8 Z" fill="none" stroke="#FBF3E4" strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="17" cy="23.6" r="1.7" fill="#FBF3E4" />
    </svg>
  );
}
