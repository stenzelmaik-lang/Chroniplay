import { playerSeenIds, sectionAction, sectionState } from '../domain/location-release-sections.ts';

// Orte, Weg B Teil 2: the section overview reads the real group player view and hides / re-shows one section
// with exactly the requests its buttons send.
export async function locationReleaseOverviewIntegration({req,check,base,ids}) {
  if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Release overview QA requires an isolated local worker.');
  const create=async(level,title,parentId)=>(await req('/api/cms/locations','gm','POST',{level,title,...(parentId?{parentId}:{})})).d;
  const finish=async(node,payload)=>{
    const saved=await req('/api/cms/drafts','gm','PATCH',{revisionId:node.revisionId,expectedVersion:1,payload});
    const review=await req('/api/cms/transitions','gm','POST',{action:'submit',revisionId:node.revisionId,expectedVersion:saved.d.version});
    return req('/api/cms/transitions','gm','POST',{action:'approve',revisionId:node.revisionId,expectedVersion:review.d.version});
  };
  const place=await create('location','Overview-Testort');
  const area=await create('area','Overview-Hinterhof',place.id);
  check((await finish(place,{title:place.title,summary:'Synthetischer Ort fÃ¼r die AbschnittsÃ¼bersicht.'})).s===200&&(await finish(area,{title:area.title,playerHint:'Synthetischer Bereich.'})).s===200,'OVERVIEW synthetic sections are approved in the isolated database');
  const seenIds=async id=>{
    const r=await req('/api/locations?place='+encodeURIComponent(id)+'&view=player&target=group','gm');
    const nodes=(await req('/api/cms/locations?place='+encodeURIComponent(id),'gm')).d.nodes.map(n=>n.id);
    return playerSeenIds(r.s===200?r.d.projection:null,nodes);
  };
  const look=async(placeId,id)=>{
    const rows=(await req('/api/locations?view=sl&target=group&place='+encodeURIComponent(placeId),'gm')).d.projection.location.slGroupReleases;
    const row=rows.find(item=>item.entityId===id),state=sectionState({},row,(await seenIds(placeId)).has(id));
    return {row,state,action:sectionAction(state,row)};
  };
  let s=await look(place.id,area.id);
  check(s.state==='ready'&&s.action==='publish','OVERVIEW approved but unpublished section reads as ready');
  const publish=(id,row)=>req('/api/cms/releases','gm','POST',{action:'publish',entityId:id,scope:'group',revisionId:row.approvedRevisionId,expectedReleaseVersion:row.version,discoveryState:'known',reason:'In der OrtsÃ¼bersicht freigeschaltet'});
  check((await publish(place.id,(await look(place.id,place.id)).row)).s===200&&(await publish(area.id,s.row)).s===200,'OVERVIEW publish button releases a section and grants group knowledge');
  s=await look(place.id,area.id);
  check(s.state==='visible'&&s.action==='revoke','OVERVIEW released section reads as seen by players');
  const asPlayer=async()=>JSON.stringify((await req('/api/locations?place='+encodeURIComponent(place.id)+'&view=player&target=group','a')).d);
  check((await asPlayer()).includes('Overview-Hinterhof'),'OVERVIEW released section is in the real player view');
  check((await req('/api/cms/releases','a','POST',{action:'revoke',entityId:area.id,scope:'group',expectedReleaseVersion:s.row.version,reason:'player'})).s===403,'OVERVIEW players cannot hide sections');
  const stale=s.row.version;
  check((await req('/api/cms/releases','gm','POST',{action:'revoke',entityId:area.id,scope:'group',expectedReleaseVersion:stale,reason:'In der OrtsÃ¼bersicht verborgen'})).s===200,'OVERVIEW hide button revokes one section');
  s=await look(place.id,area.id);
  check(s.state==='ready'&&!(await asPlayer()).includes('Overview-Hinterhof')&&(await asPlayer()).includes('Overview-Testort'),'OVERVIEW hidden section disappears for players while the main place stays');
  check((await req('/api/cms/releases','gm','POST',{action:'revoke',entityId:area.id,scope:'group',expectedReleaseVersion:stale,reason:'stale'})).s===409,'OVERVIEW stale overview gets a conflict instead of a silent overwrite');
  check((await publish(area.id,s.row)).s===200&&(await look(place.id,area.id)).state==='visible'&&(await asPlayer()).includes('Overview-Hinterhof'),'OVERVIEW the same section can be shown again');

  // State of a place on site: closed and open again; players see the state, players cannot switch it.
  const nodeRev=async id=>(await req('/api/cms/locations?place='+encodeURIComponent(place.id),'gm')).d.nodes.find(n=>n.id===id).revision;
  const world=(who,state,rev)=>req('/api/locations/state',who,'POST',{placeId:place.id,entityId:area.id,mode:'world',worldState:state,expectedRevision:rev,reason:'In der Orte-Werkstatt geändert'});
  const before=await nodeRev(area.id);
  check((await world('a','inaccessible',before)).s===403,'OVERVIEW players cannot switch the state of a place');
  check((await world('gm','inaccessible',before)).s===200,'OVERVIEW SL closes one section');
  const closed=(await req('/api/locations?place='+encodeURIComponent(place.id)+'&view=player&target=group','a')).d.projection.location.areas.find(x=>x.title==='Overview-Hinterhof');
  check(closed?.worldState==='inaccessible','OVERVIEW players see the section as not accessible');
  check((await world('gm','active',before)).s===409,'OVERVIEW a stale state switch gets a conflict');
  check((await world('gm','active',await nodeRev(area.id))).s===200,'OVERVIEW SL opens the section again');
  // Second-screen preview page: SL only; players get the refusal page, anonymous visitors are sent to the login.
  const page=async who=>{const r=await fetch(base+'/sl/orte-vorschau?ort='+encodeURIComponent(place.id),{headers:who?ids[who]:{},redirect:'manual'});return {s:r.status,html:r.status===200?await r.text():''};};
  const gmPage=await page('gm'),playerPage=await page('a'),anonymous=await page(null);
  check(gmPage.s===200&&!gmPage.html.includes('Nur für die Spielleitung'),'OVERVIEW preview window opens for the SL');
  check(playerPage.s===200&&playerPage.html.includes('Nur für die Spielleitung')&&!playerPage.html.includes('Overview-Hinterhof'),'OVERVIEW preview window refuses players and carries no place content');
  check(anonymous.s>=300&&anonymous.s<400,'OVERVIEW preview window sends anonymous visitors to the login (HTTP '+anonymous.s+')');

  // A seeded section never handled by the CMS shows its original text once discovered; hiding it must really hide it.
  const seeded=await req('/api/cms/locations?place=place.electric-taberna','gm');
  const candidate=seeded.s===200?seeded.d.nodes.find(n=>n.level==='room'&&n.visibility!=='gm'&&n.lifecycle==='active'):null;
  if(candidate){
    const b=await look('place.electric-taberna',candidate.id);
    if(b.state==='base'&&b.action==='revoke'){
      check((await req('/api/cms/releases','gm','POST',{action:'revoke',entityId:candidate.id,scope:'group',expectedReleaseVersion:b.row.version,reason:'In der OrtsÃ¼bersicht verborgen'})).s===200,'OVERVIEW hiding a Grundfassung is accepted');
      check(!(await seenIds('place.electric-taberna')).has(candidate.id)&&(await look('place.electric-taberna',candidate.id)).state!=='base','OVERVIEW a hidden Grundfassung is really gone for players');
    }else check(true,'OVERVIEW seeded room is already CMS-managed in this run ('+b.state+')');
  }
}
