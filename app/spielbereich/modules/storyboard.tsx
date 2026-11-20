"use client";
/* eslint-disable @next/next/no-img-element -- material thumbnails come from the protected /api/files endpoint. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Clapperboard, Compass, FileText, Film, GripVertical, LayoutGrid, Lightbulb, Lock, MapPin, PencilLine, Plus, RotateCcw, ScrollText, Users, Wrench } from "lucide-react";
import type { PreparationRecipient } from "@/domain/personal-message";
import { sceneGuideSteps } from "@/domain/preparation-guide";
import { richTextToPlainText } from "@/domain/location-rich-text";
import { PreparationWhispers } from "./preparation-whispers";
import { isCentralPreparationPlace, preparationPlaces } from "./preparation-catalog";
import type { Actor } from "@/domain/types";
import { authoringTextMax } from "@/domain/authoring-limits";
import { emptyStory, type CommandReference, type StoryView } from "@/domain/command-workspace";
import { emptyScene, type SceneDocument, type SceneSummary, type SceneView } from "@/domain/story-scene";
import { sessionPreparationSchema, type PreparedSession } from "@/domain/story-preparation";
import { orderedSessionScenes, preparationSections } from "@/domain/session-overview";
import { assignEveningBook, bookEvenings, eveningProgress, guideState, looseEvenings, reorderedSessionSceneIds, sceneReadiness, sceneResources, sceneReadinessNames, sortEvenings, storyboardGuide, unplacedBookScenes, type GuideStepId } from "@/domain/storyboard";
import { RichTextEditor, RichTextView } from "./rich-text";
import { PreparationNPCs } from "./preparation-npcs";
import { PreparationFigures } from "./preparation-figures";
import { SceneBackdropPicker, SceneYoutubePicker } from "./preparation-upload";
import { preparationStatusNames } from "./session-overview";
import { useCommandConfirmation } from "./command-confirmation";
import s from "./storyboard.module.css";

type Book = { id: string; title: string; status: string; updatedAt: string };
type MediaFile = { id: string; name: string; mime: string };
type OpenScene = { id: string; version: number; document: SceneDocument };
const eveningStatuses = ["draft", "ready", "active", "completed"] as const;
type SceneArea = typeof sceneGuideSteps[number]["id"];
const areaShort: Record<SceneArea, string> = { narration: "Erzählung", atmosphere: "Atmosphäre", dialogueNotes: "NPCs & Dialoge", interactions: "Interaktionen", secrets: "Geheimnisse", visions: "Visionen & Botschaften", possibleConsequences: "Folgen & Proben", gmNotes: "SL-Notizen" };
const areaPlaceholder: Record<SceneArea, string> = {
  narration: "Was liest du der Runde vor, wenn die Szene beginnt? …", atmosphere: "Licht, Geräusche, Gerüche, Wetter – was spüren die Charaktere? …",
  dialogueNotes: "Was wollen die NPCs? Gesprächsangebote, Ziele, mögliche Antworten …", interactions: "Was setzt du wann ein – und warum? …",
  secrets: "Was bleibt zunächst verborgen? Hintergründe und Voraussetzungen für eine spätere Freigabe …", visions: "Gemeinsame Vision oder Botschaft (optional) …",
  possibleConsequences: "Mögliche Proben, Schwierigkeiten und Folgen – nur geplant, nichts wird ausgelöst …", gmNotes: "Regiehinweise, Tempo, was passiert, wenn … – nur für dich",
};
const privateAreas = new Set<SceneArea>(["secrets", "gmNotes"]);
/** The protected gallery is offered only where pictures belong: the material plan of the scene. NPC pictures come from the NPC dossiers. */
const galleryAreas = new Set<SceneArea>(["interactions"]);
const cardAreaShort: Record<SceneArea, string> = { narration: "Erzählung", atmosphere: "Atmosphäre", dialogueNotes: "NPCs", interactions: "Interaktion", secrets: "Geheimnis", visions: "Visionen", possibleConsequences: "Folgen", gmNotes: "Notizen" };
const elementKindNames: Record<string, string> = { text: "Text", "sl-note": "SL-Notiz", description: "Beschreibung", object: "Gegenstand", clue: "Hinweis", check: "Probe", dialogue: "Dialog", encounter: "Begegnung", place: "Ort", person: "Person", image: "Bild", audio: "Audio", video: "Video", handout: "Handout", puzzle: "Rätsel", pager: "Pager" };
/** A small marker on the area tab: text written or tools of this area in use. Only a hint. */
function areaFilled(document: SceneDocument, key: SceneArea) {
  if (richTextToPlainText(String(document[key] || "")).trim()) return true;
  if (key === "atmosphere") return !!document.backdropFileId || !!document.youtube?.length;
  if (key === "dialogueNotes") return document.npcIds.length + document.standardFigures.length > 0;
  if (key === "interactions") return document.elements.length > 0;
  if (key === "visions") return !!document.whispers?.length;
  if (key === "possibleConsequences") return document.possibilities.length > 0;
  return false;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!r.ok) throw new Error((r.status === 409 ? "Konflikt: Die Akte wurde inzwischen anderswo geändert. " : "") + (d.error || d.message || "Anfrage fehlgeschlagen."));
  return d;
}

function readRoute() {
  const q = new URLSearchParams(window.location.search);
  return { book: q.get("buch") || "", evening: q.get("abend") || "", scene: q.get("szene") || "" };
}
function writeRoute(next: { book: string; evening: string; scene: string }, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);
  for (const [key, value] of [["buch", next.book], ["abend", next.evening], ["szene", next.scene]] as const) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
  url.searchParams.set("bereich", "sitzung");
  if (url.pathname + url.search !== window.location.pathname + window.location.search) window.history[mode === "push" ? "pushState" : "replaceState"](null, "", url);
}

export function Storyboard({ a, onDirty, onClassic }: { a: Actor; onDirty?: (dirty: boolean) => void; onClassic: (sceneId?: string) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [sessions, setSessions] = useState<PreparedSession[]>([]);
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [refs, setRefs] = useState<CommandReference[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [route, setRoute] = useState({ book: "", evening: "", scene: "" });
  const [open, setOpen] = useState<OpenScene | null>(null);
  const [saved, setSaved] = useState("");
  const [area, setArea] = useState<SceneArea>("narration");
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
  const confirmation = useCommandConfirmation();
  const ideaInput = useRef<HTMLInputElement>(null);
  const latest = useRef(open), baseline = useRef(saved), inflight = useRef(false);
  useLayoutEffect(() => { latest.current = open; baseline.current = saved; }, [open, saved]);
  const resumeKey = "chroniplay-storyboard-resume:" + a.campaignId + ":" + a.id, guideKey = "chroniplay-storyboard-guide:" + a.id;

  const refresh = useCallback(async () => {
    const [catalog, prep, media, people] = await Promise.all([
      call<{ stories: Book[]; scenes: SceneSummary[]; references: CommandReference[] }>("/api/command-center"),
      call<{ sessions: PreparedSession[]; places?: { id: string; title: string; parent_id?: string | null; level?: string }[] }>("/api/command-center/preparation"),
      call<{ files?: MediaFile[] }>("/api/files").catch(() => ({ files: [] as MediaFile[] })),
      call<{ recipients?: PreparationRecipient[] }>("/api/messages?recipients=1&context=preparation").catch(() => ({ recipients: [] as PreparationRecipient[] })),
    ]);
    setBooks(catalog.stories.filter(story => story.status !== "archived"));
    setScenes(catalog.scenes);
    setRefs([...catalog.references.filter(ref => ref.type !== "PLACE"), ...preparationPlaces(prep.places || [])]);
    setPlayers((people.recipients || []).filter(person => person.role === "player"));
    setSessions(prep.sessions);
    setFiles(media.files || []);
  }, []);

  const loadScene = useCallback(async (id: string) => {
    if (!id) { setOpen(null); setSaved(""); return; }
    const data = await call<{ scene: SceneView }>("/api/command-center/scenes?id=" + encodeURIComponent(id));
    const next = { id: data.scene.id, version: data.scene.version, document: data.scene.document };
    setOpen(next); setSaved(JSON.stringify(next.document)); setWriting(null);
  }, []);

  useEffect(() => {
    Promise.resolve().then(async () => {
      try { setGuideHidden(localStorage.getItem(guideKey) === "aus"); const r = JSON.parse(localStorage.getItem(resumeKey) || "null"); if (r && typeof r.scene === "string") setResume(r); } catch { /* per-viewer convenience only */ }
      try {
        await refresh();
        const r = readRoute(); setRoute(r);
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
        setOpen({ id: data.scene.id, version: data.scene.version, document: data.scene.document }); setSaved(JSON.stringify(data.scene.document));
      }).catch(() => undefined);
    };
    window.addEventListener("focus", back);
    return () => window.removeEventListener("focus", back);
  }, []);

  /** Every move between levels first saves the open scene; nothing is silently dropped. */
  async function go(next: { book: string; evening: string; scene: string }, mode: "push" | "replace" = "push") {
    if (latest.current && JSON.stringify(latest.current.document) !== baseline.current) {
      if (!(await save()) && !(await confirmation.ask("Die Szene konnte nicht gespeichert werden. Trotzdem wechseln und die letzten Änderungen verwerfen?"))) return;
    }
    writeRoute(next, mode); setRoute(next); setPlanDraft(null);
    try {
      if (next.scene !== latest.current?.id) await loadScene(next.scene);
      if (next.scene) {
        setArea("narration"); setWriting(null);
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

  function change(patch: Partial<SceneDocument>) {
    setOpen(value => value ? { ...value, document: { ...value.document, ...patch } } : value);
    setMessage("Ungespeicherte Änderungen · wird gleich gespeichert");
  }

  const book = books.find(item => item.id === route.book) || null;
  const evening = sessions.find(item => item.id === route.evening) || null;
  const eveningScenes = evening ? orderedSessionScenes(evening.id, evening.document, scenes) : [];
  const progress = evening ? eveningProgress(evening.id, evening.document, scenes) : null;
  const guide = guideState({ bookId: book?.id || "", eveningId: evening?.id || "", progress });
  const nextStep = storyboardGuide.find(step => !guide[step.id])?.id || "ready";
  const sceneIndex = open ? eveningScenes.findIndex(scene => scene.id === open.id) : -1;

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
      const document: SceneDocument = { ...emptyScene(book?.id || ""), title: title.slice(0, 200), gmNotes: ideaText.trim() ? "Idee: " + ideaText.trim() : "", sessionIds: intoEvening && evening ? [evening.id] : [] };
      const created = await call<{ scene: SceneView }>("/api/command-center/scenes", { action: "create", clientRequestId: crypto.randomUUID(), document });
      if (intoEvening && evening) {
        const fresh = (await call<{ session: PreparedSession }>("/api/command-center/preparation?id=" + encodeURIComponent(evening.id))).session;
        if (!fresh.document.sceneIds.includes(created.scene.id)) await call("/api/command-center/preparation", { action: "save", id: fresh.id, version: fresh.version, document: { ...fresh.document, sceneIds: [...fresh.document.sceneIds, created.scene.id] } });
      }
      setIdeaTitle(""); setIdeaText("");
      await refresh();
      setMessage(intoEvening ? "Szenenidee ans Ende des Abends gelegt. Öffne sie, wenn du sie ausarbeiten willst." : "Szenenidee in der Ideenablage des Buchs gespeichert.");
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
    else if (id === "elaborate") { const first = eveningScenes.find(scene => sceneReadiness(scene) === "idea") || eveningScenes.find(scene => sceneReadiness(scene) === "draft"); if (first) void go({ ...route, scene: first.id }); }
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

  const level = open && route.scene ? "scene" : evening ? "evening" : book ? "book" : "chronicle";
  const nameOf = new Map(refs.map(ref => [ref.id, ref.title]));
  const fileNameOf = new Map(files.map(file => [file.id, file.name]));
  const uploaded = (file: MediaFile) => setFiles(old => [file, ...old.filter(f => f.id !== file.id)]);
  const areaIndex = Math.max(0, sceneGuideSteps.findIndex(step => step.id === area)), currentStep = sceneGuideSteps[areaIndex];
  function switchArea(next: SceneArea) { setArea(next); setWriting(null); void save(); }
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

  return <div className={s.board} data-level={level}>
    {confirmation.dialog}
    <nav className={s.path} aria-label="Gliederung der Geschichte">
      <button type="button" onClick={() => void go({ book: "", evening: "", scene: "" })} aria-current={level === "chronicle" ? "page" : undefined}><ScrollText size={15} aria-hidden="true" />Chronik</button>
      {book && <><ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => void go({ book: book.id, evening: "", scene: "" })} aria-current={level === "book" ? "page" : undefined}><BookOpen size={15} aria-hidden="true" />{book.title}</button></>}
      {evening && <><ChevronRight size={14} aria-hidden="true" /><button type="button" onClick={() => void go({ book: route.book, evening: evening.id, scene: "" })} aria-current={level === "evening" ? "page" : undefined}><Film size={15} aria-hidden="true" />{evening.document.title}</button></>}
      {level === "scene" && open && <><ChevronRight size={14} aria-hidden="true" /><span aria-current="page"><Clapperboard size={15} aria-hidden="true" />{open.document.title}</span></>}
      <span className={s.pathTools}>
        <span className={s.pathStatus} role="status">{busy ? "Speichert …" : message}</span>
        {resume && resume.scene !== route.scene && <button type="button" className={s.pathTool} onClick={() => void go({ book: resume.book, evening: resume.evening, scene: resume.scene })} title={"Zuletzt geöffnet: " + resume.title}><RotateCcw size={14} aria-hidden="true" />Weiterarbeiten</button>}
        <button type="button" className={s.pathTool} aria-pressed={!guideHidden} onClick={() => hideGuide(!guideHidden)}><Compass size={14} aria-hidden="true" />Führung</button>
      </span>
    </nav>

    {!guideHidden && <ol className={s.guide} aria-label="Geführte Vorbereitung – jeder Schritt ist freiwillig">
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
    </section> : level === "book" && book ? <section aria-labelledby="sb-book">
      <header className={s.levelHead}><div><p className={s.eyebrow}>Buch · {preparationStatusNames[book.status] || book.status}</p><h2 id="sb-book"><EditableTitle key={book.id + book.title} value={book.title} label="Titel des Buchs" onCommit={title => void renameBook(book, title)} /></h2><p>Die Spielabende dieses Buchs. Jeder Abend ist ein eigenes Storyboard.</p></div><button type="button" className={s.primary} disabled={busy} onClick={() => void createEvening()}><Plus size={16} aria-hidden="true" />Neuer Spielabend</button></header>
      {(() => {
        const list = sortEvenings(bookEvenings(book.id, sessions, scenes)), prepared = list.filter(item => item.document.status !== "draft"), drafting = list.filter(item => item.document.status === "draft");
        return <>
          {!list.length && <p className={s.empty}>Dieses Buch hat noch keinen Spielabend. Lege oben den ersten an.</p>}
          <EveningShelf title="Vorbereitet" sessions={prepared} scenes={scenes} onOpen={id => void go({ book: book.id, evening: id, scene: "" })} busy={busy} />
          <EveningShelf title="In Vorbereitung" sessions={drafting} scenes={scenes} onOpen={id => void go({ book: book.id, evening: id, scene: "" })} busy={busy} />
        </>;
      })()}
      <IdeaTray scenes={unplacedBookScenes(book.id, sessions, scenes)} onOpen={id => void go({ book: book.id, evening: "", scene: id })} />
    </section> : level === "evening" && evening ? <section aria-labelledby="sb-evening" className={s.evening}>
      <header className={s.eveningHead}>
        <div className={s.eveningTitle}>
          <p className={s.eyebrow}>Spielabend{evening.document.date ? " · " + evening.document.date.replace("T", " · ") : ""}</p>
          <h2 id="sb-evening"><EditableTitle key={evening.id + evening.document.title} value={evening.document.title} label="Titel des Spielabends" onCommit={title => void saveEvening(evening, { title }, "Titel des Spielabends gespeichert.")} /></h2>
          {progress && <ProgressBar progress={progress} />}
        </div>
        <div className={s.headPicks}>
          <label className={s.statusPick}><span>Buch oder Kampagne</span>
            <select value={books.find(item => evening.document.storyIds.includes(item.id))?.id || ""} disabled={busy} onChange={event => void moveEveningToBook(evening, event.target.value)}>
              <option value="">Ohne Buch</option>
              {books.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
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

      <div className={s.runHead}>
        <div><h3>Dein Szenenablauf</h3>
          <p className={s.hintLine}><GripVertical size={14} aria-hidden="true" /><span className={s.hintWide}>Karten ziehen oder Pfeile nutzen, um die Reihenfolge zu ändern.</span><span className={s.hintNarrow}>Mit den Pfeilen änderst du die Reihenfolge.</span> Jede Änderung wird sofort gespeichert.</p></div>
        <button type="button" className={s.primary} onClick={() => { ideaInput.current?.scrollIntoView({ block: "center", behavior: "smooth" }); ideaInput.current?.focus({ preventScroll: true }); }}><Plus size={16} aria-hidden="true" />Szene für diesen Spielabend</button>
      </div>
      {missingLinks > 0 && <p role="alert" className={s.alert}>{missingLinks} verknüpfte {missingLinks === 1 ? "Szene ist" : "Szenen sind"} nicht verfügbar. Die Verknüpfungen bleiben erhalten; prüfe sie in der klassischen Ansicht.</p>}

      <ol className={s.strip} onDragOver={event => dragId && event.preventDefault()} onDrop={onDrop} onDragLeave={event => { if (event.currentTarget === event.target) setDropIndex(-1); }}>
        {eveningScenes.map((scene, index) => {
          const readiness = sceneReadiness(scene), excerpt = scene.preparation?.narrationExcerpt, sections = scene.preparation?.sections || [];
          const { people, materials } = sceneResources(scene, nameOf, fileNameOf);
          return <li key={scene.id} className={s.card} data-readiness={readiness} data-dragging={dragId === scene.id || undefined} data-drop-before={dropIndex === index || undefined} data-drop-after={dropIndex === index + 1 && index === eveningScenes.length - 1 || undefined}
            draggable={!busy} onDragStart={event => onDragStart(event, scene.id)} onDragEnd={() => { setDragId(""); setDropIndex(-1); }} onDragOver={event => onDragOver(event, index)}>
            <button type="button" className={s.cardOpen} onClick={() => void go({ ...route, scene: scene.id })} aria-label={`Szene ${index + 1} öffnen: ${scene.title}`}>
              <span className={s.cardTop}><span className={s.cardNo}>{String(index + 1).padStart(2, "0")}</span><span className={s.pill} data-readiness={readiness}>{sceneReadinessNames[readiness]}</span></span>
              <strong>{scene.title}</strong>
              <span className={s.cardPlace}><MapPin size={12} aria-hidden="true" />{scene.placeId ? nameOf.get(scene.placeId) || "Schauplatz nicht verfügbar" : "Noch kein Schauplatz"}</span>
              <span className={s.cardText}>{excerpt || <em>Noch kein Vorlesetext – bisher nur eine Idee.</em>}</span>
              <span className={s.cardAreas} aria-label={"Vorhandene Inhalte: " + (sections.map(key => preparationSections[key as keyof typeof preparationSections]).join(", ") || "noch keine")}>
                {(Object.keys(preparationSections) as (keyof typeof preparationSections)[]).map(key => <i key={key} data-on={sections.includes(key) || undefined} title={preparationSections[key]}>{cardAreaShort[key]}</i>)}
              </span>
              <span className={s.cardFacts}>
                <span><Users size={12} aria-hidden="true" />{people.length ? people.slice(0, 2).join(", ") + (people.length > 2 ? ` +${people.length - 2}` : "") : "Keine NPCs"}</span>
                <span><FileText size={12} aria-hidden="true" />{materials.length ? `${materials.length} ${materials.length === 1 ? "Material" : "Materialien"}` : "Kein Material"}</span>
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
            <label><span className={s.srOnly}>Grobe Idee</span><textarea value={ideaText} maxLength={2000} onChange={event => setIdeaText(event.target.value)} placeholder="Grobe Idee in einem Satz (optional) …" rows={3} /></label>
            <button type="submit" disabled={busy || !ideaTitle.trim()}><Plus size={15} aria-hidden="true" />Szene anlegen</button>
          </form>
        </li>
      </ol>
      {book && <IdeaTray scenes={unplacedBookScenes(book.id, sessions, scenes)} onOpen={id => void go({ ...route, scene: id })} onPlace={id => void placeScene(id)} busy={busy} />}
    </section> : level === "scene" && open ? <section className={s.stage} aria-labelledby="sb-scene">
      {eveningScenes.length > 0 && <ol className={s.miniStrip} aria-label="Szenenfolge des Abends">
        {eveningScenes.map((scene, index) => <li key={scene.id}><button type="button" aria-current={scene.id === open.id ? "step" : undefined} data-readiness={sceneReadiness(scene)} onClick={() => void go({ ...route, scene: scene.id })} title={scene.title}><span>{index + 1}</span>{scene.title}</button></li>)}
      </ol>}
      <header className={s.stageHead}>
        <button type="button" className={s.back} onClick={() => void go({ ...route, scene: "" })}><LayoutGrid size={16} aria-hidden="true" />{evening ? "Zum Storyboard" : "Zurück"}</button>
        <div className={s.stageTitle}>
          <p className={s.eyebrow}>{sceneIndex >= 0 ? `Szene ${sceneIndex + 1} von ${eveningScenes.length}` : "Szene ohne Spielabend"}</p>
          <label><span className={s.srOnly}>Szenentitel</span><TitleArea id="sb-scene" className={s.sceneTitle} value={open.document.title} onChange={title => change({ title })} onBlur={() => { if (!open.document.title.trim()) change({ title: "Neue Szene" }); }} /></label>
        </div>
        <span className={s.stepper}>
          <button type="button" aria-label="Vorherige Szene" disabled={sceneIndex <= 0} onClick={() => void go({ ...route, scene: eveningScenes[sceneIndex - 1].id })}><ChevronLeft size={18} aria-hidden="true" /></button>
          <button type="button" aria-label="Nächste Szene" disabled={sceneIndex < 0 || sceneIndex >= eveningScenes.length - 1} onClick={() => void go({ ...route, scene: eveningScenes[sceneIndex + 1].id })}><ChevronRight size={18} aria-hidden="true" /></button>
        </span>
      </header>
      <nav className={s.areas} aria-label="Die acht Bereiche der Szene – jeder ist freiwillig">
        {sceneGuideSteps.map((step, index) => <button key={step.id} type="button" aria-current={area === step.id ? "step" : undefined} data-filled={areaFilled(open.document, step.id) || undefined} data-private={privateAreas.has(step.id) || undefined} onClick={() => switchArea(step.id)}>
          <span className={s.areaNo}>{index + 1}</span><span className={s.areaName}>{areaShort[step.id]}</span>
        </button>)}
      </nav>
      <div className={s.shelf} data-area={area}>
        <div className={`${s.page} ${privateAreas.has(area) ? s.privatePage : ""}`}>
          <header className={s.areaHead}>
            <p className={s.eyebrow}>Bereich {areaIndex + 1} von {sceneGuideSteps.length}</p>
            <h3>{currentStep.label}</h3>
            <p>{currentStep.hint}</p>
            {privateAreas.has(area) && <p className={s.privateNote}><Lock size={14} aria-hidden="true" />Nur für die Spielleitung. Wird nie automatisch an Spieler freigegeben.</p>}
          </header>

          {area === "narration" && <label className={s.field}><span>Zentraler Schauplatz</span>
            <select value={open.document.placeId} onChange={event => change({ placeId: event.target.value })}>
              <option value="">Kein Schauplatz</option>
              {open.document.placeId && !refs.some(ref => ref.id === open.document.placeId && isCentralPreparationPlace(ref)) && <option value={open.document.placeId} disabled>{nameOf.get(open.document.placeId) || "Bestehender Schauplatz"} · bisherige Zuordnung</option>}
              {refs.filter(ref => isCentralPreparationPlace(ref)).map(ref => <option key={ref.id} value={ref.id}>{ref.title}</option>)}
            </select>
          </label>}

          {area === "atmosphere" && <div className={s.tools}>
            <SceneBackdropPicker fileId={open.document.backdropFileId} files={files} onChange={backdropFileId => change({ backdropFileId })} onUploaded={uploaded} />
            <SceneYoutubePicker tracks={open.document.youtube || []} onChange={youtube => change({ youtube })} />
          </div>}

          {area === "dialogueNotes" && <div className={s.tools}>
            <PreparationNPCs references={refs} values={open.document.npcIds} onChange={npcIds => change({ npcIds })} />
            <PreparationFigures values={open.document.standardFigures} onChange={standardFigures => change({ standardFigures })} files={files} onUploaded={uploaded} />
          </div>}

          {area === "interactions" && <section className={s.materials} aria-labelledby="sb-materials">
            <div className={s.materialsHead}>
              <h4 id="sb-materials">Spielmaterial dieser Szene <small>{open.document.elements.length}</small></h4>
              <a className={s.ghost} href={"/sl/command-center?bereich=vorbereitung&material=szenen&szene=" + encodeURIComponent(open.id)} target="_blank" rel="noopener noreferrer"><FileText size={15} aria-hidden="true" />Spielmaterial in eigenem Fenster bearbeiten</a>
            </div>
            {open.document.elements.length ? <ul className={s.materialGrid}>{open.document.elements.map(element => {
              const file = element.fileId ? files.find(item => item.id === element.fileId) : undefined;
              return <li key={element.id} data-kind={element.kind}>
                {file?.mime.startsWith("image/") ? <img src={"/api/files?id=" + encodeURIComponent(file.id) + "&size=thumb"} alt="" loading="lazy" /> : <span className={s.materialIcon} aria-hidden="true"><FileText size={22} /></span>}
                <span><small>{elementKindNames[element.kind] || "Baustein"}</small><strong>{element.title}</strong>
                  {file && <em>{file.name}</em>}{!file && element.fileId && <em>Datei nicht verfügbar</em>}{element.referenceId && <em>{nameOf.get(element.referenceId) || "Verknüpfung nicht verfügbar"}</em>}</span>
              </li>;
            })}</ul> : <p className={s.planBlank}>Noch kein Spielmaterial angelegt. Lege es im eigenen Fenster an – sobald du hierher zurückkehrst, erscheint es in dieser Liste.</p>}
          </section>}

          {area === "visions"
            ? <PreparationWhispers scene={open.document} players={players} files={files} onChange={change} onSave={save} onUploaded={uploaded}>{textArea("visions")}</PreparationWhispers>
            : textArea(area)}

          {area === "possibleConsequences" && <section className={s.branches} aria-label="Optionale Abzweigungen">
            <h4>Optionale Abzweigungen</h4>
            <p>Alternative Verläufe bleiben Möglichkeiten. Ihre Vorbereitung löst nichts aus.</p>
            <div className={s.branchGrid}>{open.document.possibilities.map((item, index) => <div className={s.branch} key={item.id}>
              <label className={s.field}><span>Titel der Abzweigung</span><input maxLength={200} value={item.title} onChange={event => change({ possibilities: open.document.possibilities.map((value, i) => i === index ? { ...value, title: event.target.value } : value) })} /></label>
              <label className={s.field}><span>Was passiert dann?</span><textarea maxLength={3000} rows={3} value={item.text} onChange={event => change({ possibilities: open.document.possibilities.map((value, i) => i === index ? { ...value, text: event.target.value } : value) })} /></label>
              <button type="button" className={s.ghost} onClick={() => change({ possibilities: open.document.possibilities.filter(value => value.id !== item.id) })}>Abzweigung entfernen</button>
            </div>)}</div>
            <div><button type="button" className={s.ghost} disabled={open.document.possibilities.length >= 50} onClick={() => change({ possibilities: [...open.document.possibilities, { id: crypto.randomUUID(), title: "Neue Abzweigung", text: "" }] })}><Plus size={15} aria-hidden="true" />Abzweigung hinzufügen</button></div>
          </section>}
        </div>
      </div>
      <footer className={s.areaNav}>
        <button type="button" className={s.ghost} disabled={areaIndex === 0} onClick={() => switchArea(sceneGuideSteps[areaIndex - 1].id)}><ChevronLeft size={16} aria-hidden="true" />Zurück</button>
        {areaIndex < sceneGuideSteps.length - 1 && <button type="button" className={s.skip} onClick={() => switchArea(sceneGuideSteps[areaIndex + 1].id)}>Bereich überspringen</button>}
        {areaIndex < sceneGuideSteps.length - 1
          ? <button type="button" className={s.primary} disabled={busy} onClick={() => void save().then(ok => { if (ok) switchArea(sceneGuideSteps[areaIndex + 1].id); })}>Speichern & weiter<ChevronRight size={16} aria-hidden="true" /></button>
          : <button type="button" className={s.primary} disabled={busy} onClick={() => void go({ ...route, scene: "" })}>{evening ? "Speichern & zum Spielabend" : "Speichern & zurück"}<ChevronRight size={16} aria-hidden="true" /></button>}
      </footer>
      <p className={s.classicScene}><button type="button" onClick={() => void save().then(ok => ok && onClassic(open.id))}><Wrench size={14} aria-hidden="true" />Diese Szene in der klassischen Ansicht öffnen</button></p>
    </section> : <p className={s.empty}>Diese Akte ist nicht mehr verfügbar. <button type="button" onClick={() => void go({ book: "", evening: "", scene: "" })}>Zur Chronik</button></p>}
    <p className={s.classic}><button type="button" onClick={() => onClassic()}>Klassische Vorbereitungsansicht öffnen</button></p>
  </div>;
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

function ProgressBar({ progress }: { progress: { total: number; idea: number; draft: number; ready: number } }) {
  if (!progress.total) return <p className={s.progressText}>Noch keine Szene geplant.</p>;
  return <div className={s.progress} aria-label={`${progress.ready} von ${progress.total} Szenen spielbereit, ${progress.draft} im Entwurf, ${progress.idea} Ideen`}>
    <span className={s.progressBar}>{(["ready", "draft", "idea"] as const).map(key => progress[key] ? <span key={key} data-readiness={key} style={{ flexGrow: progress[key] }} /> : null)}</span>
    <small>{progress.ready}/{progress.total} spielbereit · {progress.draft} im Entwurf · {progress.idea} {progress.idea === 1 ? "Idee" : "Ideen"}</small>
  </div>;
}

function EveningShelf({ title, sessions, scenes, onOpen, onCreate, busy }: { title: string; sessions: PreparedSession[]; scenes: SceneSummary[]; onOpen: (id: string) => void; onCreate?: () => void; busy: boolean }) {
  if (!sessions.length && !onCreate) return title ? null : <p className={s.empty}>Dieses Buch hat noch keinen Spielabend. Lege oben den ersten an.</p>;
  return <section className={s.shelfBlock}>
    {title && <h3>{title}</h3>}
    <ul className={s.eveningGrid}>{sessions.map(session => {
      const list = orderedSessionScenes(session.id, session.document, scenes), progress = eveningProgress(session.id, session.document, scenes);
      return <li key={session.id}><button type="button" className={s.eveningCard} onClick={() => onOpen(session.id)}>
        <span className={s.eyebrow}>{preparationStatusNames[session.document.status]}{session.document.date ? " · " + session.document.date.slice(0, 10) : ""}</span>
        <strong>{session.document.title}</strong>
        <span className={s.thumbs} aria-hidden="true">{list.slice(0, 8).map(scene => <span key={scene.id} data-readiness={sceneReadiness(scene)} />)}{list.length > 8 && <em>+{list.length - 8}</em>}</span>
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
    <ul>{scenes.map(scene => <li key={scene.id} data-readiness={sceneReadiness(scene)}>
      <button type="button" className={s.trayOpen} onClick={() => onOpen(scene.id)}><strong>{scene.title}</strong><small>{sceneReadinessNames[sceneReadiness(scene)]}</small></button>
      {onPlace && <button type="button" className={s.trayPlace} disabled={busy} onClick={() => onPlace(scene.id)} aria-label={`In den Abend holen: ${scene.title}`}><Plus size={14} aria-hidden="true" />In den Abend</button>}
    </li>)}</ul>
  </section>;
}
