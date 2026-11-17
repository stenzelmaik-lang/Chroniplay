import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Spielpause} from '../../app/spielbereich/modules/spieltisch/spielpause/spielpause';
import frame from '../../app/spielbereich/modules/spieltisch/stage.module.css';

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
createRoot(document.getElementById('root')!).render(<Preview/>);
