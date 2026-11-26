// Öffentliche Welt: read-only projections for anonymous website visitors.
// Campaign-neutral: callers pass already projected *group* data, never raw SL rows. A website release is always a
// subset of what the whole group may see; the explicit website flag alone never discloses anything.
// Note: "public" in the location model means "generally known inside the game", not "shown on the website".
// The website release therefore uses its own flag keys below.
import { encodeRichText, readRichText, type RichTextBlock, type RichTextDocument, type RichTextInline } from "./location-rich-text.ts";

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
  /** Only bundled static images (/images/…); uploads need a login and are never emitted. */
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
export type PublicWorld = { places: PublicPlace[]; people: PublicPerson[]; chronicle: PublicChronicleEntry[] };

const knownDiscovery = ["known", "visited", "investigated"];

/** The flag counts only as an explicit boolean true; strings, numbers or missing keys never publish. */
export function isMarkedForWebsite(data: unknown, key: string): boolean {
  return !!data && typeof data === "object" && !Array.isArray(data) && (data as Record<string, unknown>)[key] === true;
}

export function publicStaticImage(value: unknown): string {
  return typeof value === "string" && /^\/images\/[a-zA-Z0-9._-]+$/.test(value) ? value : "";
}

const cleanLine = (value: unknown, max = 200) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const cleanList = (value: unknown) => Array.isArray(value) ? value.map(item => cleanLine(item)).filter(Boolean).slice(0, 20) : [];

function publicInlines(parts: RichTextInline[]): RichTextInline[] {
  // Internal links lead into the protected app (and carry entry IDs); keep their text, drop the target.
  return parts.map(({ href, ...rest }) => href && /^(https?:|mailto:)/i.test(href) ? { ...rest, href } : rest);
}

function publicBlocks(blocks: RichTextBlock[]): RichTextBlock[] {
  return blocks.flatMap((block): RichTextBlock[] => {
    // Embedded images point to the authenticated file API; a guest could not load them and must not learn their IDs.
    if (block.type === "image") return [];
    if (block.type === "details") {
      const content: RichTextDocument = { version: 1, blocks: publicBlocks(block.content.blocks) };
      return content.blocks.length ? [{ ...block, content }] : [];
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
  const blocks = publicBlocks(readRichText(value).blocks);
  if (!documentText(blocks).trim()) return "";
  return encodeRichText({ version: 1, blocks });
}

/** Plain teaser of a (public) rich text value. */
export function publicTeaser(value: unknown, max = 220): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const text = documentText(readRichText(value).blocks).replace(/\s+/g, " ").trim();
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
    image: publicStaticImage(location.image),
  };
}

/** Input: an NPC already projected for the group (field releases applied, secret keys stripped). */
export function publicPerson(entity: { id: string; title: string; content: Record<string, unknown> }): PublicPerson | null {
  const name = cleanLine(entity.title);
  if (!name) return null;
  const c = entity.content;
  return {
    id: entity.id,
    name,
    alias: cleanLine(c.alias),
    epithet: cleanLine(c.title),
    role: cleanLine(c.role),
    clan: cleanLine(c.clan),
    summary: publicRichText(typeof c.summary === "string" && c.summary.trim() ? c.summary : c.concept),
    description: publicRichText(c.text),
    knownFor: cleanList(c.known_for),
    affiliation: cleanList(c.affiliation),
    image: publicStaticImage(c.image_primary) || publicStaticImage(c.image),
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
