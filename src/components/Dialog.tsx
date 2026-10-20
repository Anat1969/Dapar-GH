import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'

/** דיאלוג שנפתח מתחת לסרגל העליון, לא מעליו. */
export function Dialog({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open || !onClose) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="dialog-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`dialog ${wide ? 'dialog-wide' : ''}`}
            initial={{ y: -16, opacity: 0, rotateX: 8 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            exit={{ y: -10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-head">
              <h2>{title}</h2>
              {onClose && (
                <button className="btn btn-ghost btn-sm" onClick={onClose}>
                  סגירה
                </button>
              )}
            </div>
            <div className="dialog-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
