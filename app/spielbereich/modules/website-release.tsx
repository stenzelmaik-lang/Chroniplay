"use client";
// Öffentliche Welt: one switch per entry, "Auf der Website zeigen". The website shows an entry only when it is also
// released to the group; the hint says so before the SL wonders why a marked entry does not appear.
import { useState } from "react";
import { toast } from "sonner";
import { publicWorldOrderHints } from "@/domain/public-world";
import { api } from "./api-client";
import styles from "./website-release.module.css";

export function WebsiteSwitch({ checked, disabled = false, onChange, hint, note, anchor }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  hint: string;
  note?: string;
  anchor: "orte" | "persoenlichkeiten" | "chronik";
}) {
  return <section className={styles.release} aria-label="Website">
    <label className={styles.switch}><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span>Auf der Website zeigen</span></label>
    <p>{hint}</p>
    <p>{publicWorldOrderHints[anchor === "orte" ? "places" : anchor === "persoenlichkeiten" ? "people" : "chronicle"]}</p>
    {note && <p className={styles.note} role="status">{note}</p>}
    <span className={styles.links}><a className={styles.link} href={"/kampagne/welt#" + anchor} target="_blank" rel="noopener">Öffentliche Seite ansehen</a><a className={styles.link} href="/sl/command-center?bereich=rueckblick&ansicht=website">Übersicht</a></span>
  </section>;
}

const knownDiscovery = ["known", "visited", "investigated"];

/** Main places: saved at once, version protected by the node revision (like the milestone binding). */
export function LocationWebsiteToggle({ node, disabled = false, onSaved }: {
  node: { id: string; revision: number; showOnWebsite?: boolean; groupDiscovery: string };
  disabled?: boolean;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const checked = node.showOnWebsite === true;
  async function save(show: boolean) {
    setBusy(true); setError("");
    try {
      await api("/api/cms/location-website", "POST", { entityId: node.id, expectedRevision: node.revision, show });
      toast.success(show ? "Der Ort ist für die Website markiert." : "Der Ort ist nicht mehr auf der Website.");
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die Website-Freigabe konnte nicht gespeichert werden.");
      if ((e as { status?: number }).status === 409) await onSaved();
    } finally { setBusy(false); }
  }
  const groupKnows = knownDiscovery.includes(node.groupDiscovery);
  return <>
    <WebsiteSwitch anchor="orte" checked={checked} disabled={disabled || busy} onChange={show => void save(show)}
      hint="Gäste sehen Name, Untertitel, Stadtteil, Beschreibung und Zustand. Bereiche, Räume, Erkenntnisse, Adresse und Karte bleiben im Spielbereich."
      note={checked && !groupKnows ? "Noch nicht sichtbar: Erst wenn die Gruppe den Ort kennt, erscheint er auf der Website." : undefined} />
    {error && <p role="alert" className="error-box">{error}</p>}
  </>;
}
