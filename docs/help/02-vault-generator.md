# The Vault Generator

The Vault Generator is the core of Marketer Pro Office. It uses a three-act cinematic sequence to generate AI-powered marketing content — copy, captions, hashtags, and variations — tailored to your brand and audience.

---

## Overview

The generation flow has three acts, each lasting under a second:

```
Generator Form → Vault Door (Act I) → Reactor Control (Act II) → Presentation Chamber (Act III)
```

While you interact with the cinematic sequence, the AI is generating your content in parallel in the background. By the time you reach the Presentation Chamber, your artifacts are ready.

---

## Step 1 — The Generator Form

Open the Generator Form by tapping the **Generate** button (gold wand) in the Quick Actions Bar.

### Platforms
Select the social platforms you want content generated for. You can select multiple platforms at once. The AI will tailor the output format and style for each platform.

| Platform | Content style |
|---|---|
| **Instagram** | Visual-first, punchy captions, heavy hashtag use |
| **Facebook** | Longer form, community-oriented, link-friendly |
| **TikTok** | Short, punchy, trend-aware, hook-first |
| **LinkedIn** | Professional, insight-driven, minimal hashtags |
| **X (Twitter)** | Concise, conversational, thread-friendly |

### Content Type
Choose the format of content you need:
- **Post** — standard feed post
- **Ad** — paid advertising copy with a call-to-action focus
- **Script** — short-form video script for Reels, TikToks, or Stories

### Goal / Brief
Write a short brief for what you want this content to achieve. The clearer and more specific your brief, the better the AI output.

**Good brief examples:**
- "Announce our new summer collection — focus on the limited availability and the vibrant colour palette"
- "Drive sign-ups to our free webinar on Thursday — key benefit is learning to grow on LinkedIn in 30 minutes a day"
- "Re-engage dormant customers with a loyalty offer — 20% off, no minimum spend, valid for 48 hours"

**Weak brief examples:**
- "Post about our product"
- "Something for Instagram"

### Firing the Reactor
Once you've set platforms, content type, and brief, tap **Fire the Reactor**. The Generator Form closes and Act I begins.

---

## Step 2 — Act I: The Vault Door

The Vault Door is the entry to the classified content generation sequence.

**What you see:**
- A circular vault door with rotating lock bolts
- A biometric fingerprint scanner in the centre
- Atmospheric fog and classified gold lighting

**What to do:**
Tap the **fingerprint scanner** in the centre of the vault door. The scanner reads your biometric, the lock bolts rotate, and the door opens.

> The vault door also auto-triggers after a short delay if you don't tap it manually.

**Duration:** approximately 0.6 seconds

---

## Step 3 — Act II: Reactor Control

The Reactor Control Room is where you arm the AI generation systems.

**What you see:**
- Three switches labelled **Brand Intel**, **Audience**, and **AI Core**
- A lever on the right
- A reactor glow that intensifies as you flip each switch

**What to do:**

1. Tap each of the three switches to flip them on. The order doesn't matter — all three must be on before you can pull the lever.
2. Once all three switches are green/lit, the lever glows gold.
3. Pull the lever down.
4. The reactor fires — a brief blue flash fills the screen.

**Why this matters:** Each switch represents a data source the AI uses:
- **Brand Intel** — your brand identity (logo, colours, tone)
- **Audience** — your defined audience traits
- **AI Core** — the generation model itself

If you need to abort — tap the **Abort** text at the bottom before pulling the lever. This cancels the generation and returns you to the Desk.

**Duration:** approximately 0.9 seconds

---

## Step 4 — Act III: The Presentation Chamber

The Presentation Chamber is where your generated content is revealed as classified artifacts.

**What you see:**
- A dramatic briefcase slam onto a metal table
- The briefcase opens to reveal your artifacts
- Artifact cards arranged in a classified document style

**The artifacts:**

| Artifact | What it contains |
|---|---|
| **Copy Dossier** | 3–5 full-length copy variations |
| **Caption File** | Platform-optimised captions for each selected platform |
| **Hashtag Set** | Curated hashtag groups — broad, niche, and branded |
| **Variations** | Alternative angles and tones for the same brief |
| **Visual Assets** | Image generation prompts (or generated images on Pro) |

**What to do:**
Tap any artifact card to open it. From the artifact view you can:
- **Use Artifact** — copy the content or send it to a scheduled post
- **Schedule** — open the Scheduler Tower to schedule this artifact
- **Save to Vault** — all artifacts are auto-saved, but this pins the artifact for easy access

Tap **Return to Desk** to close the Chamber without selecting an artifact. All artifacts are saved to the [Artifact Vault](./06-artifact-vault.md) automatically.

---

## Generation Limits

| Plan | Generations per month |
|---|---|
| Free | 10 |
| Pro | Unlimited |
| Enterprise | Unlimited + shared team pool |

Your remaining generations (on Free) are shown in **Settings → Billing**. Upgrade to Pro for unlimited generations.

---

## Tips for Better Generations

- **Set up your Brand Identity Chamber first.** The AI uses your brand tone, colours, and logo context to shape the output. Skipping this gives generic results.
- **Define your audience first.** Audience traits (demographics, psychographics, behaviours) are fed directly into the generation prompt.
- **Be specific in your brief.** Mention the product, the offer, the emotion you want to evoke, and the action you want the audience to take.
- **Generate multiple times.** Each generation uses a different creative seed. If the first round isn't right, fire the reactor again with a refined brief.
- **Use Variations.** The Variations artifact gives you the same brief approached from different angles — tone, structure, and framing.

---

## Troubleshooting

**The reactor animation is slow or stuttering**
The cinematic sequence is GPU-accelerated. Close other apps running in the background and ensure your device has adequate charge. Older devices (iPhone 11 / equivalent) may show slightly slower animations.

**My artifacts didn't appear in the Presentation Chamber**
If the API call is still in progress when the sequence finishes, a loading indicator appears. Wait a few seconds — do not close the Chamber. If loading takes more than 30 seconds, tap **Return to Desk** and check the Artifact Vault — the content may have saved there.

**I got "Reactor Failure"**
This means the AI generation request failed. Common causes: no internet connection, or a temporary service outage. Tap **Return to Desk** and try again. If the issue persists, contact support.
