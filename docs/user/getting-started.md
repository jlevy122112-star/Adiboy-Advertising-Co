# Marketer-Pro — getting started (user)

This guide is for **end users** operating the product (not developers).

## Account

- Sign up or sign in using the methods your workspace enables (email/password, Sign in with Apple, Google OAuth — exact options depend on deployment).

## Connect channels

- Open **Channels** (or equivalent) in the web app.
- Connect **Meta**, **X**, **TikTok**, or **LinkedIn** using the provider buttons and complete OAuth in the browser.
- If a connection fails, note the on-screen hint (denied permission, missing app configuration, etc.) and retry after fixing credentials.

## Typical workflow

1. Create or select a **workspace**.
2. Define a **campaign** or content brief.
3. **Generate** drafts (AI-assisted where enabled).
4. **Schedule** slots on the calendar.
5. **Publish** — the system enqueues or executes publish jobs per provider rules.

## Troubleshooting (short)

| Symptom | What to try |
|---------|-------------|
| “Not connected” for a network | Re-run OAuth for that channel; confirm redirect URLs match deployment. |
| Post did not appear | Check schedule time, provider quotas, and token expiry; reconnect if needed. |
| Rate limit errors | Reduce frequency or upgrade provider/API tier where applicable. |

_For FAQ-sized topics intended for in-app help, see [../help/README.md](../help/README.md)._
