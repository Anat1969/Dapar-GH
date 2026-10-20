import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DEFAULT_APPLY_SECONDS, MASTERY } from '../config/app'
import { isStuck, isUnlocked, layerStatus } from '../engine/mastery'
import { hasOpenUnderstandingError } from '../engine/errors'
import { DOMAIN_NAME, DOMAINS, LAYER_NAME, LAYERS, type Domain, type Layer, type Question } from '../engine/types'
import { useStore } from '../lib/store'
import { pickQuestions } from '../lib/pick'
import { QuestionRunner } from '../components/QuestionRunner'
import { DOMAIN_COLOR, Towers } from '../components/Towers'
import { Empty } from '../components/States'

const REQ: Record<Layer, string> = {
  knowledge: 'פתוחה תמיד.',
  understanding: `נפתחת אחרי ${MASTERY.toUnderstanding.minAnswers} שאלות ידע, ודיוק של ${MASTERY.toUnderstanding.minAccuracy * 100} אחוז בשש האחרונות.`,
  application: `נפתחת אחרי ${MASTERY.toApplication.minAnswers} שאלות הבנה, דיוק של ${MASTERY.toApplication.minAccuracy * 100} אחוז בשמונה האחרונות, ובלי טעות הבנה פתוחה.`,
}

const prev: Record<Layer, Layer> = { knowledge: 'knowledge', understanding: 'knowledge', application: 'understanding' }

export default function Practice() {
  const store = useStore()
  const [params, setParams] = useSearchParams()
  const domain = (DOMAINS as string[]).includes(params.get('domain') ?? '') ? (params.get('domain') as Domain) : null
  const layerParam = (LAYERS as string[]).includes(params.get('layer') ?? '') ? (params.get('layer') as Layer) : null
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [current, setCurrent] = useState<Question | null>(null)
  const [streak, setStreak] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const seen = useRef(new Set<string>())

  const open = domain ? hasOpenUnderstandingError(store.scored, store.notes, domain) : false
  const locked = domain && layerParam ? !isUnlocked(store.scored, domain, layerParam, open) : false

  useEffect(() => {
    setAttemptId(null)
    setCurrent(null)
    setStreak(0)
    setAnswered(0)
    seen.current = new Set()
  }, [domain, layerParam])

  useEffect(() => {
    if (locked && domain && layerParam) {
      setNotice(`שכבת ${LAYER_NAME[layerParam]} עוד נעולה. ${REQ[layerParam]}`)
      setParams({ domain })
    }
  }, [locked, domain, layerParam, setParams])

  const pick = (d: Domain, l: Layer) => pickQuestions(store.questions, store.scored, { domain: d, layer: l, count: 1, exclude: seen.current, ascending: l === 'application' })[0] ?? null

  useEffect(() => {
    if (domain && layerParam && !locked && !attemptId) {
      const a = store.startAttempt('practice')
      setAttemptId(a.id)
      setCurrent(pick(domain, layerParam))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, layerParam, locked, attemptId])

  if (domain && layerParam && !locked) {
    if (!attemptId) return null
    const onDone = (correct: boolean) => {
      if (current) seen.current.add(current.id)
      setStreak((s) => (correct ? s + 1 : 0))
      setAnswered((n) => n + 1)
      const snap = store.snapshot()
      if (layerParam !== 'knowledge' && isStuck(snap.scored, domain, layerParam)) {
        store.finishAttempt(attemptId, null)
        setNotice(`הדיוק ב${LAYER_NAME[layerParam]} ירד מתחת ל-60 אחוז בעשר התשובות האחרונות. חוזרים שכבה אחת אחורה, ל${LAYER_NAME[prev[layerParam]]}.`)
        setParams({ domain, layer: prev[layerParam] })
        return
      }
      setCurrent(pick(domain, layerParam))
    }
    return (
      <div className="page" style={{ ['--tc' as string]: DOMAIN_COLOR[domain] }}>
        <div className="session-bar">
          <div>
            <div className="mono label">תרגול</div>
            <div className="h-lg">{DOMAIN_NAME[domain]} · {LAYER_NAME[layerParam]}</div>
          </div>
          <div className="streak" aria-label={`רצף תשובות נכונות: ${streak}`}>
            <span className="mono">רצף</span>
            <motion.span key={streak} className="streak-num" initial={{ scale: 1.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}>
              {streak}
            </motion.span>
            <div className="streak-bars">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={i < streak % 11 ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
        {notice && <div className="notice">{notice}</div>}
        <AnimatePresence mode="wait">
          {current ? (
            <motion.div key={current.id + answered} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
              <QuestionRunner
                q={current}
                attemptId={attemptId}
                timed={layerParam === 'application' ? current.time_limit_seconds ?? DEFAULT_APPLY_SECONDS : null}
                onDone={(it) => onDone(it.is_correct)}
              />
            </motion.div>
          ) : (
            <Empty text="אין עדיין שאלות נוספות בשכבה הזו. ענת תוסיף אותן." action={<Link className="btn" to={`/practice?domain=${domain}`}>חזרה לבחירת שכבה</Link>} />
          )}
        </AnimatePresence>
        <div className="row-actions">
          <button className="btn btn-ghost" onClick={() => { store.finishAttempt(attemptId, null); setParams({ domain }) }}>
            סיום התרגול
          </button>
        </div>
      </div>
    )
  }

  if (domain) {
    const st = layerStatus(store.scored, domain, open)
    return (
      <div className="page narrow" style={{ ['--tc' as string]: DOMAIN_COLOR[domain] }}>
        <Link to="/practice" className="back-link">כל התחומים</Link>
        <h1 className="h-hero">{DOMAIN_NAME[domain]}</h1>
        {notice && <div className="notice">{notice}</div>}
        <div className="layers">
          {[...st].reverse().map((s, i) => (
            <motion.div key={s.layer} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              {s.unlocked ? (
                <Link className={`layer-card ${s.passed ? 'layer-done' : ''}`} to={`/practice?domain=${domain}&layer=${s.layer}`} onClick={() => setNotice(null)}>
                  <div className="layer-fill" style={{ transform: `scaleX(${Math.max(0.03, s.progress)})` }} />
                  <span className="layer-name">{LAYER_NAME[s.layer]}</span>
                  <span className="mono layer-meta">
                    {s.answered} תשובות · {Math.round(s.recent * 100)}% לאחרונה
                  </span>
                  {s.stuck && <span className="tag tag-warn">כדאי לחזק את השכבה שמתחת</span>}
                </Link>
              ) : (
                <div className="layer-card layer-locked" aria-disabled="true">
                  <span className="layer-name">{LAYER_NAME[s.layer]}</span>
                  <span className="layer-req">{REQ[s.layer]}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="section-head">
        <div className="mono label">תרגול לפי שכבה</div>
        <h1 className="h-hero">בחרו תחום</h1>
        <p className="lead">ידע, אחר כך הבנה, ורק אז יישום. כשנתקעים חוזרים קומה אחת למטה.</p>
      </div>
      <Towers scored={store.scored} notes={store.notes} />
    </div>
  )
}
