import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import type { Domain, ScoredItem, ErrorNote } from '../engine/types'
import { DOMAINS, DOMAIN_NAME, LAYER_NAME } from '../engine/types'
import { layerStatus } from '../engine/mastery'
import { hasOpenUnderstandingError } from '../engine/errors'

export const DOMAIN_COLOR: Record<Domain, string> = {
  verbal: 'var(--c-verbal)',
  quant: 'var(--c-quant)',
  figural: 'var(--c-figural)',
  instructions: 'var(--c-instr)',
}

/**
 * מגדלי השליטה: לכל תחום מגדל של שלוש קומות (ידע, הבנה, יישום).
 * קומה נבנית לפי ההתקדמות לסף. קומה נעולה מוצגת כשלד.
 */
export function Towers({ scored, notes, compact }: { scored: ScoredItem[]; notes: ErrorNote[]; compact?: boolean }) {
  return (
    <div className={`towers ${compact ? 'towers-compact' : ''}`}>
      {DOMAINS.map((d, di) => {
        const st = layerStatus(scored, d, hasOpenUnderstandingError(scored, notes, d))
        return (
          <Link key={d} to={`/practice?domain=${d}`} className="tower" style={{ ['--tc' as string]: DOMAIN_COLOR[d] }}>
            <div className="tower-3d">
              {[...st].reverse().map((s, k) => {
                const floor = 2 - k
                return (
                  <div key={s.layer} className={`floor ${s.unlocked ? '' : 'floor-locked'} ${s.passed ? 'floor-done' : ''}`}>
                    <motion.div
                      className="floor-fill"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: s.unlocked ? Math.max(0.04, s.progress) : 0 }}
                      transition={{ delay: 0.15 * di + 0.12 * floor, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                    />
                    <span className="floor-label">{LAYER_NAME[s.layer]}</span>
                    {!compact && <span className="floor-meta mono">{s.unlocked ? `${Math.round(s.progress * 100)}%` : 'נעול'}</span>}
                  </div>
                )
              })}
              <div className="tower-base" />
            </div>
            <div className="tower-name">{DOMAIN_NAME[d]}</div>
          </Link>
        )
      })}
    </div>
  )
}
