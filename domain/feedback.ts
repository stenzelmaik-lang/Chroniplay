/** In-app reports (2.5, issue #5). Pure rules: kinds, areas, statuses, limits and the coarse browser class.
 * Nothing here reads forms, secrets or other players' data; reporters type what they want to share. */
import {z} from 'zod';

export const FEEDBACK_KINDS=['fehler','idee','allgemein'] as const;
export type FeedbackKind=typeof FEEDBACK_KINDS[number];
export const kindLabels:Record<FeedbackKind,string>={fehler:'Fehler',idee:'Verbesserungsidee',allgemein:'Allgemeines Feedback'};

/** Where it happened. The first five are the alpha-critical areas from the issue; they are marked for the operator. */
export const FEEDBACK_AREAS=['anmeldung','verlust','freigabe','karte','veroeffentlichung','spieltisch','charakter','vorbereitung','discord','sonstiges'] as const;
export type FeedbackArea=typeof FEEDBACK_AREAS[number];
export const areaLabels:Record<FeedbackArea,string>={
 anmeldung:'Anmeldung oder Registrierung',
 verlust:'Charakter oder Inventar verloren',
 freigabe:'Falsche Freigabe oder Geheimnis sichtbar',
 karte:'Karte oder Orte',
 veroeffentlichung:'Veröffentlichen als SL',
 spieltisch:'Spieltisch',
 charakter:'Charakterbogen',
 vorbereitung:'Vorbereitung und Command Center',
 discord:'Discord oder Syntax',
 sonstiges:'Sonstiges',
};
export const CRITICAL_AREAS:readonly FeedbackArea[]=['anmeldung','verlust','freigabe','karte','veroeffentlichung'];
export const isCritical=(area:string)=>(CRITICAL_AREAS as readonly string[]).includes(area);

export const FEEDBACK_STATUSES=['eingegangen','in_pruefung','erledigt','abgelehnt'] as const;
export type FeedbackStatus=typeof FEEDBACK_STATUSES[number];
export const statusLabels:Record<FeedbackStatus,string>={eingegangen:'Eingegangen',in_pruefung:'In Prüfung',erledigt:'Behoben oder erledigt',abgelehnt:'Nicht umgesetzt'};
export const FEEDBACK_SEVERITIES=['niedrig','mittel','hoch','kritisch'] as const;

/** At most this many reports per person and hour (spam guard). */
export const FEEDBACK_PER_HOUR=5;

const text=(max:number)=>z.string().trim().max(max);
export const feedbackCreateSchema=z.object({
 kind:z.enum(FEEDBACK_KINDS),
 area:z.enum(FEEDBACK_AREAS),
 title:z.string().trim().min(3,'Bitte einen kurzen Titel angeben.').max(120),
 description:z.string().trim().min(10,'Bitte beschreibe kurz, worum es geht.').max(4000),
 steps:text(4000).default(''),
 expected:text(2000).default(''),
 actual:text(2000).default(''),
 /** Only the path of the page the person names, never query strings (they can carry ids or tokens). */
 page:text(200).default(''),
 /** The person confirmed that version, page and browser class may be attached. */
 consentContext:z.boolean().default(false),
}).strict();
export type FeedbackCreate=z.infer<typeof feedbackCreateSchema>;

export const feedbackUpdateSchema=z.object({
 id:z.string().uuid(),
 version:z.number().int().min(1),
 status:z.enum(FEEDBACK_STATUSES).optional(),
 severity:z.enum(FEEDBACK_SEVERITIES).nullable().optional(),
 operatorNote:text(4000).optional(),
 reply:text(2000).optional(),
}).strict();

/** Keeps only a same-site path: "/spielbereich?x=1#y" → "/spielbereich"; anything else → "". */
export function cleanPage(page:string){
 const p=page.trim();
 if(!p.startsWith('/')||p.startsWith('//'))return '';
 return p.split(/[?#]/)[0].replace(/[^\w\-/.äöüÄÖÜß]/g,'').slice(0,200);
}

/** Coarse browser class from the user agent: device and engine only, no version or fingerprint. */
export function browserClass(ua:string|null|undefined){
 const s=ua||'';
 const device=/Mobi|Android|iPhone|iPad/i.test(s)?'Mobil':'Desktop';
 const engine=/Edg\//.test(s)?'Edge':/Firefox\//.test(s)?'Firefox':/Chrome\//.test(s)?'Chrome':/Safari\//.test(s)?'Safari':'anderer Browser';
 return device+' · '+engine;
}
