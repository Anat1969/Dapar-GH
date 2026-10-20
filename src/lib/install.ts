import { useEffect, useState } from 'react'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BIPEvent | null = null
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BIPEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

/** כפתור ההתקנה מוצג רק כש-Chrome שלח beforeinstallprompt. */
export function useInstall() {
  const [can, setCan] = useState(Boolean(deferred))
  useEffect(() => {
    const l = () => setCan(Boolean(deferred))
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [])
  return {
    canInstall: can,
    install: async () => {
      if (!deferred) return
      await deferred.prompt()
      await deferred.userChoice.catch(() => undefined)
      deferred = null
      setCan(false)
    },
  }
}
