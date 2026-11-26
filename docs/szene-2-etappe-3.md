# Szene 2.0 · Etappe 3 – Material-Bibliothek und Verwendungen (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c` (zusammen mit Phase 1–4 und Etappe 1–2, alles uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md`, Abschnitte 1 (Material ist einzigartig), 7.6 und 12

## Was sich ändert

**Bibliothek:** Jedes Material gibt es einmal, als eigene SL-Akte (`NOTE`, `documentKind: 'scene_material'`), mit dem bestehenden Spielmaterial-3.0-Block (Dateien, Darstellung, Effekte). Arten: Bild, Brief/Handout, Akte/Paket, Ton, Video, Sonstiges. Pager-Nachrichten bleiben Szenenbausteine (Empfänger), Bühnenbilder gehören zu den Stimmungen. Schlagworte für die Suche.

**Verwendung in der Szene** (`materialUses`): Verweis auf das Bibliotheksmaterial plus
- wie es ins Spiel kommt: liegt offen, durch Untersuchung, wird übergeben (von einem NSC), anders
- Bedingung und Zielgruppe (nur SL)
- einsteckbar ja/nein – je Verwendung
- jedes Material höchstens einmal je Szene

**Oberfläche:** Bereich „Material“ zeigt oben die Verwendungen, darunter die Bibliothek mit Suche und „Neues Material“. Der bestehende Material-Editor öffnet direkt in der Szene, ohne zweites Fenster. Neues Material wird beim Speichern gleich in der Szene verwendet.

## Verträglichkeit (alte Regie läuft weiter)

- **Kopie für die alte Regie:** Beim Speichern legt der Server je Verwendung einen klassischen Baustein **mit derselben ID** in die Szene (Inhalt aus der Bibliothek, einsteckbar laut Verwendung). Regie, Tisch und Tasche spielen ihn unverändert aus.
- **Bibliothek ändern → alle Szenen folgen:** Ein Speichern in der Bibliothek aktualisiert die Kopien in jeder Szene, die das Material nutzt (normales Szenen-Speichern mit Verlauf und CAS). Eine Szene, die im selben Moment bearbeitet wird, wird übersprungen und gemeldet; ihre Kopie folgt beim nächsten Speichern.
- **Klassische Bearbeitung gewinnt:** Ändert jemand die Kopie im alten Material-Fenster, löst sich die Verwendung; der Baustein bleibt als normales Szenenmaterial. Nichts geht verloren.
- **Fehlende Kopie** wird neu angelegt (nicht als Löschen gelesen). Ein aus der Bibliothek verschwundener Eintrag lässt die gespeicherte Kopie stehen.
- **Übernehmen statt Umwandeln:** Klassisches Material wird nicht automatisch verschoben. „In die Bibliothek übernehmen“ legt einen Eintrag an und verwendet ihn mit derselben ID; am Tisch ändert sich nichts.
- **Server prüft:** unbekanntes Material 400, Übergabe nur durch NSC 400, Dateien und Darstellungen wie beim Szenenmaterial, Spieler 401/403.
- **Rollback:** `sceneWithoutMaterialUses` (im Rollback-Skript eingebunden) entfernt `materialUses`; die Kopien bleiben als klassische Bausteine, die Angaben zur Verwendung wandern als Text in die SL-Notizen. Die Bibliotheksakten stören ältere Builds nicht (eigener `documentKind`).

## Altsystem-Befund

Es gibt bereits „Materialvorlagen & Handout-Pakete“ (`/api/table-materials`, `domain/table-material.ts`) – ein älteres, schlichteres System ohne Effekte und Darstellungen. Die neue Bibliothek baut bewusst auf Spielmaterial 3.0. **Vorschlag für den Ablöseplan:** die alten Vorlagen später zählen, auf Wunsch in die Bibliothek übernehmen und dann abbauen. Hier nicht angefasst.

## Dateien

- `domain/material-library.ts` (neu): Schema, Befehle, Kopie (`elementFromMaterial`, `withMaterialCopies`), Übernahme (`entryFromElement`), Rollback
- `domain/story-scene.ts`: `sceneMaterialUseSchema`, Feld `materialUses`, `sceneRichText` exportiert
- `server/material-library.ts` (neu), `app/api/command-center/materials/route.ts` (neu)
- `server/story-scenes.ts`: Kopien beim Speichern, Prüfungen, `refreshScenesUsingMaterial`
- `app/spielbereich/modules/storyboard-materials.tsx` (neu), `storyboard.tsx` (Bereich verdrahtet), `material/workbench.tsx` (Editor exportiert), `storyboard.module.css`
- `scripts/storyboard2-rollback-board.mjs`
- `tests/material-library.test.mjs` (neu, 6 Tests, in `npm test`), `tests/plot-threads-integration.mjs` (MATERIAL-Prüfungen)

## Prüfungen (beobachtet)

- `npm test`: 748 bestanden, 0 fehlgeschlagen. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration (isolierte lokale D1): **2457 integration checks passed**, darunter 22 MATERIAL-Prüfungen (Rollen, idempotentes Anlegen, Kopie mit gleicher ID, Bibliothek → Szenen, veralteter Stand 409, klassische Bearbeitung gewinnt, nichts bei Spielern).
- Browser (lokale Demo 8866, Szene 05): „Neues Material → Brief“ im Editor angelegt, „In die Bibliothek legen und verwenden“ → Verwendung und Kopie (`handout`, gleiche ID) gespeichert; „Wird übergeben von Herr Schäfer“ gespeichert; Titel in der Bibliothek geändert → Kopie in der Szene folgt (Version +1), kein Konflikt im offenen Editor. 375 px ohne waagerechtes Scrollen.

## Prüfgrenzen

- Ausspielen der Kopie in der alten Regie nicht von Hand am Tisch geprüft; abgesichert über gleiche Element-Form und Integration.
- „In die Bibliothek übernehmen“ nur per Unit-Test (Szene 05 hat kein klassisches Material).
- Die Sperre „schon eingesteckt, nicht erneut ausspielen“ gehört zum Inventar-Auftrag (geschützt), hier nicht gebaut.
- Kein echtes Mobilgerät; volles `npm run lint` nicht gelaufen.

## Offen (je eigene Freigabe)

Etappe 4 Erkenntnisse, Interaktionen, Ereignisse (Interaktionen verweisen dann auf Verwendungen) · Etappe 5 Regelprofil und Proben · Etappe 6 SL-Notizbuch · Etappe 7 Test · Design-Prototyp · neue Regie · Ablösung der Altsysteme (inkl. alter Materialvorlagen).
