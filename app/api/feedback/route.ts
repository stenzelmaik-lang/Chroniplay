import {actor,sameOrigin,input,json,failure} from '@/server/access';
import {createFeedback,ownFeedback,allFeedback,updateFeedback} from '@/server/feedback';
export const dynamic='force-dynamic';
/** GET: own reports; ?alle=1 for the operator (GM/owner) all reports of the campaign. */
export async function GET(req:Request){try{
 const a=await actor();
 return json(new URL(req.url).searchParams.get('alle')==='1'?await allFeedback(a):await ownFeedback(a));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);
 return json(await createFeedback(await actor(),await input(req,20000),req.headers.get('user-agent')),201);
}catch(e){return failure(e,req);}}
export async function PATCH(req:Request){try{
 sameOrigin(req);
 return json(await updateFeedback(await actor(),await input(req,10000)));
}catch(e){return failure(e,req);}}
