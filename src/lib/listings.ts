// ── Homes for sale, from Zillow ──────────────────────────────────────────────
// Zillow doesn't hand its listings out itself, so this goes through a data
// service on RapidAPI that serves Zillow's for-sale listings ("Zillow.com" API,
// host zillow-com1.p.rapidapi.com). Two environment variables in Vercel:
//
//   RAPIDAPI_KEY          the key RapidAPI shows on the API's page once subscribed
//   RAPIDAPI_ZILLOW_HOST  optional — only if a different Zillow API is used
//
// Every search is cached for a few hours, so poking around the same ZIP doesn't
// use up the monthly allowance. Server-side only: the key never leaves here.

export type Listing = {
  zpid: string;
  address: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  photo: string | null;
  photos: string[];
  url: string;
  homeType: string;
  daysOnMarket: number | null;
  hoaMonthly: number | null;
};

export type ListingSearch =
  | { ok: true; listings: Listing[]; total: number }
  | { ok: false; error: string };

const HOST = () => process.env.RAPIDAPI_ZILLOW_HOST || "zillow-com1.p.rapidapi.com";

export function listingsReady(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const HOME_TYPES: Record<string, string> = {
  SINGLE_FAMILY: "House",
  CONDO: "Condo",
  TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi-family",
  MANUFACTURED: "Manufactured",
  APARTMENT: "Apartment",
  LOT: "Land",
};

function toListing(raw: Record<string, unknown>): Listing | null {
  const zpid = String(raw.zpid ?? "");
  const price = num(raw.price ?? raw.unformattedPrice);
  if (!zpid || !price) return null;
  const detail = typeof raw.detailUrl === "string" ? raw.detailUrl : "";
  const carousel = Array.isArray(raw.carouselPhotos)
    ? (raw.carouselPhotos as { url?: unknown }[]).map((p) => (typeof p?.url === "string" ? p.url : "")).filter(Boolean)
    : [];
  const photo = typeof raw.imgSrc === "string" ? raw.imgSrc : carousel[0] ?? null;
  const type = String(raw.propertyType ?? raw.homeType ?? "");
  return {
    zpid,
    address: String(raw.address ?? raw.streetAddress ?? "Address not listed"),
    price,
    beds: num(raw.bedrooms ?? raw.beds),
    baths: num(raw.bathrooms ?? raw.baths),
    sqft: num(raw.livingArea ?? raw.area),
    photo,
    photos: carousel,
    url: detail.startsWith("http") ? detail : `https://www.zillow.com${detail || `/homedetails/${zpid}_zpid/`}`,
    homeType: HOME_TYPES[type] ?? (type ? type.replace(/_/g, " ").toLowerCase() : "Home"),
    daysOnMarket: num(raw.daysOnZillow),
    hoaMonthly: num(raw.hoaFee ?? raw.monthlyHoaFee),
  };
}

async function call(path: string, params: Record<string, string>): Promise<Response> {
  const url = `https://${HOST()}${path}?${new URLSearchParams(params).toString()}`;
  return fetch(url, {
    headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": HOST() },
    signal: AbortSignal.timeout(15000),
    next: { revalidate: 6 * 3600 },
  });
}

function failure(status: number): string {
  if (status === 401 || status === 403) return "The Zillow data key was turned down. Admin needs to check RAPIDAPI_KEY and the subscription.";
  if (status === 429) return "This month's Zillow searches are used up. More open up next month (or on a bigger plan).";
  return "Zillow didn't answer just now. Try again in a minute.";
}

/** Homes for sale in a ZIP, up to a price. */
export async function searchListings(opts: {
  zip: string;
  maxPrice: number;
  minBeds: number;
}): Promise<ListingSearch> {
  if (!listingsReady()) return { ok: false, error: "Home search isn't switched on yet — Admin needs to add the Zillow data key." };
  try {
    const params: Record<string, string> = {
      location: opts.zip,
      status_type: "ForSale",
      sort: "Price_High_Low",
      maxPrice: String(Math.round(opts.maxPrice)),
    };
    if (opts.minBeds > 0) params.bedsMin = String(opts.minBeds);
    const res = await call("/propertyExtendedSearch", params);
    if (!res.ok) return { ok: false, error: failure(res.status) };
    const data = (await res.json()) as Record<string, unknown>;
    const props = Array.isArray(data.props) ? data.props : Array.isArray(data.results) ? data.results : [];
    const listings = (props as Record<string, unknown>[])
      .map(toListing)
      .filter((l): l is Listing => l !== null && l.homeType !== "Land");
    return { ok: true, listings, total: Number(data.totalResultCount) || listings.length };
  } catch {
    return { ok: false, error: "Zillow didn't answer just now. Try again in a minute." };
  }
}

/** Every photo of one listing — fetched only when he opens it. */
export async function listingPhotos(zpid: string): Promise<string[]> {
  if (!listingsReady() || !/^\d+$/.test(zpid)) return [];
  try {
    const res = await call("/images", { zpid });
    if (!res.ok) return [];
    const data = (await res.json()) as { images?: unknown };
    return Array.isArray(data.images) ? data.images.filter((u): u is string => typeof u === "string").slice(0, 40) : [];
  } catch {
    return [];
  }
}
