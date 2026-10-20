import { useEffect, useRef, useState } from 'react'
import { Ring } from './Ring'

export const fmt = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** טיימר לפי זמן התחלה שמור, כך שיציאה מהדף לא מאפסת אותו. */
export function useCountdown(startedAt: number | null, totalSec: number, onEnd?: () => void) {
  const [now, setNow] = useState(Date.now())
  const ended = useRef(false)
  useEffect(() => {
    ended.current = false
  }, [startedAt, totalSec])
  useEffect(() => {
    if (startedAt == null) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [startedAt])
  const left = startedAt == null ? totalSec : Math.max(0, totalSec - (now - startedAt) / 1000)
  useEffect(() => {
    if (startedAt != null && left <= 0 && !ended.current) {
      ended.current = true
      onEnd?.()
    }
  }, [left, startedAt, onEnd])
  return left
}

export function TimerRing({ left, total, size = 64, label }: { left: number; total: number; size?: number; label?: string }) {
  const frac = total ? left / total : 0
  const color = frac < 0.15 ? 'var(--wrong)' : frac < 0.35 ? 'var(--warn)' : 'var(--accent)'
  return (
    <Ring value={frac} size={size} stroke={size > 80 ? 8 : 5} color={color} label={label ?? `נותרו ${fmt(left)}`}>
      <span className="mono timer-text" style={{ fontSize: size > 80 ? 20 : 14 }}>{fmt(left)}</span>
    </Ring>
  )
}
