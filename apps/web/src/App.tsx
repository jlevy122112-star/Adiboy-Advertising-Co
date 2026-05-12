import { BrandProfileDraftPanel } from './BrandProfileDraftPanel'
import { CampaignSyncPanel } from './CampaignSyncPanel'
import { MarketerCalendar } from './calendar/MarketerCalendar'
import './App.css'

function App() {
  return (
    <div className="marketer-shell">
      <header className="marketer-hero">
        <p className="marketer-kicker">Marketer Pro</p>
        <h1 className="marketer-title">Plan, personalize, ship</h1>
        <p className="marketer-lead">
          Calendar and brand tools below run locally in the browser until API
          sync is connected.
        </p>
      </header>

      <MarketerCalendar />

      <div className="marketer-divider" aria-hidden />

      <CampaignSyncPanel />

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
