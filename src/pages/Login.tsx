import { motion } from 'framer-motion'
import { useState } from 'react'
import { APP_NAME, EXAM_DATE } from '../config/app'
import { useAuth } from '../lib/auth'
import { Logo } from '../components/Logo'

export default function Login() {
  const { google, signInGoogle, continueLocal } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    const e = await signInGoogle()
    setBusy(false)
    if (e) setMsg(e)
  }
  return (
    <div className="page login">
      <motion.div className="login-card" initial={{ opacity: 0, y: 30, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.7 }}>
        <motion.div initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }}>
          <Logo size={88} />
        </motion.div>
        <h1 className="h-hero">{APP_NAME}</h1>
        <p className="lead">בונים שליטה קומה אחר קומה: ידע, הבנה, יישום. המבחן ב-{EXAM_DATE.split('-').reverse().slice(0, 2).join('.')}.</p>
        <button className="btn btn-primary btn-lg" onClick={go} disabled={busy || google === false}>
          כניסה עם Google
        </button>
        {google === false && (
          <p className="notice">הכניסה עם Google עדיין לא הופעלה בפרויקט. אפשר להתחיל כבר עכשיו במכשיר הזה, וההתקדמות תעבור לחשבון אחרי הכניסה.</p>
        )}
        {msg && <p className="notice">{msg}</p>}
        <button className="btn btn-ghost" onClick={continueLocal}>
          המשך במכשיר הזה
        </button>
        <p className="muted small">במכשיר הזה: ההתקדמות נשמרת רק בדפדפן הזה.</p>
      </motion.div>
    </div>
  )
}
