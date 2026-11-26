"use client";
// Orte: state of a place on site (open, changed, closed, destroyed, abandoned) for one section.
// Existing route /api/locations/state (mode "world"), version protected. Reversible, so no extra question.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { worldStateIds, type PlaceProjection, type WorldStateId } from "@/domain/location-types";
import { api } from "./api-client";
import { WorldStateIcon, worldStateHints, worldStateNames } from "./location-icons";
import cmsStyles from "./location-cms.module.css";

export function LocationWorldState({ placeId, entry, current, disabled = false, onChanged }: {
  placeId: string; entry: { id: string; title: string; revision: number };
  /** Known state; when missing it is read from the SL projection. */
  current?: WorldStateId; disabled?: boolean; onChanged: () => Promise<void>;
}) {
  const [loaded, setLoaded] = useState<WorldStateId | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const read = useCallback(async () => {
    if (current) return;
    try {
      const { projection } = await api<{ projection: PlaceProjection }>("/api/locations?view=sl&target=group&place=" + encodeURIComponent(placeId));
      const place = projection.location, world: Record<string, WorldStateId> = { [place.id]: place.worldState };
      for (const area of place.areas) { world[area.viewKey] = area.worldState; for (const room of area.rooms) world[room.viewKey] = room.worldState; }
      setLoaded(world[entry.id] ?? "active");
    } catch (e) { setError(e instanceof Error ? e.message : "Der Zustand konnte nicht geladen werden."); }
  }, [current, placeId, entry.id]);
  useEffect(() => { const timer = window.setTimeout(() => { void read(); }, 0); return () => window.clearTimeout(timer); }, [read]);
  const state = current ?? loaded;

  async function change(next: WorldStateId) {
    setBusy(true); setError("");
    try {
      await api("/api/locations/state", "POST", { placeId, entityId: entry.id, mode: "world", worldState: next, expectedRevision: entry.revision, reason: "Zustand in der Orte-Werkstatt geändert" });
      toast.success(`„${entry.title}“: ${worldStateNames[next]}.`);
      if (!current) setLoaded(next);
      await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Der Zustand konnte nicht gespeichert werden."); if ((e as { status?: number }).status === 409) await onChanged(); }
    finally { setBusy(false); }
  }

  return <div className={cmsStyles.worldStatePanel}>
    <p><strong>Zustand vor Ort:</strong> {entry.title}</p>
    <div className={cmsStyles.worldStateRow} role="radiogroup" aria-label={"Zustand vor Ort: " + entry.title}>
      {worldStateIds.map(id => <button key={id} type="button" role="radio" aria-checked={id === state} disabled={disabled || busy || !state} title={worldStateHints[id]} onClick={() => { if (id !== state) void change(id); }}><WorldStateIcon state={id} />{worldStateNames[id]}</button>)}
    </div>
    <small>{state ? worldStateHints[state] : "Zustand wird geladen …"} Später kannst du das auch in der Regie umschalten.</small>
    {error && <p role="alert" className="error-box">{error}</p>}
  </div>;
}
