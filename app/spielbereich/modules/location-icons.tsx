"use client";
// Orte: one icon language for what the players know and for the state of a place, used in the workshop and
// in the player dossier. Noir mood: whispers, a pin on the map, footprints, the magnifier.
import { DoorClosed, DoorOpen, Ear, EyeOff, Flame, Footprints, Ghost, MapPin, ScanSearch, Sparkles, type LucideIcon } from "lucide-react";
import type { DiscoveryState, WorldStateId } from "@/domain/location-types";

export const discoveryIcons: Record<DiscoveryState, LucideIcon> = { hidden: EyeOff, rumored: Ear, known: MapPin, visited: Footprints, investigated: ScanSearch };
export const worldStateIcons: Record<WorldStateId, LucideIcon> = { active: DoorOpen, changed: Sparkles, inaccessible: DoorClosed, destroyed: Flame, abandoned: Ghost };

/** Workshop wording: what the SL switches. Players read the dossier wording (for example "Nicht zugänglich"). */
export const worldStateNames: Record<WorldStateId, string> = { active: "Offen", changed: "Verändert", inaccessible: "Geschlossen", destroyed: "Zerstört", abandoned: "Verlassen" };
export const worldStateHints: Record<WorldStateId, string> = {
  active: "Normal zugänglich.",
  changed: "Etwas hat sich hier verändert; die Spieler sehen den Hinweis „Verändert“.",
  inaccessible: "Zu, versperrt oder bewacht; die Spieler sehen „Nicht zugänglich“.",
  destroyed: "Zerstört; die Spieler sehen „Zerstört“.",
  abandoned: "Niemand mehr da; die Spieler sehen „Verlassen“.",
};

export function DiscoveryIcon({ state, size = 15 }: { state: string; size?: number }) {
  const Icon = discoveryIcons[state as DiscoveryState] ?? MapPin;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export function WorldStateIcon({ state, size = 15 }: { state: string; size?: number }) {
  const Icon = worldStateIcons[state as WorldStateId] ?? DoorOpen;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
