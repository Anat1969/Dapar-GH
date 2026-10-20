import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DAILY_BLOCKS, DEFAULT_APPLY_SECONDS } from '../config/app'
import { isoDate, todayPlan } from '../engine/plan'
import { recommendedLayer } from '../engine/mastery'
import { hasOpenUnderstandingError, repairQueue } from '../engine/errors'
import { sessionReport } from '../engine/report'
import type { Domain, Layer, Question, ScoredItem } from '../engine/types'
import { DOMAIN_NAME, DOMAINS, LAYER_NAME } from '../engine/types'
import { useStore, type Store } from '../lib/store'
import { pickQuestions } from '../lib/pick'
import { readJSON, removeKey, writeJSON } from '../lib/storage'
import { QuestionRunner } from '../components/QuestionRunner'
import { TimerRing, useCountdown } from '../components/Timer'
import { SessionReportView } from '../components/Report'
import { Empty } from '../components/States'

type BlockKind = 'repair' | 'material' | 'apply'
interface Block { k: BlockKind; min: number }
interface Saved { date: string; mode: string; attemptId: string; block: number; blockStartedAt: number; seen: string[] }

const KEY = 'dapar.session'
const BLOCK_NAME: Record<BlockKind, string> = { repair: 'תיקון טעויות', material: 'חומר', apply: 'יישום בזמן' }

/** שאלה הבאה לתיקון: קודם השאלה שבה טעה, אחר כך שאלה מאותו נושא. */
export function nextRepair(store: Store, seen: Set<string>) {
  const queue = repairQueue(store.scored, store.notes)
  for (const g of queue) {
    const ids = [...g.questionIds, ...pickQuestions(store.questions, store.scored, { skill: g.skill, count: 6, exclude: seen }).map((q) => q.id)]
    const id = ids.find((x) => !seen.has(x) && store.qmap.has(x))
    if (id) return { q: store.qmap.get(id)!, instructionFirst: g.type === 'instruction', group: g }
  }
  return null
}

function weakestDomain(scored: ScoredItem[]): Domain {
  let best: Domain = 'verbal'
  let worst = 2
  for (const d of DOMAINS) {
    const list = scored.filter((i) => i.q.domain === d).slice(-20)
    if (!list.length) continue
    const acc = list.filter((i) => i.is_correct).length / list.length
    if (acc < worst) { worst = acc; best = d }
  }
  return best
}

export default function Session() {
  const store = useStore()
  const [params] = useSearchParams()
  const review = params.get('mode') === 'review'
  const today = isoDate(new Date())
  const plan = todayPlan(today)
  const blocks: Block[] = review
    ? [{ k: 'repair', min: 20 }, { k: 'apply', min: 25 }]
    : [{ k: 'repair', min: DAILY_BLOCKS.repair }, { k: 'material', min: DAILY_BLOCKS.material }, { k: 'apply', min: DAILY_BLOCKS.apply }]
  const focus = plan.focus.length ? plan.focus : [{ domain: 'verbal' as Domain, layer: 'knowledge' as Layer }]
  const applyDomain: Domain = review ? weakestDomain(store.scored) : plan.apply ?? focus[0].domain

  const [saved, setSaved] = useState<Saved | null>(() => {
    const s = readJSON<Saved | null>(KEY, null)
    return s && s.date === today && s.mode === (review ? 'review' : 'daily') ? s : null
  })
  const [current, setCurrent] = useState<{ q: Question; instructionFirst?: boolean; timed?: number | null; note?: string } | null>(null)
  const [timeUp, setTimeUp] = useState(false)
  const [finished, setFinished] = useState<string | null>(null)
  const [count, setCount] = useState(0)

  const persist = (s: Saved | null) => {
    setSaved(s)
    if (s) writeJSON(KEY, s)
    else removeKey(KEY)
  }

  const pickFor = useCallback(
    (s: Saved) => {
      const blk = blocks[s.block]
      const seen = new Set(s.seen)
      if (blk.k === 'repair') {
        const r = nextRepair(store, seen)
        return r ? { q: r.q, instructionFirst: r.instructionFirst } : null
      }
      if (blk.k === 'material') {
        const f = focus.length > 1 && s.seen.length % 3 === 2 ? focus[1] : focus[0]
        const open = hasOpenUnderstandingError(store.scored, store.notes, f.domain)
        const rec = recommendedLayer(store.scored, f.domain, f.layer, open)
        const q = pickQuestions(store.questions, store.scored, { domain: f.domain, layer: rec.layer, count: 1, exclude: seen })[0]
        const note = rec.reason === 'stuck' ? `חוזרים לשכבת ${LAYER_NAME[rec.layer]} לחיזוק.` : rec.reason === 'locked' ? `שכבת ${LAYER_NAME[f.layer]} עוד נעולה. מתרגלים ${LAYER_NAME[rec.layer]}.` : undefined
        return q ? { q, note } : null
      }
      const open = hasOpenUnderstandingError(store.scored, store.notes, applyDomain)
      const rec = recommendedLayer(store.scored, applyDomain, 'application', open)
      const options = pickQuestions(store.questions, store.scored, { domain: applyDomain, layer: rec.layer, count: 4, exclude: seen, ascending: true })
      const q = options[0]
      if (!q) return null
      const note = rec.layer !== 'application' ? `יישום ב${DOMAIN_NAME[applyDomain]} ייפתח אחרי שידע והבנה יציבים. בינתיים: ${LAYER_NAME[rec.layer]} עם שעון.` : undefined
      return { q, timed: q.time_limit_seconds ?? DEFAULT_APPLY_SECONDS, note }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, applyDomain, review],
  )

  const start = () => {
    const a = store.startAttempt('daily')
    const s: Saved = { date: today, mode: review ? 'review' : 'daily', attemptId: a.id, block: 0, blockStartedAt: Date.now(), seen: [] }
    persist(s)
    setCurrent(pickFor(s))
  }

  const advance = useCallback(() => {
    if (!saved) return
    setTimeUp(false)
    if (saved.block + 1 >= blocks.length) {
      store.finishAttempt(saved.attemptId, null)
      setFinished(saved.attemptId)
      persist(null)
      setCurrent(null)
      return
    }
    const s = { ...saved, block: saved.block + 1, blockStartedAt: Date.now() }
    persist(s)
    setCurrent(pickFor(s))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, pickFor])

  const blk = saved ? blocks[saved.block] : null
  const left = useCountdown(saved ? saved.blockStartedAt : null, (blk?.min ?? 0) * 60, () => setTimeUp(true))

  // חזרה לסשן פתוח
  if (saved && !current && !finished) {
    const c = pickFor(saved)
    if (c) setCurrent(c)
  }

  const onDone = (q: Question) => {
    if (!saved) return
    const s = { ...saved, seen: [...saved.seen, q.id] }
    persist(s)
    setCount((n) => n + 1)
    if (timeUp) {
      advance()
      return
    }
    setCurrent(pickFor(s))
  }

  const report = useMemo(() => {
    if (!finished) return null
    const a = store.attempts.find((x) => x.id === finished)
    const mine = store.scored.filter((i) => i.attempt_id === finished)
    const before = store.scored.filter((i) => a && i.answered_at < a.started_at)
    return sessionReport(mine, before)
  }, [finished, store.attempts, store.scored])

  if (report) {
    return (
      <div className="page">
        <SessionReportView r={report} title="סיכום היום" />
        <div className="row-actions">
          <Link className="btn btn-primary" to="/">לדף הבית</Link>
          <Link className="btn btn-ghost" to="/stats">ללוח המדידה</Link>
        </div>
      </div>
    )
  }

  if (!saved || !blk) {
    return (
      <div className="page narrow">
        <div className="mono label">{review ? 'יום תיקון' : 'סשן יומי'}</div>
        <h1 className="h-hero">{review ? 'תיקון ויישום בזמן' : plan.title}</h1>
        <div className="session-plan">
          {blocks.map((b, i) => (
            <motion.div key={b.k} className={`sp-step sp-${b.k}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
              <span className="mono">{b.min} דק'</span>
              <strong>{BLOCK_NAME[b.k]}</strong>
            </motion.div>
          ))}
        </div>
        <p className="muted">בסשן יומי לא מוצג ציון. כל תשובה נשמרת מיד.</p>
        <button className="btn btn-primary btn-lg" onClick={start}>התחלת היום</button>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="session-bar">
        <div className="seg-progress">
          {blocks.map((b, i) => (
            <div key={b.k} className={`seg ${i < saved.block ? 'seg-done' : ''} ${i === saved.block ? 'seg-now' : ''}`} style={{ flexGrow: b.min }}>
              <span>{BLOCK_NAME[b.k]}</span>
              {i === saved.block && <motion.div className="seg-fill" style={{ transformOrigin: 'right' }} animate={{ scaleX: 1 - left / (b.min * 60) }} />}
            </div>
          ))}
        </div>
        <TimerRing left={left} total={blk.min * 60} size={56} label={`זמן בחלק: ${BLOCK_NAME[blk.k]}`} />
      </div>
      {timeUp && <div className="notice">הזמן של החלק נגמר. מסיימים את השאלה ועוברים הלאה.</div>}
      {current?.note && <div className="notice">{current.note}</div>}
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div key={current.q.id + count} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}>
            <QuestionRunner q={current.q} attemptId={saved.attemptId} timed={current.timed} instructionFirst={current.instructionFirst} onDone={() => onDone(current.q)} />
          </motion.div>
        ) : (
          <Empty
            text={blk.k === 'repair' ? 'אין טעויות פתוחות לתיקון. עוברים לחלק הבא.' : 'אין עוד שאלות זמינות בחלק הזה.'}
          />
        )}
      </AnimatePresence>
      <div className="row-actions">
        <button className="btn btn-ghost" onClick={advance}>
          {saved.block + 1 >= blocks.length ? 'סיום היום' : `סיום החלק, ל${BLOCK_NAME[blocks[saved.block + 1].k]}`}
        </button>
      </div>
    </div>
  )
}
