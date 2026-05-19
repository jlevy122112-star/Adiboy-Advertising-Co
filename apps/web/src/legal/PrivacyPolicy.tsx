import './legal.css'

interface Props {
  onBack?: () => void
}

export function PrivacyPolicy({ onBack }: Props) {
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
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-updated">Last updated: May 18, 2026</p>

        <div className="legal-content">
          <h2>1. Introduction</h2>
          <p>
            Marketer Pro ("we," "us," or "our") operates the Marketer Pro application
            (the "Service"). This Privacy Policy explains how we collect, use, disclose,
            and safeguard your information when you use our Service. Please read this
            policy carefully. If you disagree with its terms, please discontinue use of
            the Service.
          </p>

          <h2>2. Information We Collect</h2>
          <p>We collect information you provide directly to us:</p>
          <ul>
            <li><strong>Account information:</strong> email address, password (stored as a salted hash — we never store your plaintext password), and workspace name.</li>
            <li><strong>Brand content:</strong> brand names, logos, colors, copy, images, and other creative assets you upload or generate.</li>
            <li><strong>Social account connections:</strong> OAuth tokens for connected social networks (Facebook, Instagram, X, LinkedIn, YouTube, TikTok, Pinterest, Reddit, Threads). Tokens are encrypted at rest using AES-256 and never exposed outside our API servers.</li>
            <li><strong>Payment information:</strong> billing details are processed by Stripe. We do not store full card numbers; we retain only the last four digits and billing address for your records.</li>
            <li><strong>Usage data:</strong> log data, device type, browser type, IP address, pages visited, and actions taken within the Service.</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, operate, and improve the Service.</li>
            <li>Authenticate your identity and protect your account.</li>
            <li>Publish content to your connected social accounts on your instruction.</li>
            <li>Send transactional emails (account confirmation, password reset, publish notifications).</li>
            <li>Respond to your comments, questions, and support requests.</li>
            <li>Monitor and analyze usage and trends to improve your experience.</li>
            <li>Detect, investigate, and prevent fraudulent transactions and other illegal activities.</li>
            <li>Comply with applicable laws and regulations.</li>
          </ul>

          <h2>4. Sharing of Information</h2>
          <p>We do not sell, trade, or rent your personal information to third parties. We may share information with:</p>
          <ul>
            <li><strong>Service providers:</strong> third-party vendors who perform services on our behalf (cloud hosting, payment processing, email delivery, AI generation). These parties are contractually obligated to keep your information confidential.</li>
            <li><strong>Social platforms:</strong> when you instruct us to publish content, we transmit that content to the platforms you authorize. Their own privacy policies govern what they do with it.</li>
            <li><strong>Law enforcement:</strong> when required by law or to protect the rights, safety, and property of Marketer Pro and its users.</li>
            <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, your information may be transferred. We will notify you before your information is transferred and becomes subject to a different privacy policy.</li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We retain your account information for as long as your account is active or
            as needed to provide services. You may request deletion of your account and
            associated data at any time by emailing <a href="mailto:privacy@marketer.pro">privacy@marketer.pro</a>.
            We will process deletion requests within 30 days, subject to legal retention
            obligations.
          </p>

          <h2>6. Security</h2>
          <p>
            We implement commercially reasonable technical and organizational measures
            to protect your information against unauthorized access, alteration, disclosure,
            or destruction. These include TLS encryption in transit, AES-256 encryption
            for OAuth tokens at rest, argon2id password hashing, and short-lived JWT
            access tokens (15-minute expiry) with rotating refresh tokens.
          </p>
          <p>
            No method of transmission over the Internet or electronic storage is 100%
            secure. We cannot guarantee absolute security.
          </p>

          <h2>7. Your Rights</h2>
          <p>Depending on your location, you may have rights to:</p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate or incomplete data.</li>
            <li>Request deletion of your data ("right to be forgotten").</li>
            <li>Object to or restrict processing of your data.</li>
            <li>Data portability — receive your data in a machine-readable format.</li>
            <li>Withdraw consent at any time where processing is based on consent.</li>
          </ul>
          <p>
            To exercise these rights, contact us at <a href="mailto:privacy@marketer.pro">privacy@marketer.pro</a>.
            We may need to verify your identity before fulfilling a request.
          </p>

          <h2>8. Children's Privacy</h2>
          <p>
            The Service is not directed at children under 13 (or under 16 in the EU).
            We do not knowingly collect personal information from children. If you believe
            a child has provided us with personal information, contact us immediately and
            we will delete it.
          </p>

          <h2>9. Third-Party Links</h2>
          <p>
            The Service may contain links to third-party websites. We are not responsible
            for the privacy practices of those sites and encourage you to review their
            privacy policies.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of
            material changes by posting the new policy in the app and, where appropriate,
            by email. Your continued use of the Service after changes become effective
            constitutes your acceptance of the revised policy.
          </p>

          <h2>11. Contact Us</h2>
          <div className="legal-contact-box">
            <p>
              If you have questions or concerns about this Privacy Policy, please contact us:<br /><br />
              <strong>Marketer Pro</strong><br />
              Email: <a href="mailto:privacy@marketer.pro">privacy@marketer.pro</a><br />
              Support: <a href="mailto:support@marketer.pro">support@marketer.pro</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
