import type { BoardLinkKind, SceneBoard } from './storyboard-blocks.ts';

/** Storyboard 2.0, Phase 2: pure layouts for the plot network and the timeline. All views read the same scene data;
 * nothing here persists. Connections are orientation only. */

export type ViewScene = { id: string; title: string; board?: SceneBoard };

/** `implicit`: no connection exists; the edge only follows the play order of the evening (see `plotGraph` options). */
export type GraphEdge = { from: string; to: string; kind: BoardLinkKind; label: string; condition: string; back: boolean; implicit?: true };
export type GraphLayout = {
  nodes: { id: string; layer: number; row: number }[];
  edges: GraphEdge[];
  /** Links whose target is not part of this view (another book, archived or unavailable). */
  outside: { from: string; to: string }[];
  layers: number;
  rows: number;
};

/** Layered layout: a scene sits one column right of its furthest predecessor. "Rückkehr" links and links that would
 * close a cycle are drawn as back edges and do not move scenes. Within a column the given order (evening or book) decides. */
export function plotGraph(scenes: readonly ViewScene[], options: { sequence?: readonly string[] } = {}): GraphLayout {
  const ids = new Set(scenes.map(scene => scene.id));
  const index = new Map(scenes.map((scene, i) => [scene.id, i]));
  const edges: GraphEdge[] = [], outside: { from: string; to: string }[] = [];
  for (const scene of scenes) for (const link of scene.board?.links || []) {
    if (!ids.has(link.to)) { outside.push({ from: scene.id, to: link.to }); continue; }
    edges.push({ from: scene.id, to: link.to, kind: link.kind, label: link.label, condition: link.condition, back: link.kind === 'return' || link.to === scene.id });
  }
  // Evening order as a faint fallback: a scene without any connection of its own leads to the next scene of the evening,
  // unless that one is already reached by a connection. Real connections always win.
  const sequence = (options.sequence || []).filter(id => ids.has(id));
  const linkedFrom = new Set(scenes.filter(scene => scene.board?.links?.length).map(scene => scene.id));
  const reached = new Set(edges.map(edge => edge.to));
  for (let i = 0; i + 1 < sequence.length; i++) {
    const from = sequence[i], to = sequence[i + 1];
    if (!linkedFrom.has(from) && !reached.has(to)) edges.push({ from, to, kind: 'next', label: '', condition: '', back: false, implicit: true });
  }
  // Mark edges that close a cycle (depth-first in the given order); they become back edges.
  const forward = new Map<string, GraphEdge[]>();
  for (const edge of edges) if (!edge.back) forward.set(edge.from, [...(forward.get(edge.from) || []), edge]);
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const edge of forward.get(id) || []) {
      const s = state.get(edge.to);
      if (s === 1) edge.back = true;
      else if (!s) visit(edge.to);
    }
    state.set(id, 2);
  };
  for (const scene of scenes) if (!state.has(scene.id)) visit(scene.id);
  // Longest path over the remaining acyclic edges, in topological order (Kahn, ties by given order).
  const incoming = new Map(scenes.map(scene => [scene.id, 0]));
  for (const edge of edges) if (!edge.back) incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  const layer = new Map(scenes.map(scene => [scene.id, 0]));
  const queue = scenes.filter(scene => !incoming.get(scene.id)).map(scene => scene.id);
  while (queue.length) {
    queue.sort((a, b) => index.get(a)! - index.get(b)!);
    const id = queue.shift()!;
    for (const edge of edges) if (!edge.back && edge.from === id) {
      layer.set(edge.to, Math.max(layer.get(edge.to)!, layer.get(id)! + 1));
      incoming.set(edge.to, incoming.get(edge.to)! - 1);
      if (!incoming.get(edge.to)) queue.push(edge.to);
    }
  }
  const rowsUsed = new Map<number, number>();
  const nodes = scenes.map(scene => {
    const l = layer.get(scene.id)!, row = rowsUsed.get(l) || 0;
    rowsUsed.set(l, row + 1);
    return { id: scene.id, layer: l, row };
  });
  return { nodes, edges, outside, layers: nodes.length ? Math.max(...nodes.map(n => n.layer)) + 1 : 0, rows: Math.max(0, ...rowsUsed.values()) };
}

/** Targets of this view's connections that lie outside it (another evening, the idea tray, another book).
 * The network shows them as faint "ghost" nodes so no branch silently ends. Ghosts carry no links of their own. */
export function linkedOutside<T extends ViewScene & { archived?: boolean }>(list: readonly T[], all: readonly T[]): T[] {
  const inside = new Set(list.map(scene => scene.id));
  const wanted = new Set(list.flatMap(scene => (scene.board?.links || []).map(link => link.to)).filter(id => !inside.has(id)));
  return all.filter(scene => wanted.has(scene.id) && !scene.archived).map(scene => ({ ...scene, board: scene.board ? { ...scene.board, links: undefined } : undefined }));
}

/** Scenes reachable from one scene: its connections in order, with the target title when known. For "Weiter laut Verbindungen". */
export function nextScenes<T extends ViewScene>(scene: ViewScene | undefined, all: readonly T[]): { link: NonNullable<SceneBoard['links']>[number]; scene: T | undefined }[] {
  const byId = new Map(all.map(item => [item.id, item]));
  return (scene?.board?.links || []).map(link => ({ link, scene: byId.get(link.to) }));
}

export const sharedLane = 'Gemeinsam';
export type TimelineLayout = {
  lanes: string[];
  columns: { key: string; label: string; ordered: boolean }[];
  cells: { id: string; lane: number; column: number }[];
};

/** Timeline: one lane per group (empty lane = the whole round), one column per point in time.
 * Scenes with the same time order share a column (parallel action). Scenes without a time order follow in the given order. */
export function plotTimeline(scenes: readonly ViewScene[], options: { laneOf?: (scene: ViewScene) => string; sharedName?: string } = {}): TimelineLayout {
  const lanes: string[] = [], shared = options.sharedName || sharedLane;
  const laneOf = (scene: ViewScene) => (options.laneOf ? options.laneOf(scene) : scene.board?.lane)?.trim() || shared;
  for (const scene of scenes) if (!lanes.includes(laneOf(scene))) lanes.push(laneOf(scene));
  if (lanes.includes(shared) && lanes[0] !== shared) { lanes.splice(lanes.indexOf(shared), 1); lanes.unshift(shared); }
  const ordered = [...new Set(scenes.map(scene => scene.board?.timeOrder).filter((v): v is number => typeof v === 'number'))].sort((a, b) => a - b);
  const columns: TimelineLayout['columns'] = ordered.map(value => {
    const label = scenes.find(scene => scene.board?.timeOrder === value && scene.board?.timeLabel)?.board?.timeLabel || 'Zeitpunkt ' + value;
    return { key: 't' + value, label, ordered: true };
  });
  const cells: TimelineLayout['cells'] = [];
  for (const scene of scenes) {
    const t = scene.board?.timeOrder;
    let column: number;
    if (typeof t === 'number') column = ordered.indexOf(t);
    else { column = columns.length; columns.push({ key: 'u' + scene.id, label: scene.board?.timeLabel || 'Ohne Zeitangabe', ordered: false }); }
    cells.push({ id: scene.id, lane: lanes.indexOf(laneOf(scene)), column });
  }
  return { lanes, columns, cells };
}
