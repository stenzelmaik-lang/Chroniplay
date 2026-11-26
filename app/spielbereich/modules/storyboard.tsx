"use client";
/* eslint-disable @next/next/no-img-element -- material thumbnails come from the protected /api/files endpoint. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { MoreHorizontal, ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clapperboard, Archive, Clock, Compass, GitBranch, FileText, Link2, Undo2, Film, GripVertical, LayoutGrid, Lightbulb, MapPin, PencilLine, Plus, RotateCcw, ScrollText, Users, Wrench } from "lucide-react";
import type { PreparationRecipient } from "@/domain/personal-message";
import { sceneGuideSteps } from "@/domain/preparation-guide";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { PreparationWhispers } from "./preparation-whispers";
import { preparationPlaces } from "./preparation-catalog";
import type { Actor } from "@/domain/types";
import { authoringTextMax } from "@/domain/authoring-limits";
import { emptyStory, type CommandReference, type StoryView } from "@/domain/command-workspace";
import { emptyScene, type SceneDocument, type SceneSummary, type SceneView } from "@/domain/story-scene";
import { sessionPreparationSchema, type PreparedSession } from "@/domain/story-preparation";
import { orderedSessionScenes, preparationSections, scenePreparation } from "@/domain/session-overview";
import { assignEveningBook, bookEvenings, eveningStatusProgress, guideState, looseEvenings, reorderedSessionSceneIds, sceneResources, sceneStatus, sortEvenings, storyboardGuide, unplacedBookScenes, type EveningStatusProgress, type GuideStepId } from "@/domain/storyboard";
import { boardBlockKinds, boardBlockTypes, boardLinkKindNames, boardLinkMax, possibilityAsScene, boardDuration, boardKind, boardMinutesMax, boardPlotNames, boardPriorities, boardPriorityNames, boardStatuses, boardStatusNames, boardTextMax, compactBoard, formatMinutes, isOptionalBlock, type BoardBlockKind, type BoardStatus, type SceneBoard } from "@/domain/storyboard-blocks";
import { RichTextEditor, RichTextView } from "./rich-text";
import { PreparationFigures } from "./preparation-figures";
import { preparationStatusNames } from "./session-overview";
import { useCommandConfirmation } from "./command-confirmation";
import { BoardLinks, PlotList, PlotNetwork, PlotTimeline, ViewSwitch, type BoardView } from "./storyboard-views";
import { linkedOutside, nextScenes } from "@/domain/storyboard-views";
import { SceneThreads, ThreadPage, ThreadShelf, createThread } from "./storyboard-threads";
import { bookPossibilityAsScene, emptyThread, type ClueKnowledge, type ThreadView } from "@/domain/plot-threads";
import { EveningPlay, RegieLink } from "./storyboard-play";
import { eveningPlayLog, moveScenesBetweenEvenings, playStatusNames } from "@/domain/play-log";
import type { MomentView } from "@/domain/command-workspace";
import { MaterialArea } from "./storyboard-materials";
import { EventsEditor, InsightsEditor, InteractionCardsEditor } from "./storyboard-possibilities";
import { ChecksEditor } from "./storyboard-checks";
import { NotesArea } from "./storyboard-notes";
import { freeTextChecks } from "@/domain/scene-checks";
import { withoutDanglingCardRefs } from "@/domain/scene-possibilities";
import { isMaterialElement } from "@/domain/material-system";
import { LegacyText, CastEditor, ContextEditor, MoodsEditor, PassagesEditor, PlacesEditor, WorkshopHead, WorkshopNav } from "./storyboard-workshop";
import { primaryWorkshopAreas, takeOverDialogue, takeOverPerson, takeOverPlace, takeoverElements, toWorkshop, withWorkshopMirrors, workshopFill, type WorkshopArea } from "@/domain/scene-workshop";
import s from "./storyboard.module.css";

type Book = { id: string; title: string; status: string; updatedAt: string };
type MediaFile = { id: string; name: string; mime: string };
type OpenScene = { id: string; version: number; document: SceneDocument };
const eveningStatuses = ["draft", "ready", "active", "completed"] as const;
type SceneArea = typeof sceneGuideSteps[number]["id"];
const areaPlaceholder: Record<SceneArea, string> = {
  narration: "Was liest du der Runde vor, wenn die Szene beginnt? …", atmosphere: "Licht, Geräusche, Gerüche, Wetter – was spüren die Charaktere? …",
  dialogueNotes: "Was wollen die NPCs? Gesprächsangebote, Ziele, mögliche Antworten …", interactions: "Was setzt du wann ein – und warum? …",
  secrets: "Was bleibt zunächst verborgen? Hintergründe und Voraussetzungen für eine spätere Freigabe …", visions: "Gemeinsame Vision oder Botschaft (optional) …",
  possibleConsequences: "Mögliche Proben, Schwierigkeiten und Folgen – nur geplant, nichts wird ausgelöst …", gmNotes: "Regiehinweise, Tempo, was passiert, wenn … – nur für dich",
};
/** The protected gallery is offered only where pictures belong: the material plan of the scene. NPC pictures come from the NPC dossiers. */
const galleryAreas = new Set<SceneArea>(["interactions"]);
const cardAreaShort: Record<SceneArea, string> = { narration: "Erzählung", atmosphere: "Atmosphäre", dialogueNotes: "NPCs", interactions: "Interaktion", secrets: "Geheimnis", visions: "Visionen", possibleConsequences: "Folgen", gmNotes: "Notizen" };
const elementKindNames: Record<string, string> = { text: "Text", "sl-note": "SL-Notiz", description: "Beschreibung", object: "Gegenstand", clue: "Hinweis", check: "Probe", dialogue: "Dialog", encounter: "Begegnung", place: "Ort", person: "Person", image: "Bild", audio: "Audio", video: "Video", handout: "Handout", puzzle: "Rätsel", pager: "Pager" };
/** Colour family of a status for the existing card, bar and tray styles; review and deferred get their own accents via data-status. */
const statusTone: Record<BoardStatus, "idea" | "draft" | "ready"> = { idea: "idea", working: "draft", review: "draft", ready: "ready", deferred: "idea" };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!r.ok) throw new Error((r.status === 409 ? "Konflikt: Die Akte wurde inzwischen anderswo geändert. " : "") + (d.error || d.message || "Anfrage fehlgeschlagen."));
  return d;
}

const boardViews: BoardView[] = ["cards", "network", "list", "timeline"];
function readView(): BoardView { const v = new URLSearchParams(window.location.search).get("sicht") as BoardView | null; return v && boardViews.includes(v) ? v : "cards"; }
function writeView(view: BoardView) { const url = new URL(window.location.href); if (view === "cards") url.searchParams.delete("sicht"); else url.searchParams.set("sicht", view); window.history.replaceState(window.history.state, "", url); }
type Route = { book: string; evening: string; scene: string; thread?: string };
function readRoute(): Route {
  const q = new URLSearchParams(window.location.search);
  return { book: q.get("buch") || "", evening: q.get("abend") || "", scene: q.get("szene") || "", thread: q.get("strang") || "" };
}
function writeRoute(next: Route, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  for (const [key, value] of [["buch", next.book], ["abend", next.evening], ["szene", next.scene], ["strang", next.thread || ""]] as const) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
  url.searchParams.set("bereich", "sitzung");
  if (url.pathname + url.search !== window.location.pathname + window.location.search) window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

export function Storyboard({ a, onDirty, onClassic }: { a: Actor; onDirty?: (dirty: boolean) => void; onClassic: (sceneId?: string) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<PreparedSession[]>([]);
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [refs, setRefs] = useState<CommandReference[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [route, setRoute] = useState<Route>({ book: "", evening: "", scene: "" });
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [knowledge, setKnowledge] = useState<ClueKnowledge>({});
  const [bookStory, setBookStory] = useState<StoryView | null>(null);
  const [eveningMoments, setEveningMoments] = useState<{ id: string; moments: MomentView[] }>({ id: "", moments: [] });
  const [open, setOpen] = useState<OpenScene | null>(null);
  const [saved, setSaved] = useState("");
  const [wsArea, setWsArea] = useState<WorkshopArea>("passages");
  const [writing, setWriting] = useState<SceneArea | null>(null);
  const [players, setPlayers] = useState<PreparationRecipient[]>([]);
  const [message, setMessage] = useState("Lade deine Geschichte …");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [guideHidden, setGuideHidden] = useState(false);
  const [resume, setResume] = useState<{ book: string; evening: string; scene: string; title: string } | null>(null);
  const [ideaTitle, setIdeaTitle] = useState(""), [ideaText, setIdeaText] = useState("");
  const [dragId, setDragId] = useState(""), [dropIndex, setDropIndex] = useState(-1);
  const [planDraft, setPlanDraft] = useState<string | null>(null);
  const [ideaKind, setIdeaKind] = useState<BoardBlockKind>("scene");
  const [view, setViewState] = useState<BoardView>("cards");
  const [patching, setPatching] = useState("");
  const confirmation = useCommandConfirmation();
  // Szene 2.0, Etappe 6: how many SL notes refer to the open scene (for the area list).
  const [noteCount, setNoteCount] = useState(0);
  const ideaInput = useRef<HTMLInputElement>(null);
  const latest = useRef(open), baseline = useRef(saved), inflight = useRef(false);
  useLayoutEffect(() => { latest.current = open; baseline.current = saved; }, [open, saved]);
  const resumeKey = "chroniplay-storyboard-resume:" + a.campaignId + ":" + a.id, guideKey = "chroniplay-storyboard-guide:" + a.id;

  const refresh = useCallback(async () => {
    const [catalog, prep, media, people, plot] = await Promise.all([
      call<{ stories: Book[]; scenes: SceneSummary[]; references: CommandReference[] }>("/api/command-center"),
      call<{ sessions: PreparedSession[]; places?: { id: string; title: string; parent_id?: string | null; level?: string }[] }>("/api/command-center/preparation"),
      call<{ files?: MediaFile[] }>("/api/files").catch(() => ({ files: [] as MediaFile[] })),
      call<{ recipients?: PreparationRecipient[] }>("/api/messages?recipients=1&context=preparation").catch(() => ({ recipients: [] as PreparationRecipient[] })),
      call<{ threads: ThreadView[]; knowledge: ClueKnowledge }>("/api/command-center/threads").catch(() => ({ threads: [] as ThreadView[], knowledge: {} as ClueKnowledge })),
    ]);
    setBooks(catalog.stories.filter(story => story.status !== "archived"));
    setScenes(catalog.scenes);
    setRefs([...catalog.references.filter(ref => ref.type !== "PLACE"), ...preparationPlaces(prep.places || [])]);
    setPlayers((people.recipients || []).filter(person => person.role === "player"));
    setSessions(prep.sessions);
    setFiles(media.files || []);
    setThreads(plot.threads); setKnowledge(plot.knowledge);
  }, []);

  const loadScene = useCallback(async (id: string) => {
    if (!id) { setOpen(null); setSaved(""); return; }
    const data = await call<{ scene: SceneView }>("/api/command-center/scenes?id=" + encodeURIComponent(id));
    // Older scenes open in the workshop (narration → passage 1, picture and music → default mood). The converted
    // form is the baseline, so nothing is saved until the SL changes something.
    const next = { id: data.scene.id, version: data.scene.version, document: toWorkshop(data.scene.document) };
    setOpen(next); setSaved(JSON.stringify(next.document)); setWriting(null);
  }, []);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try { setGuideHidden(localStorage.getItem(guideKey) === "aus"); const r = JSON.parse(localStorage.getItem(resumeKey) || "null"); if (r && typeof r.scene === "string") setResume(r); } catch { /* per-viewer convenience only */ }
      try {
        await refresh();
        const r = readRoute(); setRoute(r); setViewState(readView());
        if (r.scene) await loadScene(r.scene);
        setMessage("Nur für die Spielleitung · Änderungen werden automatisch gespeichert.");
      } catch (error) { setMessage((error as Error).message); }
      setLoaded(true);
    });
  }, [refresh, loadScene, guideKey, resumeKey]);

  const dirty = !!open && JSON.stringify(open.document) !== saved;
  useEffect(() => { onDirty?.(dirty); return () => onDirty?.(false); }, [dirty, onDirty]);

  const save = useCallback(async () => {
    const start = latest.current;
    if (!start || inflight.current) return !inflight.current;
    if (JSON.stringify(start.document) === baseline.current) return true;
    inflight.current = true; setBusy(true); setMessage("Speichert …");
    try {
      const data = await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "save", id: start.id, version: start.version, document: start.document });
      const stable = JSON.stringify(latest.current?.document) === JSON.stringify(start.document);
      setSaved(JSON.stringify(stable ? data.scene.document : start.document));
      setOpen(value => value?.id === start.id ? { ...value, version: data.scene.version, document: stable ? data.scene.document : value.document } : value);
      setMessage(stable ? "Gespeichert · " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "Ungespeicherte Änderungen · wird gleich gespeichert");
      void refresh();
      return true;
    } catch (error) {
      setMessage((error as Error).message + " Deine Eingaben bleiben erhalten.");
      return false;
    } finally { inflight.current = false; setBusy(false); }
  }, [refresh]);

  const openId = open?.id || "";
  useEffect(() => {
    let live = true;
    if (!openId) return;
    call<{ notes: unknown[] }>("/api/command-center/notes?sceneId=" + encodeURIComponent(openId)).then(d => { if (live) setNoteCount(d.notes.length); }).catch(() => { if (live) setNoteCount(0); });
    return () => { live = false; };
  }, [openId]);

  /** After a library save the server refreshed the copies in this scene: load it again (only when nothing is unsaved). */
  const reloadOpenScene = useCallback(async () => {
    const current = latest.current;
    if (!current || JSON.stringify(current.document) !== baseline.current) return;
    await loadScene(current.id);
  }, [loadScene]);

  useEffect(() => {
    if (!dirty || busy) return;
    const timer = setTimeout(() => void save(), 1400);
    return () => clearTimeout(timer);
  }, [dirty, busy, open, save]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (latest.current && JSON.stringify(latest.current.document) !== baseline.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /** Back from the material window: reload the open scene (only when nothing is unsaved) so new material shows up and the version stays current. */
  const writingRef = useRef(writing);
  useLayoutEffect(() => { writingRef.current = writing; });
  useEffect(() => {
    const back = () => {
      const current = latest.current;
      if (!current || inflight.current || writingRef.current || JSON.stringify(current.document) !== baseline.current) return;
      void call<{ scene: SceneView }>("/api/command-center/scenes?id=" + encodeURIComponent(current.id)).then(data => {
        if (latest.current?.id !== data.scene.id || JSON.stringify(latest.current.document) !== baseline.current) return;
        const document = toWorkshop(data.scene.document);
        setOpen({ id: data.scene.id, version: data.scene.version, document }); setSaved(JSON.stringify(document));
      }).catch(() => undefined);
    };
    window.addEventListener("focus", back);
    return () => window.removeEventListener("focus", back);
  }, []);

  /** Every move between levels first saves the open scene; nothing is silently dropped. */
  async function go(next: Route, mode: "push" | "replace" = "push") {
    if (latest.current && JSON.stringify(latest.current.document) !== baseline.current) {
      if (!(await save()) && !(await confirmation.ask("Die Szene konnte nicht gespeichert werden. Trotzdem wechseln und die letzten Änderungen verwerfen?"))) return;
    }
    writeRoute(next, mode); setRoute(next); setPlanDraft(null);
    try {
      if (next.scene !== latest.current?.id) await loadScene(next.scene);
      if (next.scene) {
        setWsArea("passages"); setWriting(null);
        const title = scenes.find(scene => scene.id === next.scene)?.title || "Szene";
        const entry = { ...next, title }; setResume(entry);
        try { localStorage.setItem(resumeKey, JSON.stringify(entry)); } catch { /* optional */ }
      }
    } catch (error) { setMessage((error as Error).message); }
  }
  const goRef = useRef(go);
  useLayoutEffect(() => { goRef.current = go; });
  useEffect(() => {
    const pop = () => void goRef.current(readRoute(), "replace");
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  function setView(next: BoardView) { setViewState(next); writeView(next); }

  /** Play order across the whole chronicle (evenings in order, then their scenes) – used to rank open strands. */
  const sceneOrder = new Map<string, number>();
  for (const item of sortEvenings(sessions.filter(session => session.document.status !== "archived"))) for (const scene of orderedSessionScenes(item.id, item.document, scenes)) if (!sceneOrder.has(scene.id)) sceneOrder.set(scene.id, sceneOrder.size);

  /** After a thread save: keep the list current and re-read the real discovery of newly linked clue dossiers. */
  function threadSaved(thread: ThreadView) {
    setThreads(list => list.map(item => item.id === thread.id ? thread : item));
    if (thread.document.strands.some(strand => strand.kind === "clue" && strand.refIds.some(ref => !(ref in knowledge))))
      void call<{ knowledge: ClueKnowledge }>("/api/command-center/threads?id=" + encodeURIComponent(thread.id)).then(data => setKnowledge(value => ({ ...value, ...data.knowledge }))).catch(() => undefined);
  }
  function openThread(id: string) {
    if (!id) return void go({ book: route.book, evening: "", scene: "" });
    return void go({ book: route.book, evening: "", scene: "", thread: id });
  }
  /** New thread: from the shelf (opens it) or from a scene (the scene joins it and stays open). */
  async function newThread(bookId: string, title = "", joinSceneId = "") {
    if (busy) return;
    setBusy(true); setMessage("Legt einen Handlungsstrang an …");
    try {
      const thread = await createThread({ ...emptyThread(bookId), title: title.trim().slice(0, 200) || "Neuer Handlungsstrang" });
      setThreads(list => [...list, thread]);
      setBusy(false);
      if (joinSceneId && open?.id === joinSceneId) { changeBoard({ threads: [...(open.document.board?.threads || []), thread.id] }); setMessage("Handlungsstrang „" + thread.document.title + "“ angelegt und zugeordnet."); }
      else { await go({ book: route.book, evening: "", scene: "", thread: thread.id }); setMessage("Handlungsstrang angelegt. Gib ihm einen Titel und sammle seine Fäden."); }
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }
  /** Old plot-dossier possibilities into scene ideas of the book; the dossier keeps everything else. */
  /** Unplayed scenes of this evening go to a later evening (end of its order) or to the idea tray. Preparation stays. */
  async function moveUnplayed(ids: string[], targetId: string) {
    if (!evening || !ids.length || busy) return;
    const targetTitle = sessions.find(item => item.id === targetId)?.document.title;
    if (!(await confirmation.ask(ids.length + (ids.length === 1 ? " Szene" : " Szenen") + " aus diesem Abend " + (targetId ? "an das Ende von „" + targetTitle + "“ verschieben?" : "in die Ideenablage legen?") + " Inhalte und Vorbereitung bleiben unverändert."))) return;
    setBusy(true); setMessage("Verschiebt …");
    try {
      const source = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
      const target = targetId ? (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(targetId))).session : null;
      const moved = moveScenesBetweenEvenings(source.document.sceneIds, target?.document.sceneIds || [], ids);
      // Scenes linked only from the scene side (older data) are released explicitly.
      const unlink = ids.filter(id => !source.document.sceneIds.includes(id));
      if (target) await call("/api/command-center/preparation", { action: "save", id: target.id, version: target.version, document: { ...target.document, sceneIds: moved.to } });
      await call("/api/command-center/preparation", { action: "save", id: source.id, version: source.version, document: { ...source.document, sceneIds: moved.from }, ...(unlink.length ? { unlinkSceneIds: unlink } : {}) });
      await refresh();
      setMessage(ids.length + (ids.length === 1 ? " Szene" : " Szenen") + (targetId ? " nach „" + targetTitle + "“ verschoben." : " in die Ideenablage gelegt."));
    } catch (error) { setMessage((error as Error).message + " Prüfe beide Abende; nichts wurde gelöscht."); }
    finally { setBusy(false); }
  }

  async function convertBookPossibilities() {
    if (!book || !bookStory || bookStory.id !== book.id || busy) return;
    setBusy(true); setMessage("Wandelt die Möglichkeiten um …");
    const done: string[] = [];
    try {
      for (const item of bookStory.possibilities) {
        const next = bookPossibilityAsScene(item);
        await call("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document: { ...emptyScene(book.id), title: next.title, gmNotes: next.gmNotes, board: next.board } });
        done.push(item.id);
      }
    } catch (error) { setMessage((error as Error).message + (done.length ? ` ${done.length} wurden umgewandelt.` : "")); }
    try {
      if (done.length) {
        const v = (await call<{ story: StoryView }>("/api/command-center/story?id=" + encodeURIComponent(book.id))).story;
        const document = { title: v.title, summary: v.summary, status: v.status, favorite: v.favorite, pinned: v.pinned, sections: v.sections, references: v.references, possibilities: v.possibilities.filter(item => !done.includes(item.id)) };
        const saved = (await call<{ story: StoryView }>("/api/command-center/story", { action: "save", id: v.id, version: v.version, document })).story;
        setBookStory(saved);
        await refresh();
        if (done.length === bookStory.possibilities.length) setMessage(done.length + " Möglichkeiten sind jetzt Szenenideen in der Ideenablage.");
      }
    } catch (error) { setMessage((error as Error).message + " Die Szenenideen sind angelegt; die alten Möglichkeiten stehen noch im Plotdossier."); }
    setBusy(false);
  }

  /** Opens a connected scene: inside this evening when it belongs here, otherwise in its book without an evening. */
  async function openLinked(id: string) {
    if (eveningScenes.some(scene => scene.id === id)) return go({ ...route, scene: id });
    const target = scenes.find(scene => scene.id === id);
    return go({ book: target?.storyId || route.book, evening: "", scene: id });
  }

  /** Builds a branch in one step: a new scene idea in the same book, placed right after this scene in the evening
   * (or in the idea tray), connected from here. The current scene saves the connection through the normal autosave. */
  async function createSuccessor(title: string, kind: BoardBlockKind) {
    if (!open || busy || !title.trim()) return;
    if ((open.document.board?.links?.length || 0) >= boardLinkMax) { setMessage("Höchstens " + boardLinkMax + " Verbindungen je Szene."); return; }
    const source = open;
    setBusy(true); setMessage("Legt die Nachfolgeszene an …");
    try {
      const board = compactBoard({ kind, status: "idea" });
      const created = (await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document: { ...emptyScene(source.document.storyId || book?.id || ""), title: title.trim().slice(0, 200), ...(board ? { board } : {}) } })).scene;
      if (evening && eveningScenes.some(scene => scene.id === source.id)) {
        const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
        const ids = fresh.document.sceneIds.filter(id => id !== created.id), at = ids.indexOf(source.id);
        ids.splice(at >= 0 ? at + 1 : ids.length, 0, created.id);
        await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: ids } });
      }
      setOpen(value => value?.id === source.id ? { ...value, document: { ...value.document, board: compactBoard({ ...(value.document.board || {}), links: [...(value.document.board?.links || []), { id: crypto.randomUUID(), to: created.id, kind: "next", label: "", condition: "" }] }) } } : value);
      await refresh();
      setMessage("„" + created.document.title + "“ angelegt und verbunden" + (evening && eveningScenes.some(scene => scene.id === source.id) ? " – im Abend direkt danach eingereiht." : " – liegt in der Ideenablage."));
    } catch (error) { setMessage((error as Error).message + " Es wurde nichts verbunden."); }
    finally { setBusy(false); }
  }

  /** Old free-text branches into the new system: each becomes a scene idea (idea tray) connected as "Alternative".
   * The branch is removed from this scene only after its scene exists, so nothing is lost on an error. */
  async function convertPossibilities(ids: string[]) {
    if (!open || busy) return;
    const source = open, room = boardLinkMax - (source.document.board?.links?.length || 0);
    const items = source.document.possibilities.filter(item => ids.includes(item.id)).slice(0, Math.max(0, room));
    if (!items.length) { setMessage("Höchstens " + boardLinkMax + " Verbindungen je Szene. Entferne zuerst eine Verbindung."); return; }
    setBusy(true); setMessage("Wandelt " + items.length + (items.length === 1 ? " Abzweigung" : " Abzweigungen") + " um …");
    const done: { possibilityId: string; sceneId: string; title: string }[] = [];
    try {
      for (const item of items) {
        const next = possibilityAsScene(item, source.document.storyId || book?.id || "");
        const created = (await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document: { ...emptyScene(next.storyId), title: next.title, gmNotes: next.gmNotes, board: next.board } })).scene;
        done.push({ possibilityId: item.id, sceneId: created.id, title: item.title.trim() });
      }
    } catch (error) { setMessage((error as Error).message + (done.length ? ` ${done.length} wurden umgewandelt, der Rest bleibt als Abzweigung erhalten.` : " Die Abzweigungen bleiben erhalten.")); }
    if (done.length) {
      setOpen(value => value?.id === source.id ? { ...value, document: { ...value.document,
        possibilities: value.document.possibilities.filter(item => !done.some(d => d.possibilityId === item.id)),
        board: compactBoard({ ...(value.document.board || {}), links: [...(value.document.board?.links || []), ...done.map(d => ({ id: crypto.randomUUID(), to: d.sceneId, kind: "branch" as const, label: d.title.slice(0, 200), condition: "" }))] }) } } : value);
      await refresh();
      if (done.length === items.length) setMessage(done.length + (done.length === 1 ? " Abzweigung ist" : " Abzweigungen sind") + " jetzt eigene Szenen in der Ideenablage und mit dieser Szene verbunden.");
    }
    setBusy(false);
  }

  /** Takes the open scene out of this evening (both link directions); the scene itself stays and moves to the idea tray. */
  async function removeFromEvening() {
    if (!open || !evening || busy) return;
    if (!(await confirmation.ask("„" + open.document.title + "“ aus diesem Spielabend nehmen? Die Szene bleibt mit allen Inhalten erhalten und liegt danach in der Ideenablage."))) return;
    if (!(await save())) return;
    setBusy(true);
    try {
      const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
      await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: fresh.document.sceneIds.filter(id => id !== open.id) }, unlinkSceneIds: [open.id] });
      await refresh(); setBusy(false);
      await go({ ...route, scene: "" });
      setMessage("Szene aus dem Spielabend genommen. Du findest sie in der Ideenablage.");
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }

  /** Archives the open scene: it leaves this evening, content, connections and play history stay. Restoring is done in the classic view for now. */
  async function archiveScene() {
    if (!open || busy) return;
    if (!(await confirmation.ask("„" + open.document.title + "“ archivieren? Inhalte, Verbindungen und Spielverlauf bleiben erhalten. Die Szene verschwindet aus Storyboard und Abend."))) return;
    if (!(await save())) return;
    setBusy(true);
    try {
      if (evening && eveningScenes.some(scene => scene.id === open.id)) {
        const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
        await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: fresh.document.sceneIds.filter(id => id !== open.id) }, unlinkSceneIds: [open.id] });
      }
      const current = (await call<{ scene: SceneView }>("/api/command-center/scenes?id=" + encodeURIComponent(open.id))).scene;
      await call("/api/command-center/scenes", { action: "save", id: current.id, version: current.version, document: { ...current.document, archived: true, sessionIds: current.document.sessionIds.filter(id => id !== evening?.id) } });
      await refresh(); setBusy(false);
      await go({ ...route, scene: "" });
      setMessage("Szene archiviert.");
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }

  /** Quick edit from the list: load the scene, merge the board, save. One scene at a time; nothing else in the document changes. */
  async function patchSceneBoard(id: string, patch: Partial<SceneBoard>) {
    if (patching) return;
    setPatching(id); setMessage("Speichert …");
    try {
      const current = (await call<{ scene: SceneView }>("/api/command-center/scenes?id=" + encodeURIComponent(id))).scene;
      const board = compactBoard({ ...(current.document.board || {}), ...patch });
      const rest: SceneDocument = { ...current.document };
      delete rest.board;
      await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "save", id, version: current.version, document: board ? { ...rest, board } : rest });
      await refresh();
      setMessage("Gespeichert · " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) { setMessage((error as Error).message + " Die Szene bleibt unverändert."); }
    finally { setPatching(""); }
  }

  /** Board properties are stored compactly: an untouched board is not saved at all. */
  function changeBoard(patch: Partial<SceneBoard>) {
    if (!open) return;
    change({ board: compactBoard({ ...(open.document.board || {}), ...patch }) });
  }

  function change(patch: Partial<SceneDocument>) {
    // The mirrors (narration, picture/music, npcIds, placeId) follow every workshop edit right here, so a save that
    // overlaps further typing never sends stale mirrors that the server would read as a classic-view edit.
    setOpen(value => value ? { ...value, document: withoutDanglingCardRefs(withWorkshopMirrors({ ...value.document, ...patch })) } : value);
    setMessage("Ungespeicherte Änderungen · wird gleich gespeichert");
  }

  const evening = sessions.find(item => item.id === route.evening) || null;
  /** The book in the address wins; otherwise an evening (or an open scene without evening) brings its own book,
   * so path, idea tray and book views are there even when a link carries no `buch`. */
  const book = books.find(item => item.id === route.book)
    || (!route.book && evening ? books.find(item => evening.document.storyIds.includes(item.id)) : undefined)
    || (!route.book && !evening && route.scene ? books.find(item => item.id === scenes.find(scene => scene.id === route.scene)?.storyId) : undefined)
    || null;
  const eveningScenes = evening ? orderedSessionScenes(evening.id, evening.document, scenes) : [];
  const progress = evening ? eveningStatusProgress(evening.id, evening.document, scenes) : null;
  const duration = boardDuration(eveningScenes.map(scene => scene.board));
  const guide = guideState({ bookId: book?.id || "", eveningId: evening?.id || "", progress });
  const nextStep = storyboardGuide.find(step => !guide[step.id])?.id || "ready";
  const sceneIndex = open ? eveningScenes.findIndex(scene => scene.id === open.id) : -1;
  /** Book scope for the network, list and timeline: evenings in play order, then the idea tray. */
  const bookScenes: SceneSummary[] = [];
  if (book) {
    const seen = new Set<string>();
    for (const item of sortEvenings(bookEvenings(book.id, sessions, scenes))) for (const scene of orderedSessionScenes(item.id, item.document, scenes)) if (!scene.archived && !seen.has(scene.id)) { seen.add(scene.id); bookScenes.push(scene); }
    for (const scene of unplacedBookScenes(book.id, sessions, scenes)) if (!seen.has(scene.id)) { seen.add(scene.id); bookScenes.push(scene); }
  }
  const eveningTitleOf = (id: string) => sortEvenings(sessions.filter(item => item.document.status !== "archived")).filter(item => orderedSessionScenes(item.id, item.document, scenes).some(scene => scene.id === id)).map(item => item.document.title).join(", ");
  /** "Archiv" scenes are never offered as new targets, but existing connections to them keep their title. */
  const candidateGroups = ["Dieser Spielabend", "Dieses Buch", "Weitere Szenen", "Archiv"];
  /** Play order: this evening first, then the book in evening order; unknown scenes last. */
  const orderOf = (id: string) => { const e = eveningScenes.findIndex(scene => scene.id === id); if (e >= 0) return e; const b = bookScenes.findIndex(scene => scene.id === id); return b >= 0 ? 1000 + b : 1e6; };
  function linkCandidates(current: OpenScene) {
    return scenes.map(scene => ({ id: scene.id, title: scene.title, group: scene.archived ? candidateGroups[3] : eveningScenes.some(item => item.id === scene.id) ? candidateGroups[0] : current.document.storyId && scene.storyId === current.document.storyId ? candidateGroups[1] : candidateGroups[2] }))
      .sort((x, y) => candidateGroups.indexOf(x.group) - candidateGroups.indexOf(y.group) || orderOf(x.id) - orderOf(y.id) || x.title.localeCompare(y.title, "de"));
  }
  function otherView(list: SceneSummary[], sequence?: string[]) {
    const openScene = (id: string) => void openLinked(id);
    if (view === "network") return <PlotNetwork scenes={list} ghosts={linkedOutside(list, scenes)} sequence={sequence} onOpen={openScene} />;
    if (view === "list") return <PlotList scenes={list} eveningOf={eveningTitleOf} busyId={patching} onOpen={openScene} onPatch={(id, patch) => void patchSceneBoard(id, patch)} />;
    return <PlotTimeline scenes={list} onOpen={openScene} threadTitles={new Map(threads.map(thread => [thread.id, thread.document.title]))} />;
  }

  async function createBook() {
    if (busy) return;
    setBusy(true); setMessage("Legt ein neues Buch an …");
    try {
      const data = await call<{ story: { id: string } }>("/api/command-center/story", { action: "create", clientRequestId: crypto.randomUUID(), document: { ...emptyStory(), title: "Neues Buch" } });
      await refresh(); setBusy(false);
      await go({ book: data.story.id, evening: "", scene: "" });
      setMessage("Buch angelegt. Klicke auf den Titel, um ihn zu ändern.");
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }

  async function createEvening() {
    if (busy) return;
    setBusy(true); setMessage("Legt einen neuen Spielabend an …");
    try {
      const document = sessionPreparationSchema.parse({ title: book ? "Neuer Spielabend – " + book.title : "Neuer Spielabend", storyIds: book ? [book.id] : [] });
      const data = await call<{ session: PreparedSession }>("/api/command-center/preparation", { action: "create", clientRequestId: crypto.randomUUID(), document });
      await refresh(); setBusy(false);
      await go({ book: book?.id || "", evening: data.session.id, scene: "" });
      setMessage("Spielabend angelegt. Skizziere jetzt die erste Szene.");
      requestAnimationFrame(() => ideaInput.current?.focus());
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }

  async function saveEvening(target: PreparedSession, patch: Partial<PreparedSession["document"]>, success: string) {
    setSessions(list => list.map(item => item.id === target.id ? { ...item, document: { ...item.document, ...patch } } : item));
    try {
      const data = await call<{ session: PreparedSession }>("/api/command-center/preparation", { action: "save", id: target.id, version: target.version, document: { ...target.document, ...patch } });
      setSessions(list => list.map(item => item.id === target.id ? data.session : item));
      setMessage(success);
      return true;
    } catch (error) {
      setSessions(list => list.map(item => item.id === target.id ? target : item));
      setMessage((error as Error).message + " Die bisherige Reihenfolge bleibt erhalten.");
      return false;
    }
  }

  /** The SL files an existing evening under a book (or none); the view follows the evening into that book. */
  async function moveEveningToBook(target: PreparedSession, bookId: string) {
    if (busy) return;
    setBusy(true);
    const ok = await saveEvening(target, { storyIds: assignEveningBook(target.document.storyIds, books.map(item => item.id), bookId) }, bookId ? "Spielabend dem Buch „" + (books.find(item => item.id === bookId)?.title || "") + "“ zugeordnet." : "Spielabend ohne Buch gespeichert.");
    setBusy(false);
    if (ok) { const next = { book: bookId, evening: target.id, scene: "" }; writeRoute(next, "replace"); setRoute(next); }
  }

  async function moveScene(id: string, toIndex: number) {
    if (!evening || busy) return;
    const sceneIds = reorderedSessionSceneIds(evening.id, evening.document, scenes, id, toIndex);
    if (sceneIds.join() === evening.document.sceneIds.join() && toIndex === eveningScenes.findIndex(scene => scene.id === id)) return;
    setBusy(true);
    await saveEvening(evening, { sceneIds }, "Reihenfolge gespeichert · " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    setBusy(false);
  }

  /** A rough idea is a real scene: title plus a private note. It can be worked out later. */
  async function saveIdea(intoEvening: boolean) {
    const title = ideaTitle.trim();
    if (!title || busy) return;
    setBusy(true); setMessage("Speichert die Szenenidee …");
    try {
      const board = compactBoard({ kind: ideaKind, premise: ideaText.trim().slice(0, boardTextMax) });
      const document: SceneDocument = { ...emptyScene(book?.id || ""), title: title.slice(0, 200), sessionIds: intoEvening && evening ? [evening.id] : [], ...(board ? { board } : {}) };
      const created = await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document });
      if (intoEvening && evening) {
        const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
        if (!fresh.document.sceneIds.includes(created.scene.id)) await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: [...fresh.document.sceneIds, created.scene.id] } });
      }
      setIdeaTitle(""); setIdeaText(""); setIdeaKind("scene");
      await refresh();
      setMessage(intoEvening ? (ideaKind === "scene" ? "Szenenidee" : boardBlockTypes[ideaKind].label) + " ans Ende des Abends gelegt. Öffne sie, wenn du sie ausarbeiten willst." : "Szenenidee in der Ideenablage des Buchs gespeichert.");
    } catch (error) { setMessage((error as Error).message + " Deine Eingabe bleibt im Feld."); }
    finally { setBusy(false); }
  }

  async function placeScene(id: string) {
    if (!evening || busy) return;
    setBusy(true);
    const ok = await saveEvening(evening, { sceneIds: [...evening.document.sceneIds.filter(existing => existing !== id), id] }, "Szene in den Abend geholt.");
    if (ok) await refresh();
    setBusy(false);
  }

  async function renameBook(target: Book, title: string) {
    try {
      const v = (await call<{ story: StoryView }>("/api/command-center/story?id=" + encodeURIComponent(target.id))).story;
      const document = { title, summary: v.summary, status: v.status, favorite: v.favorite, pinned: v.pinned, sections: v.sections, references: v.references, possibilities: v.possibilities };
      await call("/api/command-center/story", { action: "save", id: v.id, version: v.version, document });
      await refresh(); setMessage("Titel des Buchs gespeichert.");
    } catch (error) { setMessage((error as Error).message); }
  }

  function hideGuide(hidden: boolean) { setGuideHidden(hidden); try { localStorage.setItem(guideKey, hidden ? "aus" : "an"); } catch { /* optional */ } }

  function guideAction(id: GuideStepId) {
    if (id === "book") void go({ book: "", evening: "", scene: "" });
    else if (id === "evening") { if (book) void (evening ? go({ book: book.id, evening: "", scene: "" }) : createEvening()); else void go({ book: "", evening: "", scene: "" }); }
    else if (id === "sketch") { if (evening) { void go({ ...route, scene: "" }).then(() => requestAnimationFrame(() => ideaInput.current?.focus())); } }
    else if (id === "elaborate") { const first = eveningScenes.find(scene => sceneStatus(scene) === "idea") || eveningScenes.find(scene => sceneStatus(scene) === "working" || sceneStatus(scene) === "review"); if (first) void go({ ...route, scene: first.id }); }
    else window.location.assign(new URL("/sl/regie", window.location.origin).toString());
  }

  function onDragStart(event: DragEvent, id: string) { setDragId(id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); }
  function onDragOver(event: DragEvent, index: number) { if (!dragId) return; event.preventDefault(); const rect = (event.currentTarget as HTMLElement).getBoundingClientRect(); setDropIndex(event.clientX > rect.left + rect.width / 2 ? index + 1 : index); }
  function onDrop(event: DragEvent) {
    event.preventDefault();
    const id = dragId || event.dataTransfer.getData("text/plain"), from = eveningScenes.findIndex(scene => scene.id === id);
    setDragId(""); setDropIndex(-1);
    if (from < 0 || dropIndex < 0) return;
    void moveScene(id, dropIndex > from ? dropIndex - 1 : dropIndex);
  }

  const level = route.thread ? "thread" : open && route.scene ? "scene" : evening ? "evening" : book ? "book" : "chronicle";
  const bookShelfAll = book ? sortEvenings(bookEvenings(book.id, sessions, scenes)) : [];
  const bookShelf = { all: bookShelfAll, prepared: bookShelfAll.filter(item => item.document.status !== "draft"), drafting: bookShelfAll.filter(item => item.document.status === "draft") };
  function openEvening(id: string) { void go({ book: book?.id || "", evening: id, scene: "" }); }
  /** The book's plot dossier is only needed for its old possibilities; loaded when a book is opened. */
  /** Actual play of the open evening (Phase 4): moments of this evening; runs come with the scene list. */
  const playEveningId = level === "evening" ? evening?.id || "" : "";
  useEffect(() => {
    if (!playEveningId) return;
    let live = true;
    call<{ moments: MomentView[] }>("/api/command-center/moments?sessionId=" + encodeURIComponent(playEveningId)).then(data => { if (live) setEveningMoments({ id: playEveningId, moments: data.moments }); }).catch(() => undefined);
    return () => { live = false; };
  }, [playEveningId, scenes]);
  const playLog = evening ? eveningPlayLog(evening.id, eveningScenes.map(scene => scene.id), scenes, eveningMoments.id === evening.id ? eveningMoments.moments : []) : null;
  const bookId = level === "book" ? book?.id || "" : "";
  useEffect(() => {
    if (!bookId) return;
    let live = true;
    call<{ story: StoryView }>("/api/command-center/story?id=" + encodeURIComponent(bookId)).then(data => { if (live) setBookStory(data.story); }).catch(() => undefined);
    return () => { live = false; };
  }, [bookId]);
  const nameOf = new Map(refs.map(ref => [ref.id, ref.title]));
  // Szene 2.0, Etappe 2: classic person, dialogue and place elements the workshop can take over on request.
  const offers = open ? takeoverElements(open.document, new Set(refs.filter(ref => ref.type === "NPC").map(ref => ref.id)), new Set(refs.filter(ref => ref.type === "PLACE").map(ref => ref.id))) : { persons: [], dialogues: [], places: [] };
  const fileNameOf = new Map(files.map(file => [file.id, file.name]));
  const uploaded = (file: MediaFile) => setFiles(old => [file, ...old.filter(f => f.id !== file.id)]);
  function selectArea(next: WorkshopArea) { setWsArea(next); setWriting(null); void save(); }
  /** Reading view first; the editor opens in the same column. Empty areas offer to start writing. */
  function textArea(key: SceneArea) {
    if (!open) return null;
    const value = String(open.document[key] || ""), label = sceneGuideSteps.find(step => step.id === key)?.label || "Text";
    if (writing === key) return <div className={s.writer}>
      <RichTextEditor key={open.id + ":" + key} label={label} value={value} onChange={next => change({ [key]: next } as Partial<SceneDocument>)} maximumPlainLength={authoringTextMax} placeholder={areaPlaceholder[key]} advanced htmlSource compactTools preparationTools inlineGallery={galleryAreas.has(key)} files={galleryAreas.has(key) ? files : []} proseClassName={s.prose} />
      <div className={s.pageActions}><button type="button" className={s.primary} onClick={() => { setWriting(null); void save(); }}>Fertig – Lesefassung zeigen</button></div>
    </div>;
    return <div className={s.reader}>
      {richTextToPlainText(value).trim() ? <RichTextView value={value} readable flowing className={s.prose} /> : <p className={s.blank}>{areaPlaceholder[key]}</p>}
      <div className={s.pageActions}><button type="button" className={s.primary} onClick={() => setWriting(key)}><PencilLine size={16} aria-hidden="true" />{richTextToPlainText(value).trim() ? "Bearbeiten" : "Schreiben"}</button></div>
    </div>;
  }
  const missingLinks = evening ? evening.document.sceneIds.filter(id => !scenes.some(scene => scene.id === id)).length : 0;

  // The colour scheme comes from the Command Center header (data-cp-theme on the shell, ADR-002).
  return <div className={s.board} data-level={level}>
    {confirmation.dialog}
    <nav className={s.path} aria-label="Gliederung der Geschichte">
      <button type="button" onClick={() => void go({ book: "", evening: "", scene: "" })} aria-current={level === "chronicle" ? "page" : undefined}><ScrollText size={15} aria-hidden="true" />Chronik</button>
      {book && <><ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => void go({ book: book.id, evening: "", scene: "" })} aria-current={level === "book" ? "page" : undefined}><BookOpen size={15} aria-hidden="true" />{book.title}</button></>}
      {evening && <><ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => void go({ book: route.book, evening: evening.id, scene: "" })} aria-current={level === "evening" ? "page" : undefined}><Film size={15} aria-hidden="true" />{evening.document.title}</button></>}
      {level === "scene" && open && (evening && eveningScenes.length > 0
        ? <ol className={s.pathScenes} aria-label="Szenen dieses Abends">{eveningScenes.map((scene, index) => <li key={scene.id}><button type="button" aria-current={scene.id === open.id ? "step" : undefined} data-readiness={statusTone[sceneStatus(scene)]} title={(index + 1) + ". " + scene.title + " · " + boardStatusNames[sceneStatus(scene)]} aria-label={"Szene " + (index + 1) + ": " + scene.title} onClick={() => void go({ ...route, scene: scene.id })}>{index + 1}</button></li>)}</ol>
        : <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page"><Clapperboard size={15} aria-hidden="true" />{open.document.title}</span></>)}
      {level === "thread" && <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page"><GitBranch size={15} aria-hidden="true" />{threads.find(item => item.id === route.thread)?.document.title || "Handlungsstrang"}</span></>}
      <span className={s.pathTools}>
        {level !== "scene" && <span className={s.pathStatus} role="status">{busy ? "Speichert …" : message}</span>}
        {resume && resume.scene !== route.scene && <button type="button" className={s.pathTool} onClick={() => void go({ book: resume.book, evening: resume.evening, scene: resume.scene })} title={"Zuletzt geöffnet: " + resume.title}><RotateCcw size={14} aria-hidden="true" />Weiterarbeiten</button>}
        {level !== "scene" && <button type="button" className={s.pathTool} aria-pressed={!guideHidden} onClick={() => hideGuide(!guideHidden)}><Compass size={14} aria-hidden="true" />Führung</button>}
      </span>
    </nav>

    {!guideHidden && level !== "scene" && <ol className={s.guide} aria-label="Geführte Vorbereitung – jeder Schritt ist freiwillig">
      {storyboardGuide.map((step, index) => <li key={step.id} data-done={guide[step.id] || undefined} data-next={step.id === nextStep || undefined}>
        <button type="button" onClick={() => guideAction(step.id)} title={step.hint} disabled={(step.id === "sketch" || step.id === "elaborate") && !evening}>
          <span className={s.guideNo}>{guide[step.id] ? "✓" : index + 1}</span><span>{step.label}</span>
        </button>
      </li>)}
      <li className={s.guideHint}><span>{storyboardGuide.find(step => step.id === nextStep)?.hint}</span></li>
    </ol>}

    {!loaded ? <p className={s.empty}>Lade …</p> : level === "chronicle" ? <section aria-labelledby="sb-books">
      <header className={s.levelHead}><div><p className={s.eyebrow}>Chronik</p><h2 id="sb-books">Bücher und Kampagnen</h2><p>Wähle die Geschichte, an der du weiterarbeiten willst.</p></div><button type="button" className={s.primary} disabled={busy} onClick={() => void createBook()}><Plus size={16} aria-hidden="true" />Neues Buch</button></header>
      <ul className={s.bookGrid}>{books.map(item => {
        const evenings = bookEvenings(item.id, sessions, scenes), count = scenes.filter(scene => !scene.archived && scene.storyId === item.id).length;
        return <li key={item.id}><button type="button" className={s.bookCard} onClick={() => void go({ book: item.id, evening: "", scene: "" })}>
          <span className={s.bookSpine} aria-hidden="true" />
          <span className={s.eyebrow}>{preparationStatusNames[item.status] || item.status}</span>
          <strong>{item.title}</strong>
          <small>{evenings.length} {evenings.length === 1 ? "Spielabend" : "Spielabende"} · {count} {count === 1 ? "Szene" : "Szenen"}</small>
        </button></li>;
      })}</ul>
      {!books.length && <p className={s.empty}>Noch kein Buch angelegt. Beginne mit „Neues Buch“ – oder lege direkt einen Spielabend ohne Buch an.</p>}
      <EveningShelf title="Spielabende ohne Buch" sessions={looseEvenings(books.map(item => item.id), sessions, scenes)} scenes={scenes} onOpen={id => void go({ book: "", evening: id, scene: "" })} onCreate={books.length ? undefined : () => void createEvening()} busy={busy} />
      <ThreadShelf threads={threads} scenes={scenes} books={books} sceneOrder={sceneOrder} busy={busy} onOpenThread={openThread} onOpenScene={id => void openLinked(id)} onCreate={() => void newThread("")} />
    </section> : level === "thread" && route.thread ? <ThreadPage key={route.thread} threadId={route.thread} threads={threads} scenes={scenes} books={books} refs={refs} knowledge={knowledge} sceneOrder={sceneOrder}
      onOpenScene={id => void openLinked(id)} onOpenThread={openThread} onSaved={threadSaved} onBack={() => window.history.length > 1 ? window.history.back() : void go({ book: route.book, evening: "", scene: "" })} onMessage={setMessage} />
    : level === "book" && book ? <section aria-labelledby="sb-book">
      <header className={s.levelHead}><div><p className={s.eyebrow}>Buch · {preparationStatusNames[book.status] || book.status}</p><h2 id="sb-book"><EditableTitle key={book.id + book.title} value={book.title} label="Titel des Buchs" onCommit={title => void renameBook(book, title)} /></h2><p>Die Spielabende dieses Buchs. Jeder Abend ist ein eigenes Storyboard.</p></div><button type="button" className={s.primary} disabled={busy} onClick={() => void createEvening()}><Plus size={16} aria-hidden="true" />Neuer Spielabend</button></header>
      <ViewSwitch value={view} onChange={setView} cardsLabel="Spielabende" />
      {view !== "cards" ? otherView(bookScenes) : <>
          {!bookShelf.all.length && <p className={s.empty}>Dieses Buch hat noch keinen Spielabend. Lege oben den ersten an.</p>}
          <EveningShelf title="Vorbereitet" sessions={bookShelf.prepared} scenes={scenes} onOpen={openEvening} busy={busy} />
          <EveningShelf title="In Vorbereitung" sessions={bookShelf.drafting} scenes={scenes} onOpen={openEvening} busy={busy} />
        </>}
      {view === "cards" && <IdeaTray scenes={unplacedBookScenes(book.id, sessions, scenes)} onOpen={id => void go({ book: book.id, evening: "", scene: id })} />}
      {view === "cards" && bookStory?.id === book.id && bookStory.possibilities.length > 0 && <section className={s.branches} aria-label="Ältere Möglichkeiten des Buchs">
        <h4>Ältere Möglichkeiten des Buchs <small>{bookStory.possibilities.length}</small></h4>
        <p>Diese Notizen stammen aus dem alten Plotdossier. Wandle sie um: Jede wird eine Szenenidee in der Ideenablage – offen als Idee, genutzt als spielbereit, verworfen als zurückgestellt. Nichts geht verloren.</p>
        <ul className={s.legacyList}>{bookStory.possibilities.map(item => <li key={item.id}><span><strong>{item.title}</strong>{item.text && <small>{item.text}</small>}</span><small>{item.status === "used" ? "genutzt" : item.status === "discarded" ? "verworfen" : "offen"}</small></li>)}</ul>
        <div><button type="button" className={s.primary} disabled={busy} onClick={() => void convertBookPossibilities()}>Alle {bookStory.possibilities.length} in Szenenideen umwandeln</button></div>
      </section>}
      {view === "cards" && <ThreadShelf threads={threads} scenes={scenes} books={books} bookId={book.id} sceneOrder={sceneOrder} busy={busy} onOpenThread={openThread} onOpenScene={id => void openLinked(id)} onCreate={() => void newThread(book.id)} />}
    </section> : level === "evening" && evening ? <section aria-labelledby="sb-evening" className={s.evening}>
      <header className={s.eveningHead}>
        <div className={s.eveningTitle}>
          <p className={s.eyebrow}>Spielabend{evening.document.date ? " · " + evening.document.date.replace("T", " · ") : ""}</p>
          <h2 id="sb-evening"><EditableTitle key={evening.id + evening.document.title} value={evening.document.title} label="Titel des Spielabends" onCommit={title => void saveEvening(evening, { title }, "Titel des Spielabends gespeichert.")} /></h2>
          {progress && <ProgressBar progress={progress} />}
          {duration.estimated > 0 && <p className={s.duration}><Clock size={13} aria-hidden="true" />Geschätzte Spielzeit {formatMinutes(duration.minutes)}{duration.estimated < eveningScenes.filter(scene => scene.board?.status !== "deferred").length ? ` · für ${duration.estimated} von ${eveningScenes.filter(scene => scene.board?.status !== "deferred").length} Szenen geschätzt` : ""}</p>}
        </div>
        <div className={s.headPicks}>
          <label className={s.statusPick}><span>Buch oder Kampagne</span>
            <select value={books.find(item => evening.document.storyIds.includes(item.id))?.id || ""} disabled={busy} onChange={event => void moveEveningToBook(evening, event.target.value)}>
              <option value="">Ohne Buch</option>
              {books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <RegieLink sessionId={evening.id} />
          <label className={s.statusPick}><span>Termin</span>
            <input key={evening.id + evening.document.date} type="datetime-local" defaultValue={evening.document.date.slice(0, 16)} disabled={busy} onBlur={event => { const date = event.target.value; if (date !== evening.document.date.slice(0, 16)) void saveEvening(evening, { date }, date ? "Termin gespeichert." : "Termin entfernt."); }} />
          </label>
          <label className={s.statusPick}><span>Stand des Abends</span>
            <select value={evening.document.status} disabled={busy} onChange={event => void saveEvening(evening, { status: event.target.value as PreparedSession["document"]["status"] }, "Stand des Spielabends gespeichert.")}>
              {eveningStatuses.map(key => <option key={key} value={key}>{preparationStatusNames[key]}</option>)}
            </select>
          </label>
        </div>
      </header>

      <section className={s.plan} aria-labelledby="sb-plan">
        <div className={s.planHead}>
          <h3 id="sb-plan">Für diesen Abend geplant</h3>
          {planDraft === null && <button type="button" className={s.ghost} onClick={() => setPlanDraft(evening.document.summary)}><PencilLine size={15} aria-hidden="true" />{evening.document.summary.trim() ? "Bearbeiten" : "Ergänzen"}</button>}
        </div>
        {planDraft === null
          ? evening.document.summary.trim() ? <p className={s.planText}>{evening.document.summary}</p> : <p className={s.planBlank}>Noch kein Kurzüberblick. Halte fest, worum es an diesem Abend gehen soll – Ziel, Stimmung, offene Fäden.</p>
          : <form className={s.planForm} onSubmit={event => { event.preventDefault(); void saveEvening(evening, { summary: planDraft.trim() }, "Kurzüberblick gespeichert.").then(ok => { if (ok) setPlanDraft(null); }); }}>
            <label><span className={s.srOnly}>Für diesen Abend geplant</span><textarea autoFocus value={planDraft} maxLength={2000} rows={7} onChange={event => setPlanDraft(event.target.value)} placeholder="Worum geht es an diesem Abend? …" /></label>
            <div className={s.planActions}><small>{planDraft.length}/2000</small><button type="button" className={s.ghost} onClick={() => setPlanDraft(null)}>Abbrechen</button><button type="submit" className={s.primary} disabled={busy}>Speichern</button></div>
          </form>}
      </section>

      <ViewSwitch value={view} onChange={setView} />
      {view !== "cards" ? otherView(eveningScenes, eveningScenes.map(scene => scene.id)) : <>
      <div className={s.runHead}>
        <div><h3>Dein Szenenablauf</h3>
          <p className={s.hintLine}><GripVertical size={14} aria-hidden="true" /><span className={s.hintWide}>Karten ziehen oder Pfeile nutzen, um die Reihenfolge zu ändern.</span><span className={s.hintNarrow}>Mit den Pfeilen änderst du die Reihenfolge.</span> Jede Änderung wird sofort gespeichert.</p></div>
        <button type="button" className={s.primary} onClick={() => { ideaInput.current?.scrollIntoView({ block: "center", behavior: "smooth" }); ideaInput.current?.focus({ preventScroll: true }); }}><Plus size={16} aria-hidden="true" />Szene für diesen Spielabend</button>
      </div>
      {missingLinks > 0 && <p role="alert" className={s.alert}>{missingLinks} verknüpfte {missingLinks === 1 ? "Szene ist" : "Szenen sind"} nicht verfügbar. Die Verknüpfungen bleiben erhalten, bis du sie bereinigst. <button type="button" className={s.ghost} disabled={busy} onClick={() => void saveEvening(evening, { sceneIds: evening.document.sceneIds.filter(id => scenes.some(scene => scene.id === id)) }, "Nicht verfügbare Verknüpfungen entfernt.")}>Bereinigen</button></p>}

      <ol className={s.strip} onDragOver={event => dragId && event.preventDefault()} onDrop={onDrop} onDragLeave={event => { if (event.currentTarget === event.target) setDropIndex(-1); }}>
        {eveningScenes.map((scene, index) => {
          const status = sceneStatus(scene), readiness = statusTone[status], kind = boardKind(scene.board), excerpt = scene.preparation?.narrationExcerpt, sections = scene.preparation?.sections || [];
          const { people, materials } = sceneResources(scene, nameOf, fileNameOf);
          return <li key={scene.id} className={s.card} data-readiness={readiness} data-status={status} data-kind={kind} data-dragging={dragId === scene.id || undefined} data-drop-before={dropIndex === index || undefined} data-drop-after={dropIndex === index + 1 && index === eveningScenes.length - 1 || undefined}
            draggable={!busy} onDragStart={event => onDragStart(event, scene.id)} onDragEnd={() => { setDragId(""); setDropIndex(-1); }} onDragOver={event => onDragOver(event, index)}>
            <button type="button" className={s.cardOpen} onClick={() => void go({ ...route, scene: scene.id })} aria-label={`Szene ${index + 1} öffnen: ${scene.title}`}>
              <span className={s.cardTop}><span className={s.cardNo}>{String(index + 1).padStart(2, "0")}</span>{playLog?.started && playLog.status[scene.id] !== "open" && <span className={s.playBadge} data-play={playLog.status[scene.id]}>{playStatusNames[playLog.status[scene.id]]}</span>}<span className={s.pill} data-readiness={readiness} data-status={status}>{boardStatusNames[status]}</span></span>
              <span className={s.cardKind}>{kind !== "scene" && <b>{boardBlockTypes[kind].label}</b>}{isOptionalBlock(scene.board) && kind !== "optional" && <i>optional</i>}{scene.board?.plot === "side" && <i>Nebenhandlung</i>}{scene.board?.priority === "high" && <i>Priorität hoch</i>}{scene.board?.minutes && <i><Clock size={11} aria-hidden="true" />{formatMinutes(scene.board.minutes)}</i>}</span>
              <strong>{scene.title}</strong>
              <span className={s.cardPlace}><MapPin size={12} aria-hidden="true" />{scene.placeId ? nameOf.get(scene.placeId) || "Schauplatz nicht verfügbar" : "Noch kein Schauplatz"}</span>
              <span className={s.cardText}>{excerpt || scene.board?.premise || <em>Noch kein Vorlesetext – bisher nur eine Idee.</em>}</span>
              <span className={s.cardAreas} aria-label={"Vorhandene Inhalte: " + (sections.map(key => preparationSections[key as keyof typeof preparationSections]).join(", ") || "noch keine")}>
                {(Object.keys(preparationSections) as (keyof typeof preparationSections)[]).map(key => <i key={key} data-on={sections.includes(key) || undefined} title={preparationSections[key]}>{cardAreaShort[key]}</i>)}
              </span>
              <span className={s.cardFacts}>
                <span><Users size={12} aria-hidden="true" />{people.length ? people.slice(0, 2).join(", ") + (people.length > 2 ? ` +${people.length - 2}` : "") : "Keine NPCs"}</span>
                <span><FileText size={12} aria-hidden="true" />{materials.length ? `${materials.length} ${materials.length === 1 ? "Material" : "Materialien"}` : "Kein Material"}</span>
                {!!scene.board?.links?.length && <span><Link2 size={12} aria-hidden="true" />{(() => { const next = nextScenes(scene, scenes); return "→ " + (next[0].scene?.title || "nicht verfügbar") + (next[0].scene?.archived ? " (archiviert)" : "") + (next.length > 1 ? ` +${next.length - 1}` : ""); })()}</span>}
              </span>
            </button>
            <span className={s.cardMove}>
              <button type="button" aria-label={`${scene.title} nach vorne`} disabled={busy || index === 0} onClick={() => void moveScene(scene.id, index - 1)}><ArrowLeft size={15} aria-hidden="true" /></button>
              <GripVertical size={15} aria-hidden="true" className={s.grip} />
              <button type="button" aria-label={`${scene.title} nach hinten`} disabled={busy || index === eveningScenes.length - 1} onClick={() => void moveScene(scene.id, index + 1)}><ArrowRight size={15} aria-hidden="true" /></button>
            </span>
          </li>;
        })}
        <li className={`${s.card} ${s.ideaCard}`}>
          <form onSubmit={event => { event.preventDefault(); void saveIdea(true); }}>
            <span className={s.cardTop}><span className={s.cardNo}>{String(eveningScenes.length + 1).padStart(2, "0")}</span><span className={s.pill} data-readiness="idea"><Lightbulb size={12} aria-hidden="true" />Neue Szene</span></span>
            <label><span className={s.srOnly}>Titel der neuen Szene</span><input ref={ideaInput} value={ideaTitle} maxLength={200} onChange={event => setIdeaTitle(event.target.value)} placeholder="Titel der Szene …" /></label>
            <label><span className={s.srOnly}>Typ des Eintrags</span><select className={s.ideaKind} value={ideaKind} onChange={event => setIdeaKind(event.target.value as BoardBlockKind)}>{boardBlockKinds.map(key => <option key={key} value={key}>{boardBlockTypes[key].label}</option>)}</select></label>
            <label><span className={s.srOnly}>Grobe Idee</span><textarea value={ideaText} maxLength={2000} onChange={event => setIdeaText(event.target.value)} placeholder="Grobe Idee in einem Satz (optional) …" rows={3} /></label>
            <button type="submit" disabled={busy || !ideaTitle.trim()}><Plus size={15} aria-hidden="true" />{ideaKind === "scene" ? "Szene anlegen" : "Eintrag anlegen"}</button>
          </form>
        </li>
      </ol>
      {playLog && <EveningPlay log={playLog} planned={eveningScenes} scenes={scenes} evenings={sortEvenings(sessions.filter(item => item.id !== evening.id && item.document.status !== "archived" && item.document.status !== "completed"))} busy={busy} onOpenScene={id => void openLinked(id)} onMove={(ids, targetId) => void moveUnplayed(ids, targetId)} />}
      {book && <IdeaTray scenes={unplacedBookScenes(book.id, sessions, scenes)} onOpen={id => void go({ ...route, scene: id })} onPlace={id => void placeScene(id)} busy={busy} />}
      </>}
    </section> : level === "scene" && open ? <section className={s.stage} aria-labelledby="sb-scene">
      <header className={s.stageHead}>
        {!evening && <button type="button" className={s.back} onClick={() => void go({ ...route, scene: "" })}><LayoutGrid size={16} aria-hidden="true" />Zurück</button>}
        <div className={s.stageTitle}>
          <p className={s.eyebrow}>Vorbereitung · {sceneIndex >= 0 ? `Szene ${sceneIndex + 1} von ${eveningScenes.length}` : "Szene ohne Spielabend"}</p>
          <label><span className={s.srOnly}>Szenentitel</span><TitleArea id="sb-scene" className={s.sceneTitle} value={open.document.title} onChange={title => change({ title })} onBlur={() => { if (!open.document.title.trim()) change({ title: "Neue Szene" }); }} /></label>
        </div>
        <span className={s.saveState} data-state={busy ? "saving" : dirty ? "dirty" : "saved"} role="status">{busy ? "Speichert …" : dirty ? "Ungespeichert" : "Gespeichert"}</span>
        <span className={s.stepper}>
          <button type="button" aria-label="Vorherige Szene" disabled={sceneIndex <= 0} onClick={() => void go({ ...route, scene: eveningScenes[sceneIndex - 1].id })}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Nächste Szene" disabled={sceneIndex < 0 || sceneIndex >= eveningScenes.length - 1} onClick={() => void go({ ...route, scene: eveningScenes[sceneIndex + 1].id })}><ChevronRight size={18} aria-hidden="true" /></button>
        </span>
        {/* Rarely used actions live behind "⋯" so the head stays calm. */}
        <details className={s.moreMenu}>
          <summary aria-label="Weitere Aktionen"><MoreHorizontal size={18} aria-hidden="true" /></summary>
          <div role="menu" onClick={event => { (event.currentTarget.parentElement as HTMLDetailsElement).open = false; }}>
            <button type="button" role="menuitem" onClick={() => void save().then(ok => ok && onClassic(open.id))}><Wrench size={14} aria-hidden="true" />Klassische Ansicht</button>
            {evening && sceneIndex >= 0 && <button type="button" role="menuitem" disabled={busy} onClick={() => void removeFromEvening()}><Undo2 size={14} aria-hidden="true" />Aus dem Spielabend nehmen</button>}
            <button type="button" role="menuitem" className={s.danger} disabled={busy} onClick={() => void archiveScene()}><Archive size={14} aria-hidden="true" />Szene archivieren</button>
          </div>
        </details>
      </header>
      <div className={s.workshop}>
        <WorkshopNav active={wsArea} fill={{ ...workshopFill(open.document), notes: workshopFill(open.document).notes + noteCount }} primary={primaryWorkshopAreas(boardBlockTypes[boardKind(open.document.board)].areas)} onSelect={selectArea} />
        <div className={s.wsPage}>
          <WorkshopHead area={wsArea} />

          {wsArea === "overview" && <>
            <ContextEditor value={open.document.context} onChange={context => change({ context })} />
            <BoardPanel key={open.id} board={open.document.board} derived={sceneStatus({ preparation: scenePreparation(open.document), board: undefined })} onChange={changeBoard}>
              <SceneThreads sceneId={open.id} joined={open.document.board?.threads || []} threads={threads} busy={busy} onJoin={ids => changeBoard({ threads: ids.length ? ids : undefined })} onOpenThread={openThread}
                onCreate={title => void newThread(open.document.storyId || book?.id || "", title, open.id)} onStrandChanged={thread => setThreads(list => list.map(item => item.id === thread.id ? thread : item))} />
            </BoardPanel>
          </>}

          {wsArea === "places" && <PlacesEditor places={open.document.places || []} placesOpen={!!open.document.placesOpen} references={refs} offers={offers.places}
            onChange={(places, placesOpen) => change({ places, ...(placesOpen === undefined ? {} : { placesOpen: placesOpen || undefined }) })}
            onTakeover={id => change(takeOverPlace(open.document, id))} onAsk={question => confirmation.ask(question)} />}

          {wsArea === "cast" && <>
            <CastEditor cast={open.document.cast || []} references={refs} persons={offers.persons} dialogues={offers.dialogues} onChange={cast => change({ cast })}
              onTakeoverPerson={id => change(takeOverPerson(open.document, id))} onTakeoverDialogue={(id, castId) => change(takeOverDialogue(open.document, id, castId))} onAsk={question => confirmation.ask(question)} />
            <h4 className={s.wsSub}>Namenlose Figuren</h4>
            <div className={s.tools}><PreparationFigures values={open.document.standardFigures} onChange={standardFigures => change({ standardFigures })} files={files} onUploaded={uploaded} /></div>
            <LegacyText label="Allgemeine Dialognotizen" filled={!!richTextToPlainText(String(open.document.dialogueNotes || "")).trim()}>{textArea("dialogueNotes")}</LegacyText>
          </>}

          {wsArea === "passages" && <PassagesEditor passages={open.document.passages || []} moods={open.document.moods || []} onChange={passages => change({ passages })} onAsk={question => confirmation.ask(question)} />}

          {wsArea === "moods" && <>
            <MoodsEditor moods={open.document.moods || []} passages={open.document.passages || []} files={files} onUploaded={uploaded} onChange={(moods, passages) => change({ moods, ...(passages ? { passages } : {}) })} />
            <LegacyText label="Atmosphäre in eigenen Worten" filled={!!richTextToPlainText(String(open.document.atmosphere || "")).trim()}>{textArea("atmosphere")}</LegacyText>
          </>}

          {wsArea === "interactions" && <>
            <InteractionCardsEditor cards={open.document.interactionCards || []} doc={open.document} references={refs} onChange={interactionCards => change({ interactionCards })} onAsk={question => confirmation.ask(question)} />
            <LegacyText label="Freie Notizen zu Interaktionen" filled={!!richTextToPlainText(String(open.document.interactions || "")).trim()}>{textArea("interactions")}</LegacyText>
          </>}

          {wsArea === "material" && <section className={s.materials} aria-labelledby="sb-materials">
            <h4 id="sb-materials" className={s.srOnly}>Material</h4>
            <MaterialArea elements={open.document.elements} uses={open.document.materialUses || []} cast={open.document.cast || []} references={refs} files={files} actorId={a.id}
              classicHref={"/sl/command-center?bereich=vorbereitung&material=szenen&szene=" + encodeURIComponent(open.id)}
              onFilesChange={next => setFiles(next)}
              onUses={next => {
                // A use that leaves the scene takes its copy with it; the library entry stays.
                const gone = new Set((open.document.materialUses || []).filter(u => !next.some(n => n.id === u.id)).map(u => u.id));
                change({ materialUses: next, ...(gone.size ? { elements: open.document.elements.filter(e => !gone.has(e.id)) } : {}) });
              }}
              onBeforeLibrarySave={save} onLibrarySaved={reloadOpenScene} onAsk={question => confirmation.ask(question)} />
            {open.document.elements.some(element => element.kind !== "check" && !isMaterialElement(element)) && <>
            <h4 className={s.wsSub}>Weitere Bausteine der klassischen Szene</h4>
            <ul className={s.materialGrid}>{open.document.elements.filter(element => element.kind !== "check" && !isMaterialElement(element)).map(element => {
              const file = element.fileId ? files.find(item => item.id === element.fileId) : undefined;
              return <li key={element.id} data-kind={element.kind}>
                {file?.mime.startsWith("image/") ? <img src={"/api/files?id=" + encodeURIComponent(file.id) + "&size=thumb"} alt="" loading="lazy" /> : <span className={s.materialIcon} aria-hidden="true"><FileText size={22} /></span>}
                <span><small>{elementKindNames[element.kind] || "Baustein"}{element.material?.takeable === false ? " · nicht einsteckbar" : ""}</small><strong>{element.title}</strong>
                  {file && <em>{file.name}</em>}{!file && element.fileId && <em>Datei nicht verfügbar</em>}{element.referenceId && <em>{nameOf.get(element.referenceId) || "Verknüpfung nicht verfügbar"}</em>}</span>
              </li>;
            })}</ul></>}
          </section>}

          {wsArea === "checks" && <>
            <ChecksEditor checks={open.document.checks || []} freeText={freeTextChecks(open.document)} players={players} onChange={checks => change({ checks })} onAsk={question => confirmation.ask(question)} />
            <LegacyText label="Freie Notizen zu Folgen" filled={!!richTextToPlainText(String(open.document.possibleConsequences || "")).trim()}>{textArea("possibleConsequences")}</LegacyText>
          </>}

          {wsArea === "insights" && <>
            <InsightsEditor insights={open.document.insights || []} references={refs} onChange={insights => change({ insights })} onAsk={question => confirmation.ask(question)} />
            <LegacyText label="Weitere Geheimnisse (Freitext)" filled={!!richTextToPlainText(String(open.document.secrets || "")).trim()}>{textArea("secrets")}</LegacyText>
          </>}

          {wsArea === "visions" && <PreparationWhispers scene={open.document} players={players} files={files} onChange={change} onSave={save} onUploaded={uploaded}>{textArea("visions")}</PreparationWhispers>}

          {wsArea === "events" && <>
            <EventsEditor events={open.document.events || []} onChange={events => change({ events })} onAsk={question => confirmation.ask(question)} />
            <p className={s.viewHint}>Am Tisch hältst du fest, was mit einem Ereignis geschah (ausgelöst, verschoben, übersprungen, verworfen). Das Protokoll gehört zum Spielverlauf, nicht zur Vorbereitung.</p>
          </>}

          {wsArea === "exits" && <>
            <BoardLinks key={"links:" + open.id} sceneId={open.id} board={open.document.board} onChange={changeBoard} onOpen={id => void openLinked(id)} onCreateSuccessor={(title, kind) => void createSuccessor(title, kind)} busy={busy}
              candidates={linkCandidates(open)}
              incoming={scenes.filter(scene => scene.id !== open.id).flatMap(scene => (scene.board?.links || []).filter(link => link.to === open.id).map(link => ({ id: scene.id, title: scene.title, kind: link.kind })))} />
            {open.document.possibilities.length > 0 && <section className={s.branches} aria-label="Ältere Abzweigungen">
              <h4>Ältere Abzweigungen <small>{open.document.possibilities.length}</small></h4>
              <p>Diese Textnotizen stammen aus dem alten System. Wandle sie um: Jede wird eine Szenenidee in der Ideenablage, mit dieser Szene als Alternative verbunden. Titel und Text bleiben vollständig erhalten.</p>
              <ul className={s.legacyList}>{open.document.possibilities.map(item => <li key={item.id}>
                <span><strong>{item.title}</strong>{item.text && <small>{item.text}</small>}</span>
                <button type="button" className={s.ghost} disabled={busy} onClick={() => void convertPossibilities([item.id])}>In Szene umwandeln</button>
              </li>)}</ul>
              {open.document.possibilities.length > 1 && <div><button type="button" className={s.primary} disabled={busy} onClick={() => void convertPossibilities(open.document.possibilities.map(item => item.id))}>Alle {open.document.possibilities.length} umwandeln</button></div>}
            </section>}
          </>}

          {wsArea === "notes" && <>
            <NotesArea key={"notes:" + open.id} sceneId={open.id} sessionId={route.evening || ""} cast={open.document.cast || []} places={open.document.places || []} references={refs}
              onCount={setNoteCount} onAsk={question => confirmation.ask(question)} />
            <LegacyText label="Freie SL-Notizen zur Szene" filled={!!richTextToPlainText(String(open.document.gmNotes || "")).trim()}>{textArea("gmNotes")}</LegacyText>
          </>}
        </div>
      </div>
      {!!open.document.board?.links?.length && <nav className={s.nextBar} aria-label="Weiter laut Verbindungen">
        <span>Weiter laut Verbindungen</span>
        {nextScenes({ id: open.id, title: open.document.title, board: open.document.board }, scenes).map(({ link, scene }) => <button key={link.id} type="button" className={s.ghost} disabled={!scene} onClick={() => scene && void openLinked(scene.id)}>
          <small>{boardLinkKindNames[link.kind]}</small>{scene?.title || "Szene nicht verfügbar"}{scene?.archived ? " · archiviert" : ""}<ChevronRight size={14} aria-hidden="true" />
        </button>)}
      </nav>}
    </section> : <p className={s.empty}>Diese Akte ist nicht mehr verfügbar. <button type="button" onClick={() => void go({ book: "", evening: "", scene: "" })}>Zur Chronik</button></p>}
    {level !== "scene" && <p className={s.classic}><button type="button" onClick={() => onClassic()}>Klassische Vorbereitungsansicht öffnen</button></p>}
  </div>;
}

/** Storyboard 2.0: type and status always in reach, every further property optional and folded away. */
function BoardPanel({ board, derived, onChange, children }: { board: SceneBoard | undefined; derived: BoardStatus; onChange: (patch: Partial<SceneBoard>) => void; children?: ReactNode }) {
  const b = board || {}, kind = boardKind(board);
  const [startOpen] = useState(() => [b.premise, b.plot, b.optional, b.triggers, b.minutes, b.priority].some(value => value !== undefined && value !== "" && value !== false));
  const extras = [b.premise, b.plot, b.optional, b.triggers, b.minutes, b.priority].filter(value => value !== undefined && value !== "" && value !== false).length;
  return <section className={s.boardPanel} aria-label="Storyboard-Angaben dieser Szene">
    <div className={s.boardRow}>
      <label className={s.statusPick}><span>Typ</span>
        <select value={kind} onChange={event => onChange({ kind: event.target.value as BoardBlockKind })}>
          {boardBlockKinds.map(key => <option key={key} value={key}>{boardBlockTypes[key].label}</option>)}
        </select>
      </label>
      <label className={s.statusPick}><span>Vorbereitungsstatus</span>
        <select value={b.status || ""} data-status={b.status || derived} onChange={event => onChange({ status: (event.target.value || undefined) as BoardStatus | undefined })}>
          <option value="">Automatisch · {boardStatusNames[derived]}</option>
          {boardStatuses.map(key => <option key={key} value={key}>{boardStatusNames[key]}</option>)}
        </select>
      </label>
      <p className={s.boardHint}>{boardBlockTypes[kind].hint} Der Status beschreibt nur die Vorbereitung, nicht den Spielverlauf.</p>
    </div>
    <details className={s.boardMore} open={startOpen || undefined}>
      <summary>Weitere Angaben{extras ? ` · ${extras} ausgefüllt` : " · alle freiwillig"}</summary>
      <div className={s.boardGrid}>
        <label className={`${s.field} ${s.boardWide}`}><span>Grobe Idee</span><textarea rows={2} maxLength={boardTextMax} value={b.premise || ""} onChange={event => onChange({ premise: event.target.value })} placeholder="Worum geht es in einem Satz? …" /></label>
        <label className={s.field}><span>Handlung</span>
          <select value={b.plot || ""} onChange={event => onChange({ plot: (event.target.value || undefined) as SceneBoard["plot"] })}>
            <option value="">Nicht festgelegt</option>
            {(Object.keys(boardPlotNames) as (keyof typeof boardPlotNames)[]).map(key => <option key={key} value={key}>{boardPlotNames[key]}</option>)}
          </select>
        </label>
        <label className={s.field}><span>Priorität</span>
          <select value={b.priority || ""} onChange={event => onChange({ priority: (event.target.value || undefined) as SceneBoard["priority"] })}>
            <option value="">Nicht festgelegt</option>
            {boardPriorities.map(key => <option key={key} value={key}>{boardPriorityNames[key]}</option>)}
          </select>
        </label>
        <label className={s.field}><span>Geschätzte Spieldauer (Minuten)</span><input type="number" inputMode="numeric" min={1} max={boardMinutesMax} step={5} value={b.minutes ?? ""} onChange={event => { const n = Math.trunc(Number(event.target.value)); onChange({ minutes: event.target.value && n >= 1 ? Math.min(boardMinutesMax, n) : undefined }); }} placeholder="z. B. 30" /></label>
        <label className={s.check}><input type="checkbox" checked={b.optional === true || kind === "optional"} disabled={kind === "optional"} onChange={event => onChange({ optional: event.target.checked })} /><span>Optional – darf ausgelassen werden</span></label>
        <label className={`${s.field} ${s.boardWide}`}><span>Voraussetzungen und Auslöser</span><textarea rows={2} maxLength={boardTextMax} value={b.triggers || ""} onChange={event => onChange({ triggers: event.target.value })} placeholder="Wann oder wodurch kommt es zu dieser Szene? …" /></label>
      </div>
    </details>
    {children}
  </section>;
}

function EditableTitle({ value, label, onCommit }: { value: string; label: string; onCommit: (title: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => { const title = draft.trim().slice(0, 200); if (!title) setDraft(value); else if (title !== value) onCommit(title); };
  return <label><span className={s.srOnly}>{label}</span><TitleArea className={s.titleInput} value={draft} onChange={setDraft} onBlur={commit} onEscape={() => setDraft(value)} /></label>;
}

/** Single-line title that wraps instead of being cut off on narrow screens; Enter commits. */
function TitleArea({ value, onChange, onBlur, onEscape, className, id }: { value: string; onChange: (value: string) => void; onBlur?: () => void; onEscape?: () => void; className: string; id?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; });
  useEffect(() => { const fit = () => { const el = ref.current; if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }; window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);
  return <textarea ref={ref} id={id} rows={1} className={className} value={value} maxLength={200} onChange={event => onChange(event.target.value.replace(/\s*[\r\n]+\s*/g, " "))} onBlur={onBlur} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } if (event.key === "Escape") onEscape?.(); }} />;
}

const progressOrder: BoardStatus[] = ["ready", "review", "working", "idea", "deferred"];
function ProgressBar({ progress }: { progress: EveningStatusProgress }) {
  if (!progress.total) return <p className={s.progressText}>Noch keine Szene geplant.</p>;
  const parts = progressOrder.filter(key => progress[key]).map(key => `${progress[key]} ${boardStatusNames[key]}`);
  return <div className={s.progress} aria-label={`${progress.ready} von ${progress.total} Szenen spielbereit. ${parts.join(", ")}`}>
    <span className={s.progressBar}>{progressOrder.map(key => progress[key] ? <span key={key} data-readiness={statusTone[key]} data-status={key} style={{ flexGrow: progress[key] }} /> : null)}</span>
    <small>{progress.ready}/{progress.total} spielbereit{progressOrder.filter(key => key !== "ready" && progress[key]).map(key => ` · ${progress[key]} ${boardStatusNames[key]}`).join("")}</small>
  </div>;
}

function EveningShelf({ title, sessions, scenes, onOpen, onCreate, busy }: { title: string; sessions: PreparedSession[]; scenes: SceneSummary[]; onOpen: (id: string) => void; onCreate?: () => void; busy: boolean }) {
  if (!sessions.length && !onCreate) return title ? null : <p className={s.empty}>Dieses Buch hat noch keinen Spielabend. Lege oben den ersten an.</p>;
  return <section className={s.shelfBlock}>
    {title && <h3>{title}</h3>}
    <ul className={s.eveningGrid}>{sessions.map(session => {
      const list = orderedSessionScenes(session.id, session.document, scenes), progress = eveningStatusProgress(session.id, session.document, scenes);
      return <li key={session.id}><button type="button" className={s.eveningCard} onClick={() => onOpen(session.id)}>
        <span className={s.eyebrow}>{preparationStatusNames[session.document.status]}{session.document.date ? " · " + session.document.date.slice(0, 10) : ""}</span>
        <strong>{session.document.title}</strong>
        <span className={s.thumbs} aria-hidden="true">{list.slice(0, 8).map(scene => <span key={scene.id} data-readiness={statusTone[sceneStatus(scene)]} />)}{list.length > 8 && <em>+{list.length - 8}</em>}</span>
        <ProgressBar progress={progress} />
      </button></li>;
    })}</ul>
    {onCreate && <button type="button" className={s.primary} disabled={busy} onClick={onCreate}><Plus size={16} aria-hidden="true" />Spielabend ohne Buch anlegen</button>}
  </section>;
}

function IdeaTray({ scenes, onOpen, onPlace, busy }: { scenes: SceneSummary[]; onOpen: (id: string) => void; onPlace?: (id: string) => void; busy?: boolean }) {
  if (!scenes.length) return null;
  return <section className={s.tray} aria-label="Ideenablage">
    <h3><Lightbulb size={16} aria-hidden="true" />Ideenablage <small>Szenen dieses Buchs ohne Spielabend</small></h3>
    <ul>{scenes.map(scene => <li key={scene.id} data-readiness={statusTone[sceneStatus(scene)]}>
      <button type="button" className={s.trayOpen} onClick={() => onOpen(scene.id)}><strong>{scene.title}</strong><small>{boardKind(scene.board) !== "scene" ? boardBlockTypes[boardKind(scene.board)].label + " · " : ""}{boardStatusNames[sceneStatus(scene)]}</small></button>
      {onPlace && <button type="button" className={s.trayPlace} disabled={busy} onClick={() => onPlace(scene.id)} aria-label={`In den Abend holen: ${scene.title}`}><Plus size={14} aria-hidden="true" />In den Abend</button>}
    </li>)}</ul>
  </section>;
}
