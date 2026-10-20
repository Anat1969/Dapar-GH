import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DIAGNOSTIC_SECTIONS, INTERNAL_SCORE_LABEL, MOCK_SECTIONS } from '../config/app'
import { estimate } from '../engine/score'
import { sessionReport } from '../engine/report'
import { suggestErrorType } from '../engine/errors'
import { DOMAIN_NAME, DOMAINS, ERROR_NAME, ERROR_TYPES, type AttemptKind, type Domain, type ErrorType } from '../engine/types'
import { useStore } from '../lib/store'
import { pickQuestions } from '../lib/pick'
import { readJSON, removeKey, uid, writeJSON } from '../lib/storage'
import { ErrorTypePicker, OptionContent, QuestionBody } from '../components/QuestionRunner'
import { TimerRing, useCountdown } from '../components/Timer'
import { Ring } from '../components/Ring'
import { DOMAIN_COLOR } from '../components/Towers'
import { SessionReportView } from '../components/Report'
import { Empty } from '../components/States'

interface Section { domain: Domain; qids: string[]; minutes: number; startedAt: number | null; ended: boolean }
interface Active {
  attemptId: string
  kind: AttemptKind
  sections: Section[]
  current: number
  idx: number
  answers: Record<string, number>
  itemIds: Record<string, string>
  answeredAt: Record<string, string>
}
const KEY = 'dapar.mock.active'
const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו']

const KIND_NAME: Record<string, string> = { diagnostic: 'אבחון', mock_partial: 'מבחן מדומה חלקי', mock_full: 'מבחן מדומה מלא' }

function plannedSections(kind: AttemptKind, domain: Domain | null) {
  if (kind === 'diagnostic') return DOMAINS.map((d) => ({ domain: d, ...DIAGNOSTIC_SECTIONS[d] }))
  if (kind === 'mock_partial') return [{ domain: domain ?? 'verbal', ...MOCK_SECTIONS[domain ?? 'verbal'] }]
  return DOMAINS.map((d) => ({ domain: d, ...MOCK_SECTIONS[d] }))
}

export default function Mock() {
  const store = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [active, setActiveState] = useState<Active | null>(() => readJSON<Active | null>(KEY, null))
  const setActive = (a: Active | null) => {
    setActiveState(a)
    if (a) writeJSON(KEY, a)
    else removeKey(KEY)
  }
  const kindParam = params.get('kind')
  const kind: AttemptKind | null = kindParam === 'diagnostic' ? 'diagnostic' : kindParam === 'partial' ? 'mock_partial' : kindParam === 'full' ? 'mock_full' : null
  const domParam = (DOMAINS as string[]).includes(params.get('domain') ?? '') ? (params.get('domain') as Domain) : null

  const sec = active ? active.sections[active.current] : null

  const saveAnswer = (a: Active, qid: string, selected: number | null, timedOut = false) => {
    const q = store.qmap.get(qid)
    if (!q) return a
    const id = a.itemIds[qid] ?? uid()
    const correct = selected === q.correct_index
    const at = a.answeredAt[qid] ?? new Date().toISOString()
    store.saveItem({
      id,
      attempt_id: a.attemptId,
      question_id: qid,
      selected_index: selected,
      is_correct: correct,
      seconds_taken: null,
      error_type: correct ? 'none' : timedOut || selected === null ? 'time' : suggestErrorType(q, null, false),
      answered_at: at,
    })
    return { ...a, itemIds: { ...a.itemIds, [qid]: id }, answeredAt: { ...a.answeredAt, [qid]: at }, answers: selected === null ? a.answers : { ...a.answers, [qid]: selected } }
  }

  const finishAll = (a: Active) => {
    const items = store.snapshot().scored.filter((i) => i.attempt_id === a.attemptId)
    const est = estimate(items).overall
    store.finishAttempt(a.attemptId, est)
    setActive(null)
    nav(`/mock/report/${a.attemptId}`)
  }

  const endSection = useCallback(
    (timedOut: boolean) => {
      const a = readJSON<Active | null>(KEY, null)
      if (!a) return
      let next = a
      const s = a.sections[a.current]
      for (const qid of s.qids) if (!(qid in a.answers)) next = saveAnswer(next, qid, null, timedOut)
      const sections = next.sections.map((x, i) => (i === a.current ? { ...x, ended: true } : x))
      next = { ...next, sections }
      if (a.current + 1 >= a.sections.length) {
        finishAll(next)
        return
      }
      setActive({ ...next, current: a.current + 1, idx: 0 })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store],
  )

  const left = useCountdown(sec?.startedAt ?? null, (sec?.minutes ?? 0) * 60, () => endSection(true))

  const start = () => {
    if (!kind) return
    const a = store.startAttempt(kind)
    const exclude = new Set<string>()
    const sections: Section[] = plannedSections(kind, domParam).map((p) => {
      const qs = pickQuestions(store.questions, store.scored, { domain: p.domain, count: p.questions, exclude })
      qs.forEach((q) => exclude.add(q.id))
      // מהקל לקשה, כמו במבחן
      const qids = qs.sort((x, y) => x.difficulty - y.difficulty).map((q) => q.id)
      return { domain: p.domain, qids, minutes: p.minutes, startedAt: null, ended: false }
    }).filter((s) => s.qids.length)
    setActive({ attemptId: a.id, kind, sections, current: 0, idx: 0, answers: {}, itemIds: {}, answeredAt: {} })
  }

  // רץ
  if (active && sec) {
    if (!sec.startedAt) {
      return (
        <div className="page narrow">
          <div className="mono label">{KIND_NAME[active.kind]} · פרק {active.current + 1} מתוך {active.sections.length}</div>
          <motion.h1 className="h-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ color: DOMAIN_COLOR[sec.domain] }}>
            {DOMAIN_NAME[sec.domain]}
          </motion.h1>
          <p className="lead">{sec.qids.length} שאלות · {sec.minutes} דקות. השעון מתחיל עם הפרק. אפשר לחזור לשאלות בתוך הפרק.</p>
          <button className="btn btn-primary btn-lg" onClick={() => setActive({ ...active, sections: active.sections.map((s, i) => (i === active.current ? { ...s, startedAt: Date.now() } : s)) })}>
            התחלת הפרק
          </button>
        </div>
      )
    }
    const qid = sec.qids[active.idx]
    const q = store.qmap.get(qid)
    const answeredHere = sec.qids.filter((x) => x in active.answers).length
    return (
      <div className="page exam" style={{ ['--tc' as string]: DOMAIN_COLOR[sec.domain] }}>
        <div className="session-bar">
          <div>
            <div className="mono label">{KIND_NAME[active.kind]} · פרק {active.current + 1}/{active.sections.length}</div>
            <div className="h-lg">{DOMAIN_NAME[sec.domain]}</div>
            <div className="mono small">נענו {answeredHere} מתוך {sec.qids.length}</div>
          </div>
          <TimerRing left={left} total={sec.minutes * 60} size={72} label="זמן בפרק" />
        </div>
        <div className="qgrid" role="tablist" aria-label="שאלות בפרק">
          {sec.qids.map((x, i) => (
            <button key={x} role="tab" aria-selected={i === active.idx} className={`qgrid-cell ${x in active.answers ? 'answered' : ''} ${i === active.idx ? 'current' : ''}`} onClick={() => setActive({ ...active, idx: i })}>
              {i + 1}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {q && (
            <motion.article key={qid} className="qcard" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.2 }}>
              <QuestionBody q={q} />
              <div className={`options ${q.options.some((o) => typeof o !== 'string') ? 'options-fig' : ''}`}>
                {q.options.map((o, i) => (
                  <button key={i} className={`option ${active.answers[qid] === i ? 'option-chosen' : ''}`} onClick={() => setActive(saveAnswer(active, qid, i))}>
                    <span className="opt-letter mono">{LETTERS[i]}</span>
                    <OptionContent o={o} />
                  </button>
                ))}
              </div>
            </motion.article>
          )}
        </AnimatePresence>
        <div className="row-actions">
          <button className="btn" disabled={active.idx === 0} onClick={() => setActive({ ...active, idx: active.idx - 1 })}>הקודמת</button>
          {active.idx + 1 < sec.qids.length ? (
            <button className="btn btn-primary" onClick={() => setActive({ ...active, idx: active.idx + 1 })}>הבאה</button>
          ) : (
            <button className="btn btn-primary" onClick={() => endSection(false)}>
              {active.current + 1 >= active.sections.length ? 'סיום המבחן' : 'סיום הפרק'}
            </button>
          )}
          {active.idx + 1 < sec.qids.length && (
            <button className="btn btn-ghost" onClick={() => endSection(false)}>סיום הפרק עכשיו</button>
          )}
        </div>
      </div>
    )
  }

  // פתיחה
  if (kind) {
    const plan = plannedSections(kind, domParam)
    const total = plan.reduce((s, p) => s + p.minutes, 0)
    return (
      <div className="page narrow">
        <Link to="/mock" className="back-link">כל סוגי המבחן</Link>
        <div className="mono label">{kind === 'diagnostic' ? 'יום 1' : 'מבחן מדומה'}</div>
        <h1 className="h-hero">{KIND_NAME[kind]}{kind === 'mock_partial' ? `: ${DOMAIN_NAME[domParam ?? 'verbal']}` : ''}</h1>
        {kind === 'diagnostic' && <p className="lead">מדידה ראשונית בכל התחומים, בלי ציון. אחרי המבחן: סיכום טעויות לפי סוג.</p>}
        {kind === 'mock_full' && <p className="notice">מומלץ במחשב, כי המבחן עצמו ממוחשב.</p>}
        {kind === 'mock_partial' && (
          <div className="chips">
            {DOMAINS.map((d) => (
              <button key={d} className={`chip ${d === (domParam ?? 'verbal') ? 'chip-on' : ''}`} onClick={() => setParams({ kind: 'partial', domain: d })}>
                {DOMAIN_NAME[d]}
              </button>
            ))}
          </div>
        )}
        <div className="session-plan">
          {plan.map((p, i) => (
            <motion.div key={p.domain} className="sp-step" style={{ ['--tc' as string]: DOMAIN_COLOR[p.domain], flexGrow: p.minutes }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <span className="mono">{p.minutes} דק' · {p.questions} שאלות</span>
              <strong>{DOMAIN_NAME[p.domain]}</strong>
            </motion.div>
          ))}
        </div>
        <p className="muted">סך הכל {total} דקות. טיימר לכל פרק. יציאה מהדף לא מאבדת תשובות, והשעון ממשיך.</p>
        <button className="btn btn-primary btn-lg" onClick={start}>התחלת המבחן</button>
      </div>
    )
  }

  const past = store.attempts.filter((a) => a.kind !== 'daily' && a.kind !== 'practice' && a.finished_at).slice(-5).reverse()
  return (
    <div className="page">
      <div className="section-head">
        <div className="mono label">מבחן מדומה</div>
        <h1 className="h-hero">בחרו מבחן</h1>
      </div>
      <div className="choice-grid">
        <Link to="/mock?kind=partial&domain=verbal" className="choice">
          <strong>מבחן חלקי</strong>
          <span>פרק אחד עם שעון. מתאים גם לנייד.</span>
        </Link>
        <Link to="/mock?kind=full" className="choice choice-strong">
          <strong>מבחן מלא</strong>
          <span>ארבעה פרקים, שעון לכל פרק. מומלץ במחשב.</span>
        </Link>
        <Link to="/mock?kind=diagnostic" className="choice">
          <strong>אבחון</strong>
          <span>מדידה ראשונית בכל התחומים, בלי ציון.</span>
        </Link>
      </div>
      {past.length > 0 && (
        <section>
          <h2 className="h-lg">דוחות קודמים</h2>
          <div className="cards">
            {past.map((a) => (
              <Link key={a.id} to={`/mock/report/${a.id}`} className="card">
                <span className="tag">{KIND_NAME[a.kind]}</span>
                <span className="mono">{new Date(a.started_at).toLocaleDateString('he-IL')}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function MockReport() {
  const store = useStore()
  const { id } = useParams()
  const attempt = store.attempts.find((a) => a.id === id)
  const items = useMemo(() => store.scored.filter((i) => i.attempt_id === id), [store.scored, id])
  const [open, setOpen] = useState<string | null>(null)
  if (!attempt) return <div className="page"><Empty text="הדוח לא נמצא." action={<Link className="btn" to="/mock">למבחן מדומה</Link>} /></div>
  const est = estimate(items)
  const hideScore = attempt.kind === 'diagnostic'
  const wrong = items.filter((i) => !i.is_correct)
  const typeCounts = ERROR_TYPES.map((t) => ({ t, n: wrong.filter((i) => i.error_type === t).length })).filter((x) => x.n)
  const maxN = Math.max(1, ...typeCounts.map((x) => x.n))
  const before = store.scored.filter((i) => i.answered_at < attempt.started_at)
  const rep = sessionReport(items, before)
  const setType = (itemId: string, t: ErrorType) => {
    const it = store.items.find((x) => x.id === itemId)
    if (it) store.saveItem({ ...it, error_type: t })
  }
  return (
    <div className="page">
      <div className="mono label">{KIND_NAME[attempt.kind]} · {new Date(attempt.started_at).toLocaleDateString('he-IL')}</div>
      <h1 className="h-hero">דוח מבחן</h1>
      {!hideScore && est.overall !== null && (
        <section className="score-hero">
          <Ring value={est.overall / 100} size={168} stroke={12} label={`ציון משוער ${est.overall}`}>
            <div className="countdown">
              <span className="countdown-num">{est.overall}</span>
              <span className="countdown-lbl">ציון משוער</span>
            </div>
          </Ring>
          <div>
            <p className="internal-label">{INTERNAL_SCORE_LABEL}</p>
            <div className="dom-bars">
              {(Object.keys(est.byDomain) as Domain[]).map((d, i) => (
                <div key={d} className="dom-bar">
                  <span>{DOMAIN_NAME[d]}</span>
                  <div className="dom-track">
                    <motion.div className="dom-fill" style={{ background: DOMAIN_COLOR[d] }} initial={{ scaleX: 0 }} animate={{ scaleX: (est.byDomain[d] ?? 0) / 100 }} transition={{ delay: 0.2 + i * 0.1, duration: 0.8 }} />
                  </div>
                  <span className="mono">{est.byDomain[d]}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {hideScore && <p className="notice">אבחון: בלי ציון, רק מדידה ראשונית. סווגו כל טעות לפי מה שקרה בה.</p>}

      <section>
        <h2 className="h-lg">סוגי הטעויות</h2>
        {typeCounts.length === 0 ? (
          <p className="muted">אין טעויות במבחן הזה.</p>
        ) : (
          <div className="etype-bars">
            {typeCounts.map((x, i) => (
              <div key={x.t} className={`etype-bar ${x.n >= 2 ? 'recurring' : ''}`}>
                <span>{ERROR_NAME[x.t]}</span>
                <div className="dom-track">
                  <motion.div className="dom-fill etype-fill" initial={{ scaleX: 0 }} animate={{ scaleX: x.n / maxN }} transition={{ delay: i * 0.08 }} />
                </div>
                <span className="mono">{x.n}</span>
                {x.n >= 2 && <span className="tag tag-warn">חוזרת</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <SessionReportView r={rep} title="מה הלאה" />

      {wrong.length > 0 && (
        <section>
          <h2 className="h-lg">השאלות שבהן טעית</h2>
          <div className="wrong-list">
            {wrong.map((i) => (
              <div key={i.id} className="wrong-item">
                <button className="wrong-head" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
                  <span className={`tag tag-${i.q.domain}`}>{DOMAIN_NAME[i.q.domain]}</span>
                  <span className="wrong-skill">{i.q.skill}</span>
                  <span className="tag">{i.error_type === 'none' ? 'לא סווג' : ERROR_NAME[i.error_type]}</span>
                </button>
                {open === i.id && (
                  <div className="wrong-body">
                    <QuestionBody q={i.q} />
                    <div className="mono label">התשובה הנכונה</div>
                    <div className="option option-right static"><OptionContent o={i.q.options[i.q.correct_index]} /></div>
                    <p className="explanation">{i.q.explanation}</p>
                    <ErrorTypePicker value={i.error_type === 'none' ? 'knowledge' : i.error_type} onChange={(t) => setType(i.id, t)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="row-actions">
        <Link className="btn btn-primary" to="/repair">לתיקון טעויות</Link>
        <Link className="btn btn-ghost" to="/stats">ללוח המדידה</Link>
      </div>
    </div>
  )
}
