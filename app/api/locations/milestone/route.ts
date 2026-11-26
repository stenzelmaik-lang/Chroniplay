import {z} from 'zod';
import {actor,database,failure,HttpError,input,json,sameOrigin} from '@/server/access';
import {fireMilestone,listMilestones} from '@/server/location-milestones';
export const dynamic='force-dynamic';
const schema=z.object({label:z.string().max(200),reason:z.string().trim().min(1).max(500)}).strict();
/** Reached milestones: every active member may read names and times; only the SL can reach one. */
export async function GET(req:Request){try{const a=await actor();return json(await listMilestones(database(),a));}catch(error){return failure(error,req);}}
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),data=schema.safeParse(await input(req));if(!data.success)throw new HttpError(400,'Ungültiger Meilenstein.');return json(await fireMilestone(database(),a,data.data));}catch(error){return failure(error,req);}}