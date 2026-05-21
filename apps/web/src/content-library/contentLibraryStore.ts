import { useState, useEffect } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Platform =
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'tiktok'
  | 'linkedin'
  | 'youtube'
  | 'pinterest'
  | 'snapchat';

export type ContentFormat =
  | 'feed_post'
  | 'story'
  | 'reel'
  | 'carousel'
  | 'short'
  | 'video'
  | 'pin'
  | 'snap'
  | 'article'
  | 'ad'
  | 'thread'
  | 'poll';

export type LibraryItemSource = 'template' | 'saved' | 'ai_generated' | 'imported';

export interface LibraryItem {
  id: string;
  platform: Platform;
  format: ContentFormat;
  title: string;
  body: string;
  hashtags: string[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  source: LibraryItemSource;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  isFavorite: boolean;
}

// ─── Platform Meta ────────────────────────────────────────────────────────────

export const PLATFORM_META: Record<
  Platform,
  { label: string; icon: string; color: string; textColor?: string; formats: ContentFormat[] }
> = {
  instagram: {
    label: 'Instagram',
    icon: '📸',
    color: '#d6249f',
    formats: ['feed_post', 'story', 'reel', 'carousel'],
  },
  facebook: {
    label: 'Facebook',
    icon: '📘',
    color: '#1877F2',
    formats: ['feed_post', 'story', 'video', 'carousel', 'ad', 'poll'],
  },
  x: {
    label: 'X',
    icon: '✕',
    color: '#000000',
    formats: ['feed_post', 'thread', 'poll', 'ad'],
  },
  tiktok: {
    label: 'TikTok',
    icon: '♪',
    color: '#010101',
    formats: ['short', 'video', 'story'],
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'in',
    color: '#0A66C2',
    formats: ['feed_post', 'article', 'video', 'poll', 'ad'],
  },
  youtube: {
    label: 'YouTube',
    icon: '▶',
    color: '#FF0000',
    formats: ['video', 'short'],
  },
  pinterest: {
    label: 'Pinterest',
    icon: '𝑃',
    color: '#E60023',
    formats: ['pin'],
  },
  snapchat: {
    label: 'Snapchat',
    icon: '👻',
    color: '#FFFC00',
    textColor: '#000',
    formats: ['snap', 'story'],
  },
};

// ─── Format Labels ────────────────────────────────────────────────────────────

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  feed_post: 'Feed Post',
  story: 'Story',
  reel: 'Reel',
  carousel: 'Carousel',
  short: 'Short',
  video: 'Video',
  pin: 'Pin',
  snap: 'Snap',
  article: 'Article',
  ad: 'Ad',
  thread: 'Thread',
  poll: 'Poll',
};

// ─── Seed Templates ───────────────────────────────────────────────────────────

const D = '2026-01-01T00:00:00.000Z';

export const SEED_TEMPLATES: LibraryItem[] = [
  // ── Instagram ──────────────────────────────────────────────────────────────
  {
    id: 'tpl-ig-1',
    platform: 'instagram',
    format: 'feed_post',
    title: 'Product Launch Announcement',
    body: "The wait is finally over. ✨ Introducing the newest drop from [BRAND] — designed for people who refuse to settle. We've obsessed over every detail so you don't have to. Tap the link in bio to be first in line. Limited quantities available.",
    hashtags: ['#NewDrop', '#[BRAND]', '#JustLaunched', '#MustHave', '#ShopNow'],
    source: 'template',
    tags: ['launch', 'product', 'announcement'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-ig-2',
    platform: 'instagram',
    format: 'story',
    title: 'Behind-the-Scenes Teaser',
    body: "👀 Something big is coming from [BRAND]. Swipe up for a sneak peek at what we've been working on behind closed doors. Your feed is about to get a whole lot better.",
    hashtags: ['#BehindTheScenes', '#[BRAND]', '#ComingSoon', '#Sneak'],
    source: 'template',
    tags: ['bts', 'teaser', 'story'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-ig-3',
    platform: 'instagram',
    format: 'reel',
    title: 'How-To Tutorial Reel',
    body: "3 ways to use [BRAND] that you probably haven't tried yet 🙌 Watch till the end for the game-changer tip. Save this for later and share it with someone who needs to see this!",
    hashtags: ['#HowTo', '#[BRAND]Tips', '#Tutorial', '#LifeHack', '#LearnOnReels'],
    source: 'template',
    tags: ['tutorial', 'how-to', 'education'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-ig-4',
    platform: 'instagram',
    format: 'carousel',
    title: 'Top 5 Benefits Carousel',
    body: "Swipe → to see why thousands of people are switching to [BRAND] 💡\n\nSlide 1: The problem everyone ignores\nSlide 2: What makes [BRAND] different\nSlide 3: Real results, real people\nSlide 4: How to get started\nSlide 5: Limited-time offer inside 👀",
    hashtags: ['#[BRAND]', '#SwipeRight', '#TopTips', '#GlowUp', '#Transformation'],
    source: 'template',
    tags: ['carousel', 'education', 'benefits'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── Facebook ───────────────────────────────────────────────────────────────
  {
    id: 'tpl-fb-1',
    platform: 'facebook',
    format: 'feed_post',
    title: 'Community Engagement Post',
    body: "We started [BRAND] because we believed things could be done better — and our community proved us right every single day. 💙\n\nDrop a ❤️ if you've been with us from the beginning, or tell us in the comments: how did you first discover [BRAND]? We love hearing your stories.",
    hashtags: ['#[BRAND]Community', '#ThankYou', '#OurStory'],
    source: 'template',
    tags: ['community', 'engagement', 'brand story'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-fb-2',
    platform: 'facebook',
    format: 'video',
    title: 'Customer Testimonial Video',
    body: "\"I honestly didn't expect [BRAND] to change my routine this much.\" — Real words from a real customer 🎥\n\nWatch how [Name] went from skeptic to superfan in under 30 days. Full story in the video. Share this with someone who needs to hear it. 👇",
    hashtags: ['#CustomerLove', '#[BRAND]', '#Testimonial', '#RealResults'],
    source: 'template',
    tags: ['testimonial', 'video', 'social proof'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-fb-3',
    platform: 'facebook',
    format: 'poll',
    title: 'Audience Preference Poll',
    body: "Quick question for the [BRAND] community! 🗳️\n\nWe're working on something new and YOUR opinion matters. Which would you love to see from us next?\n\n🔵 Option A: [Feature/Product 1]\n🟣 Option B: [Feature/Product 2]\n\nVote below and tell us WHY in the comments — best suggestion wins early access!",
    hashtags: ['#[BRAND]Poll', '#YouDecide', '#Community'],
    source: 'template',
    tags: ['poll', 'engagement', 'audience research'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-fb-4',
    platform: 'facebook',
    format: 'ad',
    title: 'Flash Sale Ad Copy',
    body: "⚡ FLASH SALE — 48 hours only!\n\n[BRAND] is offering [X]% off our best-sellers, and this deal disappears at midnight Sunday. No code needed — discount applied automatically at checkout.\n\nDon't overthink it. Your future self will thank you. Click below to shop before it's gone.",
    hashtags: ['#FlashSale', '#[BRAND]', '#LimitedTime', '#Sale'],
    source: 'template',
    tags: ['sale', 'ad', 'promotion', 'urgent'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── X ─────────────────────────────────────────────────────────────────────
  {
    id: 'tpl-x-1',
    platform: 'x',
    format: 'feed_post',
    title: 'Hot Take / Bold Claim',
    body: "Controversial opinion: most [industry] advice is designed to keep you busy, not successful.\n\n[BRAND] was built on the opposite idea. Less noise. More results.\n\nChange my mind. 👇",
    hashtags: ['#HotTake', '#[BRAND]', '#Unpopular Opinion'],
    source: 'template',
    tags: ['opinion', 'engagement', 'brand voice'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-x-2',
    platform: 'x',
    format: 'thread',
    title: 'Value Thread — Industry Insights',
    body: "Everything I know about [industry] that took me 5 years to learn (thread 🧵):\n\n1/ The biggest mistake people make is [insight 1]. Here's why it matters...\n\n2/ [BRAND] learned early on that [insight 2]. Most people skip this step.\n\n3/ The counterintuitive truth: [insight 3]. Yes, really.\n\n4/ If I had to start over, I'd do [action] first. Every time.\n\n5/ Bookmark this. Your competitors won't. (That's the point.)",
    hashtags: ['#Thread', '#[BRAND]', '#[IndustryTips]'],
    source: 'template',
    tags: ['thread', 'value', 'education', 'thought leadership'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-x-3',
    platform: 'x',
    format: 'poll',
    title: 'Debate-Starter Poll',
    body: "The eternal [industry] debate. We need to settle this once and for all.\n\nWhich camp are you in?\n\n🔵 [Option A]\n🟣 [Option B]\n\nVoting closes in 24 hours. RT to let your followers weigh in.",
    hashtags: ['#[BRAND]', '#Poll', '#YouDecide'],
    source: 'template',
    tags: ['poll', 'engagement', 'debate'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-x-4',
    platform: 'x',
    format: 'ad',
    title: 'Promoted Post — Direct Offer',
    body: "If you've been on the fence about [BRAND], this is your sign. 👇\n\nFirst-time customers get [X]% off + free [bonus]. No tricks, no subscription required.\n\n[Link] — offer ends [date].",
    hashtags: ['#[BRAND]', '#LimitedOffer'],
    source: 'template',
    tags: ['ad', 'offer', 'direct response'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── TikTok ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-tt-1',
    platform: 'tiktok',
    format: 'short',
    title: 'POV Trending Hook',
    body: "POV: You just discovered [BRAND] and now you can't stop telling everyone about it 😭✨\n\nFor real though — why did nobody tell me this existed sooner? Drop a 🔥 if you know the feeling. Full review in comments!",
    hashtags: ['#POV', '#[BRAND]', '#TikTokMadeMeBuyIt', '#MustHave', '#Obsessed'],
    source: 'template',
    tags: ['pov', 'trending', 'discovery'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-tt-2',
    platform: 'tiktok',
    format: 'video',
    title: 'Unboxing / First Impression',
    body: "Unboxing [BRAND] for the first time and my reaction says it all 📦😱\n\nI was NOT expecting this level of quality. The packaging alone?? Chef's kiss. Keep watching for the full first impression — spoiler: I'm obsessed. Comment your questions and I'll answer them all!",
    hashtags: ['#Unboxing', '#[BRAND]', '#FirstImpression', '#TikTokReview', '#GiftIdeas'],
    source: 'template',
    tags: ['unboxing', 'review', 'first impression'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-tt-3',
    platform: 'tiktok',
    format: 'story',
    title: '24-Hour Challenge Story',
    body: "I used ONLY [BRAND] for 24 hours straight. Here's what happened 👀\n\nHour 1: [reaction]\nHour 6: [shift]\nHour 12: [surprise]\nHour 24: I'm never going back.\n\nFull recap dropping tomorrow. Save this so you don't miss it!",
    hashtags: ['#24HourChallenge', '#[BRAND]', '#Challenge', '#TikTokTrend'],
    source: 'template',
    tags: ['challenge', 'story', 'series'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  {
    id: 'tpl-li-1',
    platform: 'linkedin',
    format: 'feed_post',
    title: 'Founder Story / Origin Post',
    body: "Two years ago, I quit my [role] job to build [BRAND]. Everyone thought I was crazy.\n\nHere's what they didn't see:\n\n→ The [industry] problem was costing businesses $[X] per year in wasted [resource].\n→ Existing solutions were built for enterprises, not growing teams.\n→ The market was ready — it just needed the right approach.\n\nToday, [BRAND] serves [X] customers in [Y] countries. And we're just getting started.\n\nThe lesson? The best opportunities are hiding inside the problems everyone else complains about but nobody solves.\n\nWhat problem are you working on? Drop it in the comments.",
    hashtags: ['#Entrepreneurship', '#StartupStory', '#[BRAND]', '#Founder', '#BuildInPublic'],
    source: 'template',
    tags: ['founder story', 'brand building', 'thought leadership'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-li-2',
    platform: 'linkedin',
    format: 'article',
    title: 'Industry Insight Long-Form Article',
    body: "The [industry] landscape is shifting faster than most teams can adapt. Here's what the data actually shows — and what [BRAND] is doing about it.\n\n**The problem with conventional wisdom**\nFor years, the industry mantra has been [conventional approach]. It sounds logical. It rarely works.\n\n**What we found instead**\nAfter working with [X]+ companies, [BRAND] identified three patterns that consistently separate high-performers from the rest:\n\n1. [Pattern 1] — teams that prioritize [X] see [Y]% better outcomes.\n2. [Pattern 2] — the counterintuitive case for [approach].\n3. [Pattern 3] — why [assumption] is costing you more than you think.\n\n**The path forward**\nThe organizations winning right now aren't necessarily the biggest or best-funded. They're the most adaptive. [BRAND] was designed to give every team — regardless of size — that adaptive advantage.\n\nWant to see the full benchmark report? Link in comments.",
    hashtags: ['#[Industry]', '#[BRAND]', '#Insights', '#Leadership', '#Innovation'],
    source: 'template',
    tags: ['article', 'thought leadership', 'industry insight'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-li-3',
    platform: 'linkedin',
    format: 'poll',
    title: 'Professional Opinion Poll',
    body: "Quick question for my network — I'm curious where professionals actually stand on this.\n\nWhen evaluating a new tool like [BRAND], what matters most to you?\n\n🔵 Time to value (how fast it works)\n🟣 Integration with existing stack\n🟡 Pricing transparency\n🟢 Quality of customer support\n\nVoting takes 2 seconds. The results might surprise you — sharing them next week with full breakdown.",
    hashtags: ['#[BRAND]', '#Poll', '#B2B', '#ProfessionalDevelopment'],
    source: 'template',
    tags: ['poll', 'b2b', 'research', 'engagement'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-li-4',
    platform: 'linkedin',
    format: 'ad',
    title: 'Lead Gen Ad — Free Resource',
    body: "We turned 2 years of [industry] data into a free guide — and it's available to download today.\n\n📊 The [BRAND] [Industry] Benchmark Report includes:\n\n✓ [X] metrics tracked across [Y] companies\n✓ The top 3 levers that drive [outcome]\n✓ A 90-day implementation roadmap\n✓ Real case studies with real numbers\n\nNo fluff. No gated upsell. Just the data.\n\nDownload free → [Link]",
    hashtags: ['#FreeResource', '#[BRAND]', '#[Industry]', '#Data'],
    source: 'template',
    tags: ['lead gen', 'ad', 'free resource', 'b2b'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── YouTube ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-yt-1',
    platform: 'youtube',
    format: 'video',
    title: 'In-Depth Review / Deep Dive',
    body: "I tested [BRAND] for 30 days straight — and the results were NOT what I expected.\n\nIn this video I'm covering everything: the good, the not-so-good, and whether it's actually worth your money in [year].\n\n📌 Chapters:\n00:00 — Why I decided to test this\n02:15 — First impressions & setup\n07:40 — Real-world testing (days 1–10)\n14:20 — The turning point (what changed)\n21:00 — Final verdict & my honest score\n\nIf this helped you, smash that like button and subscribe — I drop honest reviews every week.",
    hashtags: ['#[BRAND]Review', '#HonestReview', '#IsItWorthIt'],
    source: 'template',
    tags: ['review', 'deep dive', 'youtube'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-yt-2',
    platform: 'youtube',
    format: 'short',
    title: 'Quick Tip YouTube Short',
    body: "The [BRAND] trick nobody talks about 👇 (under 60 seconds)\n\nMost people use [BRAND] the basic way. But if you do THIS instead, you'll get [benefit] in half the time.\n\nSave this short and try it today. More tips every week — subscribe so you don't miss them!",
    hashtags: ['#[BRAND]', '#QuickTip', '#Shorts', '#LifeHack', '#LearnSomethingNew'],
    source: 'template',
    tags: ['tip', 'shorts', 'quick', 'education'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-yt-3',
    platform: 'youtube',
    format: 'video',
    title: 'Tutorial — Getting Started Guide',
    body: "New to [BRAND]? This is the only getting-started guide you'll need in [year].\n\nI've watched hundreds of new users make the same 3 mistakes — so in this video, I'm walking you through the exact setup process that gets you to [result] in under [timeframe].\n\n📌 What's covered:\n00:00 — Welcome & what to expect\n01:30 — Account setup done right\n05:00 — The 3 features to use first\n11:20 — Common beginner mistakes (avoid these)\n17:00 — Your first [milestone] walkthrough\n\nTimestamps in the comments. Questions? Drop them below — I read every one.",
    hashtags: ['#[BRAND]Tutorial', '#GetStarted', '#Beginners', '#HowTo'],
    source: 'template',
    tags: ['tutorial', 'beginners', 'how-to', 'onboarding'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── Pinterest ──────────────────────────────────────────────────────────────
  {
    id: 'tpl-pt-1',
    platform: 'pinterest',
    format: 'pin',
    title: 'Inspirational Lifestyle Pin',
    body: "The [aesthetic/lifestyle] you've been curating, elevated. ✨\n\n[BRAND] makes it effortless to bring your vision to life — whether you're building a mood board, a morning routine, or an entirely new chapter.\n\nSave this pin for your [board name] board. Because inspiration deserves a permanent home.",
    hashtags: ['#[BRAND]', '#[Aesthetic]Inspo', '#SaveForLater', '#[Lifestyle]Goals', '#Curated'],
    source: 'template',
    tags: ['lifestyle', 'inspiration', 'aesthetic'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-pt-2',
    platform: 'pinterest',
    format: 'pin',
    title: 'Step-by-Step How-To Pin',
    body: "How to [achieve result] with [BRAND] in 5 simple steps 📌\n\nStep 1: [Action]\nStep 2: [Action]\nStep 3: [Action]\nStep 4: [Action]\nStep 5: [Final result — the wow moment]\n\nSave this pin and share it with someone who needs a simpler way to [goal]. You'll thank yourself later.",
    hashtags: ['#HowTo', '#[BRAND]', '#StepByStep', '#DIY', '#SaveThisPin'],
    source: 'template',
    tags: ['how-to', 'tutorial', 'step-by-step'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-pt-3',
    platform: 'pinterest',
    format: 'pin',
    title: 'Product Feature Showcase Pin',
    body: "[BRAND] — the [product/tool] that actually does what it promises. 🌿\n\nHere's what makes it different:\n• [Feature 1] — [short benefit]\n• [Feature 2] — [short benefit]\n• [Feature 3] — [short benefit]\n\nSave this to your [relevant board] and click through for the full details. Limited stock available.",
    hashtags: ['#[BRAND]', '#ProductDesign', '#WishList', '#ShopNow', '#[Category]'],
    source: 'template',
    tags: ['product', 'showcase', 'features'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },

  // ── Snapchat ───────────────────────────────────────────────────────────────
  {
    id: 'tpl-sc-1',
    platform: 'snapchat',
    format: 'snap',
    title: 'Exclusive Deal Snap',
    body: "Psst — this one's just for Snapchat 👻\n\n[BRAND] is dropping a SECRET deal ONLY for our Snap fam. Use code SNAP[X] for [Y]% off — good for the next 24 hours ONLY.\n\nDon't screenshot, just shop 😂 Link in bio!",
    hashtags: ['#[BRAND]', '#SnapExclusive', '#SecretDeal', '#SnapFam'],
    source: 'template',
    tags: ['deal', 'exclusive', 'snap', 'urgent'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-sc-2',
    platform: 'snapchat',
    format: 'story',
    title: 'Day-in-the-Life Brand Story',
    body: "A day in the life with [BRAND] 👀✨\n\nMorning: [scene 1]\nAfternoon: [scene 2 — show the product in use]\nEvening: [scene 3 — the result]\n\nThis is the life. And it starts with [BRAND]. Link to shop in our bio — you deserve this.",
    hashtags: ['#DayInTheLife', '#[BRAND]', '#Lifestyle', '#SnapStory'],
    source: 'template',
    tags: ['day in the life', 'story', 'lifestyle', 'brand'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
  {
    id: 'tpl-sc-3',
    platform: 'snapchat',
    format: 'snap',
    title: 'New Arrival Snap Alert',
    body: "🚨 NEW DROP ALERT 🚨\n\nJust landed: [BRAND]'s newest [product/collection]. And yes, it's as good as you're imagining right now.\n\nFirst 50 orders get a free [bonus]. Don't wait — our last drop sold out in under 2 hours. Shop now in bio 👆",
    hashtags: ['#NewArrival', '#[BRAND]', '#JustDropped', '#GetItFirst'],
    source: 'template',
    tags: ['new arrival', 'drop', 'urgency'],
    createdAt: D,
    updatedAt: D,
    usageCount: 0,
    isFavorite: false,
  },
];

// ─── Storage Key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'marketer-pro:content-library:v1';

function loadFromStorage(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return SEED_TEMPLATES;
}

function saveToStorage(items: LibraryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface LibraryStore {
  items: LibraryItem[];
  addItem: (item: LibraryItem) => void;
  updateItem: (item: LibraryItem) => void;
  deleteItem: (id: string) => void;
  toggleFavorite: (id: string) => void;
  incrementUsage: (id: string) => void;
  clearAll: () => void;
}

export function useLibraryStore(): LibraryStore {
  const [items, setItems] = useState<LibraryItem[]>(() => loadFromStorage());

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  function addItem(item: LibraryItem) {
    setItems((prev) => [item, ...prev]);
  }

  function updateItem(item: LibraryItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function toggleFavorite(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isFavorite: !i.isFavorite, updatedAt: new Date().toISOString() } : i))
    );
  }

  function incrementUsage(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, usageCount: i.usageCount + 1, updatedAt: new Date().toISOString() } : i))
    );
  }

  function clearAll() {
    setItems(SEED_TEMPLATES);
  }

  return { items, addItem, updateItem, deleteItem, toggleFavorite, incrementUsage, clearAll };
}
