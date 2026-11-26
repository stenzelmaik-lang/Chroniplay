"use client";
// Orte, Etappe 2: an Erkenntnis waits for a milestone. The SL names it here; reaching the same name in the Regie
// lets the group learn the Erkenntnis. Saved immediately, version protected by the node revision.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api-client";
import cmsStyles from "./location-cms.module.css";

type Reached = { milestones: { label: string }[]; pending?: { label: string; count: number }[] };

export function LocationMilestoneLink({ node, disabled = false, onSaved }: {
  node: { id: string; revision: number; unlockMilestone?: string | null };
  disabled?: boolean;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(node.unlockMilestone ?? "");
  const [known, setKnown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<Reached>("/api/locations/milestone").then(result => { if (alive) setKnown([...new Set([...(result.pending ?? []).map(item => item.label), ...result.milestones.map(item => item.label)])]); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  async function save(next: string | null) {
    setBusy(true); setError("");
    try {
      await api("/api/cms/location-unlock", "POST", { entityId: node.id, expectedRevision: node.revision, milestone: next, reason: "Freischaltung in der Orte-Werkstatt geändert" });
      setValue(next ?? "");
      toast.success(next ? "Freischaltung gespeichert." : "Freischaltung entfernt.");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Freischaltung konnte nicht gespeichert werden.");
      if ((e as { status?: number }).status === 409) await onSaved();
    } finally { setBusy(false); }
  }

  const bound = (node.unlockMilestone ?? "") !== "";
  return <section className={cmsStyles.milestoneLink} aria-label="Freischaltung durch Meilenstein">
    <strong>Freischaltung durch Meilenstein</strong>
    <p>Die Spieler sehen diese Erkenntnis erst, wenn du in der Regie den gleichen Meilenstein erreichst. Gleicher Name, gleiche Freischaltung.</p>
    <p>Nach dem Meilenstein sehen die Spieler zunächst nur den Titel. Den Text gibst du unter „Für Spieler“ frei, bevor du den Meilenstein erreichst.</p>
    <div className={cmsStyles.milestoneRow}>
      <label className="field"><span>Meilenstein</span><input list={`milestones-${node.id}`} value={value} maxLength={80} disabled={disabled || busy} placeholder="z. B. Der Rundgang" onChange={event => setValue(event.target.value)} /></label>
      <datalist id={`milestones-${node.id}`}>{known.map(label => <option key={label} value={label} />)}</datalist>
      <button type="button" className="button primary" disabled={disabled || busy || value.trim() === (node.unlockMilestone ?? "")} onClick={() => void save(value.trim() || null)}>Speichern</button>
      {bound && <button type="button" className="button" disabled={disabled || busy} onClick={() => void save(null)}>Entfernen</button>}
    </div>
    {error && <p role="alert" className="error-box">{error}</p>}
  </section>;
}
