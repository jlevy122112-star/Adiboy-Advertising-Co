# Marketer Pro - AI Agent Constitution

> This file is read by every AI agent, every coding session, and every developer
> that touches this codebase. It is the single source of truth for all product
> decisions. No exceptions. No deviations without explicit approval.

---

## The North Star

**A brand new user opens Marketer Pro for the very first time and walks away
having published at least one perfectly formatted post on each social platform
they selected - all within their first session.**

This is the only metric that matters at launch.

---

## The Golden Rule

> The user should NEVER have to think about what to do next.

Every screen must answer 3 questions in under 2 seconds:
1. Where am I?
2. What can I do here?
3. What should I do next?

If a screen fails any of these 3 questions - it must be fixed before anything
else is built on top of it.

---

## App Navigation Structure

The app has exactly 4 tabs. No more. Ever.

| Tab | Contains | User Intent |
|-----|----------|-------------|
| Create | AI Studio, Content Brief Generator, all 8 platform studios | I want to make something |
| Plan | Calendar, Campaign Manager, Post Scheduler | I want to organize my content |
| Analyze | Analytics, Sentiment, Predictive, SERP | I want to see how I am doing |
| Settings | Brand Profile, Team, Billing, Account | I want to configure my account |

### Rules
- Never add a 5th tab without explicit product approval
- Never move a feature to a tab that does not match its user intent
- Mobile bottom nav shows all 4 tabs always - no hiding or collapsing

---

## The Complete User Journey

Every feature built must belong to one of these 6 phases.
If it does not fit a phase - it does not get built yet.

### Phase 1 - Onboarding (first launch only)
Collects brand intelligence so the AI can generate on-brand content immediately.
- What are you promoting
- Brand name, logo, colors, personality
- Problem solved and solution offered
- Contact channels
- Industry, target audience, competitors, best content examples

**Rule:** After onboarding completes, user lands on Create tab with one
prominent button: "Generate Your First Post". Never show an empty screen.

### Phase 2 - Content Generation
User controls 12 parameters before hitting Generate:
1. Platforms to post on
2. Duration per platform
3. Contact points to display
4. Topic and tagline
5. Solution highlight for this post
6. Audience exclusions
7. Response deadline
8. Logo visibility
9. Content goal
10. Call to action
11. Hashtag strategy
12. Post urgency

**Rule:** All 12 controls must be present and functional before this phase
is considered complete.

### Phase 3 - Review and Approval
- All generated posts shown side by side, one per platform
- Each post renders as a realistic platform preview
- One tap approve, one tap edit, one tap reject
- Rejected posts can be regenerated immediately

**Rule:** Nothing goes live without passing through this phase.
Auto-publish without review is only available in autonomous mode
and must be explicitly enabled by the user.

### Phase 4 - Schedule and Publish
- Post now or pick a date and time
- AI suggests optimal posting times
- Posts appear on calendar after scheduling
- One clearly labeled Publish button - no ambiguity

### Phase 5 - Performance Tracking
- Automatic tracking of likes, comments, shares, clicks
- Results shown in plain English - not raw numbers
- Every metric below standard has a recommended action attached
- Cross-platform comparison always visible

### Phase 6 - Rate and Learn
- Thumbs up or thumbs down after every post after post lifecycle is completed
- User can flag: wrong tone, factually incorrect, off brand
- AI adjusts all future generations based on feedback
- The longer a user uses the app, the better the output
- Develop and build a database of successful posts as templates for future use

---

## AI Content Generation Rules

### Brand Context - Always Injected
Every single AI generation call MUST include the full brand profile:
- Brand name and industry
- Tagline and slogan
- Mission and value proposition
- Brand voice and tone
- Target audience profile
- Competitors to differentiate from
- Brand primary color
- Logo image

**Rule:** Never generate content without brand context.
Generic content is a product failure.

### Platform Specifications - Always Enforced
| Platform | Character Limit | Key Rules |
|----------|----------------|-----------|
| Instagram | 2,200 caption, 30 hashtags | Square/portrait/story formats |
| Facebook | 63,206 characters | Link previews, event formats |
| X (Twitter) | 280 per tweet | Thread support, no hashtag stuffing |
| LinkedIn | 3,000 characters | Professional tone required |
| TikTok | 150 caption | Video script format |
| YouTube | 100 title, 5,000 description | SEO optimized, chapter markers |
| Pinterest | 100 title, 500 description | Vertical 2:3 ratio |
| Snapchat | 250 characters | 24hr story format |

---

## Supported Platforms

Marketer Pro supports exactly these 8 platforms at launch:
1. Instagram
2. Facebook
3. X (formerly Twitter)
4. LinkedIn
5. TikTok
6. YouTube
7. Pinterest
8. Snapchat

**Rule:** Do not add a 9th platform until all 8 are fully
tested and working end to end in production.

---

## Feature Checklist

Every new feature MUST answer YES to all 5 questions before
any code is written:

- [ ] Which phase of the user journey does this belong to?
- [ ] Which of the 4 tabs does it live in?
- [ ] Does the user know what to do next after using it?
- [ ] Does it have a help document written or planned?
- [ ] Is it consistent with the brand system?

If any answer is NO - stop and resolve it before writing code.

---

## Brand System Rules

- Brand logo must appear in: top nav, calendar header, analytics header,
  team panel header, all platform studio panels
- Brand primary color applies to: all CTA buttons, active states,
  progress indicators, highlights
- Brand accent color applies to: secondary buttons, hover states, badges
- Logo upload accepts: PNG, JPG, SVG via drag and drop or file picker
- Logo is stored as base64 in localStorage under key: marketer-brand-theme
- useBrandTheme() hook is the ONLY way to access brand data in components
- buildBrandContextForAI() MUST be called in every generation request

---

## Design System Rules

Based on Facebook Design System (FDS) principles:
- Atomic component design - every element is a reusable building block template
- Cross-platform consistency - iOS and Android must look and feel identical
- Accessibility - minimum 44x44pt touch targets on all interactive elements
- Dark mode - fully supported via CSS variables, never hardcode colors
- No more than 4 primary navigation items at any level
- Every empty state has an illustration, a message, and a CTA button
- Loading states use skeleton screens - never blank white flashes or loading circles
- Animations between 200-500ms - no jarring transitions

---

## Git Commit Convention

Every commit must follow this format:

```
[Phase N - Name] Short description of what was built or fixed

Examples:
[Phase 1 - Onboard] Add logo file upload to brand intake step 2
[Phase 2 - Generate] Add audience exclusion control to generation form
[Phase 3 - Review] Build realistic Instagram platform preview card
[Phase 4 - Publish] Wire optimal time suggestions to schedule picker
[Phase 5 - Track] Add plain English performance summary to analytics
[Phase 6 - Learn] Add thumbs up/down rating prompt after post goes live
```

---

## App Store Targets

| Store | Platform | Priority |
|-------|----------|----------|
| Google Play Store | Android | 1 - Launch first |
| Apple App Store | iOS | 2 - After Android |
| Amazon Appstore | Android / Fire OS | 3 |
| Microsoft Store | Windows via PWA | 4 |

---

## What AI Agents Must Never Do

- Never add a 5th navigation tab
- Never generate content without brand context
- Never show an empty screen to a new user
- Never build a feature that does not belong to one of the 6 phases
- Never auto-publish without user approval unless autonomous mode is on
- Never hardcode colors - always use CSS variables
- Never store API keys or secrets in frontend code
- Never remove the user journey phases from the onboarding flow
- Never skip writing a help document for a completed feature
- Never build on iOS-only features that break Android parity

---

## Reference Documents

- Master Product Blueprint: Marketer-Pro-Master-Blueprint-v2.docx
- Target Architecture: marketer-pro-target-architecture.md
- Go-Live Readiness: go-live-readiness.md
- Reconstruction Source of Truth: Reconstruction Source of Truth.md

---

*Marketer Pro - Confidential & Proprietary*
*This file must remain in the root of the repository at all times.*
*Last updated: May 2026 - Version 1.0*
