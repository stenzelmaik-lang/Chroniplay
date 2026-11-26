"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Clapperboard, NotebookPen, Plus, SkipForward } from "lucide-react";
import { emptyScene, type SceneSummary, type SceneView } from "@/domain/story-scene";
import type { PreparedSession } from "@/domain/story-preparation";
import type { MomentKind, MomentView } from "@/domain/command-workspace";
import { momentKindNames } from "@/domain/command-workspace";
import { orderedSessionScenes } from "@/domain/session-overview";
import { eveningPlayLog, playStatusNames } from "@/domain/play-log";
import { newStrand, strandKinds, strandsForScene, type ThreadView } from "@/domain/plot-threads";
import { patchStrand } from "../storyboard-threads";
import s from "./regie-evening.module.css";

/** Storyboard 2.0, Phase 4: the evening in the Regie. Planned order with the actual state of each scene, switching,
 * skipping, a spontaneous scene, and recording decisions and notes as the evening goes. SL only.
 * Starting a scene uses the Regie's own activate (the table records the run); everything else goes through the
 * existing command-center routes. The preparation of a scene is never changed here, only the evening's order. */

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!r.ok) throw new Error(d.error || d.message || "Anfrage fehlgeschlagen.");
  return d;
}

export function RegieEvening({ sessionId, stageSceneId, busy, activate }: { sessionId: string; stageSceneId: string; busy: boolean; activate: (sceneId: string) => Promise<boolean> }) {
  const [evening, setEvening] = useState<PreparedSession | null>(null);
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [moments, setMoments] = useState<MomentView[]>([]);
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [message, setMessage] = useState(""), [working, setWorking] = useState(false);
  const [spontaneous, setSpontaneous] = useState("");
  const [note, setNote] = useState(""), [noteKind, setNoteKind] = useState<MomentKind>("decision"), [noteThread, setNoteThread] = useState("");

  const load = useCallback(async () => {
    try {
      const [prep, list, log, plot] = await Promise.all([
        call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(sessionId)).catch(() => null),
        call<{ scenes: SceneSummary[] }>("/api/command-center/scenes"),
        call<{ moments: MomentView[] }>("/api/command-center/moments?sessionId=" + encodeURIComponent(sessionId)),
        call<{ threads: ThreadView[] }>("/api/command-center/threads").catch(() => ({ threads: [] as ThreadView[] })),
      ]);
      setEvening(prep?.session || null); setScenes(list.scenes); setMoments(log.moments); setThreads(plot.threads);
    } catch (error) { setMessage((error as Error).message); }
  }, [sessionId]);
  // Reload when the scene on the table changes: the table has just recorded a run.
  useEffect(() => { const timer = setTimeout(() => void load(), stageSceneId ? 600 : 0); return () => clearTimeout(timer); }, [load, stageSceneId]);

  const planned = evening ? orderedSessionScenes(evening.id, evening.document, scenes).filter(scene => !scene.archived) : [];
  const log = eveningPlayLog(sessionId, planned.map(scene => scene.id), scenes, moments);
  const running = scenes.find(scene => scene.id === stageSceneId);
  const runningRun = running?.runs.findLast(run => run.sessionId === sessionId && run.status !== "completed");
  const extra = log.spontaneous.map(id => scenes.find(scene => scene.id === id)).filter((scene): scene is SceneSummary => !!scene);
  const pending = running ? strandsForScene(threads, running.id) : [];

  async function act(work: () => Promise<void>, done: string) {
    if (working || busy) return;
    setWorking(true); setMessage("");
    try { await work(); await load(); setMessage(done); }
    catch (error) { setMessage((error as Error).message); }
    finally { setWorking(false); }
  }
  const moment = (kind: MomentKind, text: string, scene?: SceneSummary, runId = "") => call("/api/command-center/moments", {
    clientRequestId: crypto.randomUUID(), kind, text: text.slice(0, 3000), sessionId,
    storyId: scene?.storyId || "", sceneId: scene?.id || "", runId: scene ? runId : "", references: [],
  });
  const skip = (scene: SceneSummary) => act(() => moment("skipped", "Übersprungen: " + scene.title, scene).then(() => undefined), "„" + scene.title + "“ als übersprungen vermerkt. Die Vorbereitung bleibt erhalten.");

  /** A spontaneous scene: created as an idea in the evening's book, placed right after the running scene, then started. */
  async function startSpontaneous() {
    const title = spontaneous.trim();
    if (!title || !evening) return;
    await act(async () => {
      const storyId = running?.storyId || evening.document.storyIds[0] || "";
      const created = (await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document: { ...emptyScene(storyId), title: title.slice(0, 200), board: { status: "working" } } })).scene;
      const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
      const ids = fresh.document.sceneIds.filter(id => id !== created.id), at = running ? ids.indexOf(running.id) : -1;
      ids.splice(at >= 0 ? at + 1 : ids.length, 0, created.id);
      await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: ids } });
      setSpontaneous("");
      await activate(created.id);
    }, "Spontane Szene „" + title + "“ angelegt, eingereiht und gestartet.");
  }

  /** Records a decision or note for the running scene (or the evening); a decision can also land in a plot thread. */
  async function record() {
    const text = note.trim();
    if (!text) return;
    await act(async () => {
      await moment(noteKind, text, runningRun ? running : undefined, runningRun?.id || "");
      if (noteKind === "decision" && noteThread) {
        const { thread } = await call<{ thread: ThreadView }>("/api/command-center/threads?id=" + encodeURIComponent(noteThread));
        const strand = { ...newStrand("decision", text.slice(0, 200), running?.id || ""), text: text.length > 200 ? text : "" };
        await call("/api/command-center/threads", { action: "save", id: thread.id, version: thread.version, document: { ...thread.document, strands: [...thread.document.strands, strand] } });
      }
      setNote("");
    }, momentKindNames[noteKind] + " festgehalten" + (noteKind === "decision" && noteThread ? " und im Handlungsstrang vermerkt." : "."));
  }

  if (!evening) return <p className={s.empty}>Diese Runde ist mit keinem vorbereiteten Spielabend verbunden. Szenen startest du oben über die Szenenauswahl.</p>;
  const playedCount = planned.filter(scene => log.status[scene.id] === "played" || log.status[scene.id] === "running").length;
  return <div className={s.evening}>
    <p className={s.summary}>{evening.document.title} · {playedCount} von {planned.length} geplanten Szenen gespielt{log.skipped.length ? ` · ${log.skipped.length} übersprungen` : ""}{extra.length ? ` · ${extra.length} spontan` : ""}</p>
    <ol className={s.list}>
      {[...planned, ...extra].map((scene, index) => {
        const status = log.status[scene.id] || "open", isRunning = scene.id === stageSceneId, isExtra = index >= planned.length;
        return <li key={scene.id} data-status={isRunning ? "running" : status}>
          <span className={s.no}>{isExtra ? "+" : String(index + 1).padStart(2, "0")}</span>
          <span className={s.title}>{scene.title}{isExtra && <small> · spontan</small>}</span>
          <span className={s.state}>{isRunning ? "Läuft" : playStatusNames[status]}</span>
          <span className={s.actions}>
            {!isRunning && <button type="button" disabled={busy || working} onClick={() => void act(async () => { await activate(scene.id); }, "„" + scene.title + "“ läuft auf dem Tisch.")}><Clapperboard size={14} aria-hidden="true" />{status === "played" ? "Erneut" : "Starten"}</button>}
            {status === "open" && !isRunning && <button type="button" disabled={busy || working} onClick={() => void skip(scene)}><SkipForward size={14} aria-hidden="true" />Überspringen</button>}
          </span>
        </li>;
      })}
    </ol>
    <form className={s.row} onSubmit={event => { event.preventDefault(); void startSpontaneous(); }}>
      <label><span>Spontane Szene</span><input value={spontaneous} maxLength={200} onChange={event => setSpontaneous(event.target.value)} placeholder="Titel – wird nach der laufenden Szene eingereiht und gestartet" /></label>
      <button type="submit" disabled={busy || working || !spontaneous.trim()}><Plus size={14} aria-hidden="true" />Anlegen und starten</button>
    </form>
    {pending.length > 0 && <section className={s.pending} aria-label="Vorgemerkt für die laufende Szene">
      <h4>Vorgemerkt für „{running?.title}“</h4>
      <ul>{pending.map(item => <li key={item.threadId + item.strand.id}>
        <span><strong>{strandKinds[item.strand.kind].label}: {item.strand.title}</strong><small>{item.threadTitle}{item.strand.deadline ? " · " + item.strand.deadline : ""}</small></span>
        <label><span className={s.sr}>Stand: {item.strand.title}</span><select value={item.strand.state} disabled={working} onChange={event => { const state = event.target.value; void act(async () => { await patchStrand(item.threadId, item.strand.id, { state }); }, "Stand gespeichert."); }}>
          {Object.entries(strandKinds[item.strand.kind].states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </li>)}</ul>
    </section>}
    <form className={s.record} onSubmit={event => { event.preventDefault(); void record(); }}>
      <label className={s.wide}><span><NotebookPen size={13} aria-hidden="true" /> Festhalten{running && runningRun ? " zu „" + running.title + "“" : " für den Abend"}</span>
        <textarea rows={2} maxLength={3000} value={note} onChange={event => setNote(event.target.value)} placeholder="Was hat die Runde entschieden? Was ist passiert?" /></label>
      <label><span>Art</span><select value={noteKind} onChange={event => setNoteKind(event.target.value as MomentKind)}><option value="decision">Entscheidung</option><option value="note">Notiz</option></select></label>
      {noteKind === "decision" && threads.length > 0 && <label><span>Auch im Handlungsstrang</span><select value={noteThread} onChange={event => setNoteThread(event.target.value)}><option value="">Nein</option>{threads.filter(thread => thread.document.status !== "dropped" && thread.document.status !== "resolved").map(thread => <option key={thread.id} value={thread.id}>{thread.document.title}</option>)}</select></label>}
      <button type="submit" disabled={busy || working || !note.trim()}><Check size={14} aria-hidden="true" />Festhalten</button>
    </form>
    {(log.decisions.length > 0 || log.notes.length > 0 || log.events.length > 0) && <details className={s.logList}><summary>Heute festgehalten · {log.decisions.length + log.notes.length + log.events.length}</summary>
      <ul>{[...log.decisions, ...log.notes, ...log.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map(m => <li key={m.id}><small>{momentKindNames[m.kind]} · {new Date(m.occurredAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}{m.sceneId ? " · " + (scenes.find(scene => scene.id === m.sceneId)?.title || "Szene") : ""}</small>{m.text}</li>)}</ul>
    </details>}
    {message && <p className={s.message} role="status">{message}</p>}
  </div>;
}
