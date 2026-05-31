import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shield, ExternalLink } from 'lucide-react';

interface PolicyItem {
  title: string;
  description: string;
  route?: string;
  url?: string;
  updatedAt: string;
}

const POLICIES: PolicyItem[] = [
  {
    title: 'Privacy Policy',
    description: 'How we collect, use, and protect your personal data.',
    route: '/privacy',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Terms of Use',
    description: 'The rules and conditions for using Marketer Pro Office.',
    route: '/terms',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Cookie Policy',
    description: 'How we use local storage and session tokens.',
    route: '/legal/cookies',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Acceptable Use Policy',
    description: 'What content and behaviour is and is not permitted.',
    route: '/legal/acceptable-use',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Refund Policy',
    description: 'How subscription refunds work on iOS, Android, and Enterprise.',
    url: 'https://marketerprooffice.com/legal/refunds',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Data Processing Agreement',
    description: 'GDPR Article 28 DPA for users who process personal data through our Service.',
    url: 'https://marketerprooffice.com/legal/dpa',
    updatedAt: '1 Jan 2026',
  },
  {
    title: 'Security Policy',
    description: 'Our security practices, responsible disclosure, and incident response.',
    url: 'https://marketerprooffice.com/security',
    updatedAt: '1 Jan 2026',
  },
];

export const LegalIndexPage = () => {
  const navigate = useNavigate();

  const handleTap = (policy: PolicyItem) => {
    if (policy.route) {
      navigate(policy.route);
    } else if (policy.url) {
      window.open(policy.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-void-900 safe-top">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-void-900/95 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="font-display text-base tracking-[0.15em] text-classified">LEGAL</p>
          <p className="font-classified text-[9px] tracking-[0.2em] text-slate-600">POLICIES & AGREEMENTS</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 safe-bottom">
        {/* Badge */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-classified/20 bg-classified/5">
          <div className="w-9 h-9 rounded-xl bg-classified/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-classified" />
          </div>
          <div>
            <p className="text-sm font-heading text-slate-300">Your rights are protected</p>
            <p className="text-xs text-slate-500 mt-0.5 font-body">
              All our policies comply with GDPR, CCPA, and App Store / Google Play requirements.
            </p>
          </div>
        </div>

        {/* Policy list */}
        <div className="space-y-1.5">
          {POLICIES.map((policy, i) => (
            <motion.button
              key={policy.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleTap(policy)}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-all text-left group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading text-slate-300 group-hover:text-slate-100 transition-colors">
                  {policy.title}
                </p>
                <p className="text-xs text-slate-600 mt-0.5 font-body line-clamp-1">
                  {policy.description}
                </p>
                <p className="text-[10px] text-slate-700 mt-1 font-classified tracking-wider">
                  Updated {policy.updatedAt}
                </p>
              </div>
              {policy.url ? (
                <ExternalLink className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
              )}
            </motion.button>
          ))}
        </div>

        {/* Contact footer */}
        <div className="space-y-1 pt-2">
          <p className="font-classified text-[10px] tracking-[0.2em] text-slate-600 uppercase px-1">
            Legal Enquiries
          </p>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1">
            {[
              { label: 'Privacy',    email: 'privacy@marketerprooffice.com'    },
              { label: 'Legal',      email: 'legal@marketerprooffice.com'      },
              { label: 'Security',   email: 'security@marketerprooffice.com'   },
              { label: 'DPA / GDPR', email: 'dpa@marketerprooffice.com'        },
            ].map(({ label, email }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-xs text-slate-500 font-heading w-20">{label}</span>
                <span className="text-xs text-classified/70 font-classified tracking-wide">{email}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
