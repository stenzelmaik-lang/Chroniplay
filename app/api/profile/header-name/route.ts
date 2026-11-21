import {actor, failure, json} from '@/server/access';
import {account} from '@/server/account-profile';
import {headerName} from '@/server/header-name';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { try { const u = await account(req), a = await actor(false); return json(await headerName(a, u.id)); } catch (e) { return failure(e, req); } }
