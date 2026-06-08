# Marketer Pro Office — Content Generation & Publishing Spec

## Core Principle
**The user controls everything. Nothing posts without explicit user approval.**
Every piece of generated content is fully reviewable and editable before it reaches any platform.

---

## Generation Output — What the AI Must Produce Per Platform

Every generation run produces a `GeneratedContent` object with ALL of the following fields
populated and optimized for the target platform. Nothing is left empty.

```ts
interface GeneratedContent {
  platform: PlatformId
  caption: string           // Full caption, platform char limit respected
  headline?: string         // LinkedIn, YouTube, Pinterest
  hashtags: string[]        // Count optimized per platform
  altText: string           // Accessibility + SEO for every image
  imagePrompt: string       // Exact prompt used for image generation
  imageUrl?: string         // Generated or uploaded image
  thumbnailUrl?: string     // YouTube, TikTok
  videoScript?: string      // TikTok, YouTube Shorts, Reels
  cta: string               // Call to action text
  linkInBio?: string        // Instagram
  firstComment?: string     // Instagram — hashtags in first comment strategy
  articleTitle?: string     // LinkedIn articles
  boardName?: string        // Pinterest
  pinTitle?: string         // Pinterest
  tags?: string[]           // YouTube tags
  categoryId?: string       // YouTube
  visibility: 'public' | 'private' | 'unlisted'
  brandWatermark: boolean
  brandColors: string[]     // Applied palette from user brand
  logoVariant: string       // Which logo variant to overlay
  tagline?: string          // User's brand tagline injected
  scheduledAt?: string      // Optional — user sets this
  status: 'draft'           // Always starts as draft
  optimizationScore: number // 0-100, shown to user
  optimizationNotes: string[] // Specific tips shown to user
}
```

---

## Per-Platform Optimization Rules

### Instagram
- Caption: max 2,200 chars. First 125 chars must hook (shown before "more")
- Hashtags: 3–5 in caption + 20–25 in first comment (NOT in caption)
- Image: 1080×1080 (square), 1080×1350 (portrait), 1080×566 (landscape)
- Reels: 1080×1920, max 90s for feed, 15s hooks perform best
- Stories: 1080×1920, text in safe zone (center 75%)
- Alt text: required, descriptive, 100–125 chars
- CTA: always include (DM, link in bio, save, share)

### TikTok
- Caption: max 2,200 chars but top performers use <150 with strong hook
- Hashtags: 3–5 only — niche + trending mix
- Video: 1080×1920 vertical, 15–60s sweet spot, first 3s must hook
- Thumbnail: high contrast, text overlay, human face if possible
- Script: hook → value → CTA structure, conversational tone
- No external links in caption (they suppress reach)

### YouTube
- Title: 60–70 chars max, keyword at front, power word included
- Description: first 157 chars shown in search — must contain keyword + CTA
- Tags: 10–15 tags, mix exact match + broad + long-tail
- Thumbnail: 1280×720, 2MB max, contrasting colors, <6 words of text
- Chapters: include timestamps in description for videos >5 min
- Cards and end screens noted in script

### X (Twitter)
- Tweet: max 280 chars. Posts with images get 2× engagement — always attach media
- Hashtags: max 2 — one branded, one trending. More hurts reach
- Thread: for longer content, split into numbered chain
- Image: 1200×675 (landscape) or 1200×1200 (square)
- No link shorteners — paste full URL, Twitter wraps it

### LinkedIn
- Post: 1,300–2,000 chars sweet spot. Line breaks every 1–3 sentences
- Hashtags: 3–5, professional/industry focused
- Hook: first line must be compelling — shown before "see more"
- Image: 1200×627 (landscape), 1080×1080 (square)
- Video: landscape preferred, captions required (85% watch muted)
- Articles: SEO-optimized title, 1,500–2,000 words

### Facebook
- Caption: 40–80 chars for images, up to 400 for video — shorter wins
- Hashtags: 2–3 maximum — overuse kills reach on Facebook
- Image: 1200×630 (link), 1080×1080 (square feed)
- Reels: 1080×1920, <60s for best distribution
- Stories: 1080×1920, interactive elements (polls, questions) boost reach
- Schedule: native scheduling supported — surface time picker

### Pinterest
- Pin title: 100 chars max, keyword-rich
- Description: 500 chars, keywords in first sentence, no hashtag spam
- Hashtags: 2–5 only
- Image: 1000×1500 (2:3 ratio) — tall pins get 60% more repins
- Video: 1:1 or 9:16, 15–60s
- Board: auto-suggest most relevant board based on content category
- Text overlay: readable font, brand colors

### Threads
- Post: max 500 chars
- Images: up to 10 per post, 1:1 or 4:5 ratio
- No hashtag algorithm confirmed — use 0–3 contextually
- Conversational, authentic tone outperforms polished brand-speak
- No native scheduling yet — note to user

---

## Brand Injection — Applied to Every Generation

The following brand elements are injected automatically and shown to user for approval:

- **Logo**: watermark overlay, position + opacity user-adjustable
- **Primary color**: dominant color in any generated image palette
- **Secondary/accent colors**: supporting palette
- **Tagline**: appended to caption or used as CTA (user toggles)
- **Brand voice**: tone, formality, banned words, preferred phrases
- **Font style**: noted in image generation prompt
- **Industry/audience**: shapes hashtag selection and caption style

All brand values editable per-generation without changing the workspace brand settings.

---

## Publish Mode — User Chooses How They Want to Work

After generation, the user picks their mode. All three are always available:

### Mode 1 — Auto Schedule & Post
- AI schedules and posts at optimal time for each platform automatically
- User gets notification when each post goes live
- No review required unless user wants it

### Mode 2 — Review Then Post
- User sees full Review Panel before anything publishes
- Every field visible, optimization score shown
- User taps **"Approve & Post"** or **"Approve & Schedule"**
- Nothing posts without that tap

### Mode 3 — Review, Edit, Then Post
- Full Review Panel with every field editable:
  - Caption editor (char counter, platform limit shown)
  - Hashtag editor (drag to reorder, add/remove)
  - Image preview with logo overlay toggle
  - Alt text editor
  - CTA editor
  - Schedule picker
  - Optimization score + improvement tips
- User edits whatever they want, then taps **"Post Now"** or **"Schedule"**

**The user can switch modes at any time. Mode is a per-generation choice, not a locked setting.**

Platform selector always shown — user picks exactly which connected accounts receive the post.

---

## Authentication — User-Scoped Publishing

- Social services receive the **logged-in user's OAuth token** at runtime
- Tokens stored encrypted in Supabase, scoped to `(userId, platform)`
- Never hardcoded, never shared between users
- Token refresh handled silently before publish
- If token expired: user prompted to reconnect, post saved as draft

---

## Optimization Score

Every generated piece shows a score (0–100) and specific actionable notes:
- "Add 2 more hashtags for Instagram (currently 3, optimal is 5)"
- "Caption is 340 chars — consider trimming to <125 for preview"
- "No CTA detected — add one to improve engagement"
- "Image dimensions are 1080×1080 ✓"
- "Brand logo not applied — tap to add watermark"

Score shown in Review Panel. User can ignore or act on each note.
