import {z} from 'zod';
import {actor,database,failure,HttpError,input,json,sameOrigin} from '@/server/access';
import {setInformationUnlock} from '@/server/location-milestones';
export const dynamic='force-dynamic';
const schema=z.object({entityId:z.string().min(1).max(160),expectedRevision:z.number().int().min(0),milestone:z.string().max(200).nullable(),reason:z.string().trim().min(1).max(500)}).strict();
export async function POST(req:Request){try{sameOrigin(req);const a=await actor(),data=schema.safeParse(await input(req));if(!data.success)throw new HttpError(400,'Ungültige Freischaltung.');return json(await setInformationUnlock(database(),a,data.data));}catch(error){return failure(error,req);}}