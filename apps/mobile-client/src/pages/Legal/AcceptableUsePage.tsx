import { useNavigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';

interface SectionProps { title: string; children: React.ReactNode; }
const Section = ({ title, children }: SectionProps) => (
  <div className="space-y-3">
    <h2 className="font-heading text-sm font-semibold text-slate-200 tracking-wide">{title}</h2>
    <div className="text-sm text-slate-400 font-body leading-relaxed space-y-2">{children}</div>
  </div>
);

const AllowedItem = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2.5">
    <CheckCircle2 className="w-4 h-4 text-emerald-500/70 flex-shrink-0 mt-0.5" />
    <span className="text-sm text-slate-400">{text}</span>
  </div>
);

const ForbiddenItem = ({ text }: { text: string }) => (
  <div className="flex items-start gap-2.5">
    <XCircle className="w-4 h-4 text-red-500/70 flex-shrink-0 mt-0.5" />
    <span className="text-sm text-slate-400">{text}</span>
  </div>
);

export const AcceptableUsePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-void-900 safe-top">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-void-900/95 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="font-display text-base tracking-[0.15em] text-classified">ACCEPTABLE USE</p>
          <p className="font-classified text-[9px] tracking-[0.2em] text-slate-600">LAST UPDATED 1 JANUARY 2026</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8 safe-bottom">
        <Section title="What This Is">
          <p>This policy defines what you can and cannot do with Marketer Pro Office and the content you generate using it. Violations may result in account suspension or termination.</p>
        </Section>

        <Section title="Permitted Uses">
          <div className="space-y-2 pt-1">
            <AllowedItem text="Creating and scheduling content for brands you own or are authorised to manage" />
            <AllowedItem text="Generating marketing copy, captions, hashtags, and creative briefs" />
            <AllowedItem text="Publishing to social platforms you own or have explicit permission to post to" />
            <AllowedItem text="Analysing performance metrics for your own campaigns" />
            <AllowedItem text="Collaborating with team members in an Enterprise organisation account" />
          </div>
        </Section>

        <Section title="Prohibited Content">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-classified mb-2">You must not generate or publish content that:</p>
          <div className="space-y-2">
            <ForbiddenItem text="Violates any law or infringes intellectual property, privacy, or other legal rights" />
            <ForbiddenItem text="Constitutes harassment, abuse, threats, or targeted harm" />
            <ForbiddenItem text="Promotes or glorifies violence, self-harm, or harm to others" />
            <ForbiddenItem text="Exploits, harms, or endangers minors in any way" />
            <ForbiddenItem text="Is sexually explicit or pornographic" />
            <ForbiddenItem text="Promotes hatred or discrimination against any group" />
            <ForbiddenItem text="Is intentionally deceptive, impersonates real people or brands without authorisation, or constitutes spam" />
            <ForbiddenItem text="Spreads health misinformation or promotes fraudulent products" />
            <ForbiddenItem text="Violates the terms of service of the social platforms you post to" />
          </div>
        </Section>

        <Section title="Prohibited System Uses">
          <div className="space-y-2">
            <ForbiddenItem text="Attempting to reverse-engineer, decompile, or extract the source code of the app" />
            <ForbiddenItem text="Using bots or automation to abuse the API beyond normal use" />
            <ForbiddenItem text="Attempting to bypass content filters, safety systems, or rate limits" />
            <ForbiddenItem text="Using the Service to train or develop competing AI systems" />
            <ForbiddenItem text="Sharing your account credentials with unauthorised users" />
          </div>
        </Section>

        <Section title="Your Responsibility for AI Content">
          <p>You are solely responsible for reviewing all AI-generated content before publishing it. The AI engine generates suggestions — you are the publisher. We implement content filters but they are not infallible. Ensure all content complies with this policy and applicable platform rules before publishing.</p>
        </Section>

        <Section title="Consequences of Violation">
          <p>Depending on severity, we may issue a warning, remove content, temporarily suspend your account, or permanently terminate your account without refund. Serious violations involving illegal content or child safety will be reported to relevant authorities.</p>
        </Section>

        <Section title="Report a Violation">
          <p>If you encounter content or behaviour that violates this policy: <span className="text-classified">safety@marketerprooffice.com</span></p>
        </Section>

        <Section title="Full Policy">
          <p>The complete Acceptable Use Policy is available at: <span className="text-classified">marketerprooffice.com/legal/acceptable-use</span></p>
        </Section>
      </div>
    </div>
  );
};
