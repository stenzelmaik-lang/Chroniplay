"use client";
import { useState } from "react";
import { ArrowRight, Clapperboard, History } from "lucide-react";
import type { SceneSummary } from "@/domain/story-scene";
import type { PreparedSession } from "@/domain/story-preparation";
import { eventStateNames, momentKindNames, type EventState } from "@/domain/command-workspace";
import { playStatusNames, type PlayLog } from "@/domain/play-log";
import s from "./storyboard.module.css";

/** Storyboard 2.0, Phase 4: plan and actual play of one evening, side by side, and moving what was not played.
 * The preparation stays as it was; the actual play comes from scene runs and moments. */
export function EveningPlay({ log, planned, scenes, evenings, busy, onOpenScene, onMove }: { log: PlayLog; planned: SceneSummary[]; scenes: SceneSummary[]; evenings: PreparedSession[]; busy: boolean; onOpenScene: (id: string) => void; onMove: (ids: string[], targetId: string) => void }) {
  const [target, setTarget] = useState("");
  const title = (id: string) => scenes.find(scene => scene.id === id)?.title || "Szene nicht verfügbar";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (!log.started) return null;
  // A played scene counts as out of order when a scene planned later was already played before it.
  const outOfOrder = new Set<string>();
  let highest = -1;
  for (const item of log.played) { if (item.plannedIndex < 0) continue; if (item.plannedIndex < highest) outOfOrder.add(item.id); highest = Math.max(highest, item.plannedIndex); }
  return <section className={s.playLog} aria-labelledby="sb-play">
    <h3 id="sb-play"><History size={16} aria-hidden="true" /> Gespielt an diesem Abend</h3>
    <div className={s.playColumns}>
      <div>
        <h4>Geplant</h4>
        <ol>{planned.map(scene => <li key={scene.id} data-status={log.status[scene.id] || "open"}><button type="button" className={s.linkButton} onClick={() => onOpenScene(scene.id)}>{scene.title}</button><small>{playStatusNames[log.status[scene.id] || "open"]}</small></li>)}</ol>
      </div>
      <div>
        <h4>Tatsächlich</h4>
        {log.played.length ? <ol>{log.played.map(item => <li key={item.id} data-status={item.running ? "running" : "played"}>
          <button type="button" className={s.linkButton} onClick={() => onOpenScene(item.id)}>{item.title}</button>
          <small>{time(item.startedAt)}{item.visits > 1 ? ` · ${item.visits}× aufgerufen` : ""}{item.plannedIndex < 0 ? " · spontan" : outOfOrder.has(item.id) ? " · früher als geplant" : ""}</small>
        </li>)}</ol> : <p className={s.planBlank}>Noch keine Szene auf dem Tisch gestartet.</p>}
      </div>
    </div>
    {(log.decisions.length > 0 || log.notes.length > 0 || log.events.length > 0) && <div className={s.playMoments}>
      <h4>Festgehalten</h4>
      <ul>{[...log.decisions, ...log.notes, ...log.events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(m => <li key={m.id} data-kind={m.kind}>
        <small>{momentKindNames[m.kind]}{m.eventState && m.eventState in eventStateNames ? " · " + eventStateNames[m.eventState as EventState] : ""} · {time(m.occurredAt)}{m.sceneId ? " · " + title(m.sceneId) : ""}</small><span>{m.text}</span>
      </li>)}</ul>
    </div>}
    {log.open.length > 0 && <form className={s.linkAdd} onSubmit={event => { event.preventDefault(); onMove(log.open, target); }}>
      <p className={s.viewHint}>{log.open.length} {log.open.length === 1 ? "Szene wurde" : "Szenen wurden"} nicht gespielt: {log.open.map(title).join(", ")}. Die Vorbereitung bleibt vollständig erhalten.</p>
      <label className={s.field}><span>Verschieben nach</span>
        <select value={target} onChange={event => setTarget(event.target.value)}>
          <option value="">Ideenablage (ohne Abend)</option>
          {evenings.map(item => <option key={item.id} value={item.id}>{item.document.title}{item.document.date ? " · " + item.document.date.slice(0, 10) : ""}</option>)}
        </select></label>
      <button type="submit" className={s.ghost} disabled={busy}><ArrowRight size={14} aria-hidden="true" />{log.open.length === 1 ? "Szene verschieben" : `${log.open.length} Szenen verschieben`}</button>
    </form>}
  </section>;
}

/** Opens the Regie for this evening in its own window (second screen). */
export function RegieLink({ sessionId }: { sessionId: string }) {
  return <a className={s.primary} href={"/sl/regie?sessionId=" + encodeURIComponent(sessionId)} target="chroniplay-regie" rel="noopener"><Clapperboard size={16} aria-hidden="true" />In der Regie spielen</a>;
}
