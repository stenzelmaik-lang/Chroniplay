"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ToyTable } from "../spielbereich/modules/spieltisch/spielpause/spielpause";
import { SPIELE } from "./katalog.js";
import { clearResults, localResultService, readResults } from "./local-results.js";
import styles from "./spielbox.module.css";

/** One stable object: the toy table remounts whenever `services` changes. */
const rubikResults = localResultService("rubik");

/* How many results this browser holds. Read on every render, re-read when another tab or the delete button changes them. */
const nachAenderung = new Set<() => void>();
function beobachten(melden: () => void) {
  nachAenderung.add(melden); window.addEventListener("storage", melden);
  return () => { nachAenderung.delete(melden); window.removeEventListener("storage", melden); };
}
const anzahl = () => readResults("rubik").length;

export function Spielbox() {
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [tastatur, setTastatur] = useState(false);
  const gespeichert = useSyncExternalStore(beobachten, anzahl, () => 0);
  const buehne = useRef<HTMLDivElement>(null);

  useEffect(() => { if (aktiv) buehne.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [aktiv]);

  const schliessen = () => { setAktiv(null); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-spiel="rubik"]')?.focus()); };
  const loeschen = () => { clearResults("rubik"); nachAenderung.forEach(melden => melden()); };

  return <div className={styles.box}>
    <ul className={styles.grid} aria-label="Spiele">
      {SPIELE.map(spiel => {
        const bereit = spiel.stand === "spielbar";
        return <li key={spiel.id} className={styles.card} data-stand={spiel.stand}>
          <span className={styles.badge}>{bereit ? "Spielbar" : spiel.stand === "als Nächstes" ? "Kommt als Nächstes" : "Geplant"}</span>
          <h2>{spiel.name}</h2>
          <p>{spiel.text}</p>
          {bereit
            ? <button data-spiel={spiel.id} className={styles.play} aria-pressed={aktiv === spiel.id} onClick={e => { setTastatur(e.detail === 0); setAktiv(spiel.id); }}>{aktiv === spiel.id ? "Läuft" : "Spielen"}</button>
            : <button className={styles.play} disabled>Bald</button>}
        </li>;
      })}
    </ul>

    {aktiv === "rubik" && <div ref={buehne} className={styles.stage} aria-label="Spielfläche Rubikwürfel" role="region">
      <ToyTable toy="cube" keyboardFocus={tastatur} personalKey="spielbox" blocked={false} onClose={schliessen} services={rubikResults} />
    </div>}

    <aside className={styles.local} aria-label="Gespeicherte Ergebnisse">
      <p><strong>Nur in diesem Browser:</strong> Bestzeiten und Einstellungen liegen im Speicher deines Browsers (localStorage). Sie werden nicht an ChroniPlay geschickt und sind auf anderen Geräten nicht zu sehen.</p>
      {!aktiv && gespeichert > 0 && <button className={styles.clear} onClick={loeschen}>Gespeicherte Würfel-Ergebnisse löschen ({gespeichert})</button>}
    </aside>
  </div>;
}
