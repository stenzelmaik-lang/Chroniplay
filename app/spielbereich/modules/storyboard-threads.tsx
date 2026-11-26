"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, ChevronRight, Clock, Eye, GitBranch, Lock, Plus, Trash2, X } from "lucide-react";
import type { SceneSummary } from "@/domain/story-scene";
import type { CommandReference } from "@/domain/command-workspace";
import { boardThreadMax } from "@/domain/storyboard-blocks";
import { effectiveClueFound, isStrandOpen, newStrand, openStrands, stateName, strandHints, strandKindList, strandKinds, threadCounts, threadKindNames, threadKinds, threadLimits, threadStatusNames, threadStatuses, type ClueKnowledge, type OpenStrand, type Strand, type StrandKind, type ThreadDocument, type ThreadView } from "@/domain/plot-threads";
import s from "./storyboard.module.css";

/** Storyboard 2.0, Phase 3: plot threads in the storyboard. SL only. Nothing here reveals anything to players. */

type Book = { id: string; title: string };
async function call<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!r.ok) throw new Error((r.status === 409 ? "Konflikt: Der Handlungsstrang wurde inzwischen anderswo geändert. " : "") + (d.error || d.message || "Anfrage fehlgeschlagen."));
  return d;
}

/** Changes one strand of a thread from elsewhere (scene view): load, patch, save. Returns the saved thread. */
export async function patchStrand(threadId: string, strandId: string, patch: Partial<Strand>): Promise<ThreadView> {
  const { thread } = await call<{ thread: ThreadView }>("/api/command-center/threads?id=" + encodeURIComponent(threadId));
  const document = { ...thread.document, strands: thread.document.strands.map(item => item.id === strandId ? { ...item, ...patch } : item) };
  return (await call<{ thread: ThreadView }>("/api/command-center/threads", { action: "save", id: thread.id, version: thread.version, document })).thread;
}
export async function createThread(document: ThreadDocument): Promise<ThreadView> {
  return (await call<{ thread: ThreadView }>("/api/command-center/threads", { action: "create", clientRequestId: crypto.randomUUID(), document })).thread;
}

const strandPlural: Record<StrandKind, string> = { clue: "Hinweise", secret: "Geheimnisse", decision: "Entscheidungen", promise: "Versprechen", consequence: "Konsequenzen", event: "Ereignisse und Fristen" };

function OpenStrandList({ items, sceneTitle, onOpenThread, onOpenScene, limit = 12 }: { items: OpenStrand[]; sceneTitle: (id: string) => string; onOpenThread: (id: string) => void; onOpenScene: (id: string) => void; limit?: number }) {
  if (!items.length) return <p className={s.planBlank}>Keine offenen Fäden. Alles, was du in Handlungssträngen vormerkst, erscheint hier – das Dringendste zuerst.</p>;
  return <ul className={s.openList}>{items.slice(0, limit).map(item => <li key={item.threadId + item.strand.id} data-kind={item.strand.kind}>
    <span className={s.openKind}>{strandKinds[item.strand.kind].label}</span>
    <span className={s.openMain}><strong>{item.strand.title}</strong>
      <small><button type="button" className={s.linkButton} onClick={() => onOpenThread(item.threadId)}>{item.threadTitle}</button> · {stateName(item.strand)}
        {item.strand.deadline && <> · <Clock size={11} aria-hidden="true" /> {item.strand.deadline}</>}
        {item.strand.sceneId && <> · <button type="button" className={s.linkButton} onClick={() => onOpenScene(item.strand.sceneId)}>{sceneTitle(item.strand.sceneId)}</button></>}</small></span>
  </li>)}{items.length > limit && <li className={s.openMore}>und {items.length - limit} weitere in den Handlungssträngen</li>}</ul>;
}

/** Chronicle and book level: thread cards plus the open strands, most pressing first. */
export function ThreadShelf({ threads, scenes, books, bookId, sceneOrder, busy, onOpenThread, onOpenScene, onCreate }: { threads: ThreadView[]; scenes: SceneSummary[]; books: Book[]; bookId?: string; sceneOrder: ReadonlyMap<string, number>; busy: boolean; onOpenThread: (id: string) => void; onOpenScene: (id: string) => void; onCreate: () => void }) {
  const list = bookId ? threads.filter(thread => thread.document.bookIds.includes(bookId) || scenes.some(scene => scene.storyId === bookId && scene.board?.threads?.includes(thread.id))) : threads;
  const active = list.filter(thread => thread.document.status !== "resolved" && thread.document.status !== "dropped"), closed = list.length - active.length;
  const sceneTitle = (id: string) => scenes.find(scene => scene.id === id)?.title || "Szene nicht verfügbar";
  return <section className={s.threadShelf} aria-labelledby={"sb-threads-" + (bookId || "all")}>
    <div className={s.planHead}>
      <h3 id={"sb-threads-" + (bookId || "all")}><GitBranch size={16} aria-hidden="true" /> Handlungsstränge{bookId ? " in diesem Buch" : ""} <small>{active.length}{closed ? ` · ${closed} abgeschlossen` : ""}</small></h3>
      <button type="button" className={s.ghost} disabled={busy} onClick={onCreate}><Plus size={15} aria-hidden="true" />Neuer Handlungsstrang</button>
    </div>
    {list.length ? <ul className={s.threadGrid}>{list.map(thread => {
      const counts = threadCounts(thread.document), sceneCount = scenes.filter(scene => !scene.archived && scene.board?.threads?.includes(thread.id)).length;
      return <li key={thread.id}><button type="button" className={s.threadCard} data-status={thread.document.status} onClick={() => onOpenThread(thread.id)}>
        <span className={s.eyebrow}>{threadKindNames[thread.document.kind]} · {threadStatusNames[thread.document.status]}</span>
        <strong>{thread.document.title}</strong>
        <small>{sceneCount} {sceneCount === 1 ? "Szene" : "Szenen"} · {counts.open} offen{thread.document.bookIds.length > 1 ? ` · ${thread.document.bookIds.length} Bücher` : thread.document.bookIds.length === 1 && !bookId ? " · " + (books.find(book => book.id === thread.document.bookIds[0])?.title || "Buch") : ""}</small>
      </button></li>;
    })}</ul> : <p className={s.planBlank}>Noch kein Handlungsstrang. Ein Strang verbindet Szenen über Abende und Bücher hinweg und sammelt Hinweise, Geheimnisse, Entscheidungen, Versprechen, Konsequenzen und Ereignisse.</p>}
    {active.length > 0 && <>
      <h4 className={s.openHead}>Offene Fäden</h4>
      <OpenStrandList items={openStrands(active, sceneOrder)} sceneTitle={sceneTitle} onOpenThread={onOpenThread} onOpenScene={onOpenScene} />
    </>}
  </section>;
}

/** Scene view: which threads the scene belongs to, and what threads have prepared for exactly this scene. */
export function SceneThreads({ sceneId, joined, threads, onJoin, onOpenThread, onCreate, onStrandChanged, busy }: { sceneId: string; joined: string[]; threads: ThreadView[]; onJoin: (ids: string[]) => void; onOpenThread: (id: string) => void; onCreate: (title: string) => void; onStrandChanged: (thread: ThreadView) => void; busy: boolean }) {
  const [pick, setPick] = useState(""), [title, setTitle] = useState(""), [message, setMessage] = useState("");
  const pending = threads.flatMap(thread => thread.document.strands.filter(strand => strand.sceneId === sceneId && isStrandOpen(strand)).map(strand => ({ thread, strand })));
  const free = threads.filter(thread => !joined.includes(thread.id) && thread.document.status !== "dropped");
  async function setState(thread: ThreadView, strand: Strand, state: string) {
    setMessage("Speichert …");
    try { onStrandChanged(await patchStrand(thread.id, strand.id, { state })); setMessage(""); }
    catch (error) { setMessage((error as Error).message); }
  }
  return <div className={s.sceneThreads}>
    <div className={s.threadChips} aria-label="Handlungsstränge dieser Szene">
      <span className={s.chipLabel}><GitBranch size={13} aria-hidden="true" /> Handlungsstränge</span>
      {joined.map(id => { const thread = threads.find(item => item.id === id); return <span key={id} className={s.chip}>
        <button type="button" onClick={() => thread && onOpenThread(id)} disabled={!thread}>{thread?.document.title || "Strang nicht verfügbar"}</button>
        <button type="button" aria-label={"Aus Strang lösen: " + (thread?.document.title || id)} onClick={() => onJoin(joined.filter(item => item !== id))}><X size={12} aria-hidden="true" /></button>
      </span>; })}
      {joined.length < boardThreadMax && free.length > 0 && <label><span className={s.srOnly}>Handlungsstrang zuordnen</span>
        <select value={pick} onChange={event => { const id = event.target.value; setPick(""); if (id) onJoin([...joined, id]); }}>
          <option value="">+ Zuordnen …</option>
          {free.map(thread => <option key={thread.id} value={thread.id}>{thread.document.title}</option>)}
        </select></label>}
      <form className={s.chipNew} onSubmit={event => { event.preventDefault(); if (title.trim()) { onCreate(title.trim()); setTitle(""); } }}>
        <label><span className={s.srOnly}>Neuer Handlungsstrang</span><input value={title} maxLength={threadLimits.title} onChange={event => setTitle(event.target.value)} placeholder="Neuer Strang …" /></label>
        <button type="submit" disabled={busy || !title.trim() || joined.length >= boardThreadMax} aria-label="Neuen Handlungsstrang anlegen und zuordnen"><Plus size={13} aria-hidden="true" /></button>
      </form>
    </div>
    {pending.length > 0 && <section className={s.pending} aria-label="Für diese Szene vorgemerkt">
      <h4><Lock size={13} aria-hidden="true" /> Für diese Szene vorgemerkt <small>nur SL</small></h4>
      <ul>{pending.map(({ thread, strand }) => <li key={thread.id + strand.id} data-kind={strand.kind}>
        <span className={s.openKind}>{strandKinds[strand.kind].label}</span>
        <span className={s.openMain}><strong>{strand.title}</strong>{strand.text && <small>{strand.text}</small>}<small><button type="button" className={s.linkButton} onClick={() => onOpenThread(thread.id)}>{thread.document.title}</button>{strand.deadline ? " · " + strand.deadline : ""}</small></span>
        <label><span className={s.srOnly}>Stand: {strand.title}</span><select value={strand.state} onChange={event => void setState(thread, strand, event.target.value)}>
          {Object.entries(strandKinds[strand.kind].states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </li>)}</ul>
      {message && <p className={s.viewHint} role="status">{message}</p>}
    </section>}
  </div>;
}

/** The thread page: everything of one thread, edited in place with autosave (compare-and-set on its version). */
export function ThreadPage({ threadId, threads, scenes, books, refs, knowledge, sceneOrder, onOpenScene, onOpenThread, onSaved, onBack, onMessage }: { threadId: string; threads: ThreadView[]; scenes: SceneSummary[]; books: Book[]; refs: CommandReference[]; knowledge: ClueKnowledge; sceneOrder: ReadonlyMap<string, number>; onOpenScene: (id: string) => void; onOpenThread: (id: string) => void; onSaved: (thread: ThreadView) => void; onBack: () => void; onMessage: (text: string) => void }) {
  const stored = threads.find(thread => thread.id === threadId);
  const [draft, setDraft] = useState<ThreadDocument | null>(stored?.document || null);
  const [version, setVersion] = useState(stored?.version || 0);
  const [baseline, setBaseline] = useState(stored ? JSON.stringify(stored.document) : "");
  const [adding, setAdding] = useState<Partial<Record<StrandKind, string>>>({});
  const saving = useRef(false), latest = useRef({ draft, version, baseline }), callbacks = useRef({ onSaved, onMessage });
  useLayoutEffect(() => { latest.current = { draft, version, baseline }; callbacks.current = { onSaved, onMessage }; });
  // A thread that arrives later (first load) or changes elsewhere while nothing is unsaved is taken over.
  const [seen, setSeen] = useState(stored ? stored.id + ":" + stored.version : "");
  if (stored && seen !== stored.id + ":" + stored.version && (!draft || JSON.stringify(draft) === baseline)) {
    setSeen(stored.id + ":" + stored.version); setDraft(stored.document); setVersion(stored.version); setBaseline(JSON.stringify(stored.document));
  }
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  async function save() {
    const start = latest.current;
    if (!start.draft || saving.current || JSON.stringify(start.draft) === start.baseline) return;
    saving.current = true; callbacks.current.onMessage("Speichert …");
    try {
      const { thread } = await call<{ thread: ThreadView }>("/api/command-center/threads", { action: "save", id: threadId, version: start.version, document: start.draft });
      const stable = JSON.stringify(latest.current.draft) === JSON.stringify(start.draft);
      setVersion(thread.version); setBaseline(JSON.stringify(stable ? thread.document : start.draft)); setSeen(thread.id + ":" + thread.version);
      if (stable) setDraft(thread.document);
      callbacks.current.onSaved(thread);
      callbacks.current.onMessage("Gespeichert · " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    } catch (error) { callbacks.current.onMessage((error as Error).message + " Deine Eingaben bleiben erhalten."); }
    finally { saving.current = false; }
  }
  const saveRef = useRef(save);
  useLayoutEffect(() => { saveRef.current = save; });
  useEffect(() => { if (!dirty) return; const timer = setTimeout(() => void saveRef.current(), 1400); return () => clearTimeout(timer); }, [dirty, draft]);
  // Leaving the page saves what is still pending.
  useEffect(() => () => { void saveRef.current(); }, []);

  if (!draft) return <p className={s.empty}>Dieser Handlungsstrang ist nicht verfügbar. <button type="button" onClick={onBack}>Zurück</button></p>;
  const change = (patch: Partial<ThreadDocument>) => setDraft(value => value ? { ...value, ...patch } : value);
  const changeStrand = (id: string, patch: Partial<Strand>) => setDraft(value => value ? { ...value, strands: value.strands.map(item => item.id === id ? { ...item, ...patch } : item) } : value);
  const member = scenes.filter(scene => !scene.archived && scene.board?.threads?.includes(threadId)).sort((a, b) => (sceneOrder.get(a.id) ?? 1e6) - (sceneOrder.get(b.id) ?? 1e6) || a.title.localeCompare(b.title, "de"));
  const sceneOptions = [...member, ...scenes.filter(scene => !scene.archived && !member.includes(scene)).sort((a, b) => (sceneOrder.get(a.id) ?? 1e6) - (sceneOrder.get(b.id) ?? 1e6) || a.title.localeCompare(b.title, "de"))];
  const refOptions = refs.filter(ref => ["NPC", "PLACE", "CLUE", "HANDOUT", "FACTION"].includes(ref.type));
  const refName = (id: string) => refs.find(ref => ref.id === id)?.title || "Akte nicht verfügbar";
  const counts = threadCounts(draft);
  return <section className={s.threadPage} aria-labelledby="sb-thread">
    <header className={s.levelHead}>
      <div>
        <p className={s.eyebrow}>Handlungsstrang · {counts.open} offen von {counts.total} Fäden{dirty ? " · ungespeichert" : ""}</p>
        <h2 id="sb-thread"><label><span className={s.srOnly}>Titel des Handlungsstrangs</span><input className={s.titleInput} value={draft.title} maxLength={threadLimits.title} onChange={event => change({ title: event.target.value })} onBlur={() => { if (!draft.title.trim()) change({ title: "Neuer Handlungsstrang" }); }} /></label></h2>
        <p>Verbindet Szenen über Abende und Bücher hinweg. Nur für dich – nichts wird automatisch an Spieler freigegeben.</p>
      </div>
      <button type="button" className={s.ghost} onClick={onBack}>Zurück</button>
    </header>
    <div className={s.boardPanel}>
      <div className={s.boardRow}>
        <label className={s.statusPick}><span>Art</span><select value={draft.kind} onChange={event => change({ kind: event.target.value as ThreadDocument["kind"] })}>{threadKinds.map(key => <option key={key} value={key}>{threadKindNames[key]}</option>)}</select></label>
        <label className={s.statusPick}><span>Stand</span><select value={draft.status} onChange={event => change({ status: event.target.value as ThreadDocument["status"] })}>{threadStatuses.map(key => <option key={key} value={key}>{threadStatusNames[key]}</option>)}</select></label>
        <div className={s.threadChips} aria-label="Bücher dieses Strangs">
          <span className={s.chipLabel}><BookOpen size={13} aria-hidden="true" /> Bücher</span>
          {draft.bookIds.map(id => <span key={id} className={s.chip}><span>{books.find(book => book.id === id)?.title || "Buch nicht verfügbar"}</span><button type="button" aria-label="Buch lösen" onClick={() => change({ bookIds: draft.bookIds.filter(item => item !== id) })}><X size={12} aria-hidden="true" /></button></span>)}
          {draft.bookIds.length < threadLimits.books && <select value="" aria-label="Buch hinzufügen" onChange={event => { if (event.target.value) change({ bookIds: [...draft.bookIds, event.target.value] }); }}>
            <option value="">+ Buch …</option>{books.filter(book => !draft.bookIds.includes(book.id)).map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
          </select>}
        </div>
      </div>
      <label className={s.field}><span>Worum geht es?</span><textarea rows={3} maxLength={threadLimits.summary} value={draft.summary} onChange={event => change({ summary: event.target.value })} placeholder="Kern, Ziel und offene Frage des Strangs …" /></label>
    </div>

    <section className={s.threadScenes} aria-labelledby="sb-thread-scenes">
      <h3 id="sb-thread-scenes">Szenen in diesem Strang <small>{member.length}</small></h3>
      {member.length ? <ol>{member.map(scene => <li key={scene.id}><button type="button" className={s.linkButton} onClick={() => onOpenScene(scene.id)}>{scene.title}</button></li>)}</ol>
        : <p className={s.planBlank}>Noch keine Szene. Ordne Szenen in der Szene selbst diesem Strang zu (oben unter „Handlungsstränge“).</p>}
    </section>

    {strandKindList.map(kind => {
      const items = draft.strands.filter(strand => strand.kind === kind);
      return <section key={kind} className={s.strandBlock} data-kind={kind} aria-labelledby={"sb-strands-" + kind}>
        <h3 id={"sb-strands-" + kind}>{strandPlural[kind]} <small>{items.filter(isStrandOpen).length} offen · {items.length}</small></h3>
        <p className={s.viewHint}>{strandHints[kind]}</p>
        {items.length > 0 && <ul className={s.strandList}>{items.map(strand => {
          const found = effectiveClueFound(strand, knowledge);
          return <li key={strand.id} data-open={isStrandOpen(strand) || undefined}>
            <div className={s.strandRow}>
              <label className={s.field}><span>Titel</span><input value={strand.title} maxLength={threadLimits.strandTitle} onChange={event => changeStrand(strand.id, { title: event.target.value })} /></label>
              <label className={s.field}><span>Stand</span><select value={strand.state} onChange={event => changeStrand(strand.id, { state: event.target.value })}>{Object.entries(strandKinds[kind].states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className={s.field}><span>{kind === "clue" ? "Zu finden in" : kind === "decision" ? "Getroffen in" : kind === "secret" ? "Lüften in" : "Vorgemerkt für"}</span>
                <select value={strand.sceneId} onChange={event => changeStrand(strand.id, { sceneId: event.target.value })}>
                  <option value="">Keine Szene</option>
                  {strand.sceneId && !sceneOptions.some(scene => scene.id === strand.sceneId) && <option value={strand.sceneId} disabled>Szene nicht verfügbar</option>}
                  {sceneOptions.map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
                </select></label>
              {(kind === "event" || kind === "promise") && <label className={s.field}><span>Frist</span><input value={strand.deadline} maxLength={threadLimits.deadline} onChange={event => changeStrand(strand.id, { deadline: event.target.value })} placeholder="z. B. bis Nacht 3" /></label>}
              <button type="button" className={s.ghost} aria-label={"Faden entfernen: " + strand.title} onClick={() => setDraft(value => value ? { ...value, strands: value.strands.filter(item => item.id !== strand.id) } : value)}><Trash2 size={14} aria-hidden="true" /></button>
            </div>
            {found !== null && <p className={s.knowledgeNote} data-found={found || undefined}><Eye size={13} aria-hidden="true" />{found ? "Laut Freigaben bereits entdeckt." : "Laut Freigaben noch nicht entdeckt."} Der Stand oben ist deine eigene Planung.</p>}
            <div className={s.threadChips}>
              <span className={s.chipLabel}>Betrifft</span>
              {strand.refIds.map(ref => <span key={ref} className={s.chip}><span>{refName(ref)}</span><button type="button" aria-label="Akte lösen" onClick={() => changeStrand(strand.id, { refIds: strand.refIds.filter(item => item !== ref) })}><X size={12} aria-hidden="true" /></button></span>)}
              {strand.refIds.length < threadLimits.refs && <select value="" aria-label={"Akte verknüpfen: " + strand.title} onChange={event => { if (event.target.value) changeStrand(strand.id, { refIds: [...strand.refIds, event.target.value] }); }}>
                <option value="">+ Akte …</option>
                {refOptions.filter(ref => !strand.refIds.includes(ref.id)).map(ref => <option key={ref.id} value={ref.id}>{ref.title}</option>)}
              </select>}
            </div>
            <details className={s.strandText} open={!!strand.text || undefined}><summary>Notiz{strand.text ? "" : " hinzufügen"}</summary>
              <textarea rows={3} maxLength={threadLimits.strandText} value={strand.text} onChange={event => changeStrand(strand.id, { text: event.target.value })} placeholder="Details, Wortlaut, Bedingungen …" />
            </details>
          </li>;
        })}</ul>}
        <form className={s.linkAdd} onSubmit={event => { event.preventDefault(); const text = (adding[kind] || "").trim(); if (!text || draft.strands.length >= threadLimits.strands) return; setDraft(value => value ? { ...value, strands: [...value.strands, newStrand(kind, text)] } : value); setAdding(value => ({ ...value, [kind]: "" })); }}>
          <label className={s.field}><span>Neu: {strandKinds[kind].label}</span><input value={adding[kind] || ""} maxLength={threadLimits.strandTitle} onChange={event => setAdding(value => ({ ...value, [kind]: event.target.value }))} placeholder="Kurz benennen …" /></label>
          <button type="submit" className={s.ghost} disabled={!(adding[kind] || "").trim()}><Plus size={14} aria-hidden="true" />Hinzufügen</button>
        </form>
      </section>;
    })}
    <p className={s.viewHint}><button type="button" className={s.linkButton} onClick={() => onOpenThread("")}>Alle Handlungsstränge <ChevronRight size={12} aria-hidden="true" /></button></p>
  </section>;
}
