/** Spielpause: a player invites others at the running evening to watch their Rubik cube live. Pure rules only.
 * Owner decisions 24.11.2026: viewers see the cube, the running time and the move count, never the personal
 * leaderboard; an invitation can be withdrawn at any time and ends with the evening; fellow players and the GM can be
 * invited, and without an invitation nobody (the GM included) sees anything. */
import {z} from 'zod';

/** How many people one player may invite at once. */
export const MAX_VIEWERS=8;
/** Turns per round that are broadcast. A round with more turns stops broadcasting until the next round. */
export const MAX_FEED_MOVES=4000;
/** Notation of a finished round: "U R′ F2 M …" (prime as ′ or '). Empty for a solved, unscrambled cube. */
const MOVE_TOKEN="[UDLRFBMES](?:2|['′])?";
export const FEED_MOVES=new RegExp('^(?:'+MOVE_TOKEN+'(?: '+MOVE_TOKEN+')*)?$');

const sessionId=z.string().min(1).max(160);
const runId=z.string().uuid();
const memberId=z.string().min(1).max(160);

export const cubeFeedSchema=z.object({
 /** New id per round (new scramble or reset); the viewer animates only turns appended within the same round. */
 round:z.string().regex(/^[A-Za-z0-9-]{1,64}$/),
 /** Every finished turn since the solved start of this round, scramble included. */
 moves:z.string().max(MAX_FEED_MOVES*3).regex(FEED_MOVES,'Ungültige Zugfolge.'),
 overflow:z.boolean(),
 timerState:z.enum(['idle','armed','running','stopped']),
 timeMs:z.number().int().min(0).max(24*3600_000),
 userMoves:z.number().int().min(0).max(100000),
 solved:z.boolean(),
}).strict().refine(f=>!f.moves||f.moves.split(' ').length<=MAX_FEED_MOVES,'Zu viele Züge.');
export type CubeFeed=z.infer<typeof cubeFeedSchema>;

export const watchCommandSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('invite'),sessionId,runId,viewerId:memberId}).strict(),
 z.object({action:z.literal('withdraw'),sessionId,runId,viewerId:memberId}).strict(),
 z.object({action:z.literal('publish'),sessionId,runId,feed:cubeFeedSchema}).strict(),
]);
export type WatchCommand=z.infer<typeof watchCommandSchema>;

export type WatchPair={hostId:string;viewerId:string;since:string};
export type WatchState={runId:string;pairs:WatchPair[]};

/** Invitations of the current evening only: a stored state of an earlier run counts as empty. */
export function currentPairs(state:WatchState|null,currentRunId:string):WatchPair[]{
 return state&&state.runId===currentRunId&&Array.isArray(state.pairs)?state.pairs:[];
}
export function invite(pairs:WatchPair[],hostId:string,viewerId:string,now:string):WatchPair[]{
 if(hostId===viewerId)throw new Error('Du kannst dich nicht selbst einladen.');
 if(pairs.some(p=>p.hostId===hostId&&p.viewerId===viewerId))return pairs;
 if(pairs.filter(p=>p.hostId===hostId).length>=MAX_VIEWERS)throw new Error('Höchstens '+MAX_VIEWERS+' Zuschauer gleichzeitig.');
 return [...pairs,{hostId,viewerId,since:now}];
}
export const withdraw=(pairs:WatchPair[],hostId:string,viewerId:string)=>pairs.filter(p=>!(p.hostId===hostId&&p.viewerId===viewerId));
export const viewersOf=(pairs:WatchPair[],hostId:string)=>pairs.filter(p=>p.hostId===hostId).map(p=>p.viewerId);
export const hostsOf=(pairs:WatchPair[],viewerId:string)=>pairs.filter(p=>p.viewerId===viewerId).map(p=>p.hostId);
export const mayWatch=(pairs:WatchPair[],hostId:string,viewerId:string)=>pairs.some(p=>p.hostId===hostId&&p.viewerId===viewerId);
