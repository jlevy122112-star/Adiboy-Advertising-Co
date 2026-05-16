/**
 * Large, combinatorial catalog of paid + organic placements across Meta, LinkedIn,
 * TikTok, and X. Used when auto-building a monthly schedule so every slot has
 * channel + format context.
 */

export type ContentFormat = {
  id: string;
  label: string;
  network: string;
  networkLabel: string;
  placement: string;
  contentKind: "organic" | "ad" | "messenger" | "story" | "reels";
  objective?: string;
  creativeType: string;
  aspectRatio?: string;
  spec?: string;
};

const OBJECTIVES = [
  // Meta Ads Manager Outcome objectives (same roster as `CONTENT_GOALS` in generation-brief).
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "app_promotion",
  "sales",
] as const;

const CREATIVES: {
  id: string;
  label: string;
  aspect: string;
  spec: string;
}[] = [
  {
    id: "single_image",
    label: "Single image",
    aspect: "1:1 · 4:5",
    spec: "Primary text, headline, CTA, landing URL",
  },
  {
    id: "carousel",
    label: "Carousel",
    aspect: "1:1",
    spec: "2–10 cards, swipe narrative, CTA per card optional",
  },
  {
    id: "video_short",
    label: "Short vertical video",
    aspect: "9:16 · 4:5",
    spec: "Hook in 1s, captions on, ≤60s for Reels placements",
  },
  {
    id: "video_square",
    label: "Square / feed video",
    aspect: "1:1",
    spec: "15–120s, burnt-in captions recommended",
  },
  {
    id: "collection",
    label: "Collection / catalog",
    aspect: "varies",
    spec: "Product set + hero creative, instant storefront",
  },
  {
    id: "lead_form",
    label: "Instant form / lead card",
    aspect: "1:1",
    spec: "On-platform lead capture, privacy + offer copy",
  },
  {
    id: "poll_sticker",
    label: "Poll / engagement sticker",
    aspect: "story",
    spec: "Lightweight engagement, follow-up DM or comment CTA",
  },
  {
    id: "ugc_creator",
    label: "UGC / creator-native",
    aspect: "9:16",
    spec: "Lo-fi authenticity, scripted CTA, brand handle tag",
  },
];

function pushFormat(
  out: ContentFormat[],
  parts: Omit<ContentFormat, "id" | "label"> & {
    placementKey: string;
    title: string;
  },
): void {
  const id = `fmt-${out.length + 1}`;
  const label = `${parts.networkLabel} · ${parts.title} · ${parts.creativeType.replace(/_/g, " ")}${parts.objective ? ` · ${parts.objective}` : ""}`;
  out.push({
    id,
    label,
    network: parts.network,
    networkLabel: parts.networkLabel,
    placement: parts.placement,
    contentKind: parts.contentKind,
    objective: parts.objective,
    creativeType: parts.creativeType,
    aspectRatio: parts.aspectRatio,
    spec: parts.spec,
  });
}

function buildCatalog(): ContentFormat[] {
  const out: ContentFormat[] = [];

  const metaOrganic: {
    placement: string;
    placementKey: string;
    title: string;
    kind: ContentFormat["contentKind"];
  }[] = [
    {
      placement: "facebook_feed_organic",
      placementKey: "fb-feed-org",
      title: "Facebook feed post",
      kind: "organic",
    },
    {
      placement: "facebook_story_organic",
      placementKey: "fb-story-org",
      title: "Facebook story",
      kind: "story",
    },
    {
      placement: "instagram_feed_organic",
      placementKey: "ig-feed-org",
      title: "Instagram feed post",
      kind: "organic",
    },
    {
      placement: "instagram_story_organic",
      placementKey: "ig-story-org",
      title: "Instagram story",
      kind: "story",
    },
    {
      placement: "instagram_reels_organic",
      placementKey: "ig-reels-org",
      title: "Instagram Reels",
      kind: "reels",
    },
  ];

  for (const row of metaOrganic) {
    for (const c of CREATIVES) {
      if (row.kind === "story" && c.id === "collection") continue;
      if (row.kind === "reels" && c.id === "lead_form") continue;
      const net =
        row.placement.startsWith("instagram") || row.placement.startsWith("ig")
          ? "instagram"
          : "facebook";
      const netLabel = net === "instagram" ? "Instagram" : "Facebook";
      pushFormat(out, {
        network: net,
        networkLabel: netLabel,
        placement: row.placement,
        placementKey: row.placementKey,
        title: row.title,
        contentKind: row.kind,
        creativeType: c.id,
        aspectRatio: c.aspect,
        spec: c.spec,
      });
    }
  }

  const metaAds: {
    placement: string;
    placementKey: string;
    title: string;
    networks: { id: string; label: string }[];
  }[] = [
    {
      placement: "facebook_feed_ad",
      placementKey: "fb-feed-ad",
      title: "Facebook feed ads",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "facebook_right_column",
      placementKey: "fb-right",
      title: "Facebook right column",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "facebook_marketplace_ad",
      placementKey: "fb-marketplace",
      title: "Facebook Marketplace ads",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "facebook_instream_video",
      placementKey: "fb-instream",
      title: "Facebook in-stream video",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "facebook_reels_ad",
      placementKey: "fb-reels-ad",
      title: "Facebook Reels ads",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "messenger_inbox_ad",
      placementKey: "msg-inbox",
      title: "Messenger inbox sponsored messages",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "messenger_stories_ad",
      placementKey: "msg-story",
      title: "Messenger / FB story ads (messaging objective)",
      networks: [{ id: "facebook", label: "Facebook" }],
    },
    {
      placement: "instagram_feed_ad",
      placementKey: "ig-feed-ad",
      title: "Instagram feed ads",
      networks: [{ id: "instagram", label: "Instagram" }],
    },
    {
      placement: "instagram_story_ad",
      placementKey: "ig-story-ad",
      title: "Instagram story ads",
      networks: [{ id: "instagram", label: "Instagram" }],
    },
    {
      placement: "instagram_reels_ad",
      placementKey: "ig-reels-ad",
      title: "Instagram Reels ads",
      networks: [{ id: "instagram", label: "Instagram" }],
    },
    {
      placement: "instagram_explore_ad",
      placementKey: "ig-explore",
      title: "Instagram Explore ads",
      networks: [{ id: "instagram", label: "Instagram" }],
    },
    {
      placement: "instagram_shopping_ad",
      placementKey: "ig-shop",
      title: "Instagram shopping / catalog ads",
      networks: [{ id: "instagram", label: "Instagram" }],
    },
    {
      placement: "meta_advantage_plus",
      placementKey: "advantage-plus",
      title: "Advantage+ placements (auto)",
      networks: [
        { id: "facebook", label: "Facebook" },
        { id: "instagram", label: "Instagram" },
      ],
    },
  ];

  for (const ad of metaAds) {
    for (const n of ad.networks) {
      for (const obj of OBJECTIVES) {
        for (const c of CREATIVES) {
          if (ad.placement.includes("messenger") && c.id === "carousel")
            continue;
          if (ad.placement.includes("instream") && c.id === "poll_sticker")
            continue;
          pushFormat(out, {
            network: n.id,
            networkLabel: n.label,
            placement: ad.placement,
            placementKey: `${ad.placementKey}-${n.id}`,
            title: ad.title,
            contentKind:
              ad.placement.includes("messenger") ||
              ad.title.includes("Messenger")
                ? "messenger"
                : "ad",
            objective: obj,
            creativeType: c.id,
            aspectRatio: c.aspect,
            spec: c.spec,
          });
        }
      }
    }
  }

  const linkedinOrganic: {
    placement: string;
    placementKey: string;
    title: string;
  }[] = [
    {
      placement: "linkedin_feed_post",
      placementKey: "li-feed",
      title: "LinkedIn feed post",
    },
    {
      placement: "linkedin_carousel_doc",
      placementKey: "li-carousel",
      title: "LinkedIn document carousel",
    },
    {
      placement: "linkedin_video_post",
      placementKey: "li-video",
      title: "LinkedIn native video",
    },
    {
      placement: "linkedin_poll",
      placementKey: "li-poll",
      title: "LinkedIn poll",
    },
    {
      placement: "linkedin_newsletter",
      placementKey: "li-news",
      title: "LinkedIn newsletter / article",
    },
    {
      placement: "linkedin_live_event",
      placementKey: "li-live",
      title: "LinkedIn Live / event promo post",
    },
  ];

  for (const row of linkedinOrganic) {
    for (const c of CREATIVES) {
      if (c.id === "poll_sticker" && !row.placement.includes("poll")) continue;
      if (
        row.placement.includes("poll") &&
        c.id !== "poll_sticker" &&
        c.id !== "single_image"
      )
        continue;
      pushFormat(out, {
        network: "linkedin",
        networkLabel: "LinkedIn",
        placement: row.placement,
        placementKey: row.placementKey,
        title: row.title,
        contentKind: "organic",
        creativeType: c.id,
        aspectRatio: c.aspect,
        spec: c.spec,
      });
    }
  }

  const linkedinAds: {
    placement: string;
    placementKey: string;
    title: string;
    kind: ContentFormat["contentKind"];
  }[] = [
    {
      placement: "linkedin_sponsored_content",
      placementKey: "li-sponsored",
      title: "Sponsored Content (feed)",
      kind: "ad",
    },
    {
      placement: "linkedin_message_ad",
      placementKey: "li-msg-ad",
      title: "Message / Conversation ads",
      kind: "messenger",
    },
    {
      placement: "linkedin_dynamic_ad",
      placementKey: "li-dynamic",
      title: "Dynamic ads",
      kind: "ad",
    },
    {
      placement: "linkedin_text_ad",
      placementKey: "li-text",
      title: "Text ads",
      kind: "ad",
    },
    {
      placement: "linkedin_spotlight",
      placementKey: "li-spotlight",
      title: "Follower / Spotlight ads",
      kind: "ad",
    },
    {
      placement: "linkedin_lead_gen",
      placementKey: "li-lead",
      title: "Lead Gen Form ads",
      kind: "ad",
    },
    {
      placement: "linkedin_video_ad",
      placementKey: "li-v-ad",
      title: "Video ads (in-feed)",
      kind: "ad",
    },
    {
      placement: "linkedin_document_ad",
      placementKey: "li-doc-ad",
      title: "Document / thought-leadership ads",
      kind: "ad",
    },
  ];

  for (const ad of linkedinAds) {
    for (const obj of OBJECTIVES) {
      for (const c of CREATIVES) {
        if (ad.kind === "messenger" && c.id === "carousel") continue;
        if (
          ad.placement.includes("text") &&
          c.id !== "single_image" &&
          c.id !== "carousel"
        )
          continue;
        pushFormat(out, {
          network: "linkedin",
          networkLabel: "LinkedIn",
          placement: ad.placement,
          placementKey: ad.placementKey,
          title: ad.title,
          contentKind: ad.kind,
          objective: obj,
          creativeType: c.id,
          aspectRatio: c.aspect,
          spec: c.spec,
        });
      }
    }
  }

  pushFormat(out, {
    network: "tiktok",
    networkLabel: "TikTok",
    placement: "tiktok_organic_feed",
    placementKey: "tt-feed-org",
    title: "Organic feed (short-form)",
    contentKind: "organic",
    objective: "awareness",
    creativeType: "video_short",
    aspectRatio: "9:16",
    spec: "TikTok Content Posting API — video pipeline pending (P4).",
  });
  pushFormat(out, {
    network: "x",
    networkLabel: "X",
    placement: "x_organic_post",
    placementKey: "x-post-org",
    title: "Text post",
    contentKind: "organic",
    objective: "awareness",
    creativeType: "single_image",
    aspectRatio: "1:1",
    spec: "Text posts via X API v2 when MARKETER_X_ACCESS_TOKEN is configured.",
  });

  return out;
}

export const CONTENT_FORMAT_CATALOG: ContentFormat[] = buildCatalog();

export function pickFormatForSlot(index: number): ContentFormat {
  const cat = CONTENT_FORMAT_CATALOG;
  if (cat.length === 0) {
    throw new Error("content_format_catalog_empty");
  }
  return cat[(index * 31 + 7) % cat.length];
}

export const CONTENT_FORMAT_COUNT = CONTENT_FORMAT_CATALOG.length;
