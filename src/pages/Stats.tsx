import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { INTERNAL_SCORE_LABEL, TARGET_SCORE } from '../config/app'
import { domainEstimate } from '../engine/score'
import { errorGroups, repairQueue } from '../engine/errors'
import { DOMAIN_NAME, DOMAINS, ERROR_NAME, ERROR_REMEDY, ERROR_TYPES, type Domain } from '../engine/types'
import { useStore } from '../lib/store'
import { DOMAIN_COLOR, Towers } from '../components/Towers'
import { Empty } from '../components/States'

function Trend({ points }: { points: { x: string; y: number }[] }) {
  const W = 640
  const H = 220
  const P = 28
  const xs = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1)
  const ys = (v: number) => H - P - (v / 100) * (H - 2 * P)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join(' ')
  const area = `${d} L${xs(points.length - 1)},${H - P} L${xs(0)},${H - P} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img" aria-label="מגמת הציון המשוער לפי מבחנים מדומים">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={P} x2={W - P} y1={ys(v)} y2={ys(v)} className="grid-line" />
          <text x={W - P + 4} y={ys(v) + 4} className="axis-text">{v}</text>
        </g>
      ))}
      <line x1={P} x2={W - P} y1={ys(TARGET_SCORE)} y2={ys(TARGET_SCORE)} className="target-line" />
      <text x={P} y={ys(TARGET_SCORE) - 6} className="axis-text target-text">יעד {TARGET_SCORE}</text>
      <motion.path d={area} fill="url(#trendFill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} />
      <motion.path d={d} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
      {points.map((p, i) => (
        <motion.g key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.12 }} style={{ transformOrigin: `${xs(i)}px ${ys(p.y)}px` }}>
          <circle cx={xs(i)} cy={ys(p.y)} r={6} className="trend-dot" />
          <text x={xs(i)} y={ys(p.y) - 12} textAnchor="middle" className="axis-text">{p.y}</text>
          <text x={xs(i)} y={H - 8} textAnchor="middle" className="axis-text">{p.x}</text>
        </motion.g>
      ))}
    </svg>
  )
}

export default function Stats() {
  const store = useStore()
  const mocks = store.attempts.filter((a) => (a.kind === 'mock_partial' || a.kind === 'mock_full') && a.finished_at)
  const points = mocks
    .filter((a) => a.score_estimate != null)
    .map((a) => ({ x: new Date(a.started_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' }), y: Number(a.score_estimate) }))

  const byDomain: Partial<Record<Domain, number>> = {}
  for (const d of DOMAINS) {
    const last = [...mocks].reverse().find((a) => store.scored.some((i) => i.attempt_id === a.id && i.q.domain === d))
    if (!last) continue
    const v = domainEstimate(store.scored.filter((i) => i.attempt_id === last.id && i.q.domain === d))
    if (v !== null) byDomain[d] = v
  }

  const groups = errorGroups(store.scored, store.notes)
  const skills = [...new Set(groups.map((g) => g.skill))]
  const queue = repairQueue(store.scored, store.notes)
  const top = queue[0]

  return (
    <div className="page">
      <div className="section-head">
        <div className="mono label">לוח מדידה</div>
        <h1 className="h-hero">איפה עומדים</h1>
      </div>

      <section className="panel panel-accent next-panel">
        <div className="mono label">הצעד הבא</div>
        {top ? (
          <p className="next-step">
            לחזק את <strong>{top.skill}</strong> ({DOMAIN_NAME[top.domain]}). {ERROR_REMEDY[top.type]}
          </p>
        ) : (
          <p className="next-step">אין טעות פתוחה. להמשיך לפי תוכנית היום.</p>
        )}
        {top && <Link className="btn btn-primary btn-sm" to="/repair">לתיקון</Link>}
      </section>

      <section>
        <h2 className="h-lg">ציון משוער לפי תחום</h2>
        <p className="internal-label">{INTERNAL_SCORE_LABEL}</p>
        <div className="dom-cards">
          {DOMAINS.map((d, i) => (
            <motion.div key={d} className="dom-card" style={{ ['--tc' as string]: DOMAIN_COLOR[d] }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <span>{DOMAIN_NAME[d]}</span>
              <span className="dom-num">{byDomain[d] ?? 'אין'}</span>
              <span className="small muted">{byDomain[d] != null ? INTERNAL_SCORE_LABEL : 'עוד אין מבחן מדומה בתחום'}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h-lg">מגמה לפי מבחנים מדומים</h2>
        {points.length >= 2 ? <Trend points={points} /> : <Empty text="המגמה תופיע אחרי שני מבחנים מדומים." action={<Link className="btn" to="/mock">למבחן מדומה</Link>} />}
      </section>

      <section>
        <h2 className="h-lg">שליטה לפי שכבות</h2>
        <Towers scored={store.scored} notes={store.notes} compact />
      </section>

      <section>
        <h2 className="h-lg">טעויות לפי סוג ונושא</h2>
        {skills.length === 0 ? (
          <Empty text="עוד אין טעויות רשומות." />
        ) : (
          <div className="table-wrap">
            <table className="etable">
              <thead>
                <tr>
                  <th>נושא</th>
                  {ERROR_TYPES.map((t) => <th key={t}>{ERROR_NAME[t]}</th>)}
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s}>
                    <th>{s}</th>
                    {ERROR_TYPES.map((t) => {
                      const g = groups.find((x) => x.skill === s && x.type === t)
                      return (
                        <td key={t} className={g ? (g.resolved ? 'cell-resolved' : g.count >= 3 ? 'cell-hot' : 'cell-open') : ''}>
                          {g ? g.count : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small">כהה: פתוחה. מודגש: חזרה שלוש פעמים. מעומעם: טופלה.</p>
      </section>
    </div>
  )
}
