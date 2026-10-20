/** סימן האפליקציה: שלוש קומות של שליטה, בלי טקסט. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8ea2ff" />
          <stop offset="1" stopColor="#4b5fd1" />
        </linearGradient>
        <linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#0f9f8a" />
        </linearGradient>
        <linearGradient id="lg3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="1" stopColor="#e19a0c" />
        </linearGradient>
      </defs>
      <path d="M32 40 L54 50 L32 60 L10 50 Z" fill="url(#lg1)" />
      <path d="M32 26 L50 34 L32 42 L14 34 Z" fill="url(#lg2)" />
      <path d="M32 12 L46 18 L32 24 L18 18 Z" fill="url(#lg3)" />
    </svg>
  )
}
