import { authoringRequestMax } from '@/domain/authoring-limits';
import { actor, database, gmOnly, input, sameOrigin, json, failure, HttpError } from '@/server/access';
import { threadCommandSchema } from '@/domain/plot-threads';
import { clueKnowledge, executeThread, listThreads, readThread, threadHistory } from '@/server/plot-threads';
export const dynamic = 'force-dynamic';
/** Storyboard 2.0, Phase 3: plot threads. SL only, like every command-center route. */
export async function GET(req: Request) {
  try {
    const a = await actor(); gmOnly(a); const db = database(), q = new URL(req.url).searchParams, id = q.get('id');
    if (id) { const thread = await readThread(db, a, id); return json({ thread, knowledge: await clueKnowledge(db, a, [thread]), ...(q.get('history') === '1' ? { history: await threadHistory(db, a, id) } : {}) }); }
    const list = await listThreads(db, a);
    return json({ ...list, knowledge: await clueKnowledge(db, a, list.threads) });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req); const a = await actor(); gmOnly(a); const body = await input(req, authoringRequestMax);
    const command = threadCommandSchema.safeParse(body);
    if (!command.success) { const issue = command.error.issues[0]; throw new HttpError(400, (issue.path.includes('strands') ? 'Faden: ' : '') + issue.message); }
    return json({ thread: await executeThread(database(), a, command.data) }, command.data.action === 'create' ? 201 : 200);
  } catch (e) { return failure(e, req); }
}
