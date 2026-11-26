"use client";
// Regie: the places of the running scene with their state on site. One click switches it at the table;
// the players see it in the dossier on their next load. Existing route /api/locations/state, version protected.
import { useState } from "react";
import { worldStateIds, type WorldStateId } from "@/domain/location-types";
import { api } from "../api-client";
import { WorldStateIcon, worldStateHints, worldStateNames } from "../location-icons";
import type { RegieLocation } from "./types";
import styles from "./regie-locations.module.css";

const levelNames: Record<string, string> = { location: "Hauptort", area: "Bereich", room: "Raum" };

/** `locations` comes from the Regie context; the parent keys this block by its revisions, so fresh data replaces local state. */
export function RegieLocations({ sessionId, sceneId, locations }: { sessionId: string; sceneId: string; locations: RegieLocation[] }) {
  const [rows, setRows] = useState(locations);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function reload() {
    const context = await api<{ locations?: RegieLocation[] }>(`/api/live-stage?sessionId=${encodeURIComponent(sessionId)}&regie=${encodeURIComponent(sceneId)}`);
    setRows(context.locations ?? []);
  }

  async function change(row: RegieLocation, next: WorldStateId) {
    setBusy(row.id); setError(""); setNotice("");
    try {
      const result = await api<{ revision: number }>("/api/locations/state", "POST", { placeId: row.locationId, entityId: row.id, mode: "world", worldState: next, expectedRevision: row.revision, reason: "In der Regie umgeschaltet" });
      setRows(current => current.map(item => item.id === row.id ? { ...item, worldState: next, revision: result.revision } : item));
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) {
        setNotice("Dieser Ort wurde woanders geändert. Die Liste ist jetzt neu geladen; bitte prüfe den Zustand und schalte erneut.");
        try { await reload(); } catch { setError("Die Liste konnte nicht neu geladen werden."); }
      } else {
        setError(e instanceof Error ? e.message : "Der Zustand konnte nicht umgeschaltet werden.");
      }
    } finally { setBusy(""); }
  }

  if (!rows.length) return <p className={styles.empty}>Für diese Szene sind keine Orte vorbereitet. Du legst sie in der Werkbank unter „Orte“ an.</p>;
  return <div className={styles.list}>
    {rows.map(row => <section key={row.id} className={styles.place} aria-label={row.title}>
      <header><strong>{row.title}</strong><small>{levelNames[row.level] ?? "Ort"}{row.main ? " · Hauptschauplatz" : ""}</small></header>
      <div className={styles.states} role="radiogroup" aria-label={"Zustand vor Ort: " + row.title}>
        {worldStateIds.map(id => <button key={id} type="button" role="radio" aria-checked={row.worldState === id} disabled={!!busy} title={worldStateHints[id]}
          onClick={() => { if (row.worldState !== id) void change(row, id); }}><WorldStateIcon state={id} size={16} /><span>{worldStateNames[id]}</span></button>)}
      </div>
    </section>)}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
