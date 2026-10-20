import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './lib/auth'
import { StoreProvider, useStore } from './lib/store'
import { ToastProvider } from './lib/toast'
import { TopBar } from './components/TopBar'
import { DataGate, PendingBanner, Skeleton } from './components/States'
import Login from './pages/Login'
import Today from './pages/Today'

const Session = lazy(() => import('./pages/Session'))
const Repair = lazy(() => import('./pages/Repair'))
const Practice = lazy(() => import('./pages/Practice'))
const Mock = lazy(() => import('./pages/Mock'))
const MockReport = lazy(() => import('./pages/Mock').then((m) => ({ default: m.MockReport })))
const Stats = lazy(() => import('./pages/Stats'))
const Admin = lazy(() => import('./pages/Admin'))

function Routed() {
  const loc = useLocation()
  const store = useStore()
  return (
    <>
      <TopBar isAdmin={store.isAdmin} showNav />
      <PendingBanner />
      <main id="main">
        <DataGate>
          <Suspense fallback={<div className="page"><Skeleton lines={4} /></div>}>
            <AnimatePresence mode="wait">
              <motion.div key={loc.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                <Routes location={loc}>
                  <Route path="/" element={<Today />} />
                  <Route path="/session" element={<Session />} />
                  <Route path="/repair" element={<Repair />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/mock" element={<Mock />} />
                  <Route path="/mock/report/:id" element={<MockReport />} />
                  <Route path="/stats" element={<Stats />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </DataGate>
      </main>
    </>
  )
}

function Gate() {
  const { ready, session, localMode } = useAuth()
  if (!ready) {
    return (
      <>
        <TopBar isAdmin={false} showNav={false} />
        <div className="page"><Skeleton lines={4} /></div>
      </>
    )
  }
  if (!session && !localMode) {
    return (
      <>
        <TopBar isAdmin={false} showNav={false} />
        <Login />
      </>
    )
  }
  return (
    <StoreProvider session={session} mode={session ? 'remote' : 'local'}>
      <Routed />
    </StoreProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <div className="bg-scene" aria-hidden="true">
            <div className="bg-grid" />
            <div className="bg-glow bg-glow-1" />
            <div className="bg-glow bg-glow-2" />
          </div>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
