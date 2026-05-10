/**
 * US-focused business categories with hero imagery via Unsplash CDN.
 * Images use auto=format for WebP/AVIF where supported; pair with srcset widths.
 * License: https://unsplash.com/license — attribute photographers in the UI.
 */

export type BusinessCategoryHero = {
  /** images.unsplash.com base path without query */
  photoId: string;
  photographer: string;
  /** Photographer profile on Unsplash */
  photographerUrl: string;
};

export type BusinessCategory = {
  id: string;
  label: string;
  blurb: string;
  hero: BusinessCategoryHero;
};

const U = "https://images.unsplash.com";

function src(photoId: string, w: number): string {
  return `${U}/${photoId}?auto=format&fit=crop&w=${w}&q=80`;
}

/**
 * Responsive srcset for hero / cover imagery (2x DPR-friendly widths).
 */
export function categoryHeroSrcSet(photoId: string): string {
  return `${src(photoId, 640)} 640w, ${src(photoId, 960)} 960w, ${src(photoId, 1280)} 1280w, ${src(photoId, 1600)} 1600w`;
}

export function categoryHeroSizes(): string {
  return "(max-width: 720px) 100vw, min(1180px, 100vw)";
}

export function categoryHeroDefaultSrc(photoId: string): string {
  return src(photoId, 1280);
}

export const BUSINESS_CATEGORY_CATALOG: BusinessCategory[] = [
  {
    id: "retail",
    label: "Retail & consumer",
    blurb: "Stores, boutiques, and omnichannel sellers.",
    hero: {
      photoId: "photo-1441986300917-64674bd600d8",
      photographer: "Clark Street Mercantile",
      photographerUrl:
        "https://unsplash.com/@mercantileclark?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "food_beverage",
    label: "Restaurant & food service",
    blurb: "Cafés, QSR, catering, and bars.",
    hero: {
      photoId: "photo-1517248135467-4c7edcad34c4",
      photographer: "Louis Hansel",
      photographerUrl:
        "https://unsplash.com/@louishansel?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "healthcare",
    label: "Healthcare & wellness clinics",
    blurb: "Medical, dental, therapy, and outpatient care.",
    hero: {
      photoId: "photo-1576091160399-112ba8d25d1f",
      photographer: "National Cancer Institute",
      photographerUrl:
        "https://unsplash.com/@nci?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "professional_services",
    label: "Professional services",
    blurb: "Legal, accounting, consulting, and agencies.",
    hero: {
      photoId: "photo-1497366216548-37526070297c",
      photographer: "Proxyclick Visitor Management",
      photographerUrl:
        "https://unsplash.com/@proxyclick?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "real_estate",
    label: "Real estate & property",
    blurb: "Brokerages, property managers, and builders.",
    hero: {
      photoId: "photo-1560518883-ce09059eeffa",
      photographer: "Kindel Media",
      photographerUrl:
        "https://unsplash.com/@kindelmedia?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "automotive",
    label: "Automotive & mobility",
    blurb: "Dealers, repair, fleets, and car care.",
    hero: {
      photoId: "photo-1486262715619-0aa43863a09b",
      photographer: "Marek Piwnicki",
      photographerUrl:
        "https://unsplash.com/@marekpiwnicki?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "home_services",
    label: "Home & skilled trades",
    blurb: "HVAC, plumbing, electrical, landscaping.",
    hero: {
      photoId: "photo-1581578731548-c64695cc6952",
      photographer: "Element5 Digital",
      photographerUrl:
        "https://unsplash.com/@element5digital?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "technology",
    label: "Technology & software",
    blurb: "SaaS, IT services, hardware, and startups.",
    hero: {
      photoId: "photo-1518770660439-4636190af475",
      photographer: "Alexandre Debiève",
      photographerUrl:
        "https://unsplash.com/@alexkixa?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "beauty_personal_care",
    label: "Beauty & personal care",
    blurb: "Salons, spas, barbers, and cosmetics.",
    hero: {
      photoId: "photo-1560066984-138d9534e587",
      photographer: "Adam Winger",
      photographerUrl:
        "https://unsplash.com/@adamwinger?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "fitness",
    label: "Fitness & recreation",
    blurb: "Gyms, studios, sports venues, and coaches.",
    hero: {
      photoId: "photo-1534438327276-14e5300c3a48",
      photographer: "Danielle Cerullo",
      photographerUrl:
        "https://unsplash.com/@dncerullo?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "hospitality_travel",
    label: "Hospitality & travel",
    blurb: "Hotels, B&Bs, tours, and experiences.",
    hero: {
      photoId: "photo-1566073771259-6a8506099945",
      photographer: "Francesca Saraco",
      photographerUrl:
        "https://unsplash.com/@frankiel?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "finance_insurance",
    label: "Finance & insurance",
    blurb: "Advisors, lenders, agencies, and fintech.",
    hero: {
      photoId: "photo-1611974789855-9c2a0a7236a3",
      photographer: "Getty Images",
      photographerUrl:
        "https://unsplash.com/@gettyimages?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "education",
    label: "Education & training",
    blurb: "Schools, tutors, bootcamps, and corporate training.",
    hero: {
      photoId: "photo-1523050854058-8df90110c9f1",
      photographer: "MD Duran",
      photographerUrl:
        "https://unsplash.com/@mdesign85?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "agriculture",
    label: "Agriculture & food production",
    blurb: "Farms, co-ops, distributors, and agritech.",
    hero: {
      photoId: "photo-1500937386664-56d1df385289",
      photographer: "James Baltz",
      photographerUrl:
        "https://unsplash.com/@jamesbaltz?utm_source=marketer_pro&utm_medium=referral",
    },
  },
  {
    id: "manufacturing",
    label: "Manufacturing & industrial",
    blurb: "Fabrication, logistics, and B2B suppliers.",
    hero: {
      photoId: "photo-1581091226825-a6a2a5aee158",
      photographer: "ThisisEngineering",
      photographerUrl:
        "https://unsplash.com/@thisisengineering?utm_source=marketer_pro&utm_medium=referral",
    },
  },
];

const BY_ID = new Map(BUSINESS_CATEGORY_CATALOG.map((c) => [c.id, c] as const));

export function getBusinessCategory(
  id: string | undefined,
): BusinessCategory | undefined {
  if (!id) {
    return undefined;
  }
  return BY_ID.get(id);
}

export function defaultBusinessCategory(): BusinessCategory {
  return BUSINESS_CATEGORY_CATALOG[0]!;
}
