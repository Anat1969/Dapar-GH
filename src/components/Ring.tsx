import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/** טבעת התקדמות עם הנפשה. value בין 0 ל-1. */
export function Ring({ value, size = 120, stroke = 10, color = 'var(--accent)', track = 'var(--line)', children, label }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode; label?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  )
}
