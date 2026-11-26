"use client";
// Orte: actions the SL prepared for a main place (for example "back room opens"). They used to live only in the
// SL dossier on "Schauplätze"; the SL now works in the Command Center (owner decision 26.11.2026).
// Existing routes: read from the SL projection, trigger via /api/locations/actions (SL only). Hidden when a place has none.
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { PlaceProjection, PreparedPlaceAction } from "@/domain/location-types";
import { api } from "./api-client";
import cmsStyles from "./location-cms.module.css";

export function LocationPreparedActions({ placeId, disabled = false }: { placeId: string; disabled?: boolean }) {
  const [actions, setActions] = useState<PreparedPlaceAction[] | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const read = useCallback(async () => {
    try {
      const { projection } = await api<{ projection: PlaceProjection }>("/api/locations?view=sl&target=group&place=" + encodeURIComponent(placeId));
      setActions(projection.location.preparedActions ?? []);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Die Ortsaktionen konnten nicht geladen werden."); }
  }, [placeId]);
  useEffect(() => { const timer = window.setTimeout(() => { void read(); }, 0); return () => window.clearTimeout(timer); }, [read]);

  async function trigger(action: PreparedPlaceAction) {
    setBusy(action.id); setError("");
    try {
      await api("/api/locations/actions", "POST", { placeId, actionId: action.id });
      toast.success(`„${action.label}“ ausgelöst.`);
      await read();
    } catch (e) { setError(e instanceof Error ? e.message : "Die Aktion konnte nicht ausgelöst werden."); }
    finally { setBusy(""); }
  }

  if (!actions?.length && !error) return null;
  return <section className={cmsStyles.worldStatePanel} aria-label="Ortsaktionen">
    <p><strong>Ortsaktionen</strong> <small>Vorbereitete Auslöser für diesen Ort</small></p>
    {actions?.map(action => <div key={action.id} className={cmsStyles.preparedAction}>
      <span><strong>{action.label}</strong><small>{action.target}</small></span>
      <button type="button" className="button" disabled={disabled || !!busy || action.status === "triggered"} onClick={() => void trigger(action)}>
        {action.status === "triggered" ? "Ausgelöst" : busy === action.id ? "Wird ausgelöst …" : "Auslösen"}
      </button>
    </div>)}
    {error && <p role="alert"><small>{error}</small></p>}
  </section>;
}
