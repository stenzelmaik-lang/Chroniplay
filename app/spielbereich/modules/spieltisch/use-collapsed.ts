'use client';
import {useCallback,useState} from 'react';

/** Table HUD parts that each viewer may fold away on this device. */
export type CollapsibleHud='pressure'|'body'|'roster'|'voice';
const prefix='chroniplay:spieltisch:eingeklappt:';

export function readCollapsed(id:CollapsibleHud):boolean{
 try{return window.localStorage.getItem(prefix+id)==='1';}catch{return false;}
}
export function writeCollapsed(id:CollapsibleHud,collapsed:boolean){
 try{if(collapsed)window.localStorage.setItem(prefix+id,'1');else window.localStorage.removeItem(prefix+id);}catch{/* storage unavailable: the choice lasts for this visit only */}
}

/** Folded state of one HUD part, remembered per device. Pure view preference; nothing is sent to the server. */
export function useCollapsed(id:CollapsibleHud):[boolean,(collapsed:boolean)=>void]{
 const [collapsed,setState]=useState(()=>typeof window!=='undefined'&&readCollapsed(id));
 const set=useCallback((next:boolean)=>{setState(next);writeCollapsed(id,next);},[id]);
 return [collapsed,set];
}
