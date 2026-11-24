/** Personal Spielpause results. Every query is bound to the signed-in member: nobody else's times are ever read or returned.
 * A failure here must never affect play; the cube keeps working and only shows that saving failed. */
import {database,HttpError,type Actor} from './access';
import {resultCreateSchema,resultQuerySchema,RESULTS_PER_HOUR,RESULTS_SHOWN} from '@/domain/spielpause';

type Row={time_ms:number;moves:number;created_at:string};
const view=(r:Row)=>({timeMs:r.time_ms,moves:r.moves,createdAt:r.created_at});

export async function ownResults(a:Actor,game:unknown){
 const parsed=resultQuerySchema.safeParse({game});
 if(!parsed.success)throw new HttpError(400,'Unbekanntes Spiel.');
 const r=await database().prepare('SELECT time_ms,moves,created_at FROM spielpause_results WHERE campaign_id=? AND member_id=? AND game=? ORDER BY time_ms ASC, moves ASC, created_at ASC LIMIT ?')
  .bind(a.campaignId,a.id,parsed.data.game,RESULTS_SHOWN).all<Row>();
 return {results:r.results.map(view)};
}

export async function saveResult(a:Actor,raw:unknown){
 const parsed=resultCreateSchema.safeParse(raw);
 if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
 const d=parsed.data,db=database(),now=new Date();
 const recent=await db.prepare('SELECT count(*) n FROM spielpause_results WHERE campaign_id=? AND member_id=? AND created_at>?').bind(a.campaignId,a.id,new Date(now.getTime()-3600_000).toISOString()).first<{n:number}>();
 if((recent?.n||0)>=RESULTS_PER_HOUR)throw new HttpError(429,'Sehr viele Runden in einer Stunde. Die Zeit wird gerade nicht gespeichert.');
 await db.prepare('INSERT INTO spielpause_results(id,campaign_id,member_id,game,time_ms,moves,created_at) VALUES(?,?,?,?,?,?,?)')
  .bind(crypto.randomUUID(),a.campaignId,a.id,d.game,d.timeMs,d.moves,now.toISOString()).run();
 return ownResults(a,d.game);
}
