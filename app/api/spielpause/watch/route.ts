import {actor,sameOrigin,input,json,failure} from '@/server/access';
import {watchStatus,watchFeed,watchCommand} from '@/server/spielpause-watch';
export const dynamic='force-dynamic';
/** GET ?sessionId=…: own invitations. GET ?sessionId=…&host=…: that host's live cube, only with an invitation.
 * POST: invite, withdraw, or publish the own cube (stored only while somebody is invited). Never the leaderboard. */
export async function GET(req:Request){try{
 const q=new URL(req.url).searchParams,a=await actor(),host=q.get('host');
 return json(host===null?await watchStatus(a,q.get('sessionId')):await watchFeed(a,q.get('sessionId'),host));
}catch(e){return failure(e,req);}}
export async function POST(req:Request){try{
 sameOrigin(req);
 return json(await watchCommand(await actor(),await input(req,20000)));
}catch(e){return failure(e,req);}}
