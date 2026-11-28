// Öffentliche Welt: read-only projections for anonymous website visitors.
// Campaign-neutral: callers pass already projected *group* data, never raw SL rows. A website release is always a
// subset of what the whole group may see; the explicit website flag alone never discloses anything.
// Note: "public" in the location model means "generally known inside the game", not "shown on the website".
// The website release therefore uses its own flag keys below.
import { encodeRichText, htmlToRichText, readRichText, richTextPrefix, type RichTextBlock, type RichTextDocument, type RichTextInline } from "./location-rich-text.ts";

/** Stored flag keys, one per source. Each lives in an existing JSON field, so no migration is needed. */
export const websiteFlagKeys = {
  /** location_nodes.attributes of a main place (root node). */
  place: "showOnWebsite",
  /** entities.content of an NPC (snake_case like the other NPC profile keys). */
  person: "show_on_website",
  /** records.body of a Chronik entry. */
  chronicle: "showOnWebsite",
} as const;

export type PublicPlace = {
  id: string;
  title: string;
  subtitle: string;
  district: string;
  /** Rich text without images or internal links; "" when empty. */
  summary: string;
  atmosphere: string;
  worldState: string;
  /** A bundled static image (/images/…), the entry-addressed public image route for an upload, or "". */
  image: string;
};
export type PublicPerson = {
  id: string;
  name: string;
  alias: string;
  epithet: string;
  role: string;
  clan: string;
  summary: string;
  description: string;
  knownFor: string[];
  affiliation: string[];
  /** A bundled static image (/images/…), the entry-addressed public image route for an upload, or "". */
  image: string;
};
export type PublicChronicleEntry = {
  id: string;
  title: string;
  /** YYYY-MM-DD or "" when undated. */
  date: string;
  kind: "rueckblick" | "ereignis";
  text: string;
};
export type PublicWorld = {
  /** SL-maintained introduction (public rich text) or "" for the page's default sentence. */
  intro: string;
  places: PublicPlace[];
  people: PublicPerson[];
  chronicle: PublicChronicleEntry[];
};

/** A curated glimpse, not the whole world: fixed caps. The SL chooses by marking; beyond a cap the order decides. */
export const publicWorldLimits = { places: 4, people: 7, chronicle: 3 } as const;
/** How the order is decided, said in the SL switches and the overview (one source for the wording). */
export const publicWorldOrderHints = {
  places: `Höchstens ${publicWorldLimits.places} Orte erscheinen, in der Reihenfolge der Orte-Werkstatt.`,
  people: `Höchstens ${publicWorldLimits.people} Persönlichkeiten erscheinen, alphabetisch nach Name.`,
  chronicle: `Höchstens ${publicWorldLimits.chronicle} Einträge erscheinen, die neuesten zuerst.`,
} as const;

/** The intro lives in the existing settings table (no migration), one document per campaign. */
export const publicWorldIntroKey = (campaignId: string) => `public-world:intro:${campaignId}`;
export const publicWorldIntroMaxSource = 20000;
export const publicWorldIntroMaxPlain = 2000;
export type PublicWorldIntro = { text: string; version: number; updatedAt: string };
export function parsePublicWorldIntro(raw: string | null | undefined): PublicWorldIntro {
  try {
    const value: unknown = JSON.parse(raw || "null");
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const data = value as Record<string, unknown>;
      return {
        text: typeof data.text === "string" ? data.text.slice(0, publicWorldIntroMaxSource) : "",
        version: Number.isInteger(data.version) && (data.version as number) > 0 ? data.version as number : 0,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
      };
    }
  } catch { /* An unreadable document counts as no intro. */ }
  return { text: "", version: 0, updatedAt: "" };
}

const knownDiscovery = ["known", "visited", "investigated"];

/** The flag counts only as an explicit boolean true; strings, numbers or missing keys never publish. */
export function isMarkedForWebsite(data: unknown, key: string): boolean {
  return !!data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>)[key] === true;
}

export function publicStaticImage(value: unknown): string {
  return typeof value === "string" && /^\/images\/[a-zA-Z0-9._-]+$/.test(value) ? value : "";
}

export type PublicImageKind = "place" | "person";
/** Images are addressed by their entry, never by file: the route resolves the upload on the server, so no file ID
 * reaches a guest and a withdrawn entry takes its image with it. */
export function publicImagePath(kind: PublicImageKind, id: string) {
  return `/api/public-world/image?kind=${kind}&id=${encodeURIComponent(id)}`;
}

/** An upload as the group projection references it. Read only by the public image route, never sent to guests. */
export type UploadRef = { fileId: string } | { mediaBlockId: string };
export function uploadRef(value: unknown): UploadRef | null {
  if (typeof value !== "string" || value.length > 600) return null;
  let url: URL;
  try { url = new URL(value, "https://chroniplay.invalid"); } catch { return null; }
  if (url.origin !== "https://chroniplay.invalid" || url.searchParams.has("preview") || url.searchParams.has("viewerId")) return null;
  const id = url.searchParams.get("id") ?? "";
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) return null;
  if (url.pathname === "/api/files" || url.pathname === "/api/cms/media") return { fileId: id };
  if (url.pathname === "/api/locations/media") return { mediaBlockId: id };
  return null;
}

/** The first usable image among the candidates: a static image stays as it is, an upload gets the entry path. */
export function publicImageSource(kind: PublicImageKind, id: string, candidates: unknown[]): { image: string; upload: UploadRef | null } {
  for (const candidate of candidates) {
    const image = publicStaticImage(candidate);
    if (image) return { image, upload: null };
    const upload = uploadRef(candidate);
    if (upload) return { image: publicImagePath(kind, id), upload };
  }
  return { image: "", upload: null };
}

const cleanLine = (value: unknown, max = 200) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const cleanList = (value: unknown) => Array.isArray(value) ? value.map(item => cleanLine(item)).filter(Boolean).slice(0, 20) : [];

// Addresses that need a login (uploads, the protected app) or carry internal IDs. Old entries may contain them as plain
// text or in pasted HTML/Markdown; guests get neither the address nor a broken image.
const protectedAddress = String.raw`(?:https?://[^\s"'<>()]*?)?/(?:api/(?:files|cms/media|locations/media)|spielbereich|sl/command-center)(?:[?#][^\s"'<>()]*)?`;
const protectedAddresses = new RegExp(protectedAddress, "gi");
const isProtectedAddress = new RegExp("^" + protectedAddress + "$", "i");
const markdownImages = /!\[[^\]]*\]\([^)]*\)/g;
const scrub = (text: string) => text.replace(markdownImages, "").replace(protectedAddresses, "");

/** Current documents are read as stored; old HTML goes through the existing converter (images become image blocks). */
function readPublicDocument(value: string): RichTextDocument {
  if (value.startsWith(richTextPrefix) || !/<\/?[a-z][^>]*>/i.test(value)) return readRichText(value);
  try { return readRichText(htmlToRichText(value)); }
  catch { return readRichText(value.replace(/<[^>]*>/g, " ")); }
}

function publicInlines(parts: RichTextInline[]): RichTextInline[] {
  // Internal links lead into the protected app (and carry entry IDs); keep their text, drop the target.
  return parts.map(({ href, text, ...rest }) => {
    const clean = { ...rest, text: scrub(text) };
    return href && /^(https?:|mailto:)/i.test(href) && !isProtectedAddress.test(href) ? { ...clean, href } : clean;
  });
}

function publicBlocks(blocks: RichTextBlock[]): RichTextBlock[] {
  return blocks.flatMap((block): RichTextBlock[] => {
    // Embedded images point to the authenticated file API; a guest could not load them and must not learn their IDs.
    if (block.type === "image") return [];
    if (block.type === "details") {
      const content: RichTextDocument = { version: 1, blocks: publicBlocks(block.content.blocks) };
      return content.blocks.length ? [{ ...block, summary: scrub(block.summary), content }] : [];
    }
    if (block.type === "bulletList" || block.type === "orderedList") return [{ ...block, items: block.items.map(publicInlines) }];
    if (block.type === "table") return [{ ...block, rows: block.rows.map(row => row.map(publicInlines)) }];
    if (block.type === "divider") return [block];
    return [{ ...block, children: publicInlines(block.children) }];
  });
}

function documentText(blocks: RichTextBlock[]): string {
  return blocks.map(block => {
    if (block.type === "image" || block.type === "divider") return "";
    if (block.type === "details") return block.summary + " " + documentText(block.content.blocks);
    if (block.type === "bulletList" || block.type === "orderedList") return block.items.map(item => item.map(part => part.text).join("")).join(" ");
    if (block.type === "table") return block.rows.map(row => row.map(cell => cell.map(part => part.text).join("")).join(" ")).join(" ");
    return block.children.map(part => part.text).join("");
  }).join(" ");
}

/** Rich text for guests: images removed (also inside collapsible blocks), internal links reduced to their text. */
export function publicRichText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const blocks = publicBlocks(readPublicDocument(value).blocks);
  if (!documentText(blocks).trim()) return "";
  return encodeRichText({ version: 1, blocks });
}

/** Several texts as one public document, in the given order; empty parts are skipped. */
export function joinPublicRichText(values: unknown[]): string {
  const blocks = values.flatMap(value => typeof value === "string" && value.trim() ? publicBlocks(readPublicDocument(value).blocks) : []);
  return documentText(blocks).trim() ? encodeRichText({ version: 1, blocks }) : "";
}

/** Narrative NPC block kinds that the group reads in the dossier once released (never the SL kinds). */
export const publicPersonBlockKinds = {
  short: ["short_profile", "profile"],
  biography: ["biography", "bio", "history", "description", "text", "personality"],
} as const;
export type PublicPersonBlock = { kind: string; content: string };
/** Image order for a person: the full-body character (secondary image) first, then the portrait. Only released
 * fields reach here, so an unreleased full-body image falls back to the released portrait. */
export const publicPersonImageFields = ["image_secondary", "image_primary", "image"] as const;

/** Plain teaser of a (public) rich text value. */
export function publicTeaser(value: unknown, max = 220): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const text = documentText(publicBlocks(readPublicDocument(value).blocks)).replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max).replace(/\s\S*$/, "") + " …" : text;
}

/** Input: the group (player) projection of a main place. Areas, rooms, Erkenntnisse, activity, address, coordinates,
 * markers, faction signals and media are deliberately not part of the website. */
export function publicPlace(location: {
  id: string; title: string; subtitle?: string; district?: string; summary?: string; atmosphere?: string;
  worldState?: string; image?: string; discovery?: string; navigationOnly?: boolean;
}): PublicPlace | null {
  if (location.navigationOnly || !knownDiscovery.includes(String(location.discovery))) return null;
  const title = cleanLine(location.title, 160);
  if (!title) return null;
  return {
    id: location.id,
    title,
    subtitle: cleanLine(location.subtitle, 160),
    district: cleanLine(location.district, 160),
    summary: publicRichText(location.summary),
    atmosphere: publicRichText(location.atmosphere),
    worldState: cleanLine(location.worldState, 40) || "active",
    image: publicImageSource("place", location.id, [location.image]).image,
  };
}

/** Input: an NPC already projected for the group (field releases applied, secret keys stripped) and its released,
 * player-visible narrative blocks in dossier order. */
export function publicPerson(entity: { id: string; title: string; content: Record<string, unknown> }, blocks: PublicPersonBlock[] = []): PublicPerson | null {
  const name = cleanLine(entity.title);
  if (!name) return null;
  const c = entity.content;
  const ofKinds = (kinds: readonly string[]) => blocks.filter(block => kinds.includes(block.kind)).map(block => block.content);
  const summarySource = typeof c.summary === "string" && c.summary.trim() ? c.summary : typeof c.concept === "string" && c.concept.trim() ? c.concept : ofKinds(publicPersonBlockKinds.short)[0];
  return {
    id: entity.id,
    name,
    alias: cleanLine(c.alias),
    epithet: cleanLine(c.title),
    role: cleanLine(c.role),
    clan: cleanLine(c.clan),
    summary: publicRichText(summarySource),
    // "Biografie": the legacy text plus the released biography and personality blocks.
    description: joinPublicRichText([c.text, ...ofKinds(publicPersonBlockKinds.biography)]),
    knownFor: cleanList(c.known_for),
    affiliation: cleanList(c.affiliation),
    image: publicImageSource("person", entity.id, publicPersonImageFields.map(key => c[key])).image,
  };
}

function publicDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match && Number.isFinite(Date.parse(match[1])) ? match[1] : "";
}

/** Input: a group-visible Chronik record and its player-projected body. The session link of a Rückblick stays private. */
export function publicChronicleEntry(record: { id: string; title: string }, body: Record<string, unknown>): PublicChronicleEntry | null {
  const title = cleanLine(record.title);
  if (!title) return null;
  return {
    id: record.id,
    title,
    date: publicDate(body.date),
    kind: body.type === "rueckblick" ? "rueckblick" : "ereignis",
    text: publicRichText(typeof body.text === "string" && body.text.trim() ? body.text : body.summary),
  };
}

/** Newest first; undated entries last. */
export function sortPublicChronicle(entries: PublicChronicleEntry[]) {
  return [...entries].sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000") || a.title.localeCompare(b.title, "de-DE"));
}
