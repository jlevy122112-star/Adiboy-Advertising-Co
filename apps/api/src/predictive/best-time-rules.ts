/**
 * Research-backed static best-time rules per network.
 * Source: Sprout Social, HubSpot, Later.com 2024/2025 data.
 * All hours in UTC. Slots are (dayOfWeek 0=Sun…6=Sat, hourUTC, baseScore).
 */

export interface StaticSlot {
  dayOfWeek: number;
  hourUTC: number;
  baseScore: number;
  reason: string;
}

// Utility: convert local hour + timezone offset to UTC hour
function localToUtc(localHour: number, utcOffsetHours: number): number {
  return ((localHour - utcOffsetHours) % 24 + 24) % 24;
}

// US Eastern = UTC-5 (standard) approximation for general audience
const ET = -5;

const FACEBOOK_SLOTS: StaticSlot[] = [
  { dayOfWeek: 3, hourUTC: localToUtc(13, ET), baseScore: 92, reason: "Wed 1pm ET — peak Facebook engagement" },
  { dayOfWeek: 4, hourUTC: localToUtc(13, ET), baseScore: 88, reason: "Thu 1pm ET — high mid-week traffic" },
  { dayOfWeek: 5, hourUTC: localToUtc(11, ET), baseScore: 85, reason: "Fri 11am ET — pre-weekend spike" },
  { dayOfWeek: 2, hourUTC: localToUtc(13, ET), baseScore: 82, reason: "Tue 1pm ET — consistent performer" },
  { dayOfWeek: 1, hourUTC: localToUtc(12, ET), baseScore: 78, reason: "Mon 12pm ET — lunch scroll" },
];

const INSTAGRAM_SLOTS: StaticSlot[] = [
  { dayOfWeek: 2, hourUTC: localToUtc(11, ET), baseScore: 93, reason: "Tue 11am ET — peak Instagram reach" },
  { dayOfWeek: 3, hourUTC: localToUtc(11, ET), baseScore: 90, reason: "Wed 11am ET — strong mid-week" },
  { dayOfWeek: 4, hourUTC: localToUtc(11, ET), baseScore: 87, reason: "Thu 11am ET — consistent audience" },
  { dayOfWeek: 6, hourUTC: localToUtc(10, ET), baseScore: 83, reason: "Sat 10am ET — weekend leisure browsing" },
  { dayOfWeek: 0, hourUTC: localToUtc(10, ET), baseScore: 80, reason: "Sun 10am ET — discovery browsing" },
];

const X_SLOTS: StaticSlot[] = [
  { dayOfWeek: 3, hourUTC: localToUtc(9, ET),  baseScore: 91, reason: "Wed 9am ET — peak X engagement" },
  { dayOfWeek: 5, hourUTC: localToUtc(9, ET),  baseScore: 88, reason: "Fri 9am ET — news-cycle peak" },
  { dayOfWeek: 2, hourUTC: localToUtc(8, ET),  baseScore: 85, reason: "Tue 8am ET — morning commute scroll" },
  { dayOfWeek: 4, hourUTC: localToUtc(10, ET), baseScore: 82, reason: "Thu 10am ET — mid-morning traffic" },
  { dayOfWeek: 1, hourUTC: localToUtc(8, ET),  baseScore: 78, reason: "Mon 8am ET — week-start check-in" },
];

const LINKEDIN_SLOTS: StaticSlot[] = [
  { dayOfWeek: 2, hourUTC: localToUtc(10, ET), baseScore: 94, reason: "Tue 10am ET — #1 LinkedIn slot" },
  { dayOfWeek: 3, hourUTC: localToUtc(10, ET), baseScore: 91, reason: "Wed 10am ET — professional peak" },
  { dayOfWeek: 4, hourUTC: localToUtc(10, ET), baseScore: 89, reason: "Thu 10am ET — thought leadership" },
  { dayOfWeek: 1, hourUTC: localToUtc(9, ET),  baseScore: 84, reason: "Mon 9am ET — career content" },
  { dayOfWeek: 5, hourUTC: localToUtc(8, ET),  baseScore: 79, reason: "Fri 8am ET — TGIF content" },
];

const YOUTUBE_SLOTS: StaticSlot[] = [
  { dayOfWeek: 4, hourUTC: localToUtc(15, ET), baseScore: 93, reason: "Thu 3pm ET — pre-weekend upload" },
  { dayOfWeek: 5, hourUTC: localToUtc(15, ET), baseScore: 90, reason: "Fri 3pm ET — max weekend views" },
  { dayOfWeek: 6, hourUTC: localToUtc(11, ET), baseScore: 87, reason: "Sat 11am ET — weekend discovery" },
  { dayOfWeek: 0, hourUTC: localToUtc(11, ET), baseScore: 84, reason: "Sun 11am ET — leisure viewing" },
  { dayOfWeek: 3, hourUTC: localToUtc(14, ET), baseScore: 80, reason: "Wed 2pm ET — midweek momentum" },
];

const TIKTOK_SLOTS: StaticSlot[] = [
  { dayOfWeek: 2, hourUTC: localToUtc(19, ET), baseScore: 94, reason: "Tue 7pm ET — peak TikTok FYP time" },
  { dayOfWeek: 4, hourUTC: localToUtc(19, ET), baseScore: 91, reason: "Thu 7pm ET — prime evening scroll" },
  { dayOfWeek: 5, hourUTC: localToUtc(21, ET), baseScore: 89, reason: "Fri 9pm ET — weekend wind-down" },
  { dayOfWeek: 6, hourUTC: localToUtc(11, ET), baseScore: 86, reason: "Sat 11am ET — morning entertainment" },
  { dayOfWeek: 0, hourUTC: localToUtc(19, ET), baseScore: 83, reason: "Sun 7pm ET — Sunday evening" },
];

const GENERIC_SLOTS: StaticSlot[] = [
  { dayOfWeek: 3, hourUTC: 14, baseScore: 80, reason: "Wed 2pm UTC — general peak" },
  { dayOfWeek: 2, hourUTC: 13, baseScore: 78, reason: "Tue 1pm UTC — mid-week traffic" },
  { dayOfWeek: 4, hourUTC: 14, baseScore: 76, reason: "Thu 2pm UTC — solid engagement" },
  { dayOfWeek: 1, hourUTC: 13, baseScore: 72, reason: "Mon 1pm UTC — week start" },
  { dayOfWeek: 5, hourUTC: 12, baseScore: 70, reason: "Fri 12pm UTC — pre-weekend" },
];

const NETWORK_RULES: Record<string, StaticSlot[]> = {
  facebook: FACEBOOK_SLOTS,
  instagram: INSTAGRAM_SLOTS,
  x: X_SLOTS,
  linkedin: LINKEDIN_SLOTS,
  youtube: YOUTUBE_SLOTS,
  tiktok: TIKTOK_SLOTS,
};

export function getStaticSlots(network: string): StaticSlot[] {
  return NETWORK_RULES[network.toLowerCase()] ?? GENERIC_SLOTS;
}

// Content-type multipliers: video needs different timing than images
export const CONTENT_TYPE_MULTIPLIERS: Record<string, Record<string, number>> = {
  video:   { youtube: 1.1, tiktok: 1.1, instagram: 1.05, facebook: 1.0, x: 0.95, linkedin: 0.9 },
  image:   { instagram: 1.1, facebook: 1.05, linkedin: 1.0, x: 1.0, youtube: 0.8, tiktok: 0.9 },
  text:    { linkedin: 1.15, x: 1.1, facebook: 1.0, instagram: 0.85, youtube: 0.7, tiktok: 0.7 },
  link:    { linkedin: 1.05, facebook: 1.0, x: 1.05, instagram: 0.8, youtube: 0.7, tiktok: 0.7 },
};
