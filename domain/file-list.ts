// File list (GET /api/files without id): the Persönliches Archiv and the file pickers read it.
// SL decision 21.11.2026: a player never sees other players' files there, not even ones they set to "Für die Gruppe".
// A player's list holds the own files and the group files the SL released. The SL keeps the full overview.
// Direct reads by id (/api/files?id=…) keep their own checks; group files still show where they were placed.

/** SQL condition "the file owner is the SL of this campaign": an active owner/GM membership, or, without any
 *  membership row, the legacy Kleve GM recognised by GM_EMAIL (same rule as server/role-resolver.ts). */
const ownerIsSl = `(EXISTS (SELECT 1 FROM campaign_memberships cm WHERE cm.campaign_id=files.campaign_id AND cm.user_id=files.owner_id AND cm.status='active' AND cm.role IN ('campaign_owner','campaign_gm'))
 OR (?<>'' AND NOT EXISTS (SELECT 1 FROM campaign_memberships cm WHERE cm.campaign_id=files.campaign_id AND cm.user_id=files.owner_id)
  AND EXISTS (SELECT 1 FROM members m WHERE m.id=files.owner_id AND m.campaign_id=files.campaign_id AND m.status='active' AND lower(trim(m.email))=lower(trim(?)))))`;

const columns = "id,owner_id,visibility,name,mime,size,created_at,CASE WHEN key LIKE 'users/%/visionen/%' THEN 'visionen' WHEN key LIKE 'users/%/botschaften/%' THEN 'botschaften' END AS section";

export function fileListQuery(viewer:{id:string;gm:boolean;campaignId:string},gmEmail:string):{sql:string;binds:(string|number)[]}{
 if(viewer.gm)return {
  sql:`SELECT ${columns} FROM files WHERE campaign_id=? AND (owner_id=? OR visibility IN ('group','sl')) ORDER BY created_at DESC`,
  binds:[viewer.campaignId,viewer.id],
 };
 return {
  sql:`SELECT ${columns} FROM files WHERE campaign_id=? AND (owner_id=? OR (visibility='group' AND ${ownerIsSl})) ORDER BY created_at DESC`,
  binds:[viewer.campaignId,viewer.id,gmEmail,gmEmail],
 };
}
