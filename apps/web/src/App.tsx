import { useState, lazy, Suspense } from 'react'
import { BrandThemeProvider, BrandThemePanel } from './BrandThemePanel'
import './App.css'

/* Lazy-load heavy panels — they'll only mount when the tab is active */
const ContentLibrary    = lazy(() => import('./content-library/ContentLibrary').then(m => ({ default: m.ContentLibrary })))
const CampaignOrchestrator = lazy(() =>
  import('./generation/CampaignOrchestrator').then(m => ({ default: m.CampaignOrchestrator })).catch(() => ({ default: ComingSoon('Campaign Orchestrator') }))
)
const MarketerCalendar  = lazy(() =>
  import('./calendar/MarketerCalendar').then(m => ({ default: m.MarketerCalendar })).catch(() => ({ default: ComingSoon('Marketing Calendar') }))
)
const ContentBriefGen   = lazy(() =>
  import('./generation/ContentBriefGenerator').then(m => ({ default: m.ContentBriefGenerator })).catch(() => ({ default: ComingSoon('Content Brief Generator') }))
)
const InstagramStudio   = lazy(() =>
  import('./instagram/InstagramStudioPanel').then(m => ({ default: m.InstagramStudioPanel })).catch(() => ({ default: ComingSoon('Instagram Studio') }))
)
const XStudio           = lazy(() =>
  import('./x-studio/XStudioPanel').then(m => ({ default: m.XStudioPanel })).catch(() => ({ default: ComingSoon('X Studio') }))
)

type Tab = 'library' | 'campaigns' | 'calendar' | 'brief' | 'instagram' | 'x'

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'library',   icon: '📚', label: 'Library'    },
  { id: 'campaigns', icon: '🚀', label: 'Campaigns'  },
  { id: 'calendar',  icon: '📅', label: 'Calendar'   },
  { id: 'brief',     icon: '✦',  label: 'Brief'      },
  { id: 'instagram', icon: '📸', label: 'Instagram'  },
  { id: 'x',         icon: '✕',  label: 'X Studio'   },
]

function ComingSoon(name: string) {
  return function Placeholder() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#888aaa' }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🔧</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0' }}>{name}</div>
        <div style={{ fontSize: 14 }}>Loading dependencies…</div>
      </div>
    )
  }
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'mp-spin 0.8s linear infinite' }} />
    </div>
  )
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('library')

  return (
    <div className="mp-shell">
      {/* ── Top nav ─────────────────────────────────────────── */}
      <nav className="mp-nav">
        <div className="mp-nav-brand">
          <span className="mp-nav-logo">✦</span>
          <span className="mp-nav-name">Marketer Pro</span>
        </div>
        <div className="mp-nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`mp-nav-tab${tab === t.id ? ' mp-nav-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span className="mp-nav-tab-icon">{t.icon}</span>
              <span className="mp-nav-tab-label">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mp-nav-right">
          <BrandThemePanel />
        </div>
      </nav>

      {/* ── Panel area ──────────────────────────────────────── */}
      <main className="mp-main">
        <Suspense fallback={<Spinner />}>
          {tab === 'library'   && <ContentLibrary />}
          {tab === 'campaigns' && <CampaignOrchestrator />}
          {tab === 'calendar'  && <MarketerCalendar />}
          {tab === 'brief'     && <ContentBriefGen />}
          {tab === 'instagram' && <InstagramStudio />}
          {tab === 'x'         && <XStudio />}
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrandThemeProvider>
      <AppShell />
    </BrandThemeProvider>
  )
}
