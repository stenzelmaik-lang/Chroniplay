# Szene 2.0 · Etappe 1 – Werkstatt-Rahmen (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c`
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md` (Werkstatt-Modell, Ausgabe am Spieltisch, Etappen 1–7)

## Was sich ändert

Die Szenenseite ist keine Reiterleiste mit 8 Reitern mehr, sondern eine **Werkstatt mit Bereichsliste** (13 Bereiche in Gruppen, mit Füllstand). Jeder Bereich sagt oben in einer Zeile, was davon am Spieltisch passiert („Am Spieltisch: …“).

Neu im Szenendokument (alle optional, strikt geprüft):

| Feld | Inhalt |
|---|---|
| `context` | Überblick: Lage, Zweck, Voraussetzungen, Einstiege (Liste), Ton, Ende offen/fest |
| `passages[]` | Erzählabschnitte: Titel, Vorlesetext (Rich Text), **SL-Regie** (nur für die SL), Stimmungswechsel |
| `moods[]` | Stimmungen: Name, Bühnenbild, Musik, Effekte, genau eine Grundstimmung |

Die Erzählung wird **nur vorgelesen, nie ausgespielt**. Am Abschnitt hängt höchstens der Hinweis „Stimmung wechselt zu …“.

## Verträglichkeit (alte Regie läuft weiter)

- **Spiegel:** Die neuen Felder sind die Quelle. Daraus leitet der Server bei jedem Speichern `narration` (alle Vorlesetexte, **ohne** SL-Regie), `backdropFileId` und `youtube` (aus der Grundstimmung) ab. Alte Regie, klassische Ansicht und ältere Builds lesen weiter die alten Felder.
- **Bearbeitung über alte Felder gewinnt:** Ändert ein älterer Weg `narration`, fallen die Abschnitte zu einem zusammen; alle SL-Regie-Texte bleiben erhalten. Neues Bild oder neue Musik geht in die Grundstimmung.
- **Umwandlung erst beim Bearbeiten:** Alte Szenen werden beim Öffnen in der Oberfläche umgewandelt (Erzählung → Abschnitt 1, Bild/Musik → Grundstimmung). Gespeichert wird erst, wenn die SL etwas ändert. Im Browser bestätigt: alte Szene blieb Version 1.
- **Server prüft:** Ein Abschnitt darf nur auf eine Stimmung derselben Szene zeigen (sonst 400). Bilder in Stimmungen und Medien in Abschnitten laufen durch die bestehende Medienprüfung.
- **Rollback:** `scripts/storyboard2-rollback-board.mjs` nimmt jetzt auch `context`/`passages`/`moods` heraus und legt sie als Text in die SL-Notizen (`sceneWithoutWorkshop`), damit ein strikter älterer Build nicht mit 409 abbricht.

## Dateien

- `domain/story-scene.ts`: Schemata `context`, `passages`, `moods`, Grenzen `sceneWorkshopLimits`
- `domain/scene-workshop.ts` (neu): Spiegel, Umwandlung, Rollback-Helfer, Bereichsliste `workshopAreas`
- `server/story-scenes.ts`: Spiegel vor der Prüfung, Prüfung der Stimmungsbezüge und Medien
- `app/spielbereich/modules/storyboard-workshop.tsx` (neu): Bereichsliste, Überblick, Erzählabschnitte, Stimmungen
- `app/spielbereich/modules/storyboard.tsx`: neue Szenenseite; alte Reiterleiste entfernt
- `app/spielbereich/modules/storyboard.module.css`: Block „Szene 2.0 · Etappe 1“
- `scripts/storyboard2-rollback-board.mjs`: erweitert
- `tests/scene-workshop.test.mjs` (neu, 7 Tests, in `npm test` eingetragen), `tests/plot-threads-integration.mjs` (WORKSHOP-Prüfungen)

## Prüfungen (beobachtet)

- `npm test`, `npm run typecheck`, `npm run lint`: grün (vor dem letzten CSS-Fix gelaufen; der Fix ändert nur eine CSS-Zeile `.wsNav h4`).
- Volle Integration (`npm run test:integration:run`, isolierte lokale D1): **2425 integration checks passed**, darunter 8 WORKSHOP-Prüfungen (Spiegel ohne SL-Regie, Musik aus Grundstimmung, fremde Stimmung → 400, klassische Bearbeitung behält SL-Regie, Spieler 401/403). Die SQLITE-Fehler im Protokoll sind absichtlich eingespeiste Fehlerfälle.
- Browser (lokale Demo, Port 8866): Szene 05 „Der Junge im Keller“ mit 4 Abschnitten, 3 Stimmungen und echten Bildern aus der Szenenakte geladen (nur lokal). SL-Regie bearbeitet → Version +1, Erzählspiegel ohne Regie, Bühnenbild-Spiegel = Bild der Grundstimmung. Bei 375 px kein waagerechtes Scrollen. Keine Konsolenfehler.

## Prüfgrenzen

- Kein echtes Mobilgerät, nur Emulation.
- Die alte Regie wurde nicht erneut von Hand mit einer neuen Szene durchgespielt; abgesichert über die Spiegel-Tests.
- Bereiche Orte, Beteiligte, Material, Proben, Erkenntnisse, Interaktionen, Ereignisse zeigen in Etappe 1 die bisherigen Werkzeuge mit Hinweis auf die spätere Etappe.

## Offen (je eigene Freigabe)

Etappe 2 Beteiligte und mehrere Orte · Etappe 3 Materialbibliothek · Etappe 4 Erkenntnisse, Interaktionen, Ereignisse · Etappe 5 Regelprofil und Proben · Etappe 6 SL-Notizbuch · Etappe 7 Test · danach neue Regie und Ablösung der Altsysteme.
