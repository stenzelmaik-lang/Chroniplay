import type {Actor} from '@/domain/types';
import {activeCharacterBody} from '@/domain/character-selection';
import {database} from './access';
import {selectedCharacter} from './character-selection';

export type HeaderNameMode = 'account' | 'character';
export type HeaderName = {mode: HeaderNameMode; name: string; accountName: string; characterName: string | null};

/**
 * The name a member sees for themself in the header. Display only: rights,
 * projections and SL views keep using the account identity (actor().name).
 * The character is the saved active character of the current campaign, or the
 * only active own character; otherwise the account name stays.
 */
export async function headerName(a: Actor, userId: string): Promise<HeaderName> {
  const db = database();
  const row = await db.prepare('SELECT preferences FROM auth_profiles WHERE user_id=?').bind(userId).first<{preferences: string | null}>();
  let mode: HeaderNameMode = 'account';
  try { if (JSON.parse(row?.preferences || '{}').headerName === 'character') mode = 'character'; } catch { mode = 'account'; }
  const characterName = a.status === 'active' ? await headerCharacterName(a, userId) : null;
  return {mode, name: mode === 'character' && characterName ? characterName : a.name, accountName: a.name, characterName};
}

async function headerCharacterName(a: Actor, userId: string) {
  const rows = await database().prepare("SELECT r.id,r.title,r.body FROM records r JOIN entities e ON e.id=r.id AND e.campaign_id=r.campaign_id WHERE r.campaign_id=? AND r.owner_id=? AND r.kind='charaktere' AND e.canon_status<>'GM_SECRET' ORDER BY r.id").bind(a.campaignId, a.id).all<{id: string; title: string; body: string}>();
  const active = rows.results.filter(row => { try { return activeCharacterBody(JSON.parse(row.body)); } catch { return false; } });
  const chosen = await selectedCharacter(a, userId);
  const character = chosen ? active.find(row => row.id === chosen) : active.length === 1 ? active[0] : undefined;
  const title = character?.title?.trim();
  return title ? title.slice(0, 120) : null;
}
