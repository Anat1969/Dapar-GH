import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const Ctx = createContext<(msg: string) => void>(() => undefined)
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  const show = useCallback((text: string) => {
    const id = Date.now()
    setMsg({ id, text })
    window.setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 2200)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-layer" aria-live="polite">
        <AnimatePresence>
          {msg && (
            <motion.div key={msg.id} className="toast" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
