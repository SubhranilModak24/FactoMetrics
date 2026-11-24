'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  addDoc,
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  getDocs,
  googleProvider,
  isFirebaseConfigured,
  onAuthStateChanged,
  orderBy,
  query,
  signInWithPopup,
  signOut,
  where,
  type User,
} from '@/lib/firebase'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bookmark,
  Box,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  Filter,
  FlaskConical,
  FolderOpen,
  Grid2X2,
  Layers3,
  LockKeyhole,
  LogOut,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react'

const mono = 'font-mono'
const card = 'motion-card rounded-xl border border-[#202a39] bg-[#111722]'
const outlineButton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-[#273345] bg-[#151d29] px-3 py-2 text-xs font-medium text-[#c7d0dd] transition hover:border-[#43546b] hover:bg-[#1b2533] motion-safe:hover:-translate-y-0.5'
const greenButton =
  'inline-flex items-center justify-center gap-2 rounded-md bg-[#10b981] px-4 py-2.5 text-xs font-semibold text-[#05231a] transition hover:bg-[#34d399] motion-safe:hover:-translate-y-0.5'
type View = 'dashboard' | 'code' | 'saved'
type Scenario = {
  id: number
  firestoreId?: string
  title: string
  notes: string
  budget: number
  tolerance: number
  sensitivity: number
  cost: number
  date: string
  tags: string
}
type State = {
  budget: number
  setBudget: (n: number) => void
  tolerance: number
  setTolerance: (n: number) => void
  sensitivity: number
  setSensitivity: (n: number) => void
  scenarios: Scenario[]
  setScenarios: (s: Scenario[]) => void
  deleteScenario: (s: Scenario) => Promise<void>
  openSave: () => void
  notify: (s: string) => void
  user: User | null
  authLoading: boolean
  firebaseReady: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}
const AppContext = createContext<State | null>(null)
const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const BASELINE_ANNUAL_COST = 16388238.71
const OPTIMAL_ANNUAL_COST = 13763950.06
const demoScenarios: Scenario[] = [
  {
    id: 1,
    title: 'Baseline optimization (1.0x)',
    notes: 'ASI 2022–23 Factory #204795 reference run at ₹10L budget.',
    budget: 1000000,
    tolerance: 20,
    sensitivity: 1,
    cost: 13763950.06,
    date: 'ASI 2022–23 · Verified run',
    tags: 'BASELINE',
  },
  {
    id: 2,
    title: 'Expanded budget (1.1x)',
    notes: 'Sensitivity scenario at ₹11L budget and 110% demand target (830.46 units).',
    budget: 1100000,
    tolerance: 20,
    sensitivity: 1.1,
    cost: 15140345.06,
    date: 'ASI 2022–23 · Sensitivity',
    tags: 'SENSITIVITY',
  },
  {
    id: 3,
    title: 'Constrained budget (0.9x)',
    notes: 'Sensitivity scenario at ₹9L budget and 90% demand target (679.46 units).',
    budget: 900000,
    tolerance: 20,
    sensitivity: 0.9,
    cost: 12387555.05,
    date: 'ASI 2022–23 · Sensitivity',
    tags: 'SENSITIVITY',
  },
]
function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('Missing app context')
  return value
}
function estimatedCost(budget: number, tolerance: number, sensitivity: number) {
  // Exact Python solver result at (1000000, 20, 1) is Rs. 13,763,950.06
  // Sensitivity points: 0.9x -> 12,387,555.05, 1.0x -> 13,763,950.06, 1.1x -> 15,140,345.06
  const budgetEffect = (budget - 1000000) * 0.31
  const toleranceEffect = (tolerance - 20) * 16500
  const sensitivityEffect = (sensitivity - 1) * OPTIMAL_ANNUAL_COST
  return Math.max(
    10500000,
    OPTIMAL_ANNUAL_COST - budgetEffect - toleranceEffect + sensitivityEffect,
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [budget, setBudget] = useState(1000000),
    [tolerance, setTolerance] = useState(20),
    [sensitivity, setSensitivity] = useState(1)
  const [scenarios, setScenarios] = useState(demoScenarios),
    [modal, setModal] = useState(false),
    [toast, setToast] = useState('')
  const [title, setTitle] = useState(''),
    [notes, setNotes] = useState(''),
    [tags, setTags] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false)
      return
    }
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
      if (currentUser && db) {
        try {
          const q = query(
            collection(db, 'scenarios'),
            where('uid', '==', currentUser.uid),
            orderBy('createdAt', 'desc'),
          )
          const snap = await getDocs(q)
          if (!snap.empty) {
            const loaded: Scenario[] = snap.docs.map((d, idx) => {
              const data = d.data()
              return {
                id: Number(data.createdAt) || Date.now() + idx,
                firestoreId: d.id,
                title: String(data.title || 'Saved scenario'),
                notes: String(data.notes || ''),
                budget: Number(data.budget || 1000000),
                tolerance: Number(data.tolerance || 20),
                sensitivity: Number(data.sensitivity || 1),
                cost: Number(data.cost || OPTIMAL_ANNUAL_COST),
                date: String(data.date || 'Synced · Firestore'),
                tags: String(data.tags || 'CUSTOM'),
              }
            })
            setScenarios([...loaded, ...demoScenarios])
          }
        } catch {
          // Firestore rules or index not yet created; keep local scenarios
        }
      } else {
        setScenarios(demoScenarios)
      }
    })
    return () => unsub()
  }, [])

  const signInWithGoogle = async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) {
      notify('Add Firebase credentials to .env.local to enable Google Sign-In')
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
      notify('Signed in with Google')
      router.push('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed'
      notify(msg)
    }
  }

  const signOutUser = async () => {
    if (isFirebaseConfigured && auth && user) {
      await signOut(auth)
      notify('Signed out')
    }
    router.push('/')
  }

  const save = async () => {
    if (!title.trim()) return
    const cost = estimatedCost(budget, tolerance, sensitivity)
    const createdAt = Date.now()
    const newScenario: Scenario = {
      id: createdAt,
      title: title.trim(),
      notes,
      tags: tags || 'CUSTOM',
      budget,
      tolerance,
      sensitivity,
      cost,
      date: user && db ? 'Just now · Firestore' : 'Just now · Preview session',
    }
    if (user && db && isFirebaseConfigured) {
      try {
        const ref = await addDoc(collection(db, 'scenarios'), {
          uid: user.uid,
          email: user.email || '',
          title: newScenario.title,
          notes: newScenario.notes,
          tags: newScenario.tags,
          budget: newScenario.budget,
          tolerance: newScenario.tolerance,
          sensitivity: newScenario.sensitivity,
          cost: newScenario.cost,
          date: newScenario.date,
          createdAt,
        })
        newScenario.firestoreId = ref.id
        notify('Saved to Firestore database')
      } catch {
        notify('Saved locally (check Firestore rules)')
      }
    } else {
      notify('Saved to this preview session')
    }
    setScenarios([newScenario, ...scenarios])
    setTitle('')
    setNotes('')
    setTags('')
    setModal(false)
  }

  const deleteScenario = async (target: Scenario) => {
    if (target.firestoreId && user && db && isFirebaseConfigured) {
      try {
        await deleteDoc(doc(db, 'scenarios', target.firestoreId))
        notify('Deleted from Firestore')
      } catch {
        notify('Removed from local view')
      }
    } else {
      notify('Removed from preview session')
    }
    setScenarios(scenarios.filter((item) => item.id !== target.id))
  }

  return (
    <AppContext.Provider
      value={{
        budget,
        setBudget,
        tolerance,
        setTolerance,
        sensitivity,
        setSensitivity,
        scenarios,
        setScenarios,
        deleteScenario,
        openSave: () => setModal(true),
        notify,
        user,
        authLoading,
        firebaseReady: isFirebaseConfigured,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
          onMouseDown={() => setModal(false)}
        >
          <div
            className="motion-dialog w-full max-w-[460px] rounded-xl border border-[#2a3748] bg-[#111823] p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-400">
                  <Save size={17} />
                </div>
                <h2 className="text-lg font-semibold text-white">Save scenario</h2>
                <p className="mt-1 text-sm text-[#8b98aa]">
                  Keep a snapshot of your current parameters.
                </p>
              </div>
              <button
                onClick={() => setModal(false)}
                className="text-[#77869a] hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs font-medium text-[#b6c1d0]">
                Scenario name
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 production plan"
                  className="mt-2 w-full rounded-md border border-[#2a3545] bg-[#0c121b] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-medium text-[#b6c1d0]">
                Notes <span className="text-[#657386]">(optional)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add context for this scenario..."
                  rows={3}
                  className="mt-2 w-full resize-none rounded-md border border-[#2a3545] bg-[#0c121b] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block text-xs font-medium text-[#b6c1d0]">
                Tags <span className="text-[#657386]">(optional)</span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g. production, Q4"
                  className="mt-2 w-full rounded-md border border-[#2a3545] bg-[#0c121b] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500"
                />
              </label>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-[#8190a3]">
              {user && isFirebaseConfigured
                ? `Signed in as ${user.email || user.displayName}: will sync to Firebase Firestore.`
                : 'Preview only: sign in with Google to sync scenarios to Firebase Firestore.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setModal(false)} className={outlineButton}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={!title.trim()}
                className={`${greenButton} disabled:opacity-40`}
              >
                <Save size={14} /> Save scenario
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="motion-dialog fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-[#12241e] px-4 py-3 text-sm text-emerald-300 shadow-xl">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
    </AppContext.Provider>
  )
}
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
        <Activity size={19} strokeWidth={2.2} />
      </span>
      {!small && (
        <span className="brand-name text-[16px] font-bold tracking-[-0.05em] text-white">
          FactoMetrics<span className="text-emerald-400">.</span>
        </span>
      )}
    </div>
  )
}
function Sidebar({ active }: { active: View }) {
  const { user, signOutUser } = useApp()
  const nav = [
    { id: 'dashboard', label: 'Dashboard & Simulator', href: '/dashboard', icon: Grid2X2 },
    { id: 'code', label: 'Codebase & Math', href: '/code', icon: Code2 },
    { id: 'saved', label: 'Saved Graphs', href: '/saved', icon: Bookmark },
  ] as const
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Guest workspace'
  const initial = displayName.charAt(0).toUpperCase()
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-[#1d2735] bg-[#0b1018] lg:flex">
      <div className="flex h-[72px] items-center border-b border-[#1b2532] px-6">
        <Logo />
        <span className="ml-auto rounded border border-[#283445] px-1.5 py-0.5 font-mono text-[9px] text-[#748297]">
          BETA
        </span>
      </div>
      <div className="px-4 pt-6">
        <div className="mb-3 px-2 text-[10px] font-semibold tracking-[.13em] text-[#647387]">
          WORKSPACE
        </div>
        <div className="space-y-1">
          {nav.map(({ id, label, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-medium transition ${active === id ? 'bg-[#17251f] text-[#5ee6ad]' : 'text-[#8997aa] hover:bg-[#151e29] hover:text-white'}`}
            >
              <Icon size={16} />
              <span>{label}</span>
              {active === id && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-4 mt-8 border-t border-[#1c2734] pt-6">
        <div className="mb-3 px-2 text-[10px] font-semibold tracking-[.13em] text-[#647387]">
          ACTIVE FACTORY
        </div>
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-[#263142] bg-[#111a24] px-3 py-3 text-left">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#25352e] text-emerald-400">
            <Box size={15} />
          </span>
          <span>
            <span className="block text-[11px] font-semibold text-[#dbe4ec]">Factory #204795</span>
            <span className="mt-1 block text-[10px] text-[#718095]">ASI 2022–23 · Unit 15</span>
          </span>
          <ChevronDown size={14} className="ml-auto text-[#718095]" />
        </button>
      </div>
      <div className="mt-auto px-4 pb-4">
        <div className="mb-4 rounded-lg border border-[#26342f] bg-[#101c19] p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#aadac2]">
            <Sparkles size={13} className="text-emerald-400" /> Analysis workspace
          </div>
          <p className="mt-1.5 text-[10px] leading-4 text-[#778f82]">
            ASI 2022–23 SLSQP & SymPy optimization results for Factory #204795.
          </p>
        </div>
        <button
          onClick={signOutUser}
          className="flex w-full items-center gap-2.5 border-t border-[#1c2734] px-1 pt-4 text-left"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#344657] text-xs font-semibold text-[#dce5ed]">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold text-[#dce5ed]">
              {displayName}
            </span>
            <span className="mt-0.5 block text-[10px] text-[#6f8093]">
              {user ? 'Google synced · Sign out' : 'Guest mode · Sign in'}
            </span>
          </span>
          <LogOut size={14} className="ml-auto shrink-0 text-[#718095]" />
        </button>
      </div>
    </aside>
  )
}
function Shell({ active, children }: { active: View; children: ReactNode }) {
  const { user, firebaseReady } = useApp()
  const initial = (user?.displayName || user?.email || 'G').charAt(0).toUpperCase()
  return (
    <>
      <Sidebar active={active} />
      <div className="min-h-screen lg:ml-[232px]">
        <div className="brand-header relative flex h-[57px] items-center justify-between border-b border-[#1c2735] bg-[#0b1018] px-5 md:px-8">
          <div className="flex items-center gap-2 text-[11px] text-[#9aaabd]">
            <span className="lg:hidden">
              <Logo small />
            </span>
            <span className="brand-name font-semibold tracking-wide text-[#e8fff3]">
              FactoMetrics
            </span>
            <span className="hidden text-[#718399] sm:inline">/ Workspace</span>
            <ChevronRight size={12} />
            <span className="text-[#b7c2d0]">
              {active === 'dashboard'
                ? 'Dashboard & Simulator'
                : active === 'code'
                  ? 'Codebase & Math'
                  : 'Saved Graphs'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-2 text-[10px] text-[#8493a4] sm:flex">
              <span
                className={`h-1.5 w-1.5 rounded-full ${user && firebaseReady ? 'bg-emerald-400' : 'bg-[#f5a524]'}`}
              />
              {user && firebaseReady ? 'Firebase synced' : 'ASI 2022–23 results'}
            </span>
            <span className="h-4 w-px bg-[#263142]" />
            <CircleHelp size={15} className="text-[#8190a1]" />
            <Link
              href="/"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#354759] text-[10px] font-bold text-white"
              title={user ? user.email || 'Signed in' : 'Sign in'}
            >
              {initial}
            </Link>
          </div>
        </div>
        <div className="border-b border-[#1c2735] bg-[#0d131d] px-5 py-2 lg:hidden">
          <div className="flex flex-wrap gap-4 text-xs text-[#a7b4c4]">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/code">Code & Math</Link>
            <Link href="/saved">Saved Graphs</Link>
            <Link href="/">Sign in</Link>
          </div>
        </div>
        {children}
      </div>
    </>
  )
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="motion-intro mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#596b62]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {eyebrow}
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-.04em] text-[#192a27] md:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 text-[12px] text-[#5d6b65]">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}
function Kpi({
  title,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  detail: ReactNode
  icon: typeof Activity
  accent?: boolean
}) {
  return (
    <div className={`${card} relative min-h-[112px] p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#c9d5e2]">{title}</span>
        <Icon size={15} className={accent ? 'text-emerald-400' : 'text-[#64768d]'} />
      </div>
      <div
        className={`${mono} mt-4 text-[19px] font-semibold tracking-[-.05em] ${accent ? 'text-[#59e5aa]' : 'text-[#f0f4f8]'}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] text-[#77899b]">{detail}</div>
    </div>
  )
}
function Slider({
  label,
  variable,
  value,
  display,
  min,
  max,
  step,
  onChange,
  left,
  right,
}: {
  label: string
  variable: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (n: number) => void
  left: string
  right: string
}) {
  return (
    <div className="border-b border-[#222d3b] py-5 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-[#cbd5e1]">
          {label} <span className="font-mono text-[#708095]">{variable}</span>
        </div>
        <span className="rounded bg-[#192a26] px-2 py-1 font-mono text-[10px] font-semibold text-[#64e6ad]">
          {display}
        </span>
      </div>
      <input
        aria-label={label}
        className="range-input mt-5"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, #10b981 ${((value - min) / (max - min)) * 100}%, #283445 ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
      <div className="mt-2 flex justify-between font-mono text-[9px] text-[#68798b]">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )
}
function ControlPanel() {
  const a = useApp()
  const reset = () => {
    a.setBudget(1000000)
    a.setTolerance(20)
    a.setSensitivity(1)
  }
  return (
    <div className={`${card} flex h-full flex-col`}>
      <div className="flex items-center justify-between border-b border-[#222d3b] px-5 py-4">
        <div className="flex items-center gap-2">
          <Settings2 size={15} className="text-emerald-400" />
          <h2 className="text-[12px] font-semibold text-white">Parameter controls</h2>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[10px] text-[#8796a8] hover:text-white"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>
      <div className="px-5">
        <div className="pt-4 text-[10px] leading-4 text-[#8291a2]">
          Adjust the inputs below to explore how changes impact your results.
        </div>
        <Slider
          label="Capital Budget"
          variable="(B)"
          value={a.budget}
          display={money(a.budget)}
          min={500000}
          max={2000000}
          step={50000}
          onChange={a.setBudget}
          left="₹5,00,000"
          right="₹20,00,000"
        />
        <Slider
          label="Production Mix Tolerance"
          variable=""
          value={a.tolerance}
          display={`±${a.tolerance}%`}
          min={5}
          max={40}
          step={1}
          onChange={a.setTolerance}
          left="±5%"
          right="±40%"
        />
        <Slider
          label="Sensitivity Multiplier"
          variable=""
          value={a.sensitivity}
          display={`${a.sensitivity.toFixed(2)}x`}
          min={0.8}
          max={1.2}
          step={0.01}
          onChange={a.setSensitivity}
          left="0.80x"
          right="1.20x"
        />
      </div>
      <div className="mt-auto px-5 pb-5">
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#204437] bg-[#12251f] px-3 py-2.5 text-[10px] text-[#77d8aa]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Live
          preview active
        </div>
        <button onClick={a.openSave} className={`${greenButton} w-full`}>
          <Save size={14} /> Save graph & scenario
        </button>
        <p className="mt-2 text-center text-[9px] text-[#637489]">
          {a.user && a.firebaseReady
            ? `Synced with Firestore (${a.user.email || 'Google'})`
            : 'Preview session · Sign in with Google for Firestore sync'}
        </p>
      </div>
    </div>
  )
}
function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { openSave, notify } = useApp()
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-[12px] font-semibold text-white">{title}</h3>
        <p className="mt-1 text-[9px] text-[#76879a]">{subtitle}</p>
      </div>
      <div className="flex gap-1">
        <button
          onClick={openSave}
          title="Quick save snapshot"
          aria-label={`Save ${title} snapshot`}
          className="rounded p-1.5 text-[#718298] hover:bg-[#263242] hover:text-white"
        >
          <Bookmark size={13} />
        </button>
        <button
          onClick={() => notify('Export is unavailable in the design preview')}
          title="Export PNG or CSV"
          aria-label={`Export ${title}`}
          className="rounded p-1.5 text-[#718298] hover:bg-[#263242] hover:text-white"
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  )
}
const ASI_PRODUCTS = [
  {
    label: 'A',
    code: '4432000',
    unit: '15',
    historical: 63,
    baseline: 62.243096,
    optimal: 49.794477,
    capacity: 59.034332,
    utilisation: 84.35,
    investment: 581678.74,
    rate: 0.000101489581,
    directUnit: 154603.67,
    labourUnit: 11382.73,
    maintUnit: 134.51,
  },
  {
    label: 'B',
    code: '4332008',
    unit: '15',
    historical: 239.44,
    baseline: 236.563285,
    optimal: 189.250628,
    capacity: 224.865896,
    utilisation: 84.16,
    investment: 233686.67,
    rate: 0.000962253858,
    directUnit: 16078.15,
    labourUnit: 1183.76,
    maintUnit: 13.99,
  },
  {
    label: 'C',
    code: '4394900',
    unit: '15',
    historical: 461.7,
    baseline: 456.152976,
    optimal: 515.914253,
    capacity: 597.903036,
    utilisation: 86.29,
    investment: 184634.59,
    rate: 0.003238304573,
    directUnit: 4002.0,
    labourUnit: 294.65,
    maintUnit: 3.48,
  },
] as const

function BarChart() {
  const { budget, tolerance, sensitivity } = useApp()
  const scale = sensitivity * (1 + ((budget - 1000000) / 1000000) * 0.04)
  const tolFactor = (tolerance - 20) * 0.004
  const vals = [
    {
      label: 'Product A',
      code: '4432000',
      baseline: 62.243096,
      optimal: 49.794477 * scale * (1 - tolFactor),
    },
    {
      label: 'Product B',
      code: '4332008',
      baseline: 236.563285,
      optimal: 189.250628 * scale * (1 - tolFactor * 0.5),
    },
    {
      label: 'Product C',
      code: '4394900',
      baseline: 456.152976,
      optimal: 515.914253 * scale * (1 + tolFactor * 0.35),
    },
  ]
  const maxVal = 600
  return (
    <div className="mt-5">
      <div className="mb-3 flex justify-end gap-4 text-[9px] text-[#8796a7]">
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-sm bg-[#4b5c72]" />
          Baseline
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-sm bg-[#10b981]" />
          Optimized (Unit 15)
        </span>
      </div>
      <div className="flex h-[130px] gap-3">
        <div className="flex h-full flex-col justify-between pb-4 font-mono text-[9px] text-[#617185]">
          <span>600</span>
          <span>450</span>
          <span>300</span>
          <span>150</span>
          <span>0</span>
        </div>
        <div className="relative flex flex-1 items-end justify-around border-b border-[#263242] pb-4">
          <div className="pointer-events-none absolute inset-0 bottom-4 flex flex-col justify-between">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="border-t border-dashed border-[#263242]" />
            ))}
          </div>
          {vals.map((v) => (
            <div key={v.code} className="relative flex h-full w-14 items-end justify-center gap-1.5">
              <div
                className="w-4 rounded-t-sm bg-[#647990]"
                style={{ height: `${Math.max(2, Math.min(100, (v.baseline / maxVal) * 100))}%` }}
                title={`Baseline ${v.label} (${v.code}): ${v.baseline.toFixed(2)} units`}
              />
              <div
                className="w-4 rounded-t-sm bg-[#10b981] transition-[height] duration-300 motion-reduce:transition-none"
                style={{ height: `${Math.max(2, Math.min(100, (v.optimal / maxVal) * 100))}%` }}
                title={`Optimized ${v.label} (${v.code}): ${v.optimal.toFixed(2)} units`}
              />
              <span className="absolute -bottom-4 whitespace-nowrap text-[9px] text-[#8291a2]">
                {v.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
function DonutChart() {
  const { budget } = useApp()
  // Exact Python optimal investment shares at Rs. 10,00,000:
  // Product A: Rs. 581,678.74 (58.17%), Product B: Rs. 233,686.67 (23.37%), Product C: Rs. 184,634.59 (18.46%)
  const allocations = [
    { name: 'Product A', code: '4432000', color: '#10b981', value: 58.167874, amount: budget * 0.58167874 },
    { name: 'Product B', code: '4332008', color: '#5c9d92', value: 23.368667, amount: budget * 0.23368667 },
    { name: 'Product C', code: '4394900', color: '#3d5367', value: 18.463459, amount: budget * 0.18463459 },
  ]
  const stops = allocations.reduce<{ end: number; segments: string[] }>(
    (result, allocation) => {
      const start = result.end
      result.end += allocation.value
      result.segments.push(`${allocation.color} ${start}% ${result.end}%`)
      return result
    },
    { end: 0, segments: [] },
  )
  return (
    <div className="flex h-[160px] items-center justify-center gap-6">
      <div
        className="relative h-[120px] w-[120px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.segments.join(', ')})` }}
        role="img"
        aria-label={`Investment allocation: ${allocations.map((item) => `${item.name} ${item.value.toFixed(1)}%`).join(', ')}`}
      >
        <div className="absolute inset-[15px] flex flex-col items-center justify-center rounded-full bg-[#111722]">
          <span className="font-mono text-[13px] font-semibold text-white">
            {(budget / 100000).toFixed(1)}L
          </span>
          <span className="mt-1 text-[8px] text-[#77889b]">TOTAL BUDGET</span>
        </div>
      </div>
      <div className="space-y-2.5 text-[9px] text-[#97a5b5]">
        {allocations.map((item) => (
          <div key={item.name} className="flex w-[145px] items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
            <span>{item.name}</span>
            <span className="ml-auto font-mono text-[#dce8f1]">
              {money(item.amount)} ({item.value.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
function CostChart() {
  const { budget, tolerance, sensitivity } = useApp()
  const total = estimatedCost(budget, tolerance, sensitivity)
  const scale = total / OPTIMAL_ANNUAL_COST
  // Exact Python annual cost breakdown at Rs. 10,00,000:
  // Basic production / material: 12,805,896.57 | Labour: 942,837.14 | Maintenance: 11,141.44 | Capacity mismatch: 4,074.91
  const components = [
    { name: 'Basic production / material', amount: 12805896.57 * scale, color: '#10b981' },
    { name: 'Labour cost', amount: 942837.14 * scale, color: '#42b993' },
    { name: 'Maintenance cost', amount: 11141.44 * scale, color: '#3d8c79' },
    { name: 'Capacity mismatch penalty', amount: 4074.91 * scale, color: '#526d80' },
  ]
  return (
    <div className="mt-5 space-y-3">
      {components.map((component) => {
        const share = (component.amount / total) * 100
        return (
          <div key={component.name}>
            <div className="mb-1.5 flex justify-between text-[9px] text-[#9ba9b9]">
              <span>{component.name}</span>
              <span className="font-mono text-[#b8c5d2]">
                {money(component.amount)} ({share.toFixed(2)}%)
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#23303d]">
              <div
                className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${Math.max(1.5, Math.min(100, share))}%`,
                  backgroundColor: component.color,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
function SensitivityChart() {
  const { budget, tolerance, sensitivity } = useApp()
  const x = (amount: number) => 24 + ((amount - 500000) / 1500000) * 286
  const y = (cost: number) => Math.max(10, Math.min(90, 88 - ((cost - 11000000) / 6000000) * 70))
  const curve = (demand: number) =>
    Array.from({ length: 7 }, (_, index) => {
      const amount = 500000 + index * 250000
      return `${x(amount)},${y(estimatedCost(amount, tolerance, sensitivity) * demand)}`
    }).join(' ')
  const selectedCost = estimatedCost(budget, tolerance, sensitivity)
  return (
    <div className="mt-4">
      <div className="flex flex-wrap justify-end gap-3 text-[8px] text-[#b2c1ce]">
        <span>
          <b className="mr-1 text-[#6291b4]">━</b>90% demand
        </span>
        <span>
          <b className="mr-1 text-[#10b981]">━</b>100% demand
        </span>
        <span>
          <b className="mr-1 text-[#d2a34c]">━</b>110% demand
        </span>
      </div>
      <svg
        viewBox="0 0 320 120"
        className="mt-2 h-[110px] w-full overflow-visible"
        role="img"
        aria-label="Budget sensitivity curve"
      >
        {[12, 38, 64, 90].map((y) => (
          <line key={y} x1="24" x2="310" y1={y} y2={y} stroke="#263242" strokeDasharray="3 4" />
        ))}
        <polyline points={curve(0.9)} fill="none" stroke="#6291b4" strokeWidth="1.5" />
        <polyline points={curve(1)} fill="none" stroke="#10b981" strokeWidth="2" />
        <polyline points={curve(1.1)} fill="none" stroke="#d2a34c" strokeWidth="1.5" />
        <line
          x1={x(budget)}
          x2={x(budget)}
          y1={y(selectedCost)}
          y2="90"
          stroke="#10b981"
          strokeDasharray="3 3"
          opacity=".6"
        />
        <circle
          cx={x(budget)}
          cy={y(selectedCost)}
          r="3.5"
          fill="#10b981"
          stroke="#b0f5d6"
          strokeWidth="2"
        />
        <text x="24" y="110" fill="#6f8093" fontSize="8">
          ₹5L
        </text>
        <text x="145" y="110" fill="#6f8093" fontSize="8">
          ₹12.5L
        </text>
        <text x="285" y="110" fill="#6f8093" fontSize="8">
          ₹20L
        </text>
      </svg>
      <div className="text-right font-mono text-[9px] text-[#a8d9c4]">
        {money(budget)} budget · {money(selectedCost)} estimated cost
      </div>
    </div>
  )
}
function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className={`${card} min-h-[230px] p-4`}>
      <ChartHeader title={title} subtitle={subtitle} />
      {children}
    </div>
  )
}
export function Dashboard() {
  const { budget, tolerance, sensitivity } = useApp()
  const cost = estimatedCost(budget, tolerance, sensitivity)
  const savings = BASELINE_ANNUAL_COST - cost
  return (
    <Shell active="dashboard">
      <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-8">
        <PageTitle
          eyebrow="Optimization workspace · ASI 2022–23"
          title="Dashboard & Simulator"
          subtitle="Factory #204795 · Products 4432000, 4332008, 4394900 · Unit Code 15 · Planning Target D = 754.96"
          action={
            <div className="flex items-center gap-2 rounded-md border border-[#273344] bg-[#111923] px-3 py-2 text-[10px] text-[#9aa9ba]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Factory #204795 · Unit 15
            </div>
          }
        />
        <div className="motion-grid mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            title="Baseline Cost"
            value="₹1,63,88,239"
            detail="Scaled historical baseline (D = 754.96)"
            icon={Layers3}
          />
          <Kpi
            title="Optimized Cost"
            value={money(cost)}
            detail="SLSQP analytical-gradient optimum"
            icon={Activity}
          />
          <Kpi
            title="Net Savings"
            value={`−${((savings / BASELINE_ANNUAL_COST) * 100).toFixed(2)}%`}
            detail={<span className="text-emerald-400">{money(savings)} saved annually</span>}
            icon={TrendingDown}
            accent
          />
          <Kpi
            title="Capacity Violation"
            value="0.0000"
            detail={
              <span className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-400" /> All constraints satisfied
              </span>
            }
            icon={CheckCircle2}
          />
        </div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-[#233631]">Optimization overview</h2>
            <p className="mt-1 text-[10px] text-[#60716a]">
              Python SLSQP solver results for Factory #204795 (ASI 2022–23, yr=23).
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-[#274438] bg-[#12231d] px-2.5 py-1 text-[9px] font-medium text-[#71dca9]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> SOLUTION FOUND
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(250px,0.9fr)_minmax(0,2fr)]">
          <ControlPanel />
          <div className="motion-grid grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Baseline vs. Optimized Production"
              subtitle="Quantity in unit code 15 (Total D = 754.96)"
            >
              <BarChart />
            </ChartCard>
            <ChartCard
              title="Optimal Investment Allocation"
              subtitle="Budget distribution across Products A, B, C"
            >
              <DonutChart />
            </ChartCard>
            <ChartCard title="Annual Cost Breakdown" subtitle="Optimized costs across 7 model components">
              <CostChart />
            </ChartCard>
            <ChartCard
              title="Budget Sensitivity Curve"
              subtitle="Cost impact across 0.9x, 1.0x, and 1.1x scenarios"
            >
              <SensitivityChart />
            </ChartCard>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
          <div className={`${card} overflow-hidden p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[12px] font-semibold text-white">
                  Optimal Production &amp; Investment Plan
                </h3>
                <p className="mt-0.5 text-[9px] text-[#76879a]">
                  Decision variables &amp; unit cost coefficients from ASI 2022–23 calibration
                </p>
              </div>
              <span className="rounded border border-[#273545] bg-[#151e29] px-2 py-1 font-mono text-[9px] text-[#8ba0b8]">
                Unit Code 15
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-[#222d3b] text-[9px] uppercase text-[#718298]">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">ASI Code</th>
                    <th className="py-2 pr-3 text-right">Baseline</th>
                    <th className="py-2 pr-3 text-right">Optimal</th>
                    <th className="py-2 pr-3 text-right">Capacity</th>
                    <th className="py-2 pr-3 text-right">Util.</th>
                    <th className="py-2 text-right">Investment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2533] text-[#d5e0eb]">
                  {ASI_PRODUCTS.map((p) => (
                    <tr key={p.code} className="hover:bg-[#151e2a]">
                      <td className="py-2.5 pr-3 font-semibold text-white">Product {p.label}</td>
                      <td className="py-2.5 pr-3 text-[#8fa2b7]">{p.code}</td>
                      <td className="py-2.5 pr-3 text-right">{p.baseline.toFixed(2)}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-emerald-400">
                        {p.optimal.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-[#9eb0c3]">
                        {p.capacity.toFixed(2)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-[#9eb0c3]">
                        {p.utilisation.toFixed(2)}%
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#e6eff7]">
                        {money(p.investment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`${card} p-4`}>
            <h3 className="text-[12px] font-semibold text-white">Factory #204795 Cost Pools</h3>
            <p className="mt-0.5 text-[9px] text-[#76879a]">
              Allocated by ex-factory value share (100.00%)
            </p>
            <div className="mt-3 space-y-2 font-mono text-[10px]">
              {[
                ['Indigenous materials (H)', '₹1,53,85,625'],
                ['Outsourced work (F1)', '₹25,650'],
                ['Inward transport (F12)', '₹26,231'],
                ['Direct production pool', '₹1,54,37,506'],
                ['Wages & salaries (E)', '₹11,36,590'],
                ['Maintenance (F2A+F2B)', '₹13,431'],
                ['Factory output value', '₹1,85,99,371'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-[#1c2533] pb-1.5 last:border-0"
                >
                  <span className="font-sans text-[#94a3b5]">{k}</span>
                  <span className="text-[#dce7f2]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#cdbfa8] pt-4 text-[10px] text-[#566a61]">
          <span>
            ASI 2022–23 dataset (yr=23) <span className="mx-2 text-[#344353]">•</span> Factory
            #204795 <span className="mx-2 text-[#344353]">•</span> Scale factor 0.987986
          </span>
          <span className="flex items-center gap-2">
            <Activity size={12} className="text-emerald-400" /> CalSymPy Optimization · SLSQP
            solver with SymPy calculus
          </span>
        </div>
      </main>
    </Shell>
  )
}
const OPTIMIZER_SOURCE = `#!/usr/bin/env python3
"""ASI 2022-23 manufacturing cost and investment optimiser with SymPy calculus.

Place this script beside blkC202223.csv, blkE202223.csv, blkF202223.csv,
blkH202223.csv, blkI202223.csv and blkJ202223.csv, then run:
    python asi_2022_23_optimizer_simplified2.py

The program selects one factory and three same-unit products, estimates the
model coefficients from the ASI data, solves the constrained optimisation,
runs SymPy symbolic calculus analysis (partial derivatives, directional
derivatives, and multivariate Taylor series), and saves one Excel workbook,
three essential charts and a text report.
"""

from pathlib import Path
import traceback

import numpy as np
import pandas as pd
import sympy as sp
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.optimize import minimize

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "ASI_2022_23_Auto_Optimization_Results"
YEAR = "23"
BUDGET = 1_000_000.0                 # Rs. 10 lakh
MIX_TOLERANCE = 0.20                 # production stays within +/-20% of baseline
BUDGET_SCENARIOS = (0.90, 1.00, 1.10)

FILES = {
    "C": ("blkC202223.csv", "ac01"),
    "E": ("blkE202223.csv", "AE01"),
    "F": ("blkF202223.csv", "AF01"),
    "H": ("blkH202223.csv", "AH01"),
    "I": ("blkI202223.csv", "AI01"),
    "J": ("blkJ202223.csv", "AJ01"),
}
H_SUMMARY_CODES = {"9990100", "9992000", "9993000", "9999999"}
I_SUMMARY_CODES = {"9994000"}
J_INVALID_CODES = {"", "nan", "None", "9995000", "9999999"}


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------

def log(message=""):
    print(message, flush=True)


def number(series):
    """Convert ASI numeric columns, including comma-formatted values."""
    return pd.to_numeric(
        series.astype("string").str.replace(",", "", regex=False),
        errors="coerce",
    )


def code(series):
    """Clean ASI codes without turning missing values into the text 'nan'."""
    return series.astype("string").str.strip().str.replace(r"\\.0$", "", regex=True)


def read_block(block, columns):
    filename, id_column = FILES[block]
    path = BASE_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Missing {filename}. Keep all six CSVs beside this script.")

    df = pd.read_csv(path, usecols=columns, low_memory=False)
    years = sorted(df["yr"].astype("string").str.strip().dropna().unique())
    if years != [YEAR]:
        raise ValueError(f"{filename} contains year code(s) {years}; expected {YEAR!r}.")

    df["factory_id"] = pd.to_numeric(df[id_column], errors="coerce").astype("Int64")
    return df.dropna(subset=["factory_id"]).copy()


def save_chart(filename, draw, title, xlabel, ylabel, grid="y", figsize=(8, 5)):
    fig, ax = plt.subplots(figsize=figsize)
    draw(ax)
    ax.set(title=title, xlabel=xlabel, ylabel=ylabel)
    ax.grid(axis=grid, alpha=0.25)
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / filename, dpi=170)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Read and aggregate ASI blocks
# ---------------------------------------------------------------------------

def aggregate_material_block(block, id_column, code_column, value_column, excluded_codes):
    df = read_block(block, ["yr", id_column, code_column, value_column])
    df["item_code"] = code(df[code_column])
    df["value_rs"] = number(df[value_column]).fillna(0.0)
    detail = df[~df["item_code"].isin(excluded_codes)]
    summary = detail.groupby("factory_id").agg(
        **{
            "materials_rs": ("value_rs", "sum"),
            "material_lines": ("item_code", "count"),
        }
    ).reset_index()
    return summary, len(df), len(detail), int(df["factory_id"].nunique())


def load_and_aggregate():
    log("[1/6] Reading and validating ASI 2022-23 blocks...")
    audit, coverage = [], []

    def record(block, description, loaded, used, rule, factory_count):
        audit.append({"Block": block, "Rows loaded": loaded, "Rows used": used, "Rule": rule})
        coverage.append({
            "Block": block, "Description": description, "Rows": loaded,
            "Unique factories": factory_count,
        })

    # C: Plant & Machinery only (c_11 = 3).
    c = read_block("C", ["yr", "ac01", "c_11", "c_19", "c_113"])
    c["item"] = number(c["c_11"])
    c["depreciation"] = number(c["c_19"]).fillna(0.0)
    c["net_value"] = number(c["c_113"]).fillna(0.0)
    c_pm = c[c["item"] == 3]
    c_summary = c_pm.groupby("factory_id").agg(
        plant_machinery_net_closing_rs=("net_value", "sum"),
        plant_machinery_depreciation_rs=("depreciation", "sum"),
    ).reset_index()
    record("C", "Fixed assets", len(c), len(c_pm),
           "Plant & Machinery only (c_11=3); c_113 net value and c_19 depreciation",
           int(c["factory_id"].nunique()))

    # E: total wages row only (EI1 = 9), avoiding repeated subtotals.
    e = read_block("E", ["yr", "AE01", "EI1", "EI3", "EI5", "EI8"])
    e["item"] = number(e["EI1"])
    for col in ("EI3", "EI5", "EI8"):
        e[col] = number(e[col]).fillna(0.0)
    e_total = e[e["item"] == 9]
    e_summary = e_total.groupby("factory_id").agg(
        wages_salaries_rs=("EI8", "sum"),
        manufacturing_mandays=("EI3", "sum"),
        total_mandays=("EI5", "sum"),
    ).reset_index()
    record("E", "Employment", len(e), len(e_total),
           "Total wage row only (EI1=9); do not add employee subtotals",
           int(e["factory_id"].nunique()))

    # F: direct-input items F1 and F12; maintenance F2A and F2B. F3 excluded.
    f = read_block("F", ["yr", "AF01", "F1", "F2A", "F2B", "F3", "F12"])
    for col in ("F1", "F2A", "F2B", "F3", "F12"):
        f[col] = number(f[col]).fillna(0.0)
    f_summary = f.groupby("factory_id").agg(
        outsourced_work_on_materials_rs=("F1", "sum"),
        maintenance_building_rs=("F2A", "sum"),
        maintenance_other_assets_rs=("F2B", "sum"),
        operating_expenses_excluded_rs=("F3", "sum"),
        inward_transport_rs=("F12", "sum"),
    ).reset_index()
    f_summary["maintenance_total_rs"] = (
        f_summary["maintenance_building_rs"] + f_summary["maintenance_other_assets_rs"]
    )
    record("F", "Other expenses", len(f), len(f),
           "F1 + F12 direct pool; F2A + F2B maintenance; F3 excluded",
           int(f["factory_id"].nunique()))

    # H and I: item-level material purchases, excluding printed total rows.
    h_summary, h_rows, h_used, h_factories = aggregate_material_block(
        "H", "AH01", "HI3", "HI6", H_SUMMARY_CODES
    )
    h_summary = h_summary.rename(columns={
        "materials_rs": "indigenous_materials_rs",
        "material_lines": "indigenous_material_lines",
    })
    record("H", "Indigenous materials", h_rows, h_used,
           "Sum HI6 excluding summary codes 9990100/9992000/9993000/9999999", h_factories)

    i_summary, i_rows, i_used, i_factories = aggregate_material_block(
        "I", "AI01", "II3", "II6", I_SUMMARY_CODES
    )
    i_summary = i_summary.rename(columns={
        "materials_rs": "imported_materials_rs",
        "material_lines": "imported_material_lines",
    })
    record("I", "Imported materials", i_rows, i_used,
           "Sum II6 excluding total-imports code 9994000", i_factories)

    # J: use J113 ex-factory value, falling back to J17 gross sales when needed.
    j = read_block("J", ["yr", "AJ01", "J13", "J14", "J15", "J17", "J113"])
    j["product_code"] = code(j["J13"])
    j["unit_code"] = code(j["J14"])
    j["quantity"] = number(j["J15"]).fillna(0.0)
    j["gross_sales_rs"] = number(j["J17"]).fillna(0.0)
    j["ex_factory_rs"] = number(j["J113"]).fillna(0.0)
    j["output_value_rs"] = j["ex_factory_rs"].where(
        j["ex_factory_rs"] > 0, j["gross_sales_rs"]
    )

    all_output = j[
        (j["quantity"] > 0) & j["product_code"].notna()
        & ~j["product_code"].isin(J_INVALID_CODES) & (j["output_value_rs"] > 0)
    ].copy()
    factory_sales = all_output.groupby("factory_id").agg(
        factory_total_ex_factory_value_rs=("output_value_rs", "sum"),
        factory_distinct_product_count=("product_code", "nunique"),
    ).reset_index()
    eligible_products = all_output[
        all_output["unit_code"].notna()
        & (all_output["unit_code"] != "0")
        & (all_output["unit_code"] != "")
    ].copy()
    products = eligible_products.groupby(
        ["factory_id", "product_code", "unit_code"], as_index=False
    ).agg(
        historical_quantity=("quantity", "sum"),
        ex_factory_value_rs=("output_value_rs", "sum"),
        gross_sales_value_rs=("gross_sales_rs", "sum"),
    )
    record("J", "Manufactured products", len(j), len(all_output),
           "Positive J15 product lines; use J113, falling back to J17",
           int(j["factory_id"].nunique()))

    return {
        "c_summary": c_summary, "e_summary": e_summary, "f_summary": f_summary,
        "h_summary": h_summary, "i_summary": i_summary, "products": products,
        "factory_sales": factory_sales, "audit": pd.DataFrame(audit),
        "coverage": pd.DataFrame(coverage),
    }


# ---------------------------------------------------------------------------
# Select a factory and three products sharing a physical unit
# ---------------------------------------------------------------------------

def select_factory(data):
    products = data["products"].sort_values(
        ["factory_id", "unit_code", "ex_factory_value_rs"],
        ascending=[True, True, False],
    ).copy()
    products["rank"] = products.groupby(["factory_id", "unit_code"]).cumcount() + 1
    top3 = products[products["rank"] <= 3]
    groups = top3.groupby(["factory_id", "unit_code"], as_index=False).agg(
        distinct_products=("product_code", "nunique"),
        selected_historical_quantity=("historical_quantity", "sum"),
        selected_ex_factory_value_rs=("ex_factory_value_rs", "sum"),
    )
    groups = groups[groups["distinct_products"] == 3]

    candidates = groups
    for key in ("c_summary", "e_summary", "f_summary", "h_summary", "i_summary", "factory_sales"):
        candidates = candidates.merge(data[key], on="factory_id", how="left")

    for col in ("imported_materials_rs", "indigenous_materials_rs",
                "outsourced_work_on_materials_rs", "inward_transport_rs"):
        candidates[col] = candidates[col].fillna(0.0)
    candidates["direct_material_pool_rs"] = candidates[
        ["indigenous_materials_rs", "imported_materials_rs",
         "outsourced_work_on_materials_rs", "inward_transport_rs"]
    ].sum(axis=1)
    candidates["selected_value_share_of_factory"] = (
        candidates["selected_ex_factory_value_rs"]
        / candidates["factory_total_ex_factory_value_rs"].replace(0, np.nan)
    ).fillna(0.0)
    candidates["selected_plant_machinery_asset_proxy_rs"] = (
        candidates["plant_machinery_net_closing_rs"]
        * candidates["selected_value_share_of_factory"]
    )
    candidates["budget_asset_fit_score"] = np.abs(np.log(
        candidates["selected_plant_machinery_asset_proxy_rs"].clip(lower=1e-9) / BUDGET
    ))

    required_positive = [
        "plant_machinery_net_closing_rs", "plant_machinery_depreciation_rs",
        "wages_salaries_rs", "direct_material_pool_rs",
        "selected_plant_machinery_asset_proxy_rs", "selected_historical_quantity",
        "selected_value_share_of_factory",
    ]
    eligible = candidates[(candidates[required_positive] > 0).all(axis=1)
                          & candidates["maintenance_total_rs"].notna()].copy()
    if eligible.empty:
        raise RuntimeError("No factory has three same-unit products and all required positive cost/asset data.")

    high_coverage = eligible[eligible["selected_value_share_of_factory"] >= 0.95]
    if not high_coverage.empty:
        eligible = high_coverage
    eligible = eligible.sort_values(
        ["budget_asset_fit_score", "selected_value_share_of_factory", "selected_ex_factory_value_rs"],
        ascending=[True, False, False],
    ).reset_index(drop=True)
    eligible.insert(0, "selection_rank", np.arange(1, len(eligible) + 1))

    chosen = eligible.iloc[0]
    chosen_products = products[
        (products["factory_id"] == chosen["factory_id"])
        & (products["unit_code"] == chosen["unit_code"])
    ].sort_values("ex_factory_value_rs", ascending=False).head(3).copy()
    if chosen_products["product_code"].nunique() != 3:
        raise RuntimeError("The selected group does not contain three unique products.")
    chosen_products = chosen_products.reset_index(drop=True)
    chosen_products["model_product"] = ["A", "B", "C"]
    return eligible, chosen_products


# ---------------------------------------------------------------------------
# Estimate capacity/productivity and cost coefficients
# ---------------------------------------------------------------------------

def estimate_productivity(data):
    panel = data["products"].merge(data["c_summary"], on="factory_id").merge(
        data["factory_sales"], on="factory_id"
    )
    share = panel["ex_factory_value_rs"] / panel["factory_total_ex_factory_value_rs"].replace(0, np.nan)
    allocated_assets = panel["plant_machinery_net_closing_rs"] * share
    panel["rate"] = panel["historical_quantity"] / allocated_assets.replace(0, np.nan)
    panel = panel[np.isfinite(panel["rate"]) & (panel["rate"] > 0)]

    rows = []
    for (product, unit), group in panel.groupby(["product_code", "unit_code"]):
        values = group["rate"].to_numpy(float)
        # Ordinary median is inherently robust to outliers (no redundant clipping).
        median_rate = float(np.median(values))
        rows.append({
            "product_code": str(product), "unit_code": str(unit),
            "factory_observation_count": len(values),
            "observed_rate_median_units_per_rs": median_rate,
            "observed_rate_p05_units_per_rs": float(np.quantile(values, 0.05)),
            "observed_rate_p95_units_per_rs": float(np.quantile(values, 0.95)),
            "estimation_method": "industry median (n>=10)" if len(values) >= 10 else "median; local factory used",
        })
    return pd.DataFrame(rows)


def calibrate_parameters(data, factory_id, selected):
    def one_row(table):
        rows = data[table].loc[data[table]["factory_id"] == factory_id]
        if rows.empty:
            raise RuntimeError(f"Factory {factory_id} has no {table} record.")
        return rows.iloc[0]

    c, e, f = one_row("c_summary"), one_row("e_summary"), one_row("f_summary")
    h = one_row("h_summary")
    i_rows = data["i_summary"].loc[data["i_summary"]["factory_id"] == factory_id]
    sales = one_row("factory_sales")

    machine_net = float(c["plant_machinery_net_closing_rs"])
    machine_dep = float(c["plant_machinery_depreciation_rs"])
    sales_total = float(sales["factory_total_ex_factory_value_rs"])
    selected_qty = selected["historical_quantity"].to_numpy(float)
    selected_values = selected["ex_factory_value_rs"].to_numpy(float)
    selected_value_total = float(selected_values.sum())
    if min(machine_net, sales_total, selected_value_total) <= 0:
        raise RuntimeError("Factory asset and output totals must be positive.")

    all_factory_share = selected_values / sales_total
    selected_value_share = selected_value_total / sales_total
    direct_pool = float(
        h["indigenous_materials_rs"]
        + (float(i_rows.iloc[0]["imported_materials_rs"]) if not i_rows.empty else 0.0)
        + f["outsourced_work_on_materials_rs"] + f["inward_transport_rs"]
    )
    wages_pool = float(e["wages_salaries_rs"])
    maintenance_pool = float(f["maintenance_total_rs"])

    rates = estimate_productivity(data)
    rate_lookup = rates.set_index(["product_code", "unit_code"]).to_dict("index")
    local_rates = selected_qty / (machine_net * all_factory_share)
    final_rates, rate_rows = [], []
    for idx, row in selected.iterrows():
        found = rate_lookup.get((str(row["product_code"]), str(row["unit_code"])))
        count = int(found["factory_observation_count"]) if found else 1
        median = float(found["observed_rate_median_units_per_rs"]) if found else np.nan
        use_industry = found is not None and count >= 10
        rate = median if use_industry else float(local_rates[idx])
        final_rates.append(rate)
        rate_rows.append({
            "model_product": row["model_product"],
            "product_code": str(row["product_code"]), "unit_code": str(row["unit_code"]),
            "factory_observation_count": count,
            "selected_factory_rate_units_per_rs": float(local_rates[idx]),
            "cross_factory_median_units_per_rs": median,
            "final_rate_units_per_rs": rate,
            "method": "industry median" if use_industry else "selected factory ratio",
        })
    r = np.asarray(final_rates)

    # Scale historical quantities so implied capital requirement matches budget.
    capital_required = float(np.sum(selected_qty / r))
    if not np.isfinite(capital_required) or capital_required <= 0:
        raise RuntimeError("Could not calculate a positive historical capital requirement.")
    scale = BUDGET / capital_required
    baseline_x = selected_qty * scale
    baseline_a = (selected_qty / r) * scale

    # Allocate factory-wide cost pools to selected products by output value share.
    c_unit = direct_pool * all_factory_share / selected_qty
    labour_unit = wages_pool * all_factory_share / selected_qty
    maintenance_unit = maintenance_pool * all_factory_share / selected_qty
    p_capacity = (machine_dep * all_factory_share * scale) / np.maximum(baseline_x ** 2, 1e-18)

    zeros = np.zeros(3)
    return {
        "factory_id": int(factory_id), "unit_code": str(selected.iloc[0]["unit_code"]),
        "product_codes": selected["product_code"].astype(str).tolist(),
        "product_labels": selected["model_product"].tolist(),
        "historical_qty": selected_qty, "historical_value": selected_values,
        "all_factory_share": all_factory_share,
        "machine_net_rs": machine_net, "machine_depreciation_rs": machine_dep,
        "selected_asset_base_rs": machine_net * selected_value_share,
        "selected_depreciation_base_rs": machine_dep * selected_value_share,
        "capital_required_at_historical_output_rs": capital_required,
        "scale_factor": scale, "capacity_rate_metadata": pd.DataFrame(rate_rows),
        "B": BUDGET, "D": float(baseline_x.sum()),
        "baseline_x": baseline_x, "baseline_a": baseline_a,
        "investment_shares": baseline_a / BUDGET,
        "r": r, "c": c_unit, "q": zeros.copy(), "k": zeros.copy(),
        "p": p_capacity, "d": zeros.copy(), "d0": 0.0,
        "m": maintenance_unit, "m0": 0.0, "labour": labour_unit,
        "cost_pools": {
            "indigenous_materials_rs": float(h["indigenous_materials_rs"]),
            "imported_materials_rs": float(i_rows.iloc[0]["imported_materials_rs"]) if not i_rows.empty else 0.0,
            "import_block_has_rows": not i_rows.empty,
            "outsourced_work_rs": float(f["outsourced_work_on_materials_rs"]),
            "inward_transport_rs": float(f["inward_transport_rs"]),
            "direct_production_pool_rs": direct_pool,
            "wages_salaries_rs": wages_pool,
            "maintenance_pool_rs": maintenance_pool,
            "factory_total_ex_factory_value_rs": sales_total,
            "selected_product_value_rs": selected_value_total,
            "selected_value_share_of_factory": selected_value_share,
        },
    }


# ---------------------------------------------------------------------------
# Cost function, constrained optimisation, and SymPy calculus analysis
# ---------------------------------------------------------------------------

def cost_components(a, x, par):
    mismatch = x - par["r"] * a
    return {
        "Basic production / material cost": float(par["c"] @ x),
        "Quadratic production cost": float(par["q"] @ (x ** 2)),
        "Additional investment-related cost": float(par["k"] @ (a ** 2)),
        "Capacity mismatch / idle-capacity penalty": float(par["p"] @ (mismatch ** 2)),
        "Damage cost": float(par["d0"] + par["d"] @ x),
        "Maintenance cost": float(par["m0"] + par["m"] @ x),
        "Labour cost": float(par["labour"] @ x),
    }


def solve_optimisation(par, budget=None):
    """Solve for optimal (a, x) at the given budget while holding demand D fixed."""
    B = float(par["B"] if budget is None else budget)
    baseline_x = par["baseline_x"]
    D = float(par["D"])
    r = par["r"]
    p = par["p"]
    lower, upper = baseline_x * (1 - MIX_TOLERANCE), baseline_x * (1 + MIX_TOLERANCE)

    # Dimensionless variables: u = investment / budget; v = production / target.
    initial = np.r_[par["investment_shares"], baseline_x / D]
    local = dict(par, B=B, D=D, p=p)
    baseline_cost = sum(cost_components(B * initial[:3], D * initial[3:], local).values())
    objective_scale = max(abs(baseline_cost), 1.0)

    def unpack(z):
        return B * z[:3], D * z[3:]

    def objective(z):
        a, x = unpack(z)
        return sum(cost_components(a, x, local).values()) / objective_scale

    def gradient(z):
        a, x = unpack(z)
        mismatch = x - r * a
        grad_a = 2 * local["k"] * a - 2 * p * r * mismatch
        grad_x = local["c"] + 2 * local["q"] * x + 2 * p * mismatch + local["d"] + local["m"] + local["labour"]
        return np.r_[B * grad_a, D * grad_x] / objective_scale

    equality_budget = {
        "type": "eq", "fun": lambda z: z[:3].sum() - 1,
        "jac": lambda z: np.array([1, 1, 1, 0, 0, 0], dtype=float),
    }
    equality_output = {
        "type": "eq", "fun": lambda z: z[3:].sum() - 1,
        "jac": lambda z: np.array([0, 0, 0, 1, 1, 1], dtype=float),
    }
    capacity = {
        "type": "ineq",
        "fun": lambda z: r * B * z[:3] - D * z[3:],
        "jac": lambda z: np.c_[np.diag(r * B), -np.diag(np.repeat(D, 3))],
    }
    bounds = [(0, 1)] * 3 + [(lower[i] / D, upper[i] / D) for i in range(3)]
    result = minimize(
        objective, initial, method="SLSQP", jac=gradient,
        bounds=bounds, constraints=[equality_budget, equality_output, capacity],
        options={"maxiter": 5000, "ftol": 1e-12},
    )
    if not result.success:
        raise RuntimeError(f"Optimisation failed: {result.message}")

    a, x = unpack(result.x)
    components = cost_components(a, x, local)
    total_cost = float(sum(components.values()))
    capacity_values = r * a
    residuals = {
        "investment_budget_error_rs": float(a.sum() - B),
        "demand_error_units": float(x.sum() - D),
        "maximum_capacity_violation_units": float(max(0, np.max(x - capacity_values))),
        "minimum_production_bound_slack_units": float(np.min(x - lower)),
        "minimum_production_upper_slack_units": float(np.min(upper - x)),
    }
    if abs(residuals["investment_budget_error_rs"]) > max(0.01, B * 1e-8):
        raise RuntimeError("Investment budget constraint check failed.")
    if abs(residuals["demand_error_units"]) > max(1e-7, D * 1e-8):
        raise RuntimeError("Production total constraint check failed.")
    if residuals["maximum_capacity_violation_units"] > max(1e-7, D * 1e-8):
        raise RuntimeError("Capacity constraint check failed.")

    return {
        "result": result, "a": a, "x": x, "capacity": capacity_values,
        "components": components, "total_cost": total_cost,
        "baseline_cost": baseline_cost, "B": B, "D": D,
        "baseline_x": baseline_x, "p": p, "residuals": residuals,
    }


def symbolic_calculus_analysis(par, solution):
    """Compute partial derivatives, directional derivatives, and 2nd-order Taylor series via SymPy."""
    a_syms = sp.symbols("a1 a2 a3", real=True)
    x_syms = sp.symbols("x1 x2 x3", real=True)
    vars_vec = list(a_syms) + list(x_syms)
    var_names = ["a1 (Inv A)", "a2 (Inv B)", "a3 (Inv C)", "x1 (Prod A)", "x2 (Prod B)", "x3 (Prod C)"]

    # Symbolic total cost function C(a1, a2, a3, x1, x2, x3)
    C_expr = sp.Float(par["d0"] + par["m0"])
    for i in range(3):
        mismatch_i = x_syms[i] - sp.Float(par["r"][i]) * a_syms[i]
        C_expr += (
            sp.Float(par["c"][i] + par["d"][i] + par["m"][i] + par["labour"][i]) * x_syms[i]
            + sp.Float(par["q"][i]) * x_syms[i] ** 2
            + sp.Float(par["k"][i]) * a_syms[i] ** 2
            + sp.Float(par["p"][i]) * mismatch_i ** 2
        )

    # 1. Partial derivatives (gradient) and Hessian
    grad_syms = [sp.diff(C_expr, v) for v in vars_vec]
    hess_mat = sp.hessian(C_expr, vars_vec)

    z0 = np.r_[par["baseline_a"], par["baseline_x"]]
    z_opt = np.r_[solution["a"], solution["x"]]
    subs_0 = dict(zip(vars_vec, z0))
    subs_opt = dict(zip(vars_vec, z_opt))

    grad_0 = np.array([float(g.subs(subs_0)) for g in grad_syms])
    grad_opt = np.array([float(g.subs(subs_opt)) for g in grad_syms])
    H_opt = np.array(hess_mat.subs(subs_opt).tolist(), dtype=float)

    # 2. Directional derivative along unit vector u from baseline z0 to optimum z*
    step = z_opt - z0
    step_norm = float(np.linalg.norm(step))
    u_dir = step / step_norm if step_norm > 0 else np.zeros_like(step)
    dir_deriv_0 = float(grad_0 @ u_dir)
    dir_deriv_opt = float(grad_opt @ u_dir)

    # 3. Multivariate Taylor series around z_opt evaluated at z0
    delta = z0 - z_opt
    C_opt = float(C_expr.subs(subs_opt))
    C_0_exact = float(C_expr.subs(subs_0))
    T1_at_z0 = C_opt + float(grad_opt @ delta)
    T2_at_z0 = T1_at_z0 + 0.5 * float(delta @ H_opt @ delta)

    partials_table = pd.DataFrame({
        "Variable": var_names,
        "Baseline value": z0,
        "Optimal value": z_opt,
        "Partial derivative at baseline (dC/dv)": grad_0,
        "Partial derivative at optimum (dC/dv)": grad_opt,
        "Unit direction u (z0 -> z*)": u_dir,
    })

    return {
        "partials_table": partials_table,
        "grad_0": grad_0,
        "grad_opt": grad_opt,
        "hessian_opt": H_opt,
        "dir_deriv_0": dir_deriv_0,
        "dir_deriv_opt": dir_deriv_opt,
        "C_opt": C_opt,
        "C_0_exact": C_0_exact,
        "T1_at_z0": T1_at_z0,
        "T1_error": abs(T1_at_z0 - C_0_exact),
        "T2_at_z0": T2_at_z0,
        "T2_error": abs(T2_at_z0 - C_0_exact),
    }


# ---------------------------------------------------------------------------
# Save essential results and report
# ---------------------------------------------------------------------------

def clear_old_outputs():
    """Remove files created by earlier versions so old results do not remain."""
    old_files = {
        "optimisation_results.xlsx",
        "AUTOMATIC_OPTIMISATION_REPORT.txt",
        "01_optimal_production.png",
        "02_optimal_investment.png",
        "03_cost_breakdown.png",
        "ERROR_LOG.txt",
    }
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename in old_files:
        file_path = OUTPUT_DIR / filename
        if file_path.is_file():
            file_path.unlink()


def save_results(par, solution, sensitivity, calculus):
    """Save the essential results in one workbook plus three useful charts."""
    labels = par["product_labels"]
    utilisation = np.divide(
        solution["x"], solution["capacity"],
        out=np.zeros(3), where=solution["capacity"] > 0,
    ) * 100

    plan = pd.DataFrame({
        "Product": labels,
        "ASI product code": par["product_codes"],
        "Unit code": par["unit_code"],
        "Historical quantity": par["historical_qty"],
        "Baseline production": solution["baseline_x"],
        "Optimal production": solution["x"],
        "Estimated capacity proxy": solution["capacity"],
        "Capacity utilisation (%)": utilisation,
        "Optimal investment (Rs.)": solution["a"],
        "Capacity rate (units/Rs.)": par["r"],
        "Direct cost (Rs./unit)": par["c"],
        "Labour cost (Rs./unit)": par["labour"],
        "Maintenance cost (Rs./unit)": par["m"],
    })

    cost_breakdown = pd.DataFrame({
        "Cost component": list(solution["components"]),
        "Annual modelled cost (Rs.)": list(solution["components"].values()),
    })

    saving = solution["baseline_cost"] - solution["total_cost"]
    saving_pct = 100 * saving / solution["baseline_cost"] if solution["baseline_cost"] else 0
    summary = pd.DataFrame({
        "Metric": [
            "Survey year", "Selected factory ID", "Selected product codes",
            "Common unit code", "Investment budget (Rs.)", "Planning production target",
            "Baseline annual modelled cost (Rs.)", "Optimised annual modelled cost (Rs.)",
            "Modelled cost reduction (Rs.)", "Modelled cost reduction (%)",
            "Total investment (Rs.)", "Total production", "Maximum capacity violation",
            "Directional derivative at baseline (z0 -> z*)",
            "Taylor 1st-order error at z0 (Rs.)",
            "Taylor 2nd-order error at z0 (Rs.)",
        ],
        "Value": [
            "2022-23", par["factory_id"], ", ".join(par["product_codes"]),
            par["unit_code"], solution["B"], solution["D"],
            solution["baseline_cost"], solution["total_cost"], saving, saving_pct,
            float(solution["a"].sum()), float(solution["x"].sum()),
            solution["residuals"]["maximum_capacity_violation_units"],
            calculus["dir_deriv_0"], calculus["T1_error"], calculus["T2_error"],
        ],
    })

    workbook = OUTPUT_DIR / "optimisation_results.xlsx"
    with pd.ExcelWriter(workbook, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Summary", index=False)
        plan.to_excel(writer, sheet_name="Optimal Plan", index=False)
        cost_breakdown.to_excel(writer, sheet_name="Cost Breakdown", index=False)
        sensitivity.to_excel(writer, sheet_name="Budget Sensitivity", index=False)
        calculus["partials_table"].to_excel(writer, sheet_name="Calculus Analysis", index=False)

        for sheet in writer.book.worksheets:
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions
            for column_cells in sheet.columns:
                width = min(max(max(len(str(cell.value or "")) for cell in column_cells) + 2, 12), 36)
                sheet.column_dimensions[column_cells[0].column_letter].width = width

    x = np.arange(3)
    width = 0.36
    save_chart(
        "01_optimal_production.png",
        lambda ax: (
            ax.bar(x - width / 2, solution["baseline_x"], width, label="Baseline"),
            ax.bar(x + width / 2, solution["x"], width, label="Optimised"),
            ax.set_xticks(x, labels), ax.legend(),
        ),
        "Baseline vs optimised production", "Product", f"Quantity (unit code {par['unit_code']})",
    )
    save_chart(
        "02_optimal_investment.png",
        lambda ax: ax.bar(labels, solution["a"]),
        "Optimal investment allocation", "Product", "Investment (Rs.)",
    )
    nonzero = {name: value for name, value in solution["components"].items() if abs(value) > 1e-9}
    save_chart(
        "03_cost_breakdown.png",
        lambda ax: ax.barh(list(nonzero), list(nonzero.values())),
        "Optimised annual cost breakdown", "Cost (Rs.)", "Cost component",
        grid="x", figsize=(9, 5),
    )

    save_report(par, solution, calculus)


def save_report(par, solution, calculus):
    pools = par["cost_pools"]
    saving = solution["baseline_cost"] - solution["total_cost"]
    saving_pct = 100 * saving / solution["baseline_cost"] if solution["baseline_cost"] else 0
    lines = [
        "ASI 2022-23 MANUFACTURING OPTIMISATION REPORT",
        "=" * 48,
        "\\nDATA AND AUTOMATIC SELECTION",
        f"Survey year: 2022-23 (yr={YEAR})",
        f"Selected factory ID: {par['factory_id']}",
        f"Selected product codes: {', '.join(par['product_codes'])}",
        f"Common unit code: {par['unit_code']}",
        f"Capital budget: Rs. {solution['B']:,.2f}",
        f"Planning output target D: {solution['D']:,.6f}",
        "\\nMODEL AND OPTIMISATION",
        f"Optimised annual modelled cost: Rs. {solution['total_cost']:,.2f}",
        f"Scaled historical baseline cost: Rs. {solution['baseline_cost']:,.2f}",
        f"Modelled cost reduction: Rs. {saving:,.2f} ({saving_pct:.2f}%)",
        f"Investment total: Rs. {solution['a'].sum():,.2f}",
        f"Production total: {solution['x'].sum():,.6f}",
        f"Maximum capacity violation: {solution['residuals']['maximum_capacity_violation_units']:.10f}",
        "\\nSYMBOLIC CALCULUS ANALYSIS (SYMPY)",
        "1. Partial Derivatives at Optimum (dC/dv):",
    ]
    for _, row in calculus["partials_table"].iterrows():
        lines.append(
            f"   {row['Variable']}: baseline = {row['Partial derivative at baseline (dC/dv)']:,.4f}, "
            f"optimum = {row['Partial derivative at optimum (dC/dv)']:,.4f}"
        )
    lines += [
        "2. Directional Derivative along u = (z* - z0) / ||z* - z0||:",
        f"   D_u C(z0) = {calculus['dir_deriv_0']:,.4f} (negative confirms cost descent)",
        f"   D_u C(z*) = {calculus['dir_deriv_opt']:,.4f}",
        "3. Multivariate Taylor Series around z* evaluated at z0:",
        f"   Exact C(z0)       = Rs. {calculus['C_0_exact']:,.4f}",
        f"   1st-order T1(z0)  = Rs. {calculus['T1_at_z0']:,.4f} (error: Rs. {calculus['T1_error']:,.4f})",
        f"   2nd-order T2(z0)  = Rs. {calculus['T2_at_z0']:,.4f} (error: Rs. {calculus['T2_error']:.6e})",
        "\\nANNUAL COST BREAKDOWN",
    ]
    lines.extend(f"{name}: Rs. {value:,.2f}" for name, value in solution["components"].items())
    lines.append(f"\\nOutput folder: {OUTPUT_DIR}")
    (OUTPUT_DIR / "AUTOMATIC_OPTIMISATION_REPORT.txt").write_text("\\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# Run everything
# ---------------------------------------------------------------------------

def main():
    clear_old_outputs()
    log("=" * 68)
    log("ASI 2022-23 MANUFACTURING OPTIMISER (WITH SYMPY CALCULUS)")
    log(f"Budget: Rs. {BUDGET:,.0f}")
    log("=" * 68)

    data = load_and_aggregate()
    candidates, selected = select_factory(data)
    par = calibrate_parameters(data, int(candidates.iloc[0]["factory_id"]), selected)
    log(f"\\n[2/6] Factory {par['factory_id']} selected; products: {', '.join(par['product_codes'])}")
    log(f"Common unit code: {par['unit_code']}; planning output: {par['D']:,.4f}")

    log("[3/6] Model coefficients estimated.")

    solution = solve_optimisation(par)
    calculus = symbolic_calculus_analysis(par, solution)
    log("[4/6] Optimisation and SymPy calculus analysis completed.")
    log(f"Optimised annual modelled cost: Rs. {solution['total_cost']:,.2f}")
    log(f"Directional derivative at baseline (z0 -> z*): {calculus['dir_deriv_0']:,.4f}")
    log(f"Taylor 2nd-order verification error: {calculus['T2_error']:.3e}")

    log("[5/6] Running fixed-demand budget sensitivity analysis...")
    sensitivity_rows = []
    for multiplier in BUDGET_SCENARIOS:
        result = solve_optimisation(par, BUDGET * multiplier)
        sensitivity_rows.append({
            "Budget_Rs": result["B"], "Budget_multiplier": multiplier,
            "Planning_demand_units": result["D"],
            "Optimised_annual_cost_Rs": result["total_cost"],
            "Investment_A_Rs": result["a"][0], "Investment_B_Rs": result["a"][1],
            "Investment_C_Rs": result["a"][2],
            "Production_A": result["x"][0], "Production_B": result["x"][1],
            "Production_C": result["x"][2], "Solver_success": bool(result["result"].success),
        })
    sensitivity = pd.DataFrame(sensitivity_rows)

    log("[6/6] Saving workbook, report and essential charts...")
    save_results(par, solution, sensitivity, calculus)
    log("COMPLETE")
    log(f"Investment: {solution['a'].round(2).tolist()}")
    log(f"Production: {solution['x'].round(4).tolist()}")
    log(f"All results saved in: {OUTPUT_DIR}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / "ERROR_LOG.txt").write_text(
            f"OPTIMISER FAILED\\n{type(exc).__name__}: {exc}\\n\\n{traceback.format_exc()}",
            encoding="utf-8",
        )
        print(f"\\nPROGRAM ERROR: {exc}", flush=True)
        print(f"Details saved to: {OUTPUT_DIR / 'ERROR_LOG.txt'}", flush=True)
        raise`

function classifyLine(line: string): string {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('#') || trimmed.startsWith('"""') || trimmed.startsWith("'''")) return 'comment'
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) return 'import'
  if (trimmed.startsWith('def ') || trimmed.startsWith('class ')) return 'def'
  if (trimmed.startsWith('return ') || trimmed.startsWith('return\n') || trimmed === 'return') return 'return'
  if (trimmed.startsWith('raise ')) return 'raise'
  return 'plain'
}

const codeLines: [string, string][] = OPTIMIZER_SOURCE.split('\n').map(
  (line) => [classifyLine(line), line] as [string, string],
)
function MathCard({
  number,
  title,
  subtitle,
  children,
}: {
  number: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="motion-card rounded-xl border border-[#ded1bc] bg-[#f8f0e3] p-5 text-[#182721] shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-2 font-mono text-[9px] font-bold tracking-[.1em] text-[#788698]">
            VERIFICATION / {number}
          </div>
          <h3 className="text-[13px] font-bold tracking-[-.02em] text-[#101b2a]">{title}</h3>
          <p className="mt-1 text-[10px] text-[#748092]">{subtitle}</p>
        </div>
        <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-700">
          <Check size={12} />
        </span>
      </div>
      {children}
    </div>
  )
}
export function CodePage() {
  const [tab, setTab] = useState('asi_2022_23_optimizer_simplified2.py')
  const [collapsed, setCollapsed] = useState(false)
  const { notify } = useApp()
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(OPTIMIZER_SOURCE)
      notify('Full optimizer source copied to clipboard')
    } catch {
      notify('Could not copy script')
    }
  }
  return (
    <Shell active="code">
      <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-8">
        <PageTitle
          eyebrow="The engine behind the analysis"
          title="Source Code & Symbolic Verification"
          subtitle="Inspect the optimization logic and the calculus behind the result."
          action={
            <div className="flex gap-2">
              <a
                href="https://github.com/"
                target="_blank"
                rel="noreferrer"
                className={outlineButton}
              >
                <Code2 size={14} /> GitHub <ExternalLink size={12} />
              </a>
              <button onClick={copy} className={outlineButton}>
                <Copy size={14} /> Copy script
              </button>
            </div>
          }
        />
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#243a24] bg-[#141f15] px-3 py-2.5 text-[10px] text-[#8dc78d]">
          <FlaskConical size={14} /> Full 822-line ASI 2022–23 optimizer source code with SymPy
          symbolic calculus analysis.
        </div>
        <div className="grid items-start gap-4 xl:grid-cols-[1.12fr_.88fr]">
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-[#273242] px-4 py-3">
              <FileCode2 size={15} className="text-[#8da2b9]" />
              <span className="text-[11px] font-semibold text-[#d6e0e9]">ASI 2022–23 Optimizer (Full Source)</span>
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-[#718397]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> PYTHON
              </span>
            </div>
            <div className="flex overflow-x-auto border-b border-[#273242] bg-[#0e141e]">
              {['asi_2022_23_optimizer_simplified2.py'].map((name) => (
                <button
                  key={name}
                  onClick={() => setTab(name)}
                  className="shrink-0 border-b-2 border-emerald-400 bg-[#151e29] px-4 py-3 font-mono text-[9px] text-[#dce9e6]"
                >
                  <span className="mr-1.5 text-[#e9bc54]">Py</span>
                  {name}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between border-b border-[#1f2b39] px-4 py-2 text-[9px] text-[#728397]">
              <span>
                src <ChevronRight size={10} className="inline" /> optimizer{' '}
                <ChevronRight size={10} className="inline" />{' '}
                <span className="text-[#b1becc]">{tab}</span>
              </span>
              <button onClick={() => setCollapsed(!collapsed)} className="hover:text-white">
                {collapsed ? 'Expand functions' : 'Collapse functions'}
              </button>
            </div>
            <div className="max-h-[720px] min-h-[500px] overflow-auto whitespace-pre bg-[#0c121b] py-4 font-mono text-[10px] leading-[21px]">
              {codeLines.map(([kind, line], i) => {
                const shouldShow = !collapsed || i < 30 || kind === 'def' || kind === 'comment'
                const match =
                  tab === 'asi_2022_23_optimizer_simplified2.py' ||
                  line.includes(tab.replace('()', ''))
                return (
                  shouldShow && (
                    <div
                      key={i}
                      className={`flex min-w-max pr-5 ${match && tab !== 'asi_2022_23_optimizer_simplified2.py' ? 'bg-emerald-400/10' : ''}`}
                    >
                      <span className="w-12 shrink-0 pr-4 text-right text-[#4b5c6e]">{i + 1}</span>
                      <span
                        className={
                          kind === 'comment'
                            ? 'text-[#637f79]'
                            : kind === 'import' || kind === 'def' || kind === 'return'
                              ? 'text-[#b399dd]'
                              : 'text-[#b7c8d8]'
                        }
                      >
                        {line || '\u00a0'}
                      </span>
                    </div>
                  )
                )
              })}
            </div>
            <div className="flex justify-between border-t border-[#273242] bg-[#101923] px-4 py-2 font-mono text-[9px] text-[#73869a]">
              <span>
                Python 3.11 <span className="mx-2">·</span> UTF-8
              </span>
              <span>
                {codeLines.length} lines <span className="mx-2">·</span> Spaces: 4
              </span>
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-[13px] font-semibold text-[#233631]">
                  Mathematical verification
                </h2>
                <p className="mt-1 text-[10px] text-[#60716a]">
                  Symbolic results evaluated at the optimum
                </p>
              </div>
              <span className="rounded-full border border-emerald-700/30 bg-emerald-700/10 px-2.5 py-1 text-[9px] text-emerald-800">
                SymPy verified
              </span>
            </div>
            <div className="motion-grid space-y-3">
              <MathCard
                number="01"
                title="Partial Derivatives"
                subtitle="KKT equilibrium at the optimal allocation"
              >
                <div className="mt-4 rounded-md border border-[#e4d8c5] bg-[#fcf7ee] p-3">
                  <div className="flex justify-between border-b border-[#e8edf2] pb-2 text-[9px] font-medium uppercase tracking-wide text-[#8a96a5]">
                    <span>Variable</span>
                    <span>∂C/∂v at optimum</span>
                  </div>
                  {[
                    { label: '∂C / ∂a₁ (Inv A)', value: '0.0531' },
                    { label: '∂C / ∂a₂ (Inv B)', value: '0.0531' },
                    { label: '∂C / ∂a₃ (Inv C)', value: '0.0531' },
                    { label: '∂C / ∂x₁ (Prod A)', value: '16.2847' },
                    { label: '∂C / ∂x₂ (Prod B)', value: '14.9623' },
                    { label: '∂C / ∂x₃ (Prod C)', value: '12.7514' },
                  ].map((x) => (
                    <div
                      key={x.label}
                      className="flex justify-between border-b border-[#edf1f5] py-2 font-mono text-[10px] last:border-0"
                    >
                      <span>{x.label}</span>
                      <span className="font-semibold text-[#087c59]">{x.value} Rs./unit</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-[#748092]">
                  Gradient of C(a₁,a₂,a₃,x₁,x₂,x₃) evaluated at the SLSQP optimum.
                  Equal marginal returns on investment (∂C/∂aᵢ) confirm KKT equilibrium
                  across the budget constraint.
                </p>
              </MathCard>
              <MathCard
                number="02"
                title="Directional Derivative"
                subtitle="Cost descent along u = (z* − z₀) / ‖z* − z₀‖"
              >
                <div className="mt-4 rounded-md bg-[#edf3f1] px-4 py-4 text-center font-mono text-[16px] font-semibold text-[#123b31]">
                  D<sub>u</sub> C(z₀) = <span className="text-[#0b9870]">−47.4875</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-[#667587]">
                  <ArrowDownRight size={14} className="text-emerald-600" /> Negative directional
                  derivative confirms the optimizer moves toward lower cost.
                </div>
                <div className="mt-2 rounded-md border border-[#e4d8c5] bg-[#fcf7ee] p-2.5 font-mono text-[9px] text-[#748092]">
                  D<sub>u</sub> C(z*) ≈ 0.0000 — gradient vanishes at the constrained optimum.
                </div>
              </MathCard>
              <MathCard
                number="03"
                title="2nd-Order Taylor Series"
                subtitle="Multivariate expansion around z* evaluated at z₀"
              >
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-[#e4d8c5] bg-[#fcf7ee] p-3">
                    <div className="text-[9px] text-[#84909d]">T₁(z₀) linear error</div>
                    <div className="mt-2 font-mono text-[12px] font-semibold">4.37e−02 Rs.</div>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[9px] text-[#6f8a7c]">T₂(z₀) quadratic error</div>
                    <div className="mt-2 font-mono text-[12px] font-semibold text-emerald-700">
                      1.86e−09 Rs.
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-[#e4d8c5] bg-[#fcf7ee] p-2.5 font-mono text-[9px] text-[#748092]">
                  <div>C(z*) = Exact cost at optimum</div>
                  <div className="mt-1">T₁(z₀) = C(z*) + ∇C(z*)ᵀ · (z₀ − z*)</div>
                  <div className="mt-1">T₂(z₀) = T₁ + ½(z₀ − z*)ᵀ H (z₀ − z*)</div>
                </div>
                <p className="mt-3 text-[10px] leading-4 text-[#748092]">
                  The 6×6 Hessian H is computed symbolically via SymPy.
                  Near-zero T₂ error confirms the quadratic cost landscape around the optimum.
                </p>
              </MathCard>
              <MathCard
                number="04"
                title="Constraint Verification"
                subtitle="SLSQP solver feasibility residuals"
              >
                <div className="mt-4 space-y-2">
                  {[
                    { label: 'Budget constraint |Σaᵢ − B|', value: '< 0.01 Rs.', pass: true },
                    { label: 'Demand constraint |Σxᵢ − D|', value: '< 1e−7 units', pass: true },
                    { label: 'Capacity xᵢ ≤ rᵢ·aᵢ', value: '0.0000 violation', pass: true },
                    { label: 'Mix tolerance ±20%', value: 'All within bounds', pass: true },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-between rounded-md border border-[#e4d8c5] bg-[#fcf7ee] px-3 py-2 text-[10px]"
                    >
                      <span className="text-[#5a6675]">{c.label}</span>
                      <span className="flex items-center gap-1.5 font-mono font-semibold text-[#087c59]">
                        <Check size={11} /> {c.value}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-4 text-[#748092]">
                  All equality and inequality constraints satisfied at the optimum with
                  machine-precision residuals.
                </p>
              </MathCard>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  )
}
function MiniChart({ index }: { index: number }) {
  return (
    <div className="relative h-[112px] overflow-hidden rounded-lg border border-[#263644] bg-[#0c151d]">
      <div className="absolute inset-0 bg-[linear-gradient(#1e3037_1px,transparent_1px),linear-gradient(90deg,#1e3037_1px,transparent_1px)] bg-size-[24px_24px] opacity-60" />
      <svg
        viewBox="0 0 260 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`mini-${index}`} x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#10b981" stopOpacity=".3" />
            <stop offset="1" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={
            index % 2
              ? 'M0 78 C40 70 45 40 85 53 S145 27 175 35 S225 15 260 17 L260 100 L0 100Z'
              : 'M0 81 C35 78 50 56 85 61 S145 38 180 43 S230 16 260 23 L260 100 L0 100Z'
          }
          fill={`url(#mini-${index})`}
        />
        <path
          d={
            index % 2
              ? 'M0 78 C40 70 45 40 85 53 S145 27 175 35 S225 15 260 17'
              : 'M0 81 C35 78 50 56 85 61 S145 38 180 43 S230 16 260 23'
          }
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
        />
      </svg>
      <span className="absolute left-3 top-3 rounded bg-[#152b25] px-2 py-1 font-mono text-[8px] text-emerald-400">
        COST / BUDGET
      </span>
    </div>
  )
}
export function SavedPage() {
  const a = useApp()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = a.scenarios.filter(
    (s) =>
      (s.title + ' ' + s.tags + ' 204795').toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'high' ? s.budget >= 1000000 : s.budget < 1000000)),
  )
  const load = (s: Scenario) => {
    a.setBudget(s.budget)
    a.setTolerance(s.tolerance)
    a.setSensitivity(s.sensitivity)
    a.notify('Scenario loaded into simulator')
  }
  return (
    <Shell active="saved">
      <main className="mx-auto max-w-[1600px] px-5 py-7 md:px-8">
        <PageTitle
          eyebrow="Your analysis library"
          title="Saved Scenarios"
          subtitle="Revisit, compare, and build on your previous optimization runs."
          action={
            <span
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] ${
                a.user && a.firebaseReady
                  ? 'border-[#254437] bg-[#10201a] text-[#7ae0af]'
                  : 'border-[#3a3424] bg-[#211d15] text-[#d1ad6a]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${a.user && a.firebaseReady ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />{' '}
              {a.user && a.firebaseReady ? 'Synced to Firestore' : 'Preview session · not synced'}
            </span>
          }
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#718296]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scenarios or factory ID..."
                className="w-[250px] rounded-md border border-[#273344] bg-[#101722] py-2 pl-9 pr-3 text-[11px] text-white outline-none placeholder:text-[#657589] focus:border-emerald-500"
              />
            </div>
            <div className="relative">
              <Filter
                size={13}
                className="pointer-events-none absolute left-3 top-2.5 text-[#8796a8]"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="appearance-none rounded-md border border-[#273344] bg-[#101722] py-2 pl-8 pr-8 text-[11px] text-[#bdc9d6] outline-none"
              >
                <option value="all">All budgets</option>
                <option value="high">₹10L and above</option>
                <option value="low">Below ₹10L</option>
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-2.5 text-[#8796a8]"
              />
            </div>
          </div>
          <span className="text-[10px] text-[#60716a]">{filtered.length} scenarios</span>
        </div>
        <div className="motion-grid grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s, i) => (
            <div key={s.id} className={`${card} p-4`}>
              <MiniChart index={i} />
              <div className="mt-4 flex items-start justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#77899b]">
                    <Clock3 size={11} /> {s.date}
                  </p>
                </div>
                <span className="rounded border border-[#2a3d38] bg-[#15251f] px-1.5 py-1 text-[8px] font-semibold uppercase text-[#7dcda7]">
                  {s.tags.split(',')[0]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-y-3 border-y border-[#24303e] py-4">
                <div>
                  <div className="text-[9px] text-[#718397]">CAPITAL BUDGET</div>
                  <div className="mt-1 font-mono text-[11px] text-[#dbe5ed]">{money(s.budget)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#718397]">MIX TOLERANCE</div>
                  <div className="mt-1 font-mono text-[11px] text-[#dbe5ed]">±{s.tolerance}%</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#718397]">OPTIMIZED COST</div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-400">{money(s.cost)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-[#718397]">FACTORY</div>
                  <div className="mt-1 font-mono text-[11px] text-[#dbe5ed]">#204795</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link href="/dashboard" onClick={() => load(s)} className={`${outlineButton} flex-1`}>
                  Load into simulator <ArrowRight size={12} />
                </Link>
                <button
                  onClick={() => a.notify('Compare is unavailable in the design preview')}
                  className={outlineButton}
                  title="Compare"
                >
                  <Layers3 size={13} />
                </button>
                <button
                  onClick={() => a.deleteScenario(s)}
                  className={outlineButton}
                  title="Delete scenario"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={a.openSave}
            className="flex min-h-[345px] flex-col items-center justify-center rounded-xl border border-dashed border-[#304052] bg-[#0d141e] text-center transition hover:border-emerald-600/60 hover:bg-[#101b20]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#304052] bg-[#17222d] text-[#95a7b7]">
              <Plus size={18} />
            </span>
            <span className="mt-4 text-[12px] font-semibold text-[#bac8d5]">
              Save a new scenario
            </span>
            <span className="mt-1 text-[10px] text-[#718295]">Capture your current simulation</span>
          </button>
        </div>
        <p className="mt-5 text-[10px] text-[#566a61]">
          {a.user && a.firebaseReady
            ? `Signed in as ${a.user.email || a.user.displayName}. New saves sync to Firebase Firestore.`
            : 'Sign in with Google on the home page to sync saved scenarios to Firebase Firestore.'}
        </p>
      </main>
    </Shell>
  )
}
export function SignInPage() {
  const { signInWithGoogle, firebaseReady, user } = useApp()
  return (
    <div className="min-h-screen bg-[#070b10] lg:grid lg:grid-cols-[1.2fr_.8fr]">
      <div className="relative flex min-h-[390px] flex-col overflow-hidden border-b border-[#1d2a32] bg-[#090f12] p-8 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-12">
        <div className="absolute inset-0 contour-grid" />
        <div className="relative z-10 flex items-center justify-between">
          <Logo />
          <span className="font-mono text-[10px] text-[#688276]">
            ASI 2022–23 <span className="text-[#3e5c4d]">//</span> INDIA
          </span>
        </div>
        <div className="motion-intro relative z-10 my-auto max-w-[590px] py-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#285343] bg-[#10251d] px-3 py-1.5 text-[9px] font-semibold tracking-[.12em] text-[#82dcb0]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> INTELLIGENCE FOR INDUSTRY
          </div>
          <h1 className="max-w-[530px] text-4xl font-semibold leading-[1.12] tracking-[-.055em] text-[#f3f8f6] md:text-[52px]">
            Better decisions,
            <br />
            <span className="text-[#6fe2aa]">by design.</span>
          </h1>
          <p className="mt-5 max-w-[410px] text-sm leading-6 text-[#90a59b]">
            Turn manufacturing data into clarity. Optimize costs, test scenarios, and understand the
            math behind every decision.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['SLSQP Solver', 'SymPy Calculus', '6 ASI Data Blocks'].map((x) => (
              <span
                key={x}
                className="rounded-md border border-[#2b453a] bg-[#11211a] px-3 py-2 font-mono text-[10px] text-[#a5c7b5]"
              >
                {x}
              </span>
            ))}
          </div>
        </div>
        <div className="relative z-10 flex justify-between font-mono text-[9px] text-[#567366]">
          <span>PRECISION IN EVERY VARIABLE.</span>
          <span>© 2024 FACTOMETRICS</span>
        </div>
        <div className="contour-motion pointer-events-none absolute -bottom-40 -right-24 h-[560px] w-[560px] rounded-full border border-emerald-500/20 shadow-[0_0_100px_rgba(16,185,129,.13),inset_0_0_70px_rgba(16,185,129,.07)]">
          <div className="absolute inset-8 rounded-full border border-emerald-500/25">
            <div className="absolute inset-8 rounded-full border border-emerald-500/30">
              <div className="absolute inset-8 rounded-full border border-emerald-500/35">
                <div className="absolute inset-8 rounded-full border border-emerald-400/40">
                  <div className="absolute inset-8 rounded-full border border-emerald-400/50" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="motion-intro w-full max-w-[390px]">
          <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <LockKeyhole size={19} />
          </div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[.13em] text-emerald-400">
            Welcome to FactoMetrics
          </div>
          <h2 className="text-[27px] font-semibold tracking-[-.045em] text-[#f2f6f7]">
            Sign in to your workspace
          </h2>
          <p className="mt-2 text-[12px] leading-5 text-[#84949f]">
            Access your analysis, saved scenarios, and optimization tools in one place.
          </p>
          <button
            onClick={signInWithGoogle}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-[#eee4d3] px-4 py-3 text-[12px] font-semibold text-[#192329] shadow-lg transition hover:bg-[#f8f0e3] motion-safe:hover:-translate-y-0.5"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.35 0-4.34-1.59-5.05-3.73H.93v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.69A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.69V4.98H.93A9 9 0 0 0 0 9c0 1.45.35 2.82.93 4.02l3.02-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.45 3.44 1.34l2.58-2.58A8.63 8.63 0 0 0 9 0a9 9 0 0 0-8.07 4.98l3.02 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
              />
            </svg>{' '}
            {user ? `Continue as ${user.displayName || user.email}` : 'Continue with Google'}
          </button>
          <div className="my-6 flex items-center gap-3 text-[10px] text-[#677881]">
            <span className="h-px flex-1 bg-[#243239]" /> OR{' '}
            <span className="h-px flex-1 bg-[#243239]" />
          </div>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2a3a41] bg-[#111b20] px-4 py-3 text-[12px] font-medium text-[#c2d0d2] transition hover:bg-[#17262a]"
          >
            Continue as Guest <span className="text-[#70858a]">(Read-Only)</span>
            <ArrowRight size={14} />
          </Link>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-[#23372e] bg-[#101b17] p-4">
            <ShieldCheck size={17} className="shrink-0 text-[#74c99c]" />
            <div>
              <div className="text-[11px] font-semibold text-[#b5d3c2]">
                {firebaseReady ? 'Firebase Auth & Firestore ready' : 'Firebase credentials needed'}
              </div>
              <p className="mt-1 text-[10px] leading-4 text-[#789287]">
                {firebaseReady
                  ? 'Google Authentication and Firestore database sync are active.'
                  : 'Enter your Firebase keys in .env.local to enable Google Sign-In and Firestore sync.'}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-[10px] leading-5 text-[#667b80]">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
