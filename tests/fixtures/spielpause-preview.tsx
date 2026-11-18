import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Spielpause} from '../../app/spielbereich/modules/spieltisch/spielpause/spielpause';
import frame from '../../app/spielbereich/modules/spieltisch/stage.module.css';
import {createDollRenderer} from '../../app/spielbereich/modules/spieltisch/spielpause/doll-3d.js';

function Preview() {
  const [open,setOpen]=useState(true),[reduced,setReduced]=useState(false);
  return <div data-chroniplay-stage className={reduced?'user-reduced-motion':''}>
    <div className={frame.app}>
      <header className={frame.topbar}><div className={frame.brand}>ChroniPlay <span>SPIELTISCH · LOKALE VORSCHAU</span></div>
        <label style={{fontSize:12}}><input type="checkbox" checked={reduced} onChange={e=>setReduced(e.target.checked)}/> Bewegung reduzieren</label>
      </header>
      <nav className={frame.rail} aria-label="Spieltisch-Werkzeuge"><button className={frame.iconButton} aria-label="Spielpause" aria-pressed={open} onClick={()=>setOpen(!open)}><span aria-hidden="true">☕</span><span>Spielpause</span></button></nav>
      <main className={frame.stage} aria-label="Dynamische Spielbühne">
        <div className={frame.background}/>
        <div className={frame.stageStatus}>Persönliche Tischfläche</div>
        <Spielpause open={open} onMenuClose={()=>setOpen(false)} personalKey="standalone-component-preview" blocked={false}/>
      </main>
    </div>
  </div>;
}
if(new URLSearchParams(location.search).has('modellpruefung')){
  const host=document.getElementById('root')!;host.style.cssText='display:grid;grid-template-columns:repeat(2,420px);justify-content:center;background:#152127;color:#eee8dc;padding:20px;gap:20px';
  const image=new Image(),renderers:ReturnType<typeof createDollRenderer>[]=[];
  image.onload=()=>{
    for(const [title,progress,inspectYaw] of [['Vorderseite',1,0],['Seite · Körpervolumen',1,Math.PI/2],['Rücken · Mantel und Naht',1,Math.PI],['Rückenlage · Kontakt zum Tisch',.5,Math.PI/4]] as const){
      const figure=document.createElement('figure'),caption=document.createElement('figcaption'),canvas=document.createElement('canvas');
      figure.style.margin='0';caption.textContent=title;canvas.width=420;canvas.height=370;figure.appendChild(caption);figure.appendChild(canvas);host.appendChild(figure);
      const renderer=createDollRenderer();renderers.push(renderer);renderer.setImage(image);renderer.draw(canvas.getContext('2d')!,{progress,inspectYaw});
    }
  };
  image.src='/spielpause/graf-knautsch.webp';
  window.addEventListener('pagehide',()=>renderers.forEach(renderer=>renderer.dispose()),{once:true});
}else createRoot(document.getElementById('root')!).render(<Preview/>);
