import {actor,sameOrigin,json,failure,HttpError} from '@/server/access';
import {voiceStatus,voiceJoin} from '@/server/live-voice';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const a=await actor(),session=new URL(req.url).searchParams.get('sessionId');
 if(!session)throw new HttpError(400,'Spielabend wählen.');
 return json(await voiceStatus(a,session));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);
 if(!(req.headers.get('content-type')||'').includes('application/json'))throw new HttpError(415,'JSON erwartet.');
 const text=await req.text();if(text.length>2000)throw new HttpError(413,'Anfrage zu groß.');
 let body:unknown;try{body=JSON.parse(text);}catch{throw new HttpError(400,'Ungültige Sprachaktion.');}
 return json(await voiceJoin(await actor(),body));
}catch(e){return failure(e,req);}}
