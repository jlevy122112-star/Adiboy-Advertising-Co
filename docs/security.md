# Security Policy

**Last updated:** 1 January 2026

---

## 1. Our Commitment

Marketer Pro Office is committed to protecting the security and privacy of user data. This document describes our security practices, responsible disclosure process, and how we respond to incidents.

---

## 2. Infrastructure Security

### 2.1 Hosting
All production infrastructure is hosted on Supabase and cloud providers with SOC 2 Type II and ISO 27001 certifications. We use separate environments for development, staging, and production. No real user data is used in development or staging environments.

### 2.2 Network Security
- All data in transit is encrypted using TLS 1.3 or higher
- HTTP requests are redirected to HTTPS at the infrastructure level
- HSTS (HTTP Strict Transport Security) is enabled with a minimum max-age of 1 year
- Our API is not directly accessible from the internet without authentication

### 2.3 Data Encryption
- All Personal Data is encrypted at rest using AES-256
- Authentication tokens and secrets are stored using platform secure storage (iOS Keychain, Android EncryptedSharedPreferences)
- Database backups are encrypted before storage
- Encryption keys are managed separately from encrypted data

---

## 3. Application Security

### 3.1 Authentication
- All API endpoints require a valid JWT authentication token except public health check and legal endpoints
- JWTs are short-lived (1 hour) with secure refresh token rotation (90-day sliding window)
- Refresh tokens are invalidated on logout and support remote revocation via Settings → Security → Sign Out All Devices
- Brute force protection is applied to all authentication endpoints (10 requests per 15 minutes per IP)

### 3.2 Authorisation
- All API endpoints enforce ownership checks — users can only access their own data
- Enterprise organisation members can only access shared vaults within their own organisation
- Admin endpoints require both authentication and a verified admin role flag
- The principle of least privilege is applied to all internal service accounts

### 3.3 Rate Limiting
- Standard API endpoints: 300 requests per 15 minutes per IP
- Content generation endpoints: 20 requests per 15 minutes per user
- Authentication endpoints: 10 requests per 15 minutes per IP
- Rate limit violations return HTTP 429 with a `Retry-After` header

### 3.4 Input Validation
- All user inputs are validated and sanitised server-side before processing
- AI generation prompts are filtered for prompt injection attempts
- File uploads (brand logos, assets) are validated for type and size before processing

### 3.5 Dependency Management
- Dependencies are audited using automated tooling on every pull request and weekly scheduled scans
- Critical security patches are applied within 24 hours of disclosure
- High severity patches are applied within 7 days

---

## 4. AI Provider Security

When user data (brand names, audience traits, content briefs) is sent to AI providers for content generation:

- Only the minimum necessary data is included in prompts
- We do not include personally identifiable information in AI prompts
- All AI providers are bound by data processing agreements that prohibit using submitted data for model training
- Prompt content is not stored by AI providers beyond the immediate API request

---

## 5. Access Controls

- All internal access to production systems requires multi-factor authentication
- Access to production databases is restricted to named engineers on a need-to-know basis and is logged
- All production access is audited and reviewed quarterly
- Employee offboarding includes immediate revocation of all system access

---

## 6. Audit Logging

The following actions are logged to a tamper-resistant audit log with timestamp, user ID, action, resource, and IP address:

- Authentication events (login, logout, failed attempts, token refresh)
- Content generation requests
- Social platform connection and disconnection events
- Schedule confirmations
- Lootbox openings
- Admin configuration changes
- Account deletion requests

Audit logs are retained for 12 months.

---

## 7. Incident Response

In the event of a security incident:

1. Our security team is notified immediately via automated alerting
2. The incident is triaged and classified by severity within 1 hour
3. Affected systems are isolated within 4 hours if necessary
4. For incidents involving Personal Data, affected users are notified within 72 hours as required by GDPR
5. A post-incident report is produced for all P0 (critical) incidents within 14 days

To report a security incident or suspicious activity: **security@marketerprooffice.com**

---

## 8. Responsible Disclosure

We welcome reports from security researchers who discover vulnerabilities in our Service.

### 8.1 Scope
In scope: the Marketer Pro Office mobile application, our backend API (`api.marketerprooffice.com`), and our admin dashboard.

Out of scope: third-party services we use (Supabase, AI providers), social engineering attacks, physical attacks, denial-of-service attacks.

### 8.2 How to Report
Email **security@marketerprooffice.com** with:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Any proof-of-concept (no exploitation of real user data)

### 8.3 Our Commitments
- We will acknowledge receipt of your report within 48 hours
- We will provide an initial assessment within 7 days
- We will not pursue legal action against researchers acting in good faith under this policy
- We will publicly credit researchers (with permission) once the vulnerability is resolved

### 8.4 Our Requests
- Do not access, modify, or delete user data beyond what is necessary to demonstrate the vulnerability
- Do not disclose the vulnerability publicly until we have had a reasonable opportunity to remediate it (typically 90 days)

---

## 9. Compliance

Marketer Pro Office is designed and operated in compliance with:

- General Data Protection Regulation (GDPR) — EU 2016/679
- California Consumer Privacy Act (CCPA)
- Apple App Store Review Guidelines (security requirements)
- Google Play Developer Program Policies (security requirements)

---

## 10. Contact

**Security reports:** security@marketerprooffice.com
**General privacy:** privacy@marketerprooffice.com
**DPA enquiries:** dpa@marketerprooffice.com
