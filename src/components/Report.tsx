import { motion } from 'framer-motion'
import { useState } from 'react'
import type { SessionReport } from '../engine/report'
import { detectDistress } from '../engine/mood'
import { CalmNotice } from './Calm'

const list = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } }
const row = { hidden: { opacity: 0, x: 16 }, show: { opacity: 1, x: 0 } }

/** דוח סוף סשן. בלי ציון. */
export function SessionReportView({ r, title = 'סיכום הסשן' }: { r: SessionReport; title?: string }) {
  const [note, setNote] = useState('')
  const [calm, setCalm] = useState(false)
  return (
    <section className="report">
      <h2 className="h-xl">{title}</h2>
      <div className="report-grid">
        <motion.div className="panel" variants={list} initial="hidden" animate="show">
          <div className="mono label">השתפר</div>
          {r.improved.length ? r.improved.map((s) => <motion.div key={s} variants={row} className="report-item up">{s}</motion.div>) : <p className="muted">עוד מוקדם לקבוע. ממשיכים לתרגל.</p>}
        </motion.div>
        <motion.div className="panel" variants={list} initial="hidden" animate="show">
          <div className="mono label">לחזק</div>
          {r.strengthen.length ? r.strengthen.map((s) => <motion.div key={s} variants={row} className="report-item down">{s}</motion.div>) : <p className="muted">אין נושא פתוח מהסשן הזה.</p>}
        </motion.div>
        <div className="panel">
          <div className="mono label">סוג הטעות הדומיננטי</div>
          <div className="h-lg">{r.dominantName ?? 'אין טעויות בסשן'}</div>
        </div>
        <div className="panel panel-accent">
          <div className="mono label">הצעד הבא</div>
          <p className="next-step">{r.nextStep}</p>
        </div>
      </div>
      <label className="field">
        <span>משפט אחד על התרגול היום (לא נשמר)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => setCalm(detectDistress(note))} />
      </label>
      {calm && <CalmNotice onClose={() => setCalm(false)} />}
    </section>
  )
}
