import { BrandProfileDraftPanel } from './BrandProfileDraftPanel'
import { BrandThemePanel, useBrandTheme } from './BrandThemePanel'
import { CampaignSyncPanel } from './CampaignSyncPanel'
import { MarketerCalendar } from './calendar/MarketerCalendar'
import './App.css'

function App() {
  const { theme, setTheme } = useBrandTheme()

  const brandName = theme.displayName.trim() || 'Marketer Pro'

  return (
    <div className="marketer-shell">
      <header className="marketer-hero">
        {/* Brand logo + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', marginBottom: 12 }}>
          {theme.logoUrl && (
            <img
              src={theme.logoUrl}
              alt={`${brandName} logo`}
              style={{ height: 48, maxWidth: 160, objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <p className="marketer-kicker" style={{ margin: 0 }}>{brandName}</p>
        </div>

        <h1 className="marketer-title" style={theme.primaryHex ? { color: theme.primaryHex } : {}}>
          Plan, personalize, ship
        </h1>
        <p className="marketer-lead">
          {theme.tagline.trim() || 'Calendar and brand tools below run locally in the browser until API sync is connected.'}
        </p>
      </header>

      <MarketerCalendar />

      <div className="marketer-divider" aria-hidden />

      <CampaignSyncPanel />

      <div className="marketer-divider" aria-hidden />

      <BrandThemePanel theme={theme} onThemeChange={setTheme} />

      <div className="marketer-divider" aria-hidden />

      <BrandProfileDraftPanel />

      <footer className="marketer-foot">
        <a href="https://vite.dev/" target="_blank" rel="noreferrer">
          Vite
        </a>
        <span aria-hidden> · </span>
        <a href="https://react.dev/" target="_blank" rel="noreferrer">
          React
        </a>
      </footer>
    </div>
  )
}

export default App
