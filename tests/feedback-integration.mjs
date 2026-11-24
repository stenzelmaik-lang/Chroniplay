/** 2.5 / issue #5: in-app reports against the isolated local instance. */
export async function feedbackIntegration({req,check}){
 const report=(over={})=>({kind:'fehler',area:'freigabe',title:'SYNTHETIC Geheimnis sichtbar',description:'SYNTHETIC: Spieler sah eine SL-Notiz.',steps:'1. öffnen',expected:'nichts',actual:'Notiz',page:'/spielbereich?character=geheim',consentContext:true,...over});
 check((await req('/api/feedback',undefined,'POST',report())).s===401,'FEEDBACK anonymous report refused');
 check((await req('/api/feedback')).s===401,'FEEDBACK anonymous list refused');
 for(const role of ['blockedPlayer','otherCampaign'])check([403,404].includes((await req('/api/feedback',role,'POST',report())).s),'FEEDBACK '+role+' cannot report into this campaign');
 const created=await req('/api/feedback','a','POST',report(),{'User-Agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36'});
 check(created.s===201&&created.d.id,'FEEDBACK player report stored');
 check((await req('/api/feedback','a','POST',report({reporterId:'sprint1-b'}))).s===400,'FEEDBACK reporter cannot be chosen in the body');
 check((await req('/api/feedback','a','POST',report(),{Origin:'https://evil.invalid'})).s===403,'FEEDBACK cross-site report refused');
 const mine=await req('/api/feedback','a');
 const own=mine.d.reports.find(r=>r.id===created.d.id);
 check(mine.s===200&&own&&own.status==='eingegangen'&&mine.d.operator===false,'FEEDBACK reporter sees own report with status');
 check(!('operatorNote' in own)&&!('severity' in own)&&!('page' in own),'FEEDBACK reporter view has no internal fields');
 check(!(await req('/api/feedback','b')).d.reports.some(r=>r.id===created.d.id),'FEEDBACK another player never sees the report');
 check((await req('/api/feedback?alle=1','a')).s===403,'FEEDBACK players cannot open the inbox');
 const inbox=await req('/api/feedback?alle=1','gm');
 const item=inbox.d.reports.find(r=>r.id===created.d.id);
 check(inbox.s===200&&item&&item.page==='/spielbereich'&&item.browser==='Desktop · Chrome'&&item.reporter.id==='sprint1-a','FEEDBACK operator inbox with cleaned page and coarse browser');
 check(/^\d+\.\d+\.\d+$/.test(item.appVersion),'FEEDBACK app version attached');
 const upd=await req('/api/feedback','gm','PATCH',{id:item.id,version:item.version,status:'in_pruefung',severity:'kritisch',operatorNote:'SYNTHETIC intern',reply:'SYNTHETIC Danke, wir prüfen.'});
 check(upd.s===200,'FEEDBACK operator updates status, severity, note and reply');
 check((await req('/api/feedback','gm','PATCH',{id:item.id,version:item.version,status:'erledigt'})).s===409,'FEEDBACK stale version refused');
 check((await req('/api/feedback','a','PATCH',{id:item.id,version:item.version+1,status:'erledigt'})).s===403,'FEEDBACK players cannot change reports');
 const after=(await req('/api/feedback','a')).d.reports.find(r=>r.id===created.d.id);
 check(after.status==='in_pruefung'&&after.reply==='SYNTHETIC Danke, wir prüfen.'&&!JSON.stringify(after).includes('SYNTHETIC intern'),'FEEDBACK reporter sees status and reply, never the internal note');
 const noConsent=await req('/api/feedback','b','POST',report({consentContext:false,kind:'idee'}));
 const plain=(await req('/api/feedback?alle=1','gm')).d.reports.find(r=>r.id===noConsent.d.id);
 check(plain.page===''&&plain.browser===''&&plain.steps==='','FEEDBACK without consent no context; steps only for bugs');
 let last=0;for(let i=0;i<6;i++)last=(await req('/api/feedback','b','POST',report({title:'SYNTHETIC Spam '+i}))).s;
 check(last===429,'FEEDBACK rate limit per person and hour');
}
