import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface SectionProps { title: string; children: React.ReactNode; }
const Section = ({ title, children }: SectionProps) => (
  <div className="space-y-3">
    <h2 className="font-heading text-sm font-semibold text-slate-200 tracking-wide">{title}</h2>
    <div className="text-sm text-slate-400 font-body leading-relaxed space-y-2">{children}</div>
  </div>
);

interface TableRow { tech: string; purpose: string; duration: string; }
const PolicyTable = ({ rows }: { rows: TableRow[] }) => (
  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
    <div className="grid grid-cols-3 bg-white/[0.02] border-b border-white/[0.06]">
      {['Technology', 'Purpose', 'Duration'].map(h => (
        <div key={h} className="px-3 py-2 font-classified text-[9px] tracking-widest text-slate-600 uppercase">{h}</div>
      ))}
    </div>
    {rows.map((row, i) => (
      <div key={i} className="grid grid-cols-3 border-b border-white/[0.04] last:border-0">
        <div className="px-3 py-2 font-mono text-[11px] text-classified/70">{row.tech}</div>
        <div className="px-3 py-2 text-xs text-slate-500">{row.purpose}</div>
        <div className="px-3 py-2 text-xs text-slate-600">{row.duration}</div>
      </div>
    ))}
  </div>
);

export const CookiePolicyPage = () => {
  const navigate = useNavigate();

  const necessaryRows: TableRow[] = [
    { tech: 'session_token',     purpose: 'Authenticates your login session',                          duration: '30 days'    },
    { tech: 'auth_refresh',      purpose: 'Silently refreshes your session',                           duration: '90 days'    },
    { tech: 'brand_id',          purpose: 'Remembers last active brand workspace',                     duration: 'Persistent' },
    { tech: 'onboarding_complete', purpose: 'Prevents onboarding from repeating',                     duration: 'Persistent' },
  ];

  const functionalRows: TableRow[] = [
    { tech: 'desk_layout_prefs', purpose: 'Remembers panel open/closed state',                        duration: 'Persistent' },
    { tech: 'calendar_view_month', purpose: 'Remembers last viewed month',                            duration: 'Session'    },
    { tech: 'artifact_filter',   purpose: 'Remembers last selected artifact filter',                  duration: 'Session'    },
    { tech: 'theme_preference',  purpose: 'Stores your selected office theme',                        duration: 'Persistent' },
  ];

  const analyticsRows: TableRow[] = [
    { tech: 'anon_session_id',   purpose: 'Aggregates feature usage anonymously',                     duration: 'Session only' },
    { tech: 'feature_counts',    purpose: 'Counts how often features are used (aggregated)',           duration: '90 days'      },
  ];

  return (
    <div className="min-h-screen bg-void-900 safe-top">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-void-900/95 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="font-display text-base tracking-[0.15em] text-classified">COOKIE POLICY</p>
          <p className="font-classified text-[9px] tracking-[0.2em] text-slate-600">LAST UPDATED 1 JANUARY 2026</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8 safe-bottom">
        <Section title="What We Use">
          <p>Marketer Pro Office uses local storage and secure session tokens — not traditional browser cookies — to make the app function. We do not use third-party advertising cookies or cross-site tracking.</p>
        </Section>

        <Section title="Strictly Necessary">
          <p>Required for the app to work. Cannot be disabled.</p>
          <PolicyTable rows={necessaryRows} />
        </Section>

        <Section title="Functional">
          <p>Improve your experience by remembering preferences. Cleared on logout or by going to Settings → Account → Clear App Data.</p>
          <PolicyTable rows={functionalRows} />
        </Section>

        <Section title="Anonymous Analytics">
          <p>Help us understand how the app is used. No data is linked to your identity. Disable at Settings → Privacy → Analytics.</p>
          <PolicyTable rows={analyticsRows} />
        </Section>

        <Section title="What We Do Not Use">
          <p>We do not use advertising cookies, cross-app tracking identifiers (IDFA / AAID), social media pixels, or browser fingerprinting. We do not share any tracking data with advertising networks.</p>
        </Section>

        <Section title="Your Choices">
          <p>Clear all local data: <strong className="text-slate-300">Settings → Account → Clear App Data</strong></p>
          <p>Sign out all devices: <strong className="text-slate-300">Settings → Security → Sign Out All Devices</strong></p>
          <p>Disable analytics: <strong className="text-slate-300">Settings → Privacy → Analytics</strong></p>
        </Section>

        <Section title="Contact">
          <p>For questions about this policy: <span className="text-classified">privacy@marketerprooffice.com</span></p>
        </Section>
      </div>
    </div>
  );
};
