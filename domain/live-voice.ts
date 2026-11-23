/** Voice and video at the live table (VV-01, prototype). Pure rules; the server owns the Cloudflare RealtimeKit calls.
 * - Release gate: only campaigns named explicitly in CVK_VOICE_CAMPAIGNS (comma list, no wildcard). Without the variable
 *   the feature is off and every voice route answers 404.
 * - Isolated local test instance (CVK_VOICE=local-only and AUTH_ACCESS_ENVIRONMENT=local-test): available everywhere and,
 *   without RealtimeKit secrets, served by a dummy that never contacts Cloudflare.
 * - No recording, no transcription: the server only creates meetings and participant tokens. */
export type VoiceGateEnv={CVK_VOICE?:string;CVK_VOICE_CAMPAIGNS?:string;AUTH_ACCESS_ENVIRONMENT?:string};
export type VoiceSecretsEnv={CF_REALTIME_ACCOUNT_ID?:string;CF_REALTIME_APP_ID?:string;CF_REALTIME_API_TOKEN?:string;CF_REALTIME_PRESET_HOST?:string;CF_REALTIME_PRESET_PARTICIPANT?:string};
export type VoiceConfig={accountId:string;appId:string;apiToken:string;hostPreset:string;participantPreset:string};

export const VOICE_TOKEN_HOURS=12;
export const DEFAULT_HOST_PRESET='group_call_host';
export const DEFAULT_PARTICIPANT_PRESET='group_call_participant';

export const voiceLocal=(env:VoiceGateEnv)=>env.CVK_VOICE==='local-only'&&env.AUTH_ACCESS_ENVIRONMENT==='local-test';
export function voiceAvailable(env:VoiceGateEnv,campaignId:string){
 if(voiceLocal(env))return true;
 return !!campaignId&&(env.CVK_VOICE_CAMPAIGNS||'').split(',').map(s=>s.trim()).filter(s=>s&&s!=='*').includes(campaignId);
}
const id=(value:string|undefined)=>(value||'').trim();
/** All three secrets or nothing: a half configuration counts as not configured. */
export function voiceConfig(env:VoiceSecretsEnv):VoiceConfig|null{
 const accountId=id(env.CF_REALTIME_ACCOUNT_ID),appId=id(env.CF_REALTIME_APP_ID),apiToken=id(env.CF_REALTIME_API_TOKEN);
 if(!/^[0-9a-f]{32}$/i.test(accountId)||!/^[A-Za-z0-9-]{8,64}$/.test(appId)||apiToken.length<20)return null;
 return {accountId,appId,apiToken,hostPreset:id(env.CF_REALTIME_PRESET_HOST)||DEFAULT_HOST_PRESET,participantPreset:id(env.CF_REALTIME_PRESET_PARTICIPANT)||DEFAULT_PARTICIPANT_PRESET};
}
export type VoiceMode='live'|'attrappe'|'unconfigured';
export function voiceMode(gate:VoiceGateEnv,secrets:VoiceSecretsEnv):VoiceMode{return voiceConfig(secrets)?'live':voiceLocal(gate)?'attrappe':'unconfigured';}

/** The GM hosts the room (may mute and remove); everyone else joins as participant. */
export const voicePreset=(gm:boolean,c:Pick<VoiceConfig,'hostPreset'|'participantPreset'>)=>gm?c.hostPreset:c.participantPreset;
export const voiceBase=(c:Pick<VoiceConfig,'accountId'|'appId'>)=>`https://api.cloudflare.com/client/v4/accounts/${c.accountId}/realtime/kit/${c.appId}`;
/** One meeting per live evening (runId). The title holds no personal data. */
export const meetingBody=(runId:string)=>({title:'ChroniPlay Spielabend '+runId.slice(0,8)});
/** Short-lived token: valid one minute early (clock skew) and for one evening at most. */
export function participantBody(a:{id:string;name:string;gm:boolean},c:Pick<VoiceConfig,'hostPreset'|'participantPreset'>,now=Date.now()){
 return {name:(a.name||'Teilnehmer').slice(0,80),preset_name:voicePreset(a.gm,c),custom_participant_id:a.id,
  token:{not_before:new Date(now-60_000).toISOString(),expires_on:new Date(now+VOICE_TOKEN_HOURS*3_600_000).toISOString()}};
}
/** RealtimeKit answers {success,data}; older Cloudflare envelopes use {result}. */
export function apiData(body:unknown):Record<string,unknown>|null{
 if(!body||typeof body!=='object')return null;
 const b=body as {success?:boolean;data?:unknown;result?:unknown};
 if(b.success===false)return null;
 const d=b.data??b.result;return d&&typeof d==='object'?d as Record<string,unknown>:null;
}
export type RoomVoice={runId:string;meetingId:string};
/** The stored meeting only counts for the evening it was created for. */
export const currentMeeting=(voice:RoomVoice|undefined,runId:string|undefined)=>runId&&voice?.runId===runId&&voice.meetingId?voice.meetingId:'';
