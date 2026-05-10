---
name: Marketer Pro Design Plan
overview: "Design a bold-growth, balanced-responsive UX plan for Marketer Pro focused on the core v1 flow: generate content, schedule month, publish first post, then track status and first engagement."
todos:
  - id: design-tokens
    content: Define bold-growth design tokens for type, color roles, spacing, and status states.
    status: completed
  - id: screen-wireframes
    content: Create wireframes for Dashboard, Campaign Workspace, Calendar, Publish Status, and Notifications.
    status: completed
  - id: responsive-rules
    content: Define mobile and desktop layout rules for each key screen.
    status: completed
  - id: state-matrix
    content: Document UX state matrix (empty/loading/success/failure/retry) for each core flow step.
    status: completed
  - id: implementation-sequence
    content: Implement UI in flow order and validate that first-engagement alert loop is visible end-to-end.
    status: completed
isProject: false
---

# Marketer Pro Design Plan

## Design Goal
Create a cohesive product design system and page flow that makes campaign execution feel fast and confident for solo operators while supporting both mobile and desktop equally.

## Product UX Scope (v1)
- Core flow: `Generate -> Schedule Month -> Publish First -> Status -> First Engagement Alert`.
- Channels in UI language: Facebook, Instagram, LinkedIn, TikTok, plus EDDM planning.
- Keep v1 promise-focused: no deep analytics surfaces in first pass.

## Information Architecture
- **Primary navigation:** Dashboard, Campaigns, Calendar, Channels, EDDM, Notifications, Settings.
- **Campaign detail as hub:** brief, generated variants, schedule timeline, publish controls, post status, engagement milestone.
- **Responsive behavior:**
  - Mobile: stacked cards, sticky bottom action rail.
  - Desktop: split-pane workspace (content left, calendar/status right).

## Visual System (Bold Growth)
- **Tone:** energetic but trustworthy; high contrast CTAs, clear state colors.
- **Typography:** strong display headline + highly legible body copy.
- **Color roles:**
  - Primary action (generate/publish)
  - Secondary action (schedule/edit)
  - Status colors (scheduled/published/failed/engaged)
- **Component priorities:** campaign cards, status chips, schedule calendar cells, publish progress rows, engagement alert tiles.

## Key Screens to Design First
- Dashboard with “start campaign” and first-engagement summary.
- Campaign brief + AI generation workspace.
- Monthly scheduling calendar with auto-fill suggestions.
- First-post publish confirmation + immediate status feedback.
- Notifications center with first-engagement event and retry paths.

## Interaction and State Design
- Define explicit UX states for each step:
  - Empty, in-progress, success, failure, retry.
- Add microcopy for confidence:
  - What happened, what is next, and what to do if failed.
- Ensure keyboard/focus accessibility and touch targets for PWA use.

## Handoff and Implementation Plan
- Build design tokens first (type scale, spacing, color roles, radii, shadow levels).
- Implement layout primitives before feature components.
- Ship screens in flow order to avoid orphan UI:
  1) Generate,
  2) Schedule,
  3) Publish,
  4) Status,
  5) Engagement alert.

## Files to Anchor During Build
- [apps/web/src/App.tsx](apps/web/src/App.tsx) as initial flow composition shell.
- [apps/web/src/index.css](apps/web/src/index.css) for base tokens and global styles.
- [apps/web/src/App.css](apps/web/src/App.css) for feature-level layout/component styling.
- [apps/web/src/main.tsx](apps/web/src/main.tsx) for app bootstrap and top-level wrappers.
- [docs/master-multi-agent-prompt.md](docs/master-multi-agent-prompt.md) for product/design alignment language.