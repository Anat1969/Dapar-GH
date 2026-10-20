import { CALM_MESSAGE } from '../engine/mood'
import { motion } from 'framer-motion'

/** הודעת הרגעה קצרה. לא נשמר שום דבר על מצב הרוח. */
export function CalmNotice({ onClose }: { onClose: () => void }) {
  return (
    <motion.div className="calm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} role="status">
      <strong>{CALM_MESSAGE.title}.</strong> {CALM_MESSAGE.body}
      <div className="calm-step">{CALM_MESSAGE.step}</div>
      <button className="btn btn-sm" onClick={onClose}>הבנתי</button>
    </motion.div>
  )
}
