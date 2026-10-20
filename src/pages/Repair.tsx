import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorGroups, repairQueue, type ErrorGroup } from '../engine/errors'
import { DOMAIN_NAME, ERROR_NAME, ERROR_REMEDY, ERROR_TYPES, type ErrorType, type Question } from '../engine/types'
import { useStore } from '../lib/store'
import { QuestionRunner } from '../components/QuestionRunner'
import { Empty } from '../components/States'
import { TimerRing, useCountdown } from '../components/Timer'
import { nextRepair } from './Session'
import { DOMAIN_COLOR } from '../components/Towers'

export default function Repair() {
  const store = useStore()
  const [params] = useSearchParams()
  const minutes = Number(params.get('minutes')) || 0
  const queue = repairQueue(store.scored, store.notes)
  const resolvedCount = errorGroups(store.scored, store.notes).filter((g) => g.resolved).length
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [current, setCurrent] = useState<{ q: Question; instructionFirst: boolean; group: ErrorGroup } | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const seen = useRef(new Set<string>())
  const left = useCountdown(minutes ? startedAt : null, minutes * 60, () => setTimeUp(true))

  const byType = useMemo(() => {
    const m = new Map<ErrorType, ErrorGroup[]>()
    // טעויות הוראה קודם: הן דורשות קריאה לפני פתרון
    const order: ErrorType[] = ['instruction', ...ERROR_TYPES.filter((t) => t !== 'instruction')]
    for (const t of order) m.set(t, queue.filter((g) => g.type === t))
    return [...m.entries()].filter(([, l]) => l.length)
  }, [queue])

  const begin = () => {
    const a = store.startAttempt('practice')
    setAttemptId(a.id)
    setStartedAt(Date.now())
    seen.current = new Set()
    setCurrent(nextRepair(store, seen.current))
  }
  const done = () => {
    if (current) seen.current.add(current.q.id)
    if (timeUp) return stop()
    setCurrent(nextRepair(store, seen.current))
  }
  const stop = () => {
    if (attemptId) store.finishAttempt(attemptId, null)
    setAttemptId(null)
    setCurrent(null)
    setStartedAt(null)
    setTimeUp(false)
  }

  if (attemptId) {
    return (
      <div className="page">
        <div className="session-bar">
          <div>
            <div className="mono label">תיקון טעויות</div>
            {current && (
              <div className="repair-meta">
                {current.group.skill} · {ERROR_NAME[current.group.type]} · {current.group.count} פעמים
              </div>
            )}
          </div>
          {minutes > 0 && <TimerRing left={left} total={minutes * 60} size={56} />}
        </div>
        {current?.group && store.notes.filter((n) => n.skill === current.group.skill && n.error_type === current.group.type).slice(-1).map((n) => (
          <div key={n.id} className="rule-box">
            <div className="mono label">הניסוח שלך</div>
            <p>{n.rule_restatement}</p>
          </div>
        ))}
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={current.q.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <QuestionRunner q={current.q} attemptId={attemptId} instructionFirst={current.instructionFirst} onDone={done} />
            </motion.div>
          ) : (
            <Empty text="סיימת את תור התיקון לעכשיו." action={<Link className="btn btn-primary" to="/">לדף הבית</Link>} />
          )}
        </AnimatePresence>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={stop}>סיום התיקון</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="section-head">
        <div className="mono label">תור התיקון</div>
        <h1 className="h-hero">תיקון טעויות</h1>
        <p className="lead">כל טעות לפי הסוג שלה, ולכל סוג תרופה אחרת. טעות יורדת מהתור אחרי שתי תשובות נכונות ברצף בנושא.</p>
      </div>
      <div className="stat-row">
        <div className="stat"><span className="stat-num">{queue.length}</span><span>פתוחות</span></div>
        <div className="stat"><span className="stat-num ok">{resolvedCount}</span><span>טופלו</span></div>
      </div>
      {queue.length === 0 ? (
        <Empty text="אין טעויות פתוחות. כל טעות חדשה בתרגול תופיע כאן." action={<Link className="btn btn-primary" to="/practice">לתרגול</Link>} />
      ) : (
        <>
          <button className="btn btn-primary btn-lg" onClick={begin}>
            {minutes ? `${minutes} דקות תיקון` : 'התחלת תיקון'}
          </button>
          {byType.map(([t, groups]) => (
            <section key={t} className="etype-section">
              <h2 className="h-lg">{ERROR_NAME[t]}</h2>
              <p className="muted">{ERROR_REMEDY[t]}</p>
              <div className="cards">
                {groups.map((g, i) => (
                  <motion.div key={g.key} className="card" style={{ ['--tc' as string]: DOMAIN_COLOR[g.domain] }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="card-top">
                      <span className="tag">{DOMAIN_NAME[g.domain]}</span>
                      <span className="mono count-pill">{g.count}</span>
                    </div>
                    <strong>{g.skill}</strong>
                    {g.count >= 3 && !g.hasNote && <span className="tag tag-warn">נדרש ניסוח במילים שלך</span>}
                  </motion.div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
