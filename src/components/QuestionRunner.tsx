import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AttemptItem, ErrorType, Figure, Question } from '../engine/types'
import { ERROR_NAME, ERROR_REMEDY, ERROR_TYPES } from '../engine/types'
import { needsRestatement, suggestErrorType } from '../engine/errors'
import { detectDistress } from '../engine/mood'
import { useStore } from '../lib/store'
import { uid } from '../lib/storage'
import { FigureCell, FigureStrip } from './FigureView'
import { InstructionText } from './InstructionText'
import { QuestionTags } from './SourceTag'
import { TimerRing, useCountdown } from './Timer'
import { Dialog } from './Dialog'
import { CalmNotice } from './Calm'

const LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו']

export function OptionContent({ o }: { o: string | Figure }) {
  return typeof o === 'string' ? <span>{o}</span> : <FigureCell fig={o} />
}

/** גוף השאלה: תגיות, הוראה, טקסט וצורות. משותף לתרגול ולמבחן. */
export function QuestionBody({ q, hideInstruction }: { q: Question; hideInstruction?: boolean }) {
  return (
    <>
      <QuestionTags q={q} />
      {q.instruction_text && !hideInstruction && <InstructionText text={q.instruction_text} />}
      <div className="qprompt">
        {q.prompt.split('\n').map((line, i) => (line ? <p key={i}>{line}</p> : <br key={i} />))}
      </div>
      {q.figure && <FigureStrip cells={q.figure} />}
    </>
  )
}

export function ErrorTypePicker({ value, onChange }: { value: ErrorType; onChange: (t: ErrorType) => void }) {
  return (
    <fieldset className="etype">
      <legend>מה קרה בטעות הזו?</legend>
      <div className="etype-chips">
        {ERROR_TYPES.map((t) => (
          <label key={t} className={`chip ${value === t ? 'chip-on' : ''}`}>
            <input type="radio" name="etype" value={t} checked={value === t} onChange={() => onChange(t)} />
            {ERROR_NAME[t]}
          </label>
        ))}
      </div>
      <p className="etype-remedy">{ERROR_REMEDY[value]}</p>
    </fieldset>
  )
}

export function RestateDialog({ open, skill, type, rule, onSaved }: { open: boolean; skill: string; type: ErrorType; rule: string; onSaved: () => void }) {
  const store = useStore()
  const [text, setText] = useState('')
  const [calm, setCalm] = useState(false)
  const save = () => {
    if (text.trim().length < 6) return
    if (detectDistress(text)) setCalm(true)
    store.saveNote(skill, type, text.trim())
    setText('')
    if (!detectDistress(text)) onSaved()
  }
  return (
    <Dialog open={open} title="עוצרים רגע">
      <p>
        זו הפעם השלישית שאותה טעות חוזרת: <strong>{skill}</strong>, מסוג <strong>{ERROR_NAME[type]}</strong>.
      </p>
      <div className="rule-box">
        <div className="mono label">הכלל</div>
        <p>{rule}</p>
      </div>
      <label className="field">
        <span>נסחו את הכלל במילים שלכם</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="למשל: כשרואים..." />
      </label>
      {calm ? (
        <CalmNotice onClose={() => { setCalm(false); onSaved() }} />
      ) : (
        <button className="btn btn-primary" disabled={text.trim().length < 6} onClick={save}>
          שמירת הניסוח
        </button>
      )}
    </Dialog>
  )
}

/**
 * שאלה אחת במצב למידה: בחירה, משוב מונפש, הסבר, סיווג טעות, ועצירה בטעות חוזרת.
 * הרשומה נשמרת מיד עם הבחירה.
 */
export function QuestionRunner({ q, attemptId, timed, instructionFirst, onDone, nextLabel = 'לשאלה הבאה' }: {
  q: Question
  attemptId: string
  timed?: number | null
  instructionFirst?: boolean
  onDone: (item: AttemptItem) => void
  nextLabel?: string
}) {
  const store = useStore()
  const [phase, setPhase] = useState<'instruction' | 'answer' | 'feedback'>(instructionFirst && q.instruction_text ? 'instruction' : 'answer')
  const [started, setStarted] = useState<number | null>(phase === 'answer' ? Date.now() : null)
  const [item, setItem] = useState<AttemptItem | null>(null)
  const [restate, setRestate] = useState(false)
  const itemRef = useRef<AttemptItem | null>(null)

  const answer = useCallback(
    (idx: number | null, timedOut = false) => {
      if (itemRef.current) return
      const seconds = started ? Math.round((Date.now() - started) / 1000) : null
      const correct = idx === q.correct_index
      const it: AttemptItem = {
        id: uid(),
        attempt_id: attemptId,
        question_id: q.id,
        selected_index: idx,
        is_correct: correct,
        seconds_taken: seconds,
        error_type: correct ? 'none' : suggestErrorType(q, seconds, timedOut),
        answered_at: new Date().toISOString(),
      }
      itemRef.current = it
      setItem(it)
      store.saveItem(it)
      setPhase('feedback')
    },
    [attemptId, q, started, store],
  )

  const left = useCountdown(timed && phase === 'answer' ? started : null, timed ?? 0, () => answer(null, true))

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (phase !== 'answer') return
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) answer(n - 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [phase, q.options.length, answer])

  const setType = (t: ErrorType) => {
    if (!item) return
    const it = { ...item, error_type: t }
    itemRef.current = it
    setItem(it)
    store.saveItem(it)
  }

  const next = () => {
    if (!item) return
    if (!item.is_correct && item.error_type !== 'none') {
      const snap = store.snapshot()
      if (needsRestatement(snap.scored, snap.notes, q.skill, item.error_type)) {
        setRestate(true)
        return
      }
    }
    onDone(item)
  }

  return (
    <motion.article
      className={`qcard ${phase === 'feedback' ? (item?.is_correct ? 'qcard-right' : 'qcard-wrong') : ''}`}
      initial={{ opacity: 0, y: 24, rotateX: -6 }}
      animate={phase === 'feedback' && item && !item.is_correct ? { opacity: 1, y: 0, rotateX: 0, x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.45 }}
    >
      {phase === 'instruction' && q.instruction_text ? (
        <div className="instr-first">
          <div className="mono label">קודם ההוראה, לבד</div>
          <InstructionText text={q.instruction_text} />
          <p className="muted">סמנו לעצמכם את המילים המודגשות. רק אחר כך עוברים לשאלה.</p>
          <button className="btn btn-primary" onClick={() => { setPhase('answer'); setStarted(Date.now()) }}>
            קראתי, לשאלה
          </button>
        </div>
      ) : (
        <>
          <div className="qhead">
            <div className="qhead-main">
              <QuestionBody q={q} />
            </div>
            {timed && phase === 'answer' ? <TimerRing left={left} total={timed} /> : null}
          </div>
          <div className={`options ${q.options.some((o) => typeof o !== 'string') ? 'options-fig' : ''}`} role="list">
            {q.options.map((o, i) => {
              const chosen = item?.selected_index === i
              const isRight = phase === 'feedback' && i === q.correct_index
              const isWrong = phase === 'feedback' && chosen && !item?.is_correct
              return (
                <motion.button
                  key={i}
                  role="listitem"
                  className={`option ${isRight ? 'option-right' : ''} ${isWrong ? 'option-wrong' : ''} ${phase === 'feedback' && !isRight && !isWrong ? 'option-dim' : ''}`}
                  disabled={phase !== 'answer'}
                  onClick={() => answer(i)}
                  whileHover={phase === 'answer' ? { y: -2 } : undefined}
                  whileTap={phase === 'answer' ? { scale: 0.98 } : undefined}
                >
                  <span className="opt-letter mono">{LETTERS[i]}</span>
                  <OptionContent o={o} />
                </motion.button>
              )
            })}
          </div>
          <AnimatePresence>
            {phase === 'feedback' && item && (
              <motion.div className="feedback" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <div className={`verdict ${item.is_correct ? 'verdict-right' : 'verdict-wrong'}`}>
                  <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
                    {item.is_correct ? 'נכון' : item.selected_index === null ? 'הזמן נגמר' : 'לא נכון'}
                  </motion.span>
                </div>
                <p className="explanation">{q.explanation}</p>
                {!item.is_correct && item.error_type !== 'none' && <ErrorTypePicker value={item.error_type} onChange={setType} />}
                <button className="btn btn-primary" onClick={next} autoFocus>
                  {nextLabel}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
      {item && item.error_type !== 'none' && (
        <RestateDialog open={restate} skill={q.skill} type={item.error_type} rule={q.explanation} onSaved={() => { setRestate(false); onDone(item) }} />
      )}
    </motion.article>
  )
}
