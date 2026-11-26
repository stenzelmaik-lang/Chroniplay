"use client";
import { useState } from "react";
import { ArrowRight, Clock, CornerDownLeft, Plus, Trash2 } from "lucide-react";
import type { SceneSummary } from "@/domain/story-scene";
import { sceneStatus } from "@/domain/storyboard";
import { boardBlockKinds, boardBlockTypes, boardKind, boardLaneMax, boardLinkKindNames, boardLinkKinds, boardLinkMax, boardLinkTextMax, boardMinutesMax, boardPriorities, boardPriorityNames, boardStatuses, boardStatusNames, boardTimeLabelMax, formatMinutes, isOptionalBlock, type BoardBlockKind, type BoardLink, type BoardLinkKind, type BoardStatus, type SceneBoard } from "@/domain/storyboard-blocks";
import { plotGraph, plotTimeline } from "@/domain/storyboard-views";
import s from "./storyboard.module.css";

/** Storyboard 2.0, Phase 2: the network, list and timeline views. All read the same scenes; edits go through the normal scene save. */

export type BoardView = "cards" | "network" | "list" | "timeline";
export const boardViewNames: Record<BoardView, string> = { cards: "Karten", network: "Handlungsnetz", list: "Liste", timeline: "Zeitlinie" };
const tone: Record<BoardStatus, string> = { idea: "idea", working: "draft", review: "draft", ready: "ready", deferred: "idea" };

export function ViewSwitch({ value, onChange, cardsLabel = "Karten" }: { value: BoardView; onChange: (view: BoardView) => void; cardsLabel?: string }) {
  return <div className={s.viewSwitch} role="tablist" aria-label="Ansicht wählen – alle Ansichten zeigen dieselben Szenen">
    {(Object.keys(boardViewNames) as BoardView[]).map(key => <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)}>{key === "cards" ? cardsLabel : boardViewNames[key]}</button>)}
  </div>;
}

function StatusPill({ scene }: { scene: SceneSummary }) {
  const status = sceneStatus(scene);
  return <span className={s.pill} data-readiness={tone[status]} data-status={status}>{boardStatusNames[status]}</span>;
}

const colWidth = 236, colGap = 120, rowHeight = 120, rowGap = 26, nodeHeight = 112;

export function PlotNetwork({ scenes: inView, ghosts = [], sequence, onOpen }: { scenes: SceneSummary[]; ghosts?: SceneSummary[]; sequence?: string[]; onOpen: (id: string) => void }) {
  const scenes = [...inView, ...ghosts], ghostIds = new Set(ghosts.map(scene => scene.id));
  const graph = plotGraph(scenes, { sequence });
  if (!inView.length) return <p className={s.empty}>Noch keine Szenen in dieser Ansicht.</p>;
  const pos = new Map(graph.nodes.map(node => [node.id, { x: node.layer * (colWidth + colGap), y: node.row * (rowHeight + rowGap) }]));
  const width = graph.layers * (colWidth + colGap) - colGap + 8, height = Math.max(1, graph.rows) * (rowHeight + rowGap) + 40;
  const byId = new Map(scenes.map(scene => [scene.id, scene]));
  const linked = graph.edges.filter(edge => !edge.implicit).length, implicit = graph.edges.length - linked;
  return <section className={s.network} aria-label="Handlungsnetz">
    <p className={s.viewHint}>{linked ? `${linked} ${linked === 1 ? "Verbindung" : "Verbindungen"}. Sie dienen der Orientierung – du entscheidest am Tisch frei.` : "Noch keine Verbindungen. Öffne eine Szene und lege unter „Verbindungen und Zeit“ fest, wohin es weitergehen kann."}
      {ghosts.length > 0 && ` Blasse Karten liegen außerhalb dieser Ansicht.`}{graph.outside.length > 0 && ` ${graph.outside.length} ${graph.outside.length === 1 ? "Verbindung führt" : "Verbindungen führen"} zu nicht verfügbaren Szenen.`}</p>
    <ul className={s.legend} aria-label="Arten von Verbindungen">{boardLinkKinds.map(kind => <li key={kind} data-kind={kind}><i aria-hidden="true" />{boardLinkKindNames[kind]}</li>)}{implicit > 0 && <li data-kind="implicit"><i aria-hidden="true" />Abendfolge (ohne Verbindung)</li>}</ul>
    <div className={s.networkScroll} tabIndex={0} aria-label="Netz – seitlich verschiebbar">
      <div className={s.networkCanvas} style={{ width, height }}>
        <svg className={s.networkEdges} width={width} height={height} aria-hidden="true">
          <defs>{boardLinkKinds.map(kind => <marker key={kind} id={"sb-arrow-" + kind} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" data-kind={kind} /></marker>)}</defs>
          {graph.edges.map((edge, i) => {
            const a = pos.get(edge.from)!, b = pos.get(edge.to)!;
            let d: string, mx: number, my: number;
            if (edge.back) {
              const x1 = a.x + colWidth / 2, y1 = a.y + nodeHeight, x2 = b.x + colWidth / 2, y2 = b.y + nodeHeight, drop = Math.max(y1, y2) + 34;
              d = `M${x1} ${y1} C ${x1} ${drop}, ${x2} ${drop}, ${x2} ${y2 + 2}`; mx = (x1 + x2) / 2; my = drop - 6;
            } else {
              const x1 = a.x + colWidth, y1 = a.y + nodeHeight / 2, x2 = b.x - 2, y2 = b.y + nodeHeight / 2, c = Math.max(30, (x2 - x1) / 2);
              d = `M${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`; mx = (x1 + x2) / 2; my = (y1 + y2) / 2 - 6;
            }
            return <g key={i} data-kind={edge.kind} data-back={edge.back || undefined} data-implicit={edge.implicit || undefined}>
              <path d={d} markerEnd={edge.implicit ? undefined : `url(#sb-arrow-${edge.kind})`} />
              {(edge.label || edge.condition) && <text x={mx} y={my} textAnchor="middle">{(edge.label || "wenn: " + edge.condition).slice(0, 34)}</text>}
            </g>;
          })}
        </svg>
        {graph.nodes.map(node => {
          const scene = byId.get(node.id)!, p = pos.get(node.id)!, kind = boardKind(scene.board);
          const into = graph.edges.filter(edge => edge.to === node.id && !edge.back && !edge.implicit).length;
          return <button key={node.id} type="button" className={s.node} data-ghost={ghostIds.has(node.id) || undefined} data-readiness={tone[sceneStatus(scene)]} data-status={sceneStatus(scene)} style={{ left: p.x, top: p.y, width: colWidth, height: nodeHeight }} onClick={() => onOpen(node.id)}
            aria-label={`${scene.title} öffnen · ${boardStatusNames[sceneStatus(scene)]}${into > 1 ? " · Zusammenführung" : ""}`}>
            <span className={s.nodeTop}><small>{ghostIds.has(node.id) ? "Außerhalb · " : ""}{kind === "scene" ? "Szene" : boardBlockTypes[kind].label}{isOptionalBlock(scene.board) && kind !== "optional" ? " · optional" : ""}{into > 1 ? " · Zusammenführung" : ""}</small><StatusPill scene={scene} /></span>
            <strong>{scene.title}</strong>
            {(scene.board?.lane || scene.board?.timeLabel) && <small className={s.nodeMeta}>{[scene.board?.lane, scene.board?.timeLabel].filter(Boolean).join(" · ")}</small>}
          </button>;
        })}
      </div>
    </div>
  </section>;
}

export function PlotList({ scenes, eveningOf, busyId, onOpen, onPatch }: { scenes: SceneSummary[]; eveningOf: (id: string) => string; busyId: string; onOpen: (id: string) => void; onPatch: (id: string, patch: Partial<SceneBoard>) => void }) {
  if (!scenes.length) return <p className={s.empty}>Noch keine Szenen in dieser Ansicht.</p>;
  return <section className={s.listView} aria-label="Listenansicht">
    <p className={s.viewHint}>Schnell bearbeiten: Änderungen werden sofort gespeichert. Texte bearbeitest du in der Szene.</p>
    <div className={s.listScroll}>
      <table className={s.listTable}>
        <thead><tr><th scope="col">Nr.</th><th scope="col">Szene</th><th scope="col">Typ</th><th scope="col">Status</th><th scope="col">Priorität</th><th scope="col">Dauer (Min.)</th><th scope="col">Spur</th><th scope="col">Spielabend</th></tr></thead>
        <tbody>{scenes.map((scene, index) => {
          const b = scene.board || {}, busy = busyId === scene.id, title = scene.title;
          return <tr key={scene.id} data-status={sceneStatus(scene)} aria-busy={busy || undefined}>
            <td data-label="Nr.">{String(index + 1).padStart(2, "0")}</td>
            <td data-label="Szene"><button type="button" className={s.linkButton} onClick={() => onOpen(scene.id)}>{title}</button></td>
            <td data-label="Typ"><select aria-label={"Typ: " + title} value={boardKind(scene.board)} disabled={busy} onChange={event => onPatch(scene.id, { kind: event.target.value as BoardBlockKind })}>{boardBlockKinds.map(key => <option key={key} value={key}>{boardBlockTypes[key].label}</option>)}</select></td>
            <td data-label="Status"><select aria-label={"Status: " + title} value={b.status || ""} disabled={busy} onChange={event => onPatch(scene.id, { status: (event.target.value || undefined) as BoardStatus | undefined })}>
              <option value="">Automatisch · {boardStatusNames[sceneStatus({ ...scene, board: undefined })]}</option>
              {boardStatuses.map(key => <option key={key} value={key}>{boardStatusNames[key]}</option>)}
            </select></td>
            <td data-label="Priorität"><select aria-label={"Priorität: " + title} value={b.priority || ""} disabled={busy} onChange={event => onPatch(scene.id, { priority: (event.target.value || undefined) as SceneBoard["priority"] })}>
              <option value="">–</option>{boardPriorities.map(key => <option key={key} value={key}>{boardPriorityNames[key]}</option>)}
            </select></td>
            <td data-label="Dauer (Min.)"><NumberCell label={"Dauer: " + title} value={b.minutes} max={boardMinutesMax} disabled={busy} onCommit={minutes => onPatch(scene.id, { minutes })} /></td>
            <td data-label="Spur"><TextCell label={"Spur: " + title} value={b.lane || ""} max={boardLaneMax} disabled={busy} onCommit={lane => onPatch(scene.id, { lane: lane || undefined })} /></td>
            <td data-label="Spielabend">{eveningOf(scene.id) || <em>Ideenablage</em>}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}

/** Commits on blur or Enter, so a quick edit is one save, not one per keystroke. */
function TextCell({ label, value, max, disabled, onCommit }: { label: string; value: string; max: number; disabled: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value), [base, setBase] = useState(value);
  if (base !== value) { setBase(value); setDraft(value); }
  const commit = () => { const next = draft.trim(); if (next !== value) onCommit(next); };
  return <input aria-label={label} value={draft} maxLength={max} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setDraft(value); }} placeholder="–" />;
}
function NumberCell({ label, value, max, disabled, onCommit }: { label: string; value: number | undefined; max: number; disabled: boolean; onCommit: (value: number | undefined) => void }) {
  const text = value ? String(value) : "";
  const [draft, setDraft] = useState(text), [base, setBase] = useState(text);
  if (base !== text) { setBase(text); setDraft(text); }
  const commit = () => { const n = Math.trunc(Number(draft)); const next = draft.trim() && n >= 1 ? Math.min(max, n) : undefined; if (next !== value) onCommit(next); else setDraft(text); };
  return <input aria-label={label} type="number" inputMode="numeric" min={1} max={max} step={5} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} placeholder="–" />;
}

/** Rows by player group (lane) or by plot thread (Phase 3). A scene in several threads appears in its first one. */
export function PlotTimeline({ scenes, onOpen, threadTitles = new Map() }: { scenes: SceneSummary[]; onOpen: (id: string) => void; threadTitles?: ReadonlyMap<string, string> }) {
  const [byThread, setByThread] = useState(false);
  if (!scenes.length) return <p className={s.empty}>Noch keine Szenen in dieser Ansicht.</p>;
  const t = byThread
    ? plotTimeline(scenes, { laneOf: scene => scene.board?.threads?.map(id => threadTitles.get(id)).find(Boolean) || "", sharedName: "Ohne Handlungsstrang" })
    : plotTimeline(scenes), byId = new Map(scenes.map(scene => [scene.id, scene]));
  const unordered = t.columns.filter(column => !column.ordered).length;
  return <section className={s.timeline} aria-label="Zeitlinie">
    <div className={s.viewSwitch} role="group" aria-label="Zeilen der Zeitlinie">
      <button type="button" aria-pressed={!byThread} onClick={() => setByThread(false)}>Nach Spielergruppe</button>
      <button type="button" aria-pressed={byThread} onClick={() => setByThread(true)}>Nach Handlungsstrang</button>
    </div>
    <p className={s.viewHint}>Spalten folgen der Zeitfolge, Zeilen den Spuren. Gleiche Zeitfolge heißt: gleichzeitig.{unordered ? ` ${unordered} ${unordered === 1 ? "Szene hat" : "Szenen haben"} noch keine Zeitfolge und ${unordered === 1 ? "steht" : "stehen"} hinten.` : ""} Zeit und Spur legst du in der Szene unter „Verbindungen und Zeit“ fest.</p>
    <div className={s.timelineScroll} tabIndex={0} aria-label="Zeitlinie – seitlich verschiebbar">
      <div className={s.timelineGrid} style={{ gridTemplateColumns: `minmax(120px,160px) repeat(${t.columns.length}, minmax(190px,1fr))` }}>
        <span className={s.timelineCorner}>Spur</span>
        {t.columns.map(column => <span key={column.key} className={s.timelineHead} data-ordered={column.ordered || undefined}><Clock size={12} aria-hidden="true" />{column.label}</span>)}
        {t.lanes.map((lane, laneIndex) => <div key={lane} className={s.timelineRow} style={{ display: "contents" }}>
          <span className={s.timelineLane}>{lane}</span>
          {t.columns.map((column, columnIndex) => <div key={column.key} className={s.timelineCell}>
            {t.cells.filter(cell => cell.lane === laneIndex && cell.column === columnIndex).map(cell => {
              const scene = byId.get(cell.id)!;
              return <button key={cell.id} type="button" className={s.timelineItem} data-readiness={tone[sceneStatus(scene)]} onClick={() => onOpen(cell.id)}>
                <strong>{scene.title}</strong><span><StatusPill scene={scene} />{scene.board?.minutes ? <small>{formatMinutes(scene.board.minutes)}</small> : null}</span>
              </button>;
            })}
          </div>)}
        </div>)}
      </div>
    </div>
  </section>;
}

type Candidate = { id: string; title: string; group: string };

/** Scene editor: outgoing connections, incoming ones read-only, in-world time and lane. */
export function BoardLinks({ sceneId, board, candidates, incoming, onChange, onOpen, onCreateSuccessor, busy }: { sceneId: string; board: SceneBoard | undefined; candidates: Candidate[]; incoming: { id: string; title: string; kind: BoardLinkKind }[]; onChange: (patch: Partial<SceneBoard>) => void; onOpen: (id: string) => void; onCreateSuccessor: (title: string, kind: BoardBlockKind) => void; busy: boolean }) {
  const links = board?.links || [];
  const titleOf = new Map(candidates.map(c => [c.id, c.group === "Archiv" ? c.title + " · archiviert" : c.title]));
  const free = candidates.filter(c => c.id !== sceneId && c.group !== "Archiv" && !links.some(link => link.to === c.id));
  const [target, setTarget] = useState("");
  const [newTitle, setNewTitle] = useState(""), [newKind, setNewKind] = useState<BoardBlockKind>("scene");
  const [startOpen] = useState(() => links.length > 0 || !!board?.lane || !!board?.timeLabel || typeof board?.timeOrder === "number" || incoming.length > 0);
  const groups = [...new Set(free.map(c => c.group))];
  const setLinks = (next: BoardLink[]) => onChange({ links: next.length ? next : undefined });
  const update = (id: string, patch: Partial<BoardLink>) => setLinks(links.map(link => link.id === id ? { ...link, ...patch } : link));
  return <details className={s.boardMore} open={startOpen || undefined}>
    <summary>Verbindungen und Zeit{links.length ? ` · ${links.length} ${links.length === 1 ? "Verbindung" : "Verbindungen"}` : ""}</summary>
    <div className={s.linksBlock}>
      <p className={s.boardHint}>Wohin kann es nach dieser Szene gehen? Verbindungen helfen bei der Orientierung und schränken dich am Tisch nicht ein.</p>
      {links.length > 0 && <ul className={s.linkList}>{links.map(link => <li key={link.id}>
        <span className={s.linkTarget}><ArrowRight size={14} aria-hidden="true" />{titleOf.get(link.to) ? <button type="button" className={s.linkButton} onClick={() => onOpen(link.to)}>{titleOf.get(link.to)}</button> : <em>Szene nicht verfügbar</em>}</span>
        <label className={s.field}><span>Art</span><select value={link.kind} onChange={event => update(link.id, { kind: event.target.value as BoardLinkKind })}>{boardLinkKinds.map(kind => <option key={kind} value={kind}>{boardLinkKindNames[kind]}</option>)}</select></label>
        <label className={s.field}><span>Beschriftung</span><input maxLength={boardLinkTextMax} value={link.label} onChange={event => update(link.id, { label: event.target.value })} placeholder="z. B. Sie folgen der Spur" /></label>
        <label className={s.field}><span>Bedingung</span><input maxLength={boardLinkTextMax} value={link.condition} onChange={event => update(link.id, { condition: event.target.value })} placeholder="z. B. wenn der Brief gefunden wurde" /></label>
        <button type="button" className={s.ghost} aria-label={"Verbindung entfernen: " + (titleOf.get(link.to) || "Szene")} onClick={() => setLinks(links.filter(item => item.id !== link.id))}><Trash2 size={14} aria-hidden="true" />Entfernen</button>
      </li>)}</ul>}
      <div className={s.linkAdd}>
        <label className={s.field}><span>Neue Verbindung zu</span>
          <select value={target} onChange={event => setTarget(event.target.value)} disabled={links.length >= boardLinkMax}>
            <option value="">Szene wählen …</option>
            {groups.map(group => <optgroup key={group} label={group}>{free.filter(c => c.group === group).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}
          </select>
        </label>
        <button type="button" className={s.ghost} disabled={!target || links.length >= boardLinkMax} onClick={() => { setLinks([...links, { id: crypto.randomUUID(), to: target, kind: "next", label: "", condition: "" }]); setTarget(""); }}><Plus size={14} aria-hidden="true" />Verbinden</button>
      </div>
      <form className={s.linkAdd} onSubmit={event => { event.preventDefault(); if (newTitle.trim()) { onCreateSuccessor(newTitle, newKind); setNewTitle(""); setNewKind("scene"); } }}>
        <label className={s.field}><span>Oder neue Nachfolgeszene anlegen</span><input value={newTitle} maxLength={200} onChange={event => setNewTitle(event.target.value)} placeholder="Titel der neuen Szene …" /></label>
        <label className={s.field}><span>Typ</span><select value={newKind} onChange={event => setNewKind(event.target.value as BoardBlockKind)}>{boardBlockKinds.map(key => <option key={key} value={key}>{boardBlockTypes[key].label}</option>)}</select></label>
        <button type="submit" className={s.ghost} disabled={busy || !newTitle.trim() || links.length >= boardLinkMax}><Plus size={14} aria-hidden="true" />Anlegen und verbinden</button>
      </form>
      {incoming.length > 0 && <p className={s.incoming}><CornerDownLeft size={14} aria-hidden="true" />Hierher führen: {incoming.map((item, i) => <span key={item.id}>{i ? ", " : ""}<button type="button" className={s.linkButton} onClick={() => onOpen(item.id)}>{item.title}</button> <small>({boardLinkKindNames[item.kind]})</small></span>)}</p>}
      <div className={s.boardGrid}>
        <label className={s.field}><span>Zeitpunkt in der Spielwelt</span><input maxLength={boardTimeLabelMax} value={board?.timeLabel || ""} onChange={event => onChange({ timeLabel: event.target.value || undefined })} placeholder="z. B. Nacht 1, 23 Uhr" /></label>
        <label className={s.field}><span>Zeitfolge (Zahl, gleich = gleichzeitig)</span><input type="number" inputMode="numeric" step={1} value={board?.timeOrder ?? ""} onChange={event => { const n = Math.trunc(Number(event.target.value)); onChange({ timeOrder: event.target.value.trim() && Number.isFinite(n) ? Math.max(-100000, Math.min(100000, n)) : undefined }); }} placeholder="z. B. 10" /></label>
        <label className={s.field}><span>Spur (Spielergruppe)</span><input maxLength={boardLaneMax} value={board?.lane || ""} onChange={event => onChange({ lane: event.target.value || undefined })} placeholder="leer = ganze Runde" /></label>
      </div>
    </div>
  </details>;
}
