// ── Homes for sale, from Zillow ──────────────────────────────────────────────
// Zillow doesn't hand its listings out itself, so this goes through RapidAPI's
// own "Zillow" API (by RapidAPI-Org, host zillow191.p.rapidapi.com — the
// "Zillow.com" API this first used was taken down in Nov 2026). Free plan: 100
// requests a month, hard limit, so it can't run up a bill. One environment
// variable in Vercel:
//
//   RAPIDAPI_KEY          the key RapidAPI shows on the API's page once subscribed
//   RAPIDAPI_ZILLOW_HOST  optional — only if a different host is ever needed
//
// A search is two calls: the ZIP is turned into a Zillow region (cached for a
// month — ZIP codes don't move), then the homes in it (cached a few hours, so
// poking around the same ZIP doesn't use up the allowance). Every photo comes
// back with the search, so opening a house costs nothing. Server-side only:
// the key never leaves here.

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

const HOST = () => process.env.RAPIDAPI_ZILLOW_HOST || "zillow191.p.rapidapi.com";

export function listingsReady(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const urls = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.startsWith("http")) : [];

const HOME_TYPES: Record<string, string> = {
  singlefamily: "House",
  condo: "Condo",
  townhouse: "Townhouse",
  townhome: "Townhouse",
  multifamily: "Multi-family",
  manufactured: "Manufactured",
  apartment: "Apartment",
  lot: "Land",
  land: "Land",
};

function toListing(raw: unknown): Listing | null {
  const p = obj(obj(raw).property);
  const zpid = String(p.zpid ?? "");
  const price = num(obj(p.price).value ?? obj(p.hdpView).price);
  if (!zpid || !price) return null;

  const addr = obj(p.address);
  const street = typeof addr.streetAddress === "string" ? addr.streetAddress : "";
  const town = [addr.city, addr.state].filter((s) => typeof s === "string" && s).join(", ");
  const address =
    [street, [town, addr.zipcode].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Address not listed";

  const media = obj(p.media);
  const all = obj(media.allPropertyPhotos);
  const photos = urls(all.highResolution).length ? urls(all.highResolution) : urls(all.medium);
  const links = obj(media.propertyPhotoLinks);
  const photo =
    (typeof links.highResolutionLink === "string" && links.highResolutionLink) ||
    (typeof links.mediumSizeLink === "string" && links.mediumSizeLink) ||
    photos[0] ||
    null;

  const type = String(p.propertyType ?? "");
  return {
    zpid,
    address,
    price,
    beds: num(p.bedrooms),
    baths: num(p.bathrooms),
    sqft: num(p.livingArea),
    photo,
    photos: photos.slice(0, 40),
    url: `https://www.zillow.com/homedetails/${encodeURIComponent(zpid)}_zpid/`,
    homeType:
      HOME_TYPES[type.toLowerCase().replace(/[^a-z]/g, "")] ??
      (type ? type.replace(/([a-z])([A-Z])/g, "$1 $2") : "Home"),
    daysOnMarket: num(p.daysOnZillow ?? obj(p.listing).daysOnZillow),
    hoaMonthly: num(p.monthlyHoaFee ?? obj(p.hoa).fee),
  };
}

async function call(path: string, params: Record<string, string>, revalidate: number): Promise<Response> {
  const url = `https://${HOST()}${path}?${new URLSearchParams(params).toString()}`;
  return fetch(url, {
    headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": HOST() },
    signal: AbortSignal.timeout(15000),
    next: { revalidate },
  });
}

function failure(status: number): string {
  if (status === 401 || status === 403) {
    return "The Zillow data key was turned down. Admin needs to check RAPIDAPI_KEY and that the Zillow API is subscribed.";
  }
  if (status === 429) return "This month's Zillow searches are used up. More open up next month (or on a bigger plan).";
  return "Zillow didn't answer just now. Try again in a minute.";
}

// Where to search: the ZIP's own region if Zillow names one, otherwise its
// map box, otherwise a box a few miles around its centre.
type Area = Record<string, string>;

function areaFrom(result: Obj): Area | null {
  const meta = obj(result.metaData);
  const regionId = num(result.regionId ?? meta.regionId);
  const regionType = result.regionType ?? result.subType ?? result.regionSubType ?? meta.regionType;
  if (regionId && typeof regionType === "string" && regionType) {
    return { regionId: String(regionId), regionType };
  }
  const box = obj(result.mbr);
  const [n, s, e, w] = [box.maxMbrLatitude, box.minMbrLatitude, box.maxMbrLongitude, box.minMbrLongitude].map(
    (v) => (v === null || v === undefined ? NaN : Number(v))
  );
  if ([n, s, e, w].every(Number.isFinite) && n > s && e > w) {
    return { north: String(n), south: String(s), east: String(e), west: String(w) };
  }
  const loc = obj(result.location);
  const lat = loc.latitude === null ? NaN : Number(loc.latitude);
  const lng = loc.longitude === null ? NaN : Number(loc.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const d = 0.04; // about 3 miles
    return { north: String(lat + d), south: String(lat - d), east: String(lng + d), west: String(lng - d) };
  }
  return null;
}

/** Homes for sale in a ZIP, up to a price. */
export async function searchListings(opts: {
  zip: string;
  maxPrice: number;
  minBeds: number;
}): Promise<ListingSearch> {
  if (!listingsReady()) {
    return { ok: false, error: "Home search isn't switched on yet — Admin needs to add the Zillow data key." };
  }
  try {
    const where = await call("/v1/search/resolve", { query: opts.zip, searchType: "FOR_SALE" }, 30 * 86400);
    if (!where.ok) return { ok: false, error: failure(where.status) };
    const results = obj(await where.json()).results;
    const area = Array.isArray(results) && results.length ? areaFrom(obj(results[0])) : null;
    if (!area) return { ok: false, error: `Zillow doesn't recognise ZIP ${opts.zip}. Check it, or try a nearby one.` };

    const params: Record<string, string> = {
      ...area,
      searchType: "FOR_SALE",
      maxPrice: String(Math.round(opts.maxPrice)),
      page: "1",
    };
    if (opts.minBeds > 0) params.minBeds = String(opts.minBeds);
    const res = await call("/v1/search", params, 6 * 3600);
    if (!res.ok) return { ok: false, error: failure(res.status) };
    const data = obj(await res.json());
    const rows = Array.isArray(data.searchResults) ? data.searchResults : [];
    const listings = rows.map(toListing).filter((l): l is Listing => l !== null && l.homeType !== "Land");
    const total = num(obj(data.resultsCount).totalMatchingCount ?? data.totalResultCount) ?? listings.length;
    return { ok: true, listings, total };
  } catch {
    return { ok: false, error: "Zillow didn't answer just now. Try again in a minute." };
  }
}
