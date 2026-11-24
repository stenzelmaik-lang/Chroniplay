/** In-app reports (2.5, issue #5). Reporters see only their own reports; the campaign's GM/owner sees and handles all.
 * Never pushed to GitHub or Discord automatically. A failure here must not affect play: callers only use these routes. */
import {database,gmOnly,HttpError,type Actor} from './access';
import pkg from '@/package.json';
import {feedbackCreateSchema,feedbackUpdateSchema,cleanPage,browserClass,FEEDBACK_PER_HOUR} from '@/domain/feedback';

type Row={id:string;kind:string;area:string;title:string;description:string;steps:string;expected:string;actual:string;page:string;app_version:string;browser:string;status:string;severity:string|null;operator_note:string;reply:string;created_at:string;updated_at:string;version:number;reporter_id:string;reporter_name?:string};

/** What a reporter sees of their own report: no internal operator note, no severity. */
const ownView=(r:Row)=>({id:r.id,kind:r.kind,area:r.area,title:r.title,description:r.description,steps:r.steps,expected:r.expected,actual:r.actual,status:r.status,reply:r.reply,createdAt:r.created_at,updatedAt:r.updated_at});
const operatorView=(r:Row)=>({...ownView(r),page:r.page,appVersion:r.app_version,browser:r.browser,severity:r.severity,operatorNote:r.operator_note,version:r.version,reporter:{id:r.reporter_id,name:r.reporter_name||'Unbekannt'}});

export const isFeedbackOperator=(a:Actor)=>{try{gmOnly(a);return true;}catch{return false;}};

export async function createFeedback(a:Actor,raw:unknown,userAgent:string|null){
 if(a.status!=='active')throw new HttpError(403,'Melden können freigegebene Mitglieder.');
 const parsed=feedbackCreateSchema.safeParse(raw);
 if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
 const d=parsed.data,db=database(),now=new Date();
 const recent=await db.prepare('SELECT count(*) n FROM feedback_reports WHERE campaign_id=? AND reporter_id=? AND created_at>?').bind(a.campaignId,a.id,new Date(now.getTime()-3600_000).toISOString()).first<{n:number}>();
 if((recent?.n||0)>=FEEDBACK_PER_HOUR)throw new HttpError(429,'Du hast in der letzten Stunde schon mehrere Meldungen geschickt. Bitte später erneut versuchen.');
 const id=crypto.randomUUID(),stamp=now.toISOString();
 const context=d.consentContext?{page:cleanPage(d.page),browser:browserClass(userAgent)}:{page:'',browser:''};
 await db.prepare('INSERT INTO feedback_reports(id,campaign_id,reporter_id,kind,area,title,description,steps,expected,actual,page,app_version,browser,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,\'eingegangen\',?,?)')
  .bind(id,a.campaignId,a.id,d.kind,d.area,d.title,d.description,d.kind==='fehler'?d.steps:'',d.kind==='fehler'?d.expected:'',d.kind==='fehler'?d.actual:'',context.page,(pkg as {version:string}).version,context.browser,stamp,stamp).run();
 return {ok:true,id};
}

export async function ownFeedback(a:Actor){
 const r=await database().prepare('SELECT * FROM feedback_reports WHERE campaign_id=? AND reporter_id=? ORDER BY created_at DESC LIMIT 50').bind(a.campaignId,a.id).all<Row>();
 return {operator:isFeedbackOperator(a),reports:r.results.map(ownView)};
}

export async function allFeedback(a:Actor){
 gmOnly(a);
 const r=await database().prepare("SELECT f.*,COALESCE(m.name,'') AS reporter_name FROM feedback_reports f LEFT JOIN members m ON m.id=f.reporter_id WHERE f.campaign_id=? ORDER BY CASE f.status WHEN 'eingegangen' THEN 0 WHEN 'in_pruefung' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 200").bind(a.campaignId).all<Row>();
 return {reports:r.results.map(operatorView)};
}

export async function updateFeedback(a:Actor,raw:unknown){
 gmOnly(a);
 const parsed=feedbackUpdateSchema.safeParse(raw);
 if(!parsed.success)throw new HttpError(400,parsed.error.issues[0].message);
 const d=parsed.data,sets:string[]=[],binds:unknown[]=[];
 if(d.status!==undefined){sets.push('status=?');binds.push(d.status);}
 if(d.severity!==undefined){sets.push('severity=?');binds.push(d.severity);}
 if(d.operatorNote!==undefined){sets.push('operator_note=?');binds.push(d.operatorNote);}
 if(d.reply!==undefined){sets.push('reply=?');binds.push(d.reply);}
 if(!sets.length)throw new HttpError(400,'Keine Änderung angegeben.');
 const r=await database().prepare(`UPDATE feedback_reports SET ${sets.join(',')},version=version+1,updated_at=? WHERE id=? AND campaign_id=? AND version=?`).bind(...binds,new Date().toISOString(),d.id,a.campaignId,d.version).run();
 if(!r.meta.changes)throw new HttpError(409,'Die Meldung wurde inzwischen geändert oder ist nicht vorhanden. Bitte neu laden.');
 return {ok:true};
}
