"use client";
// Orte: preview on a second screen. Follows the place selected in the Orte workshop and reloads after every
// save or release. Shows either the SL draft or what the group of players sees right now.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Actor } from "@/domain/types";
import type { PlaceProjection } from "@/domain/location-types";
import { api } from "./api-client";
import { openLocationPreviewChannel, type LocationPreviewMessage } from "./location-preview-channel";
import { WorldExperience } from "./world-experience";
import styles from "./location-preview-window.module.css";

type Target = { placeId: string; entityId: string; title: string; revisionId: string | null; previewable: boolean };
type Mode = "draft" | "players";

export function LocationPreviewWindow({ a, placeHint, entityHint }: { a: Actor; placeHint: string; entityHint: string }) {
  const [target, setTarget] = useState<Target | null>(placeHint ? { placeId: placeHint, entityId: entityHint || placeHint, title: "", revisionId: null, previewable: false } : null);
  const [mode, setMode] = useState<Mode>("draft");
  const [projection, setProjection] = useState<PlaceProjection | null | undefined>(undefined);
  const [loadedAt, setLoadedAt] = useState("");
  const [shown, setShown] = useState<Mode>("players");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = useCallback(async (next: Target, wanted: Mode) => {
    const id = ++request.current;
    const useDraft = wanted === "draft" && next.previewable && !!next.revisionId;
    setError("");
    try {
      const data = useDraft
        ? await api<{ projection: PlaceProjection }>("/api/cms/preview", "POST", { revisionId: next.revisionId })
        : await api<{ projection: PlaceProjection }>("/api/locations?view=player&target=group&place=" + encodeURIComponent(next.placeId));
      if (id !== request.current) return;
      setProjection(data.projection); setShown(useDraft ? "draft" : "players");
    } catch (e) {
      if (id !== request.current) return;
      if ((e as { status?: number }).status === 404) { setProjection(null); setShown(useDraft ? "draft" : "players"); }
      else setError(e instanceof Error ? e.message : "Die Vorschau konnte nicht geladen werden.");
    }
    if (id === request.current) setLoadedAt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, []);

  // Follow the workshop: it answers "hello" with its current state and announces every change.
  useEffect(() => {
    const channel = openLocationPreviewChannel((message: LocationPreviewMessage) => {
      if (message.type !== "state") return;
      setConnected(true);
      setTarget({ placeId: message.placeId, entityId: message.entityId, title: message.title, revisionId: message.revisionId, previewable: message.previewable });
    });
    channel.post({ type: "hello" });
    return () => channel.close();
  }, []);

  useEffect(() => {
    if (!target) return;
    const timer = window.setTimeout(() => { void load(target, mode); }, 0);
    return () => window.clearTimeout(timer);
  }, [target, mode, load]);

  useEffect(() => { document.title = "Vorschau" + (target?.title ? " · " + target.title : "") + " · ChroniPlay"; }, [target?.title]);

  const draftPossible = !!target?.previewable && !!target.revisionId;
  return <div className={styles.window}>
    <header className={styles.bar}>
      <div className={styles.title}>
        <strong>Vorschau{target?.title ? ": " + target.title : ""}</strong>
        <small>{connected ? "Folgt der Orte-Werkstatt und lädt nach jedem Speichern neu." : "Öffne die Orte-Werkstatt, dann folgt diese Vorschau deiner Auswahl."}</small>
      </div>
      <div className={styles.modes} role="radiogroup" aria-label="Was zeigt die Vorschau?">
        <button type="button" role="radio" aria-checked={mode === "draft"} onClick={() => setMode("draft")}>Mein Entwurf</button>
        <button type="button" role="radio" aria-checked={mode === "players"} onClick={() => setMode("players")}>Was die Spieler sehen</button>
      </div>
      <div className={styles.state} aria-live="polite">
        {mode === "draft" && !draftPossible && target ? <span>Kein Entwurf für Spieler – du siehst den Spielerstand.</span> : <span>{shown === "draft" ? "Entwurf, noch nicht freigegeben" : "So sehen es die Spieler jetzt"}</span>}
        {loadedAt && <small>Stand {loadedAt}</small>}
      </div>
    </header>
    {error && <p role="alert" className="error-box">{error}</p>}
    {!target ? <p className={styles.empty}>Noch kein Ort gewählt. Wähle in der Orte-Werkstatt einen Ort aus.</p>
      : projection === undefined ? <p className={styles.empty}>Vorschau wird geladen …</p>
        : projection === null ? <p className={styles.empty}>{shown === "draft" ? "Dieser Entwurf zeigt den Spielern noch nichts." : "Die Spieler sehen von diesem Ort noch nichts."}</p>
          : <main className={styles.stage}><WorldExperience a={a} dataScope={a.campaignId + ":" + a.id + ":gm:orte-vorschau"} projectionOverride={projection} embeddedLabel={shown === "draft" ? "SL-Entwurf · nicht veröffentlicht" : "Spielerstand · veröffentlicht"} /></main>}
  </div>;
}
