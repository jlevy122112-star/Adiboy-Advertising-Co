import { useState, useMemo } from 'react'
import { BrandProfileDraftPanel } from './BrandProfileDraftPanel'
import { BrandThemePanel, useBrandTheme, type BrandingApiConfig } from './BrandThemePanel'
import { CampaignSyncPanel } from './CampaignSyncPanel'
import { VideoGenPanel } from './VideoGenPanel'
import { SocialConnectionsPanel } from './SocialConnectionsPanel'
import { MarketerCalendar } from './calendar/MarketerCalendar'
import { AuthGuard } from './auth/AuthGuard'
import { useAuth } from './auth/useAuth'
import { BrandingSignatureToggle } from './viral/BrandingSignatureToggle'
import { SerpBriefPanel } from './serp/SerpBriefPanel'
import AnalyticsDashboard from './analytics/AnalyticsDashboard'
import { SentimentPanel } from './sentiment/SentimentPanel'
import { PredictiveSchedulePanel } from './predictive/PredictiveSchedulePanel'
import { AutonomousAgentPanel } from './autonomous/AutonomousAgentPanel'
import { TeamPanel } from './team/TeamPanel'
import { PlanGate } from './billing/PlanGate'
import { PricingPage } from './billing/PricingPage'
import { usePlan } from './billing/usePlan'
import { ErrorBoundary } from './components/ErrorBoundary'
import './App.css'

const TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined
const BRAND_API_ORIGIN = import.meta.env.VITE_BRAND_API_ORIGIN as string | undefined

const brandingApiConfig: BrandingApiConfig | null =
  TENANT_ID && BRAND_API_ORIGIN
    ? { tenantId: TENANT_ID, apiOrigin: BRAND_API_ORIGIN }
    : null

type Tab = 'calendar' | 'analytics' | 'ai-studio' | 'campaigns' | 'team' | 'brand' | 'pricing'

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'calendar',   label: 'Calendar',   icon: '▦' },
  { id: 'analytics',  label: 'Analytics',  icon: '◈' },
  { id: 'ai-studio',  label: 'AI Studio',  icon: '⚡' },
  { id: 'campaigns',  label: 'Campaigns',  icon: '◎' },
  { id: 'team',       label: 'Team',       icon: '◉' },
  { id: 'brand',      label: 'Brand',      icon: '◆' },
  { id: 'pricing',    label: 'Pricing',    icon: '◇' },
]

function NavIcon({ id }: { id: Tab }) {
  const icons: Record<Tab, React.ReactNode> = {
    calendar: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="16" height="15" rx="2.5" />
        <path d="M14 1.5v3M6 1.5v3M2 7.5h16" />
        <rect x="5.5" y="10" width="2.5" height="2.5" rx="0.5" fill="currentColor" stroke="none" />
        <rect x="10.5" y="10" width="2.5" height="2.5" rx="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    analytics: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 16l4-5 3.5 3L14 8l4 3" />
        <circle cx="6" cy="11" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="14" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
    'ai-studio': (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="10 2 12.5 8 19 8 14 12.5 16 19 10 15 4 19 6 12.5 1 8 7.5 8" />
      </svg>
    ),
    campaigns: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5L17 4l-3.5 13L10 12z" />
        <path d="M10 12l2 5" />
      </svg>
    ),
    team: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="7" r="3" />
        <path d="M1 18c0-3.3 3.1-6 7-6s7 2.7 7 6" />
        <circle cx="15" cy="7" r="2.5" />
        <path d="M17.5 18c0-2.5 1.5-3.5 1.5-3.5" />
      </svg>
    ),
    brand: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L10 12.6l-4.2 2.4.8-4.7L3.2 7l4.7-.7z" />
      </svg>
    ),
    pricing: (
      <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v1.5M10 12.5V14M8 8.5c0-1.1.9-1.5 2-1.5s2 .5 2 1.5-1 1.5-2 1.5-2 .5-2 1.5.9 1.5 2 1.5 2-.4 2-1.5" />
      </svg>
    ),
  }
  return <>{icons[id]}</>
}

function UserAvatar({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="app-user-menu">
      <button
        className="app-avatar-btn"
        onClick={() => setOpen(o => !o)}
        aria-label="User menu"
        title={email}
      >
        <span className="app-avatar">{initials}</span>
      </button>
      {open && (
        <div className="app-user-dropdown">
          <div className="app-user-email">{email}</div>
          <div className="app-user-divider" />
          <button className="app-user-action" onClick={() => { setOpen(false); onLogout() }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function AppShell() {
  const { theme, setTheme } = useBrandTheme()
  const { state, logout } = useAuth()
  const { plan, isFree } = usePlan()
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  const brandName = theme.displayName.trim() || 'Marketer Pro'
  const userEmail = state.status === 'authenticated' ? state.user.email : ''

  const tenantId = useMemo(() => TENANT_ID ?? (state.status === 'authenticated' ? state.user.tenantId : ''), [state])

  return (
    <div className="app-shell">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <nav className="app-nav">
        <div className="app-nav-left">
          <div className="app-nav-brand">
            {theme.logoUrl && (
              <img
                src={theme.logoUrl}
                alt={brandName}
                className="app-nav-logo"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <span className="app-nav-name">{brandName}</span>
          </div>

          <div className="app-nav-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`app-nav-tab${activeTab === tab.id ? ' app-nav-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <span className="app-nav-tab-icon"><NavIcon id={tab.id} /></span>
                <span className="app-nav-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="app-nav-right">
          <button
            className={`app-free-badge${!isFree ? ' app-free-badge--paid' : ''}`}
            onClick={() => setActiveTab('pricing')}
            title="View pricing plans"
          >
            {plan === 'free' ? 'Free plan' : plan === 'pro' ? 'Pro' : 'Enterprise'}
          </button>
          {userEmail && <UserAvatar email={userEmail} onLogout={logout} />}
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="app-main">
        {activeTab === 'calendar' && (
          <div className="app-canvas">
            <ErrorBoundary label="Calendar">
              <MarketerCalendar />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="app-tab-view">
            <div className="app-tab-header">
              <h1 className="app-tab-title">Analytics</h1>
              <p className="app-tab-sub">Performance insights across all your connected channels.</p>
            </div>
            <div className="app-panel-grid app-panel-grid--wide">
              {tenantId && (
                <>
                  <div className="app-panel-card app-panel-card--full">
                    <div className="app-panel-label">Performance</div>
                    <ErrorBoundary label="Analytics Dashboard">
                      <AnalyticsDashboard tenantId={tenantId} />
                    </ErrorBoundary>
                  </div>
                  <div className="app-panel-card">
                    <div className="app-panel-label">Sentiment & Listening</div>
                    <PlanGate requiredPlan="pro" feature="Sentiment Analysis">
                      <ErrorBoundary label="Sentiment">
                        <SentimentPanel />
                      </ErrorBoundary>
                    </PlanGate>
                  </div>
                  <div className="app-panel-card">
                    <div className="app-panel-label">Best Time to Post</div>
                    <PlanGate requiredPlan="pro" feature="Predictive Scheduling">
                      <ErrorBoundary label="Predictive Schedule">
                        <PredictiveSchedulePanel />
                      </ErrorBoundary>
                    </PlanGate>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'ai-studio' && (
          <div className="app-tab-view">
            <div className="app-tab-header">
              <h1 className="app-tab-title">AI Studio</h1>
              <p className="app-tab-sub">Generate video, research keywords, and draft brand content with AI.</p>
            </div>
            <div className="app-panel-grid">
              <div className="app-panel-card">
                <div className="app-panel-label">Video Generator</div>
                <PlanGate requiredPlan="pro" feature="AI Video Generator">
                  <ErrorBoundary label="Video Generator">
                    <VideoGenPanel />
                  </ErrorBoundary>
                </PlanGate>
              </div>
              <div className="app-panel-card">
                <div className="app-panel-label">SERP Research</div>
                <PlanGate requiredPlan="pro" feature="SERP Keyword Research">
                  <ErrorBoundary label="SERP Research">
                    {tenantId && <SerpBriefPanel apiOrigin={import.meta.env.VITE_SERP_API_ORIGIN as string ?? ''} tenantId={tenantId} />}
                  </ErrorBoundary>
                </PlanGate>
              </div>
              <div className="app-panel-card">
                <div className="app-panel-label">Brand Profile Draft</div>
                <PlanGate requiredPlan="pro" feature="AI Brand Profile Draft">
                  <ErrorBoundary label="Brand Profile Draft">
                    <BrandProfileDraftPanel />
                  </ErrorBoundary>
                </PlanGate>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'campaigns' && (
          <div className="app-tab-view">
            <div className="app-tab-header">
              <h1 className="app-tab-title">Campaigns</h1>
              <p className="app-tab-sub">Manage and publish campaigns autonomously across all platforms.</p>
            </div>
            <div className="app-panel-grid">
              <div className="app-panel-card">
                <div className="app-panel-label">Campaign Sync</div>
                <PlanGate requiredPlan="pro" feature="Campaign Sync & Live Publishing">
                  <ErrorBoundary label="Campaign Sync">
                    <CampaignSyncPanel />
                  </ErrorBoundary>
                </PlanGate>
              </div>
              <div className="app-panel-card">
                <div className="app-panel-label">Autonomous Agent</div>
                <PlanGate requiredPlan="pro" feature="Autonomous Agent">
                  <ErrorBoundary label="Autonomous Agent">
                    <AutonomousAgentPanel />
                  </ErrorBoundary>
                </PlanGate>
              </div>
              <div className="app-panel-card">
                <div className="app-panel-label">Social Connections</div>
                <PlanGate requiredPlan="pro" feature="Social Connections & Publishing">
                  <ErrorBoundary label="Social Connections">
                    <SocialConnectionsPanel />
                  </ErrorBoundary>
                </PlanGate>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="app-tab-view">
            <div className="app-tab-header">
              <h1 className="app-tab-title">Team</h1>
              <p className="app-tab-sub">Manage members, reviews, approvals, and collaboration.</p>
            </div>
            <div className="app-panel-grid app-panel-grid--centered">
              {tenantId && (
                <div className="app-panel-card app-panel-card--wide">
                  <ErrorBoundary label="Team">
                    <TeamPanel tenantId={tenantId} />
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pricing' && (
          <div className="app-tab-view">
            <ErrorBoundary label="Pricing">
              <PricingPage />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'brand' && (
          <div className="app-tab-view">
            <div className="app-tab-header">
              <h1 className="app-tab-title">Brand</h1>
              <p className="app-tab-sub">Configure your workspace theme, logo, and branding settings.</p>
            </div>
            <div className="app-panel-grid app-panel-grid--centered">
              <div className="app-panel-card app-panel-card--wide">
                <div className="app-panel-label">Workspace Theme</div>
                <ErrorBoundary label="Brand Theme">
                  <BrandThemePanel theme={theme} onThemeChange={setTheme} apiConfig={brandingApiConfig} />
                </ErrorBoundary>
              </div>
              {tenantId && (
                <div className="app-panel-card">
                  <div className="app-panel-label">Branding Signature</div>
                  <ErrorBoundary label="Branding Signature">
                    <BrandingSignatureToggle tenantId={tenantId} isPaidPlan={false} />
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        © {new Date().getFullYear()} Marketer Pro
        <span className="sep">·</span>
        <a href="#/privacy">Privacy</a>
        <span className="sep">·</span>
        <a href="#/terms">Terms</a>
        <span className="sep">·</span>
        <a href="mailto:support@marketer.pro">Support</a>
      </footer>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary label="Application">
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    </ErrorBoundary>
  )
}

export default App
