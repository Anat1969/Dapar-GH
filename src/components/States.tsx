import type { ReactNode } from 'react'
import { useStore } from '../lib/store'

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="טוען">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="sk-line" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function Empty({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {action}
    </div>
  )
}

/** עוטף מסך נתונים: טעינה, שגיאה, ותור רשומות שממתינות. */
export function DataGate({ children }: { children: ReactNode }) {
  const s = useStore()
  if (s.status === 'loading') return <div className="page"><Skeleton lines={5} /></div>
  if (s.status === 'error')
    return (
      <div className="page">
        <div className="empty">
          <p>{s.error ?? 'משהו השתבש.'}</p>
          <button className="btn btn-primary" onClick={s.retry}>נסו שוב</button>
        </div>
      </div>
    )
  return <>{children}</>
}

export function PendingBanner() {
  const s = useStore()
  if (!s.pending) return null
  return (
    <div className="pending" role="status">
      <span>{s.pending} רשומות נשמרו במכשיר וממתינות לשליחה.</span>
      <button className="btn btn-sm" onClick={s.retry}>נסו שוב</button>
    </div>
  )
}
