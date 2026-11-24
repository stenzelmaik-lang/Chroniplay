import {actor,sameOrigin,input,json,failure,HttpError} from '@/server/access';
import {voiceStatus,voiceJoin} from '@/server/live-voice';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),session=new URL(req.url).searchParams.get('sessionId');
 if(!session)throw new HttpError(400,'Spielabend wählen.');
 return json(await voiceStatus(a,session));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);
 return json(await voiceJoin(await actor(),await input(req,2000)));
}catch(e){return failure(e,req);}}
