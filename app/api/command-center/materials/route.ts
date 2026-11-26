import { authoringRequestMax } from '@/domain/authoring-limits';
import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { materialCommandSchema } from '@/domain/material-library';
import { executeMaterial, listMaterials, readMaterial } from '@/server/material-library';
import { refreshScenesUsingMaterial } from '@/server/story-scenes';
export const dynamic = 'force-dynamic';
/** Szene 2.0, Etappe 3: material library. SL only, like every command-center route. A save refreshes the copies in
 * every scene that uses the material, so the current Regie plays the new version. */
export async function GET(req: Request) {
  try {
    const a = await actor(); gmOnly(a); const db = database(), id = new URL(req.url).searchParams.get('id');
    if (id) return json({ material: await readMaterial(db, a, id) });
    return json(await listMaterials(db, a));
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); gmOnly(a); const body = await input(req, authoringRequestMax);
    const command = materialCommandSchema.safeParse(body);
    if (!command.success) throw new HttpError(400, command.error.issues[0].message);
    const db = database(), material = await executeMaterial(db, a, command.data);
    const scenes = command.data.action === 'save' ? await refreshScenesUsingMaterial(db, a, material.id) : { refreshed: [], skipped: [] };
    return json({ material, scenes }, command.data.action === 'create' ? 201 : 200);
  } catch (e) { return failure(e, req); }
}
