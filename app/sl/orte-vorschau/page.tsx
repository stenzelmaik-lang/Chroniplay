import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {actor} from '@/server/access';
import {currentUserFromContext} from '@/server/platform-auth';
import {LocationPreviewWindow} from '@/app/spielbereich/modules/location-preview-window';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Orte-Vorschau · ChroniPlay',robots:{index:false,follow:false}};
const safe=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,160}$/.test(value)?value:'';
/** Second-screen preview of the Orte workshop. SL only; the content itself comes from the authorized routes. */
export default async function Page({searchParams}:{searchParams:Promise<{ort?:string;eintrag?:string}>}){
 if(!await currentUserFromContext())redirect('/anmelden');
 const a=await actor(false).catch(()=>null);
 if(!a||a.status!=='active'||!a.gm)return <main className="shell"><h1>Nur für die Spielleitung</h1><p>Die Orte-Vorschau steht ausschließlich der Spielleitung zur Verfügung.</p><a href="/spielbereich">Zum Spielbereich</a></main>;
 const q=await searchParams;
 return <LocationPreviewWindow a={a} placeHint={safe(q.ort)} entityHint={safe(q.eintrag)}/>;
}
