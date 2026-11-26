# Szene 2.0 · Etappe 4 – Erkenntnisse, Interaktionen, Ereignisse (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c` (zusammen mit Phase 1–4 und Etappe 1–3, alles uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md`, Abschnitte 7.7, 7.9, 7.11 und 12

## Was sich ändert

**Erkenntnisse** (`insights`): Titel, Inhalt (Rich Text), Verfügbarkeit *von Anfang an bekannt* / *entdeckbar* / *nur SL*, Fundweg (bzw. „wann du es preisgibst“), optional eine Hinweis- oder Handout-Akte der Welt. Entdeckt wird weiterhin nur am Tisch über `knowledge` (eine Quelle der Wahrheit).

**Interaktionskarten** (`interactionCards`): „Wenn die Spieler … → dann …“, ohne Reihenfolge, verknüpfbar mit Material-Verwendungen, Erkenntnissen, Proben und Ereignissen **derselben Szene**. Wird ein Teil gelöscht, verschwindet die Verknüpfung automatisch.

**Ereignisse** (`events`): Titel, Auslöser, Wirkung, Folgen, Dauer (nur diese Szene / den Abend / über mehrere Abende), optionaler Timer in Minuten (Spieler sehen ihn ja/nein), „nur durch dich auslösen“.

**Ereignis-Log** (Spielverlauf, nicht Vorbereitung): neue Momentart `event` mit `eventId` und Zustand *ausgelöst / verschoben / übersprungen / verworfen*. Nur Ereignisse, die in der Szene vorbereitet sind, und nur zu einem echten Szenenlauf des Abends. Die Abendübersicht im Storyboard und die Abendfolge der Regie zeigen die Einträge. Ein Knopf zum Festhalten kommt mit der neuen Regie.

Die alten Freitexte „Interaktion“, „Geheimnisse“, „Folgen“ bleiben als freie Notizen im jeweiligen Bereich.

## Verträglichkeit (alte Regie läuft weiter)

- **Keine gespeicherten Spiegel.** Die alte Regie zeigt in ihren Reitern „Interaktion“, „Geheimnisse“ und „Folgen“ den alten Freitext **plus** die neuen Karten (zusammengesetzt beim Lesen in `server/live-stage.ts` über `regieTexts`). Nichts wird doppelt gespeichert, nichts muss zurückgerechnet werden.
- **Bewusst kein Spiegel in `clueIds`:** Eine Veröffentlichung gibt die Hinweis-Akten aus `clueIds` an Spieler. Würden Erkenntnisse dort gespiegelt, könnte eine „nur SL“-Erkenntnis bei Spielern landen. Die Integration prüft das ausdrücklich.
- **Server prüft:** Kartenverweise nur innerhalb der Szene (400), Erkenntnis nur auf Hinweis-/Handout-Akten (400), Medien im Erkenntnistext wie bei anderen Texten, Spieler sehen nichts davon.
- **Rollback:** `sceneWithoutPossibilities` (im Rollback-Skript eingebunden) schreibt Karten, Erkenntnisse und Ereignisse in die alten Freitexte – so, wie die Regie sie zeigt – und entfernt die neuen Felder; was das Textlimit sprengt, geht gekürzt in die SL-Notizen. Die Export-Abfrage im Skriptkopf deckt jetzt alle neuen Felder ab (Etappe 1–4). Ereignis-Momente (`kind: 'event'`) liest ein älterer Build als Notiz.

## Bewusst offen

- **Fäden verweisen auf Erkenntnisse** (Konzept: „Fäden verweisen darauf“): noch nicht gebaut. Braucht ein Feld am Faden und eine Auswahl im Strang-Editor, die die Erkenntnisse der gewählten Szene lädt. Vorschlag: mit der neuen Regie oder als kleiner Nachtrag.
- Auslösen von Ereignissen und Timer am Tisch: neue Regie.

## Dateien

- `domain/story-scene.ts`: `sceneInsightSchema`, `sceneInteractionCardSchema`, `sceneEventSchema`, Felder `insights`, `interactionCards`, `events`
- `domain/scene-possibilities.ts` (neu): Verweisprüfung, Aufräumen, Lesesicht für die alte Regie, Rollback
- `domain/command-workspace.ts`, `server/command-workspace.ts`, `app/api/command-center/moments/route.ts`, `domain/play-log.ts`: Ereignis-Log
- `server/story-scenes.ts`, `server/live-stage.ts`
- `app/spielbereich/modules/storyboard-possibilities.tsx` (neu), `storyboard.tsx`, `storyboard-play.tsx`, `spieltisch/regie-evening.tsx`, `storyboard.module.css`
- `domain/scene-workshop.ts` (Füllstand), `scripts/storyboard2-rollback-board.mjs`
- `tests/scene-possibilities.test.mjs` (neu, 6 Tests, in `npm test`), `tests/plot-threads-integration.mjs` (POSS), `tests/scene-play-integration.mjs` (Ereignis-Log)

## Prüfungen (beobachtet)

- `npm test`: 754 bestanden, 0 fehlgeschlagen. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration: **2464 integration checks passed**, darunter 7 POSS-Prüfungen.
- `tests/scene-play-integration.mjs` gegen die lokale Demo: **11 scene-play checks passed**, darunter „an event of the scene is logged with its state“ und „only events prepared in the scene can be logged“. Der Test startet in der lokalen Demo einen Spieltisch (synthetisch).
- Browser (Demo, Szene 05): Ereignis „Das Tier erwacht“, Erkenntnis „Emils Zustand“ (nur SL) und Karte „Emil beruhigen → Er erzählt vom Labor“ mit Material, Erkenntnis und Ereignis verknüpft → gespeichert; Ereignis gelöscht (mit Rückfrage) → Verknüpfung aus der Karte entfernt. 375 px ohne waagerechtes Scrollen.

## Prüfgrenzen

- Die zusammengesetzten Reiter der alten Regie nur per Unit-Test geprüft, nicht im laufenden Regie-Fenster angesehen.
- Kein echtes Mobilgerät; volles `npm run lint` nicht gelaufen.

## Offen (je eigene Freigabe)

Etappe 5 Regelprofil und Proben · Etappe 6 SL-Notizbuch · Etappe 7 Test · Fäden → Erkenntnisse · Design-Prototyp · neue Regie · Ablösung der Altsysteme.
