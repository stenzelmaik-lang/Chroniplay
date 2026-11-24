/** Spielpause: watching another player's Rubik cube live. Built like the live table's own channels (`live-deliveries`):
 * small JSON documents in `settings`, scoped by campaign and evening, gated by the running evening (`stageRoom`, runId)
 * and read by the clients' polling. Who may watch whom is decided here only, from the session; the client never names
 * itself. A viewer receives the cube feed of a host who invited them and nothing else; the personal leaderboard is
 * never part of it. Failures here must never affect play. */
import {database,HttpError,type Actor} from './access';
import {liveMembers,roomCrew} from './live-game';
import {stageRoom} from './live-stage';
import {readSetting,mutateSetting} from './settings-store';
import {watchCommandSchema,currentPairs,invite,withdraw,viewersOf,hostsOf,mayWatch,type WatchState,type CubeFeed} from '@/domain/spielpause-watch';

const pairsKey=(campaignId:string,sessionId:string)=>`spielpause-watch:${campaignId}:${sessionId}`;
const feedKey=(campaignId:string,sessionId:string,hostId:string)=>`spielpause-feed:${campaignId}:${sessionId}:${hostId}`;
type StoredFeed={runId:string;feed:CubeFeed;updatedAt:string};
const parseState=(raw:string|null):WatchState|null=>{try{const s=raw?JSON.parse(raw):null;return s&&typeof s.runId==='string'&&Array.isArray(s.pairs)?s:null;}catch{return null;}};
const parseFeed=(raw:string|null):StoredFeed|null=>{try{const f=raw?JSON.parse(raw):null;return f&&typeof f.runId==='string'&&f.feed?f:null;}catch{return null;}};
const sessionOk=(id:unknown):id is string=>typeof id==='string'&&id.length>0&&id.length<=160;

/** The running evening and everyone at its table. The caller must be allowed into the evening (`stageRoom`). */
async function evening(a:Actor,sessionId:string,expectedRunId?:string){
 const {room}=await stageRoom(a,sessionId);
 const runId=room.runId||'';
 if(expectedRunId!==undefined&&runId!==expectedRunId)throw new HttpError(409,'Spielabend inzwischen gewechselt.');
 const crew=roomCrew(room,await liveMembers(a)).map(m=>({id:m.id,name:m.name}));
 if(!crew.some(m=>m.id===a.id))throw new HttpError(404,'Spielabend nicht verfügbar.');
 return {runId,crew};
}
async function pairs(a:Actor,sessionId:string,runId:string){return currentPairs(parseState(await readSetting(pairsKey(a.campaignId,sessionId))),runId);}
const dropFeed=(a:Actor,sessionId:string,hostId:string)=>database().prepare('DELETE FROM settings WHERE key=?').bind(feedKey(a.campaignId,sessionId,hostId)).run();

/** What the caller needs for their own Spielpause: whom they invited, whom they could invite, who invited them. */
export async function watchStatus(a:Actor,sessionId:unknown){
 if(!sessionOk(sessionId))throw new HttpError(400,'Spielabend wählen.');
 const {runId,crew}=await evening(a,sessionId),p=await pairs(a,sessionId,runId);
 const name=(id:string)=>crew.find(m=>m.id===id)?.name||'Unbekannt';
 const atTable=(id:string)=>crew.some(m=>m.id===id);
 return {
  runId,
  viewers:viewersOf(p,a.id).filter(atTable).map(id=>({id,name:name(id)})),
  candidates:crew.filter(m=>m.id!==a.id),
  watching:hostsOf(p,a.id).filter(atTable).map(id=>({id,name:name(id)})),
 };
}

/** A host's live cube for an invited viewer. Without an invitation the answer is the same 404 as for a missing host. */
export async function watchFeed(a:Actor,sessionId:unknown,hostId:unknown){
 if(!sessionOk(sessionId)||typeof hostId!=='string'||!hostId||hostId.length>160)throw new HttpError(400,'Spielabend und Spieler wählen.');
 const {runId,crew}=await evening(a,sessionId);
 const host=crew.find(m=>m.id===hostId);
 if(!host||!mayWatch(await pairs(a,sessionId,runId),hostId,a.id))throw new HttpError(404,'Nicht gefunden.');
 const stored=parseFeed(await readSetting(feedKey(a.campaignId,sessionId,hostId)));
 const live=stored&&stored.runId===runId?stored:null;
 return {host:{id:host.id,name:host.name},feed:live?live.feed:null,ageMs:live?Math.max(0,Date.now()-Date.parse(live.updatedAt)):null};
}

export async function watchCommand(a:Actor,raw:unknown){
 const parsed=watchCommandSchema.safeParse(raw);
 if(!parsed.success)throw new HttpError(400,'Ungültige Spielpause-Aktion: '+parsed.error.issues[0].message);
 const c=parsed.data,{runId,crew}=await evening(a,c.sessionId,c.runId),key=pairsKey(a.campaignId,c.sessionId);
 if(c.action==='publish'){
  // Only stored while somebody is invited; otherwise the cube stays entirely in the player's browser.
  if(!viewersOf(await pairs(a,c.sessionId,runId),a.id).length){await dropFeed(a,c.sessionId,a.id);return watchStatus(a,c.sessionId);}
  const value:StoredFeed={runId,feed:c.feed,updatedAt:new Date().toISOString()};
  // One writer per key (the host's own browser): the latest state simply replaces the previous one.
  await database().prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(feedKey(a.campaignId,c.sessionId,a.id),JSON.stringify(value)).run();
  return watchStatus(a,c.sessionId);
 }
 if(c.action==='invite'&&!crew.some(m=>m.id===c.viewerId&&m.id!==a.id))throw new HttpError(400,'Diese Person sitzt nicht an diesem Tisch.');
 let left=0;
 await mutateSetting(key,parseState,(s)=>{
  const current=currentPairs(s,runId);
  let next;
  try{next=c.action==='invite'?invite(current,a.id,c.viewerId,new Date().toISOString()):withdraw(current,a.id,c.viewerId);}
  catch(e){throw new HttpError(400,(e as Error).message);}
  left=viewersOf(next,a.id).length;
  return {runId,pairs:next};
 },'Die Einladung wurde gleichzeitig geändert. Bitte erneut versuchen.');
 if(!left)await dropFeed(a,c.sessionId,a.id);
 return watchStatus(a,c.sessionId);
}
