# Szene 2.0 · Etappe 2 – Beteiligte und Schauplätze (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c` (zusammen mit Phase 1–4 und Etappe 1, alles uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md`, Abschnitte 7.4, 7.5, 10 und 12

## Was sich ändert

**Beteiligte:** Ein NSC aus der Welt wird nur verwiesen, nie kopiert (kein zweites NSC-System). Je Szene kommen dazu:
- Anwesenheit: von Beginn an, kommt später, vielleicht
- Rolle (nur SL): warum da, will, weiß, verschweigt, reagiert auf, greift ein wenn, verlässt die Szene wenn
- Dialoghilfen (nur SL)
- **Zusatz für die Spieler-Karte in dieser Szene** – getrennt von der Wiki-Karte. Wird noch nirgends an Spieler ausgeliefert; das macht später die neue Regie.

Namenlose Figuren (Standardfiguren) und die allgemeinen Dialognotizen bleiben im selben Bereich, unverändert.

**Schauplätze:** keiner, einer oder mehrere Knoten des Ortsbaums (Ort, Bereich, Raum), je mit
- Hauptschauplatz (höchstens einer)
- „In dieser Szene freischaltbar“ (nur die Vorbereitung; das Freischalten selbst passiert später am Tisch über die Karte)
- Szenennotiz „Was ist hier anders“ (nur SL)
- Schalter „Der Schauplatz entsteht erst im Spiel“

Ortsdaten, NSC-Akten, Gefallen & Schulden und Inventar bleiben unberührt.

## Verträglichkeit

- **Spiegel:** `npcIds` = alle Beteiligten, `placeId` = Hauptschauplatz. Alte Regie, Szenenkarten und Veröffentlichung lesen weiter die alten Felder.
- **Bearbeitung über alte Felder gewinnt** (klassische Ansicht): neue NSC-Auswahl → Beteiligte folgen, Rollen der verbliebenen NSCs bleiben; neuer zentraler Ort → wird Hauptschauplatz, alle anderen Schauplätze und Notizen bleiben; Ort geleert → kein Hauptschauplatz, Schauplätze bleiben.
- **Umwandlung erst beim Bearbeiten:** gewählte NSCs → Beteiligte ohne Rolle, zentraler Ort → Hauptschauplatz. Für die alte Regie ändert sich dadurch nichts.
- **Klassische Bausteine** (Personenverweis auf einen NSC, Dialog, Ortsverweis) werden **nicht automatisch** umgezogen. Der Bereich bietet „Übernehmen“ an; der Text wandert in Rolle, Dialoghilfe oder Ortsnotiz, Formatierung wird einfacher Text. Bausteine mit Datei, Material, Pager oder Probe bleiben klassisch.
- **Server prüft:** Beteiligte müssen NSC-Akten sein (400), Schauplätze Orte (400), unbekannte Akten 404; ein NSC und ein Ort je Szene nur einmal.
- **Rollback:** `sceneWithoutWorkshop` nimmt jetzt auch `cast`, `places`, `placesOpen` heraus und legt Rollen, Kartenzusätze und Ortsnotizen als Text in die SL-Notizen.

## Nebenbei behoben (seit Etappe 1)

Die Oberfläche hielt die Spiegelfelder bis zur Server-Antwort alt. Tippte die SL während eines Speicherns weiter, konnte der nächste Speichervorgang als „Bearbeitung über die klassische Ansicht“ gelesen werden; dann wären die Erzählabschnitte zu einem zusammengefallen. Jetzt rechnet die Oberfläche die Spiegel bei jeder Änderung sofort mit (`change()` in `storyboard.tsx`).

## Dateien

- `domain/story-scene.ts`: `sceneCastSchema`, `scenePlaceSchema`, `sceneCastLimits`, Felder `cast`, `places`, `placesOpen`
- `domain/scene-workshop.ts`: Spiegel, Umwandlung, Übernahme-Helfer (`takeoverElements`, `takeOverPerson`, `takeOverDialogue`, `takeOverPlace`), Rollback, Füllstand
- `server/story-scenes.ts`: Prüfung der Schauplätze
- `app/spielbereich/modules/storyboard-workshop.tsx`: `CastEditor`, `PlacesEditor`
- `app/spielbereich/modules/storyboard.tsx`: Bereiche verdrahtet, Spiegel im Browser
- `app/spielbereich/modules/storyboard.module.css`: Block „Etappe 2“
- `tests/scene-workshop.test.mjs` (+5 Tests), `tests/plot-threads-integration.mjs` (+10 CAST-Prüfungen)

## Prüfungen (beobachtet)

- `npm test`: 742 bestanden, 0 fehlgeschlagen. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration (`npm run test:integration:run`, isolierte lokale D1): **2435 integration checks passed**, darunter alle CAST- und WORKSHOP-Prüfungen (Spieler 401/403, Rollen/Kartenzusatz/Ortsnotiz nie in Spieler-Szenen).
- Browser (lokale Demo 8866, Szene 05): NSC zugeordnet, Rolle „Greift ein, wenn …“ eingetragen → gespeichert, `npcIds` gespiegelt; Hauptschauplatz Electric Taberna mit `placeId` gespiegelt; Ortsauswahl zeigt den Ortsbaum mit Pfad. Bei 375 px kein waagerechtes Scrollen.

## Prüfgrenzen

- Kein echtes Mobilgerät. Volles `npm run lint` nicht gelaufen, nur die geänderten Dateien.
- Übernahme-Knöpfe nur per Unit-Test geprüft, nicht im Browser geklickt (Szene 05 hat keine klassischen Personen-/Ortsbausteine).
- Kartenzusatz und Freischaltung wirken erst mit der neuen Regie.

## Offen (je eigene Freigabe)

Etappe 3 Materialbibliothek · Etappe 4 Erkenntnisse, Interaktionen, Ereignisse · Etappe 5 Regelprofil und Proben · Etappe 6 SL-Notizbuch · Etappe 7 Test · Design-Prototyp der Werkstatt (vom Besitzer gewünscht, nach Etappe 2 angeboten) · neue Regie · Ablösung der Altsysteme.
