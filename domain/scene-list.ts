import { richTextToPlainText } from './location-rich-text.ts';
import { scenePreparation } from './session-overview.ts';
import { sceneDocumentSchema, sceneStateSchema, type SceneSummary } from './story-scene.ts';

/** The columns of one stored SCENE entity that a list summary needs. */
export type SceneListRow = { id: string; version: number; updated_at: string; title: string; gm_body: string | null; content: string | null };

function object(raw: string | null): Record<string, unknown> {
  try { const v: unknown = JSON.parse(raw || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
  catch { return {}; }
}
const plain = (value: string) => richTextToPlainText(value).replace(/\s+/g, ' ').trim();
const str = (v: unknown) => typeof v === 'string' ? v : '';

/** Catalog card of one scene (SL only).
 * - The search index is visible text, not the stored rich-text JSON: before P1 it shipped the raw document
 *   (about 95 % of a 1 MB list for 39 scenes) and matched formatting keys such as "text" or "bold" in every scene.
 * - `search: false` skips the index where nobody searches (the live table's scene picker).
 * - One unreadable scene no longer fails the whole list (Command Center, Regie catalog). It stays visible as
 *   `unsupported` under its stored title; opening it still reports the existing 409, and nothing is rewritten. */
export function summarizeSceneRow(row: SceneListRow, { search = true }: { search?: boolean } = {}): SceneSummary {
  const raw = object(row.gm_body), document = sceneDocumentSchema.safeParse(raw), state = sceneStateSchema.safeParse(object(row.content));
  if (!document.success || !state.success) return {
    id: row.id, title: row.title || str(raw.title) || 'Szene', archived: raw.archived === true, storyId: str(raw.storyId), placeId: str(raw.placeId), parentId: str(raw.parentId),
    version: row.version, updatedAt: row.updated_at, runs: [], sessionIds: [], favorite: false, pinned: false, elements: [], searchText: '', unsupported: true,
  };
  const d = document.data;
  return {
    id: row.id, title: d.title, archived: d.archived, storyId: d.storyId, placeId: d.placeId, version: row.version, updatedAt: row.updated_at, runs: state.data.runs,
    preparation: scenePreparation(d), parentId: d.parentId, sessionIds: d.sessionIds, favorite: d.favorite, pinned: d.pinned,
    elements: d.elements.map(({ id, title, kind }) => ({ id, title, kind })),
    ...(d.board ? { board: d.board } : {}),
    searchText: search ? [d.board?.premise || '', plain(d.narration), ...d.elements.map(e => e.title + ' ' + plain(e.text))].filter(Boolean).join(' ') : '',
  };
}
