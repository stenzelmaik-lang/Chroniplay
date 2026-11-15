import {randomUUID} from 'node:crypto';

/** Storyboard demo (synthetic, local only): a half-finished second evening of the synthetic
 * "Der Hunger bleibt" fixture. Mixed readiness on purpose: one scene with read-aloud text and notes,
 * one with text only, two rough ideas, plus one idea of the book that is planned for no evening yet.
 * No canon: all texts are labelled as sample text. */
export async function seedStoryboardDemo({base,cookie,fixture}){
 const headers={Origin:base,Cookie:cookie,'Content-Type':'application/json'};
 const call=async(path,body)=>{const r=await fetch(base+path,body?{method:'POST',headers,body:JSON.stringify(body)}:{headers});const text=await r.text();if(!r.ok)throw new Error('Storyboard demo failed: '+path+' '+r.status+' '+text.slice(0,300));return JSON.parse(text);};
 const {scene:first}=await call('/api/command-center/scenes?id='+encodeURIComponent(fixture.kaserne));
 const storyId=first.document.storyId;
 const html=value=>'cvk-html-v1:'+value;
 const scene=async(title,document={})=>(await call('/api/command-center/scenes',{action:'create',clientRequestId:randomUUID(),document:{title,storyId,placeId:'',sessionIds:[],elements:[],narration:'',atmosphere:'',gmNotes:'',dialogueNotes:'',interactions:'',secrets:'',possibleConsequences:'',npcIds:[],clueIds:[],possibilities:[],...document}})).scene.id;

 const drafted=await scene('Beispiel – Rückkehr nach Kleve',{placeId:fixture.place,npcIds:[fixture.npc],
  narration:html('<p>Beispieltext: Der Regen hat aufgehört, aber die Straßen glänzen noch. Über der Schwanenburg hängt ein Mond, der zu groß wirkt für diese Jahreszeit.</p><p>Ihr kennt diese Stadt. Und doch fühlt sich heute jede Ecke an, als hätte jemand die Möbel verrückt, während ihr fort wart.</p><p>Vor dem Eingang wartet ein Umschlag, ohne Absender, mit eurem Namen in einer Handschrift, die ihr nicht zuordnen könnt.</p>'),
  gmNotes:html('<p>Beispielnotiz: Tempo ruhig halten. Der Umschlag ist der Einstieg in den Abend.</p>')});
 const textOnly=await scene('Beispiel – Der Umschlag',{narration:html('<p>Beispieltext: Das Papier ist schwer und riecht nach kaltem Rauch. Darin liegt eine einzige Karte mit einer Uhrzeit.</p>')});
 const ideaA=await scene('Beispiel – Treffen im Hafen',{gmNotes:'Idee: Ein Kontakt bietet Hilfe an, verlangt aber einen Gefallen.'});
 const ideaB=await scene('Beispiel – Offenes Finale');
 await scene('Beispiel – Idee ohne Abend',{gmNotes:'Idee: Noch keinem Spielabend zugeordnet. Liegt in der Ideenablage.'});

 const session=await call('/api/command-center/preparation',{action:'create',clientRequestId:randomUUID(),document:{title:'Der Hunger bleibt – Spielabend 02 (in Vorbereitung)',summary:'Beispielabend für das Storyboard: halbfertig, mit Ideen und Entwürfen.',sceneIds:[drafted,textOnly,ideaA,ideaB],storyIds:storyId?[storyId]:[],status:'draft'}});
 return {storyId,sessionId:session.session?.id,scenes:[drafted,textOnly,ideaA,ideaB]};
}
