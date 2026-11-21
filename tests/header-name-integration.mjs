import {engineFixture} from './fixtures/engine-character.mjs';
// Header name (21.11.2026): a member chooses whether the header shows the account
// name or the active character. Display only; identities for SL and rights stay.
export async function headerNameIntegration({req,check,localSql,sqlQuote}){
 const route='/api/profile/header-name';
 const previous=(await req('/api/character-selection','a')).d.characterId??null;
 const setMode=async(mode,who='a')=>{const p=(await req('/api/profile',who)).d;return req('/api/profile',who,'PATCH',{version:p.version,displayName:p.displayName,avatarFileId:p.avatarFileId,preferences:{...p.preferences,headerName:mode}});};
 check((await req(route)).s===401,'HEADER anonymous denied');
 const start=await req(route,'a');
 check(start.s===200&&start.d.mode==='account'&&start.d.name===start.d.accountName&&start.d.accountName==='Player A','HEADER default shows the account name');
 check((await req('/api/profile','a')).d.preferences.headerName==='account','HEADER profile reports the default mode');
 const own=await req('/api/records','a','POST',{kind:'charaktere',title:'SYNTHETIC HEADER NAME',visibility:'private',body:{...engineFixture}});
 check((await req('/api/character-selection','a','PATCH',{characterId:own.d.id})).s===200,'HEADER own character selected');
 check((await setMode('gm')).s===400,'HEADER unknown mode rejected by the strict profile contract');
 check((await setMode('character')).s===200,'HEADER character mode saved through the profile');
 check((await req('/api/profile','a')).d.preferences.headerName==='character','HEADER mode survives a fresh load');
 const shown=(await req(route,'a')).d;
 check(shown.mode==='character'&&shown.name==='SYNTHETIC HEADER NAME'&&shown.characterName==='SYNTHETIC HEADER NAME'&&shown.accountName==='Player A','HEADER character name shown for the owner');
 check((await req('/api/members','a')).d.actor.name==='Player A','HEADER actor identity unchanged for rights and projections');
 const recipients=(await req('/api/messages?recipients=1&context=preparation','gm')).d.recipients;
 check(recipients.find(player=>player.id==='sprint1-a')?.name==='Player A','HEADER SL recipient list keeps the real player identity');
 const other=await req(route,'b');
 check(other.s===200&&other.d.mode==='account'&&other.d.name==='Player B'&&!JSON.stringify(other.d).includes('SYNTHETIC HEADER NAME'),'HEADER another player sees only their own name');
 const gm=await req(route,'gm');
 check(gm.s===200&&gm.d.mode==='account'&&!JSON.stringify(gm.d).includes('SYNTHETIC HEADER NAME'),'HEADER SL gets their own header name, never a player character');
 const pending=await req(route,'platformOnly');
 check(pending.s===200&&pending.d.characterName===null&&pending.d.name===pending.d.accountName,'HEADER pending account keeps the account name');
 const foreign=await req(route,'otherCampaign');
 check(foreign.s===200&&foreign.d.characterName===null,'HEADER campaign boundary: no Kleve character for another campaign');
 check((await req('/api/character-selection','a','PATCH',{characterId:null})).s===200,'HEADER selection cleared');
 const cleared=(await req(route,'a')).d,actives=(await req('/api/records?kind=charaktere','a')).d.records.filter(r=>r.owner_id==='sprint1-a'&&r.body.archived!==true&&r.body.lifecycleStatus!=='ARCHIVED'&&r.body.recoveryOnly!==true);
 check(actives.length>1?cleared.name==='Player A'&&cleared.characterName===null:cleared.characterName===actives[0]?.title,'HEADER without a choice only a single active character is used, otherwise the account name');
 const theirs=await req('/api/records','b','POST',{kind:'charaktere',title:'SYNTHETIC HEADER FOREIGN',visibility:'private',body:{...engineFixture}});
 localSql("UPDATE auth_profiles SET preferences=json_set(preferences,'$.activeCharacters.\"chronik-von-kleve\"',"+sqlQuote(theirs.d.id)+") WHERE user_id=(SELECT auth_user_id FROM auth_member_links WHERE member_id='sprint1-a')");
 check(!JSON.stringify((await req(route,'a')).d).includes('SYNTHETIC HEADER FOREIGN'),'HEADER a foreign character id in the preferences is never shown');
 check((await setMode('account')).s===200&&(await req(route,'a')).d.name==='Player A','HEADER switching back shows the account name');
 await req('/api/character-selection','a','PATCH',{characterId:previous});
 for(const [who,id] of [['a',own.d.id],['b',theirs.d.id]])await req('/api/character-companion',who,'PATCH',{action:'character.archive',id,version:1,confirmed:true});
}
