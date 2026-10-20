import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { DAILY_BLOCKS, EXAM_DATE } from '../config/app'
import { daysToExam, isoDate, PLAN, planDayIndex, todayPlan, type PlanDay } from '../engine/plan'
import { DOMAIN_NAME, LAYER_NAME } from '../engine/types'
import { repairQueue } from '../engine/errors'
import { useStore } from '../lib/store'
import { Towers } from '../components/Towers'
import { Ring } from '../components/Ring'

function cta(p: PlanDay): { to: string; label: string; sub?: { to: string; label: string } } {
  switch (p.mode) {
    case 'prep':
      return { to: '/mock?kind=diagnostic', label: 'להתחיל את האבחון כבר עכשיו', sub: { to: '/practice', label: 'תרגול חופשי' } }
    case 'diagnostic':
      return { to: '/mock?kind=diagnostic', label: 'התחלת האבחון' }
    case 'daily':
      return { to: '/session', label: 'התחלת היום' }
    case 'mock_partial':
      return { to: '/mock?kind=partial&domain=verbal', label: 'התחלת מבחן חלקי: מילולי', sub: { to: '/repair', label: 'תיקון טעויות אחרי המבחן' } }
    case 'mock_full':
      return { to: '/mock?kind=full', label: 'התחלת מבחן מדומה מלא' }
    case 'review':
      return { to: '/session?mode=review', label: 'התחלת היום: תיקון ויישום' }
    case 'exam_day':
      return { to: '/repair?minutes=10', label: 'עשר דקות תיקון טעויות' }
    default:
      return { to: '/practice', label: 'תרגול חופשי' }
  }
}

export default function Today() {
  const store = useStore()
  const today = isoDate(new Date())
  const plan = todayPlan(today)
  const dayIdx = planDayIndex(today)
  const left = daysToExam(today)
  const queue = repairQueue(store.scored, store.notes)
  const action = cta(plan)
  const showBlocks = plan.mode === 'daily' || plan.mode === 'review'

  return (
    <div className="page">
      <section className="hero">
        <motion.div className="hero-ring" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
          <Ring value={Math.min(1, Math.max(0, dayIdx) / PLAN.length)} size={176} stroke={12} label={`יום ${dayIdx} מתוך ${PLAN.length}`}>
            <div className="countdown">
              <span className="countdown-num">{left > 0 ? left : 0}</span>
              <span className="countdown-lbl">{left === 1 ? 'יום למבחן' : left > 0 ? 'ימים למבחן' : left === 0 ? 'היום המבחן' : 'אחרי המבחן'}</span>
            </div>
          </Ring>
        </motion.div>
        <div className="hero-text">
          <div className="mono label">
            {plan.day >= 1 && plan.day <= PLAN.length ? `יום ${plan.day} מתוך ${PLAN.length}` : plan.title} · מבחן {EXAM_DATE.split('-').reverse().slice(0, 2).join('.')}
          </div>
          <motion.h1 className="h-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {plan.title}
          </motion.h1>
          {plan.note && <p className="lead">{plan.note}</p>}
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to={action.to}>
              {action.label}
            </Link>
            {action.sub && (
              <Link className="btn btn-ghost" to={action.sub.to}>
                {action.sub.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="daytrack" aria-label="מסלול תשעת הימים">
        {PLAN.map((d) => (
          <motion.div
            key={d.day}
            className={`daydot ${d.day < dayIdx ? 'done' : ''} ${d.day === dayIdx ? 'now' : ''} ${d.mode.startsWith('mock') ? 'mock' : ''}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * d.day }}
            title={`יום ${d.day}`}
          >
            <span className="mono">{d.date.slice(8)}.{d.date.slice(5, 7)}</span>
          </motion.div>
        ))}
      </div>

      {showBlocks && (
        <section className="blocks">
          <h2 className="h-lg">מה היום דורש</h2>
          <div className="block-bars">
            {[
              { k: 'repair', name: 'תיקון טעויות', min: plan.mode === 'review' ? 20 : DAILY_BLOCKS.repair, sub: queue.length ? `${queue.length} טעויות פתוחות` : 'אין טעויות פתוחות' },
              ...(plan.mode === 'review'
                ? []
                : [{ k: 'material', name: 'חומר', min: DAILY_BLOCKS.material, sub: plan.focus.map((f) => `${DOMAIN_NAME[f.domain]}, ${LAYER_NAME[f.layer]}`).join(' · ') }]),
              { k: 'apply', name: 'יישום בזמן', min: plan.mode === 'review' ? 25 : DAILY_BLOCKS.apply, sub: plan.apply ? DOMAIN_NAME[plan.apply] : 'בנושאים החלשים' },
            ].map((b, i) => (
              <motion.div
                key={b.k}
                className={`block block-${b.k}`}
                style={{ flexGrow: b.min }}
                initial={{ scaleY: 0.2, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.12, type: 'spring', stiffness: 140, damping: 16 }}
              >
                <span className="block-min mono">{b.min} דק'</span>
                <span className="block-name">{b.name}</span>
                <span className="block-sub">{b.sub}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2 className="h-lg">מגדלי השליטה</h2>
          <p className="muted">כל תחום נבנה בשלוש קומות. קומה נפתחת רק אחרי שהקומה שמתחתיה יציבה.</p>
        </div>
        <Towers scored={store.scored} notes={store.notes} />
      </section>

      {queue.length > 0 && plan.mode !== 'daily' && (
        <Link to="/repair" className="strip-link">
          <span>{queue.length} טעויות פתוחות בתור התיקון</span>
          <span className="mono">לתיקון</span>
        </Link>
      )}
    </div>
  )
}
