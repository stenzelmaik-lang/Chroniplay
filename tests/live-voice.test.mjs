import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {voiceAvailable,voiceConfig,voiceMode,voicePreset,participantBody,meetingBody,apiData,currentMeeting,voiceBase,VOICE_TOKEN_HOURS,DEFAULT_HOST_PRESET,DEFAULT_PARTICIPANT_PRESET} from '../domain/live-voice.ts';

const secrets={CF_REALTIME_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',CF_REALTIME_APP_ID:'app-1234-abcd',CF_REALTIME_API_TOKEN:'x'.repeat(40)};

test('voice stays off without an explicit campaign allowlist',()=>{
 assert.equal(voiceAvailable({},'chronik-von-kleve'),false);
 assert.equal(voiceAvailable({CVK_VOICE_CAMPAIGNS:''},'chronik-von-kleve'),false);
 assert.equal(voiceAvailable({CVK_VOICE_CAMPAIGNS:'*'},'chronik-von-kleve'),false,'wildcard is ignored');
 assert.equal(voiceAvailable({CVK_VOICE_CAMPAIGNS:'andere-runde'},'chronik-von-kleve'),false);
 assert.equal(voiceAvailable({CVK_VOICE_CAMPAIGNS:' andere , chronik-von-kleve '},'chronik-von-kleve'),true);
 assert.equal(voiceAvailable({CVK_VOICE_CAMPAIGNS:'chronik-von-kleve'},''),false);
});
test('the local flag only opens the isolated local test instance',()=>{
 assert.equal(voiceAvailable({CVK_VOICE:'local-only',AUTH_ACCESS_ENVIRONMENT:'local-test'},'irgendwas'),true);
 assert.equal(voiceAvailable({CVK_VOICE:'local-only',AUTH_ACCESS_ENVIRONMENT:'closed-alpha-production'},'irgendwas'),false);
 assert.equal(voiceAvailable({CVK_VOICE:'local-only'},'irgendwas'),false);
});
test('configuration needs all three secrets in a plausible shape',()=>{
 assert.equal(voiceConfig({}),null);
 assert.equal(voiceConfig({...secrets,CF_REALTIME_API_TOKEN:''}),null,'half configuration counts as none');
 assert.equal(voiceConfig({...secrets,CF_REALTIME_ACCOUNT_ID:'kein-konto'}),null);
 const c=voiceConfig({...secrets,CF_REALTIME_ACCOUNT_ID:' '+secrets.CF_REALTIME_ACCOUNT_ID+'\n'});
 assert.equal(c.accountId,secrets.CF_REALTIME_ACCOUNT_ID,'trims pasted whitespace');
 assert.equal(c.hostPreset,DEFAULT_HOST_PRESET);assert.equal(c.participantPreset,DEFAULT_PARTICIPANT_PRESET);
 assert.equal(voiceConfig({...secrets,CF_REALTIME_PRESET_HOST:'sl',CF_REALTIME_PRESET_PARTICIPANT:'spieler'}).participantPreset,'spieler');
 assert.equal(voiceBase(c),'https://api.cloudflare.com/client/v4/accounts/'+secrets.CF_REALTIME_ACCOUNT_ID+'/realtime/kit/app-1234-abcd');
});
test('mode: live with secrets, dummy only locally, otherwise unconfigured',()=>{
 assert.equal(voiceMode({CVK_VOICE_CAMPAIGNS:'k'},secrets),'live');
 assert.equal(voiceMode({CVK_VOICE:'local-only',AUTH_ACCESS_ENVIRONMENT:'local-test'},{}),'attrappe');
 assert.equal(voiceMode({CVK_VOICE_CAMPAIGNS:'k',AUTH_ACCESS_ENVIRONMENT:'closed-alpha-production'},{}),'unconfigured','production never falls back to the dummy');
});
test('GM hosts, players participate; the token lasts one evening at most',()=>{
 const c=voiceConfig(secrets),now=Date.parse('2026-11-23T18:00:00Z');
 assert.equal(voicePreset(true,c),DEFAULT_HOST_PRESET);assert.equal(voicePreset(false,c),DEFAULT_PARTICIPANT_PRESET);
 const body=participantBody({id:'member-1',name:'Ada',gm:false},c,now);
 assert.equal(body.custom_participant_id,'member-1');assert.equal(body.preset_name,DEFAULT_PARTICIPANT_PRESET);
 assert.equal(Date.parse(body.token.expires_on)-now,VOICE_TOKEN_HOURS*3_600_000);
 assert.ok(Date.parse(body.token.not_before)<now);
 assert.ok(VOICE_TOKEN_HOURS<=12);
 assert.equal(participantBody({id:'m',name:'',gm:true},c,now).name,'Teilnehmer');
 assert.equal(participantBody({id:'m',name:'x'.repeat(200),gm:true},c,now).name.length,80);
 assert.ok(!JSON.stringify(body).includes('@'),'no e-mail goes to Cloudflare');
});
test('meeting title carries no personal data and one meeting belongs to one evening',()=>{
 assert.deepEqual(meetingBody('12345678-aaaa-bbbb-cccc-1234567890ab'),{title:'ChroniPlay Spielabend 12345678'});
 assert.equal(currentMeeting({runId:'r1',meetingId:'m1'},'r1'),'m1');
 assert.equal(currentMeeting({runId:'r1',meetingId:'m1'},'r2'),'','a new evening gets a new meeting');
 assert.equal(currentMeeting(undefined,'r1'),'');assert.equal(currentMeeting({runId:'r1',meetingId:'m1'},undefined),'');
});
test('API envelopes: success with data or result, failures yield nothing',()=>{
 assert.deepEqual(apiData({success:true,data:{id:'m1'}}),{id:'m1'});
 assert.deepEqual(apiData({result:{id:'m2'}}),{id:'m2'});
 assert.equal(apiData({success:false,data:{id:'m1'}}),null);
 assert.equal(apiData(null),null);assert.equal(apiData('text'),null);
});
test('the Cloudflare API token never reaches a response or the browser bundle',()=>{
 const server=readFileSync(new URL('../server/live-voice.ts',import.meta.url),'utf8');
 const returns=server.match(/return \{[^}]*\}/g)||[];
 assert.ok(returns.length>=2);
 for(const r of returns)assert.ok(!/apiToken|accountId|appId|meetingId/.test(r),'response leaks configuration: '+r);
 const client=readFileSync(new URL('../app/spielbereich/modules/spieltisch/voice-bar.tsx',import.meta.url),'utf8');
 assert.ok(!/CF_REALTIME|apiToken|api\.cloudflare\.com/.test(client));
 assert.match(client,/defaults:\{audio:false,video:false\}/,'microphone and camera start switched off');
 assert.ok(!/recording|transcri/i.test(server)&&!/startRecording|transcri/i.test(client),'no recording or transcription');
});
