import './legal.css'

interface Props {
  onBack?: () => void
}

export function TermsOfService({ onBack }: Props) {
  return (
    <div className="legal-root">
      <nav className="legal-nav">
        <span className="legal-nav-brand">Marketer Pro</span>
        {onBack && (
          <button className="legal-nav-back" onClick={onBack}>
            ← Back
          </button>
        )}
      </nav>

      <div className="legal-body">
        <p className="legal-eyebrow">Legal</p>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-updated">Last updated: May 18, 2026</p>

        <div className="legal-content">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Marketer Pro (the "Service"), you agree to be bound
            by these Terms of Service ("Terms"). If you do not agree to these Terms,
            do not use the Service. These Terms constitute a legally binding agreement
            between you and Marketer Pro.
          </p>
          <p>
            You must be at least 13 years old (or 16 in the European Economic Area) to
            use the Service. By using the Service, you represent that you meet this age
            requirement.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Marketer Pro is an AI-powered content generation, planning, and scheduling
            platform that allows users to create marketing assets, manage social media
            calendars, and publish content to connected social networks. Features vary
            by subscription plan.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            You must create an account to access the Service. You agree to provide
            accurate, complete information and to keep it up to date. You are responsible
            for maintaining the confidentiality of your credentials and for all activity
            that occurs under your account. Notify us immediately at
            <a href="mailto:support@marketer.pro"> support@marketer.pro</a> if you
            suspect unauthorized access.
          </p>
          <p>
            We reserve the right to suspend or terminate accounts that provide false
            information or violate these Terms.
          </p>

          <h2>4. Subscription Plans and Billing</h2>
          <p>
            The Service is offered under Free, Pro, and Enterprise subscription tiers.
            Paid plans are billed monthly or annually as selected at checkout.
          </p>
          <ul>
            <li><strong>Free:</strong> $0/month. Limited features as described on the pricing page.</li>
            <li><strong>Pro:</strong> $39/month or $29/month billed annually ($348/year).</li>
            <li><strong>Enterprise:</strong> $129/month or custom pricing for larger teams.</li>
          </ul>
          <p>
            All fees are exclusive of applicable taxes. Subscription fees are
            non-refundable except as described in our 14-day money-back guarantee:
            if you are unsatisfied within 14 days of your first paid subscription,
            contact us for a full refund.
          </p>
          <p>
            We may change subscription pricing upon 30 days' notice. Continued use
            after the notice period constitutes acceptance of the new pricing.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable law or regulation.</li>
            <li>Infringe the intellectual property rights of any third party.</li>
            <li>Generate, publish, or distribute hate speech, harassment, misinformation, explicit adult content involving minors, or content that promotes violence.</li>
            <li>Spam or send unsolicited commercial communications.</li>
            <li>Attempt to gain unauthorized access to our systems or other users' accounts.</li>
            <li>Reverse engineer, decompile, or disassemble the Service.</li>
            <li>Use automated means (bots, scrapers) to access the Service in a manner that exceeds normal usage.</li>
            <li>Resell or sublicense access to the Service without our written permission.</li>
          </ul>

          <h2>6. Content and Intellectual Property</h2>
          <p>
            <strong>Your content:</strong> You retain all ownership rights to content
            you upload or create using the Service. By using the Service, you grant
            Marketer Pro a limited, worldwide, royalty-free license to host, store,
            transmit, and display your content solely to provide the Service to you.
          </p>
          <p>
            <strong>AI-generated content:</strong> Content generated using our AI
            features is provided for your use. You are responsible for ensuring
            AI-generated content does not infringe third-party rights before publishing it.
          </p>
          <p>
            <strong>Our content:</strong> The Service, including its design, code,
            trademarks, and non-user-generated content, is the property of Marketer Pro
            and is protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h2>7. Social Network Integrations</h2>
          <p>
            By connecting a social network account, you authorize Marketer Pro to
            publish content to that account on your instruction. You remain solely
            responsible for all content published through the Service and must comply
            with the terms of service of each connected social network.
          </p>
          <p>
            We are not affiliated with or endorsed by Facebook, Instagram, X (Twitter),
            LinkedIn, YouTube, TikTok, Pinterest, Reddit, or Threads.
          </p>

          <h2>8. "Made with Marketer Pro" Branding</h2>
          <p>
            Free plan users' publicly shared content may include a "Made with Marketer Pro"
            attribution. This branding can be removed by upgrading to a paid plan. You
            may not artificially remove or obscure this branding while on the Free plan.
          </p>

          <h2>9. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF
            ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE,
            OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, MARKETER PRO SHALL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
            OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY,
            OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT
            OF YOUR USE OF OR INABILITY TO USE THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM THESE TERMS OR YOUR
            USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS
            PRECEDING THE CLAIM.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Marketer Pro and its officers,
            directors, employees, and agents from any claims, damages, losses, or expenses
            (including reasonable attorneys' fees) arising out of your use of the Service,
            your content, or your violation of these Terms.
          </p>

          <h2>12. Termination</h2>
          <p>
            You may cancel your subscription and delete your account at any time. We
            reserve the right to suspend or terminate your access to the Service, with
            or without notice, for conduct that violates these Terms or is harmful to
            other users, us, or third parties.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. Sections
            6 (IP), 9 (Disclaimers), 10 (Limitation of Liability), and 11 (Indemnification)
            survive termination.
          </p>

          <h2>13. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by the laws of the State of Delaware, United States,
            without regard to conflict-of-law principles. Any disputes arising from these
            Terms or the Service shall be resolved through binding arbitration under the
            American Arbitration Association rules, except that either party may seek
            injunctive relief in a court of competent jurisdiction.
          </p>

          <h2>14. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you of material
            changes by posting the revised Terms in the app and by email. Your continued
            use of the Service after changes become effective constitutes your acceptance
            of the new Terms.
          </p>

          <h2>15. Contact Us</h2>
          <div className="legal-contact-box">
            <p>
              Questions about these Terms? Contact us:<br /><br />
              <strong>Marketer Pro</strong><br />
              Email: <a href="mailto:legal@marketer.pro">legal@marketer.pro</a><br />
              Support: <a href="mailto:support@marketer.pro">support@marketer.pro</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
