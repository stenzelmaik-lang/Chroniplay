import { locationIsSecret } from "./location-discovery.ts";

/** Orte, Etappe 2 and 3: an Erkenntnis can wait for a milestone ("Meilenstein") that the SL reaches during play.
 * Reaching it grants the group knowledge of every matching, non-secret Erkenntnis. Pure rules; the server applies them. */
export const milestoneLabelMaximum = 80;

export function normalizeMilestone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.replace(/\s+/g, " ").trim();
  return label.length > 0 && label.length <= milestoneLabelMaximum ? label : null;
}

const data = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** The milestone an Erkenntnis waits for, or null when it is not bound to one. */
export function unlockMilestoneOf(attributes: unknown): string | null {
  return normalizeMilestone(data(attributes).unlockMilestone);
}

export type MilestoneCandidate = {
  id: string;
  level: string;
  attributes: Record<string, unknown>;
  canonStatus: string;
  content: Record<string, unknown>;
};

/** Ids of the Erkenntnisse this milestone unlocks for the group. Secret, archived, deleted and SL-only entries are never granted. */
export function milestoneGrantIds(candidates: MilestoneCandidate[], label: string): string[] {
  const wanted = normalizeMilestone(label);
  if (!wanted) return [];
  return candidates.flatMap(item => {
    if (item.level !== "information") return [];
    if (unlockMilestoneOf(item.attributes) !== wanted) return [];
    if (["archived", "deleted"].includes(String(item.attributes.lifecycle))) return [];
    if (item.attributes.visibility === "gm") return [];
    if (locationIsSecret(item.canonStatus, item.content, item.attributes)) return [];
    return [item.id];
  });
}
