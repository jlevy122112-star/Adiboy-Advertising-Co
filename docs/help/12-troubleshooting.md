# Troubleshooting & FAQ

This guide covers the most common issues and questions. If you don't find your answer here, contact support at **support@marketerprooffice.com**.

---

## Account & Login

**I forgot my password.**
Tap **Forgot password** on the login screen and enter your email. You'll receive a reset link within a few minutes. Check your spam folder if it doesn't arrive.

**I'm not receiving the email verification.**
Check your spam or junk folder. If it's not there, go back to the login screen and tap **Resend verification email**. Make sure you're checking the inbox for the email address you registered with.

**I can't log in — it says my session has expired.**
Sessions expire after 30 days of inactivity. Tap **Sign in** and log in again. If you were previously logged in and the session expired unexpectedly, this may be because you changed your password on another device — log in with your new password.

**I want to delete my account.**
Go to **Settings → Account → Delete Account**. Read the confirmation carefully — account deletion is permanent and removes all your data including brands, artifacts, and progression. There is a 30-day grace period after which deletion is irreversible.

---

## Generation & Cinematic Sequence

**The Vault Door isn't appearing when I tap Generate.**
Ensure you have a stable internet connection. The cinematic sequence requires an active session. Try force-closing and reopening the app.

**The Reactor lever isn't working.**
The lever is locked until all three switches (Brand Intel, Audience, AI Core) are turned on. Make sure all three switches are in the up/on position before attempting to pull the lever.

**I'm stuck on the loading screen in the Presentation Chamber.**
The Presentation Chamber waits for the AI generation to complete. If this takes more than 60 seconds, it likely indicates a network issue or a temporary service disruption. Tap **Return to Desk** — your artifact may have been saved to the Artifact Vault even if the Chamber didn't display it.

**I got "Reactor Failure" in the Presentation Chamber.**
This means the AI generation API call failed. Most common causes:
1. No internet connection — check your connection and retry
2. Temporary service outage — check our status page at status.marketerprooffice.com
3. Request was too long — try a shorter brief (under 200 characters)

**My artifacts are low quality / generic.**
This almost always means your Brand Identity or Audience isn't fully set up. Go to the Brand Identity Chamber and complete all three fields (logo, colours, tone). Then go to the Audience Arena and collect at least 4–6 traits. Regenerate with a more specific brief.

**How many times can I generate per day?**
Free plan: 10 total per month. Pro: unlimited. There is no daily limit on Pro — only the monthly limit on Free.

---

## Scheduling & Calendar

**My scheduled post didn't publish.**
The post will show a red dot in the Calendar Drawer. Tap it to see the error. Common causes: platform token expired (reconnect in Integrations), content rejected by the platform (check for policy violations), or media upload failed (re-attach the image).

**The calendar is showing the wrong timezone.**
Go to **Settings → Account → Timezone** and set your timezone manually. The calendar defaults to your device timezone, which may not match your target audience's timezone.

**I scheduled a post but it doesn't appear in the calendar.**
Pull down on the Calendar Drawer to refresh it. If it still doesn't appear, check **Settings → Billing** — draft posts are not shown in the calendar if your account is on Free and the artifact is older than 30 days.

**Can I schedule the same post to multiple platforms at different times?**
Not in the current version. When you schedule an artifact, it goes to all connected platforms at the same time. Platform-specific scheduling is on the product roadmap.

---

## Social Integrations

**Instagram says "This account is not a Business or Creator account."**
Instagram's publishing API requires a Professional account. In the Instagram app go to: Settings → Account → Switch to Professional Account. Select Creator or Business and follow the setup.

**My LinkedIn Company Page isn't showing up in Integrations.**
You must be a Page Admin on the LinkedIn Company Page to post to it. Verify your admin status in LinkedIn's Page Admin settings. Then reconnect your LinkedIn account in Marketer Pro Office.

**My platform token keeps expiring.**
Some platforms (particularly Instagram/Facebook) expire tokens after 60 days or when you change your platform password. Go to Integrations → disconnect → reconnect to refresh the token. If this happens repeatedly, check that your social media account doesn't have unusual security activity.

---

## Progression & Rewards

**I generated content but didn't receive XP.**
XP is awarded when the generation completes successfully (i.e. artifacts appear in the Presentation Chamber). If you aborted the sequence or got a Reactor Failure, no XP is awarded. Check your current XP in Settings → Progression.

**My streak reset even though I generated yesterday.**
Streaks update at midnight in your local timezone. If you generated just before midnight and the app updated the streak after midnight, it may have counted as today, not yesterday. Check Settings → Account → Timezone to ensure your device timezone is correct.

**I didn't receive a lootbox after levelling up.**
Lootboxes are awarded with a short delay after a level-up to allow the level-up animation to complete. Check the notification bell in the Workspace Header — a lootbox notification should appear within a few seconds of levelling up.

**A cosmetic I unlocked isn't showing in my office.**
Go to **Settings → Office → Customise** and apply the cosmetic manually. Cosmetics are unlocked but not auto-applied to allow you to choose which ones to display.

---

## App Performance

**The cinematic animations are stuttering or slow.**
The cinematic sequence uses GPU-accelerated animations. Try:
1. Close other apps running in the background
2. Ensure your device has at least 20% battery (performance throttling can affect animations at low battery)
3. Restart the app

Supported minimum specs: iPhone 11 / Android equivalent (2019 or newer device recommended for full visual fidelity).

**The app is using a lot of battery.**
The animated desk background and particle effects are the primary battery consumers. Reduce effects at **Settings → Display → Reduce Motion**, which switches to static backgrounds and disables particle animations.

**The app crashed.**
Force-close and reopen the app. If it crashes repeatedly on a specific screen, try: Settings → Account → Clear App Data (this does not delete your brands or artifacts — only local cache). If the issue persists, contact support with your device model and iOS/Android version.

---

## Privacy & Data

**How do I download my data?**
Go to **Settings → Privacy → Data & Exports → Request Data Export**. You'll receive an email within 48 hours with a downloadable JSON file of all your account data — brands, artifacts, analytics, and progression.

**How do I delete my data?**
Go to **Settings → Privacy → Data & Exports → Request Data Deletion**, or email privacy@marketerprooffice.com. We will complete deletion within 30 days as required by GDPR.

**Does the AI use my content to train its models?**
No. Your brand data, audience data, content briefs, and generated artifacts are never used to train AI models. See our [Data Processing Agreement](../data-processing-agreement.md) for details.

---

## Contact Support

**In-app:** Settings → Help → Contact Support

**Email:** support@marketerprooffice.com

**Response times:**
- Free plan: within 5 business days
- Pro plan: within 2 business days
- Enterprise plan: within 4 business hours (priority SLA)

**What to include in your support request:**
- Your account email
- Device model and OS version
- App version (Settings → About → Version)
- A description of the issue and steps to reproduce it
- A screenshot or screen recording if applicable
