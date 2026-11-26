"use client";

// Orte, Weg B Teil 2: every section of one place (Hauptort, Bereiche, Räume, Erkenntnisse) with what the
// group of players really sees and one action each. Uses only the existing release and discovery routes.
import {useCallback,useEffect,useState} from "react";
import {Eye,RefreshCw} from "lucide-react";
import {toast} from "sonner";
import type {DiscoveryState,PlaceProjection,WorldStateId} from "@/domain/location-types";
import {playerSeenIds,sectionAction,sectionActionText,sectionState,sectionStateText,type SectionAction,type SectionRelease as Release} from "@/domain/location-release-sections";
import {api} from "./api-client";
import {useLocationDialog} from "./location-dialog";
import {DiscoverySteps} from "./location-discovery-steps";
import {DiscoveryIcon,WorldStateIcon,worldStateNames} from "./location-icons";
import {LocationWorldState} from "./location-world-state";
import cmsStyles from "./location-cms.module.css";

type Entry={id:string;title:string;parentId:string|null;level:"location"|"area"|"room"|"information";lifecycle:string;locationId:string;revision:number;visibility?:string};
type Knowledge=Exclude<DiscoveryState,"hidden">;

const levelNames={location:"Hauptort",area:"Bereich",room:"Raum",information:"Erkenntnis"} as const;

export function LocationReleaseOverview({placeId,selectedId,nodes,disabled,onOpen,onFinish,onShowPlayers,onChanged}:{
  placeId:string;selectedId:string;nodes:Entry[];disabled:boolean;
  onOpen:(id:string)=>void;onFinish:(id:string)=>void;onShowPlayers:()=>void;onChanged:()=>Promise<void>;
}){
  const dlg=useLocationDialog();
  const [data,setData]=useState<{rows:Release[];player:PlaceProjection|null;world:Record<string,WorldStateId>}|null>(null);
  const [knowledge,setKnowledge]=useState<Knowledge>("known");
  const [busyId,setBusyId]=useState("");
  const [error,setError]=useState("");
  const items=nodes.filter(node=>node.locationId===placeId&&node.lifecycle==="active");

  const load=useCallback(async()=>{
    setError("");
    try{
      const place=encodeURIComponent(placeId);
      const [sl,player]=await Promise.all([
        api<{projection:PlaceProjection}>("/api/locations?view=sl&target=group&place="+place),
        // nothing visible yet answers 404; that simply means: players see nothing of this place
        api<{projection:PlaceProjection}>("/api/locations?view=player&target=group&place="+place).catch(e=>{if((e as {status?:number}).status===404)return {projection:null};throw e;}),
      ]);
      const place_=sl.projection.location,world:Record<string,WorldStateId>={[place_.id]:place_.worldState};
      for(const area of place_.areas){world[area.viewKey]=area.worldState;for(const room of area.rooms)world[room.viewKey]=room.worldState;}
      setData({rows:place_.slGroupReleases??[],player:player.projection,world});
    }catch(e){setError(e instanceof Error?e.message:"Die Übersicht konnte nicht geladen werden.");}
  },[placeId]);
  useEffect(()=>{const timer=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(timer);},[load]);

  async function act(entry:Entry,row:Release,action:Exclude<SectionAction,"finish"|null>,label:string){
    const name="„"+entry.title+"“";
    const question=action==="revoke"?(label==="Sperre aufheben"?`Die Sperre für ${name} aufheben?`:(row.transition==="none"?`${name} vor den Spielern verbergen? Die Spieler sehen hier bisher die Grundfassung. Wieder zeigen kannst du den Abschnitt danach, indem du ihn fertigstellst und freischaltest.`:`${name} vor den Spielern verbergen? Der Text bleibt erhalten und lässt sich jederzeit wieder freischalten.`))
      :action==="discover"?`${name} für die Spieler sichtbar machen?`
      :`${label==="Freischalten"?name:"Die neue Fassung von "+name} für die Spieler freischalten?`;
    if(!await dlg.ask(question,action==='revoke'?(label==='Sperre aufheben'?'Sperre aufheben':'Verbergen'):action==='discover'?'Sichtbar machen':'Freischalten'))return;
    setBusyId(entry.id);setError("");
    try{
      if(action==="revoke")await api("/api/cms/releases","POST",{action:"revoke",entityId:entry.id,scope:"group",expectedReleaseVersion:row.version,reason:"In der Ortsübersicht verborgen"});
      else if(action==="discover")await api("/api/locations/state","POST",{placeId,entityId:entry.id,mode:"discovery",audience:"group",discoveryState:knowledge,expectedRevision:row.discoveryVersion,reason:"In der Ortsübersicht sichtbar gemacht"});
      else await api("/api/cms/releases","POST",{action:"publish",entityId:entry.id,scope:"group",revisionId:row.approvedRevisionId,expectedReleaseVersion:row.version,discoveryState:knowledge,reason:"In der Ortsübersicht freigeschaltet"});
      toast.success(action==="revoke"?(label==="Sperre aufheben"?"Sperre aufgehoben.":"Vor den Spielern verborgen."):"Für die Spieler freigeschaltet.");
      await load();await onChanged();
    }catch(e){
      setError(e instanceof Error?e.message:"Das hat nicht geklappt.");
      if((e as {status?:number}).status===409)await load();
    }finally{setBusyId("");}
  }

  const seenNow=data?playerSeenIds(data.player,items.map(item=>item.id)):null;
  const view=data&&seenNow?items.map(entry=>{
    const row=data.rows.find(item=>item.entityId===entry.id),seen=seenNow.has(entry.id),state=sectionState(entry,row,seen),action=sectionAction(state,row);
    return {entry,row,seen,state,action,label:sectionActionText(state,action)};
  }):null;
  const shown=view?.filter(item=>item.seen&&item.state!=="sl").length??0,total=view?.filter(item=>item.state!=="sl").length??0;

  return <section className={cmsStyles.releaseOverview} aria-label="Abschnitte für die Spieler">{dlg.dialog}
    <div className={cmsStyles.releaseOverviewHead}>
      <p>{view?`${shown} von ${total} Abschnitten sehen die Spieler.`:"Abschnitte werden geladen …"}</p>
      <div className={cmsStyles.releaseOverviewTools}>
        <DiscoverySteps label="Wissen beim Freischalten" value={knowledge} disabled={disabled} onChange={next=>{if(next!=="hidden")setKnowledge(next);}}/>
        <button type="button" className="button" disabled={disabled} onClick={onShowPlayers}><Eye size={16}/> Spieleransicht öffnen</button>
        <button type="button" className="button" aria-label="Übersicht neu laden" title="Neu laden" disabled={disabled||!!busyId} onClick={()=>void load()}><RefreshCw size={16}/></button>
      </div>
    </div>
    {(()=>{const entry=items.find(item=>item.id===selectedId);return entry&&data?<LocationWorldState placeId={placeId} entry={entry} current={data.world[entry.id]??"active"} disabled={disabled||!!busyId} onChanged={async()=>{await load();await onChanged();}}/>:null;})()}
    {view&&<ul className={cmsStyles.sectionList}>
      {view.map(({entry,row,seen,state,action,label})=><li key={entry.id} className={cmsStyles.sectionRow} data-level={entry.level} data-state={state}>
        <i className={cmsStyles.reachDot} data-reach={state==="sl"?"sl":seen?"table":"draft"} aria-hidden="true"/>
        <button type="button" className={cmsStyles.sectionName} onClick={()=>onOpen(entry.id)} title="Zum Bearbeiten öffnen">
          <strong>{entry.title}</strong><small className={cmsStyles.sectionMeta}><DiscoveryIcon state={state==="sl"?"hidden":seen?(row?.discoveryState==="hidden"?"known":row?.discoveryState??"known"):"hidden"} size={13}/>{levelNames[entry.level]} · {sectionStateText[state]}{data?.world[entry.id]&&data.world[entry.id]!=="active"&&<span className={cmsStyles.stateChip}><WorldStateIcon state={data.world[entry.id]} size={12}/>{worldStateNames[data.world[entry.id]]}</span>}</small>
        </button>
        {action==="finish"?<button type="button" className="button" disabled={disabled} onClick={()=>onFinish(entry.id)}>{label}</button>
          :action&&row?<button type="button" className={"button"+(action==="revoke"?"":" primary")} disabled={disabled||!!busyId} onClick={()=>void act(entry,row,action,label)}>{busyId===entry.id?"…":label}</button>:null}
      </li>)}
    </ul>}
    {error&&<p role="alert" className="error-box">{error}</p>}
  </section>;
}
