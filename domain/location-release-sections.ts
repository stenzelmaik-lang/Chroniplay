import type { PlaceProjection } from "./location-types.ts";
import { locationPublicKey } from "./location-public-key.ts";

/** Which of `ids` the real player projection shows. Player views carry presentation keys, never internal ids,
 * so sections are matched by their dossier key; redacted placeholder areas never count as seen. */
export function playerSeenIds(projection: PlaceProjection | null, ids: string[]): Set<string> {
  const place = projection?.location;
  if (!place) return new Set();
  const keyOf = (item: { dossierHref?: string }) => item.dossierHref ? new URL(item.dossierHref, "https://chroniplay.invalid").searchParams.get("eintrag") : null;
  const keys = new Set<string>();
  for (const area of place.areas) {
    if (!area.redacted) { const key = keyOf(area); if (key) keys.add(key); }
    for (const room of area.rooms) { const key = keyOf(room); if (key) keys.add(key); }
  }
  for (const info of place.knownInformation) { const key = keyOf(info); if (key) keys.add(key); }
  return new Set(ids.filter(id => id === place.id || keys.has(locationPublicKey(id))));
}

/** Orte, Weg B Teil 2: what the group of players currently gets for one section of a place.
 * `seen` comes from the real group player projection, never from release rows alone: a section that was
 * never handled by the CMS shows its original text (Grundfassung) as soon as it is discovered. */
export type SectionRelease = NonNullable<PlaceProjection["location"]["slGroupReleases"]>[number];
export type SectionState = "sl" | "visible" | "newer" | "base" | "undiscovered" | "ready" | "blocked" | "draft";
export type SectionAction = "publish" | "revoke" | "discover" | "finish" | null;

export const sectionStateText: Record<SectionState, string> = {
  sl: "Nur für dich",
  visible: "Spieler sehen das",
  newer: "Spieler sehen eine ältere Fassung",
  base: "Spieler sehen die Grundfassung",
  undiscovered: "Noch unentdeckt",
  ready: "Fertig, noch nicht freigeschaltet",
  blocked: "Gesperrt",
  draft: "Noch in Arbeit",
};

const newerApproved = (row: SectionRelease) => !!row.approvedRevisionId && row.approvedRevisionId !== row.lastPublishedRevisionId;

export function sectionState(entry: { visibility?: string }, row: SectionRelease | undefined, seen: boolean): SectionState {
  if (entry.visibility === "gm" || row?.secret) return "sl";
  const published = row?.transition === "publish", untouched = !row || row.transition === "none";
  if (seen) {
    if (published) return newerApproved(row!) ? "newer" : "visible";
    return untouched ? "base" : "visible";
  }
  if (published && row!.discoveryState === "hidden") return "undiscovered";
  if (row?.approvedRevisionId) return "ready";
  if (row?.transition === "block") return "blocked";
  if (untouched && row && row.discoveryState === "hidden") return "undiscovered";
  return "draft";
}

/** The one action a section offers. A Grundfassung with an approved new text offers that text first. */
export function sectionAction(state: SectionState, row: SectionRelease | undefined): SectionAction {
  if (state === "sl" || !row) return state === "draft" ? "finish" : null;
  if (state === "visible") return "revoke";
  if (state === "base") return row.approvedRevisionId ? "publish" : "revoke";
  if (state === "newer" || state === "ready") return "publish";
  if (state === "undiscovered") return "discover";
  if (state === "blocked") return "revoke";
  return "finish";
}

export const sectionActionText = (state: SectionState, action: SectionAction) =>
  action === "publish" ? (state === "ready" ? "Freischalten" : "Neue Fassung freischalten")
    : action === "revoke" ? (state === "blocked" ? "Sperre aufheben" : "Verbergen")
      : action === "discover" ? "Sichtbar machen"
        : action === "finish" ? "Fertigstellen" : "";
