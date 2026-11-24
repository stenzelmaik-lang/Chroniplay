import {actor,sameOrigin,input,json,failure} from '@/server/access';
import {ownResults,saveResult} from '@/server/spielpause';
export const dynamic='force-dynamic';
/** GET ?spiel=rubik: the signed-in player's own best results. POST: save one solve. Never other players' data. */
export async function GET(req:Request){try{
 return json(await ownResults(await actor(),new URL(req.url).searchParams.get('spiel')));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);
 return json(await saveResult(await actor(),await input(req,2000)),201);
}catch(e){return failure(e,req);}}
