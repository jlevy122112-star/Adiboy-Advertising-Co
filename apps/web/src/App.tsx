import { useState } from 'react'
import { BrandProfileDraftPanel } from './BrandProfileDraftPanel'
import { BrandThemePanel, useBrandTheme, type BrandingApiConfig } from './BrandThemePanel'
import { CampaignSyncPanel } from './CampaignSyncPanel'
import { VideoGenPanel } from './VideoGenPanel'
import { SocialConnectionsPanel } from './SocialConnectionsPanel'
import { MarketerCalendar } from './calendar/MarketerCalendar'
import { AuthGuard } from './auth/AuthGuard'
import { ViralDashboard } from './viral/ViralDashboard'
import { BrandingSignatureToggle } from './viral/BrandingSignatureToggle'
import { SerpBriefPanel } from './serp/SerpBriefPanel'
import AnalyticsDashboard from './analytics/AnalyticsDashboard'
import { SentimentPanel } from './sentiment/SentimentPanel'
import { PredictiveSchedulePanel } from './predictive/PredictiveSchedulePanel'
import { AutonomousAgentPanel } from './autonomous/AutonomousAgentPanel'
import { TeamPanel } from './team/TeamPanel'
import './App.css'

const TENANT_ID = import.meta.env.VITE_TENANT_ID as string | undefined
const BRAND_API_ORIGIN = import.meta.env.VITE_BRAND_API_ORIGIN as string | undefined

const brandingApiConfig: BrandingApiConfig | null =
  TENANT_ID && BRAND_API_ORIGIN
    ? { tenantId: TENANT_ID, apiOrigin: BRAND_API_ORIGIN }
    : null

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function AppShell() {
  const { theme, setTheme } = useBrandTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const brandName = theme.displayName.trim() || 'Marketer Pro'

  return (
    <div className="app-shell">
      <nav className="app-nav">
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

        <div className="app-nav-actions">
          <button
            className={`app-nav-toggle${sidebarOpen ? ' app-nav-toggle--active' : ''}`}
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Close settings' : 'Open settings'}
            title={sidebarOpen ? 'Close settings' : 'Open settings'}
          >
            <SettingsIcon />
          </button>
        </div>
      </nav>

      <div className="app-body">
        <main className="app-main">
          <MarketerCalendar />
        </main>

        <aside className={`app-sidebar${sidebarOpen ? ' app-sidebar--open' : ''}`} aria-label="Settings">
          <div className="sidebar-inner">
            <div className="sidebar-section">
              <p className="sidebar-section-title">Brand Theme</p>
              <BrandThemePanel theme={theme} onThemeChange={setTheme} apiConfig={brandingApiConfig} />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Campaign Sync</p>
              <CampaignSyncPanel />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">AI Draft</p>
              <BrandProfileDraftPanel />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Video Generator</p>
              <VideoGenPanel />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Social Connections</p>
              <SocialConnectionsPanel />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Viral Growth</p>
              <ViralDashboard />
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Branding Signature</p>
              {TENANT_ID && <BrandingSignatureToggle tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">SERP Briefs</p>
              {TENANT_ID && <SerpBriefPanel tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Analytics</p>
              {TENANT_ID && <AnalyticsDashboard tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Sentiment &amp; Listening</p>
              {TENANT_ID && <SentimentPanel tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Predictive Scheduling</p>
              {TENANT_ID && <PredictiveSchedulePanel tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Autonomous Agent</p>
              {TENANT_ID && <AutonomousAgentPanel tenantId={TENANT_ID} />}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-section">
              <p className="sidebar-section-title">Team</p>
              {TENANT_ID && <TeamPanel tenantId={TENANT_ID} />}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthGuard>
      <AppShell />
    </AuthGuard>
  )
}

export default App
