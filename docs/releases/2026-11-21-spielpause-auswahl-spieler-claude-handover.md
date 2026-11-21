# Spielpause: Auswahl für Spieler erreichbar – Übergabe

Stand: 21.11.2026. Claude Code, Branch `claude/spielpause-spieler`, Basis `df55055` (= `main`, entspricht laut Auftrag dem Live-Stand b191ca45). **Nicht gepusht, nicht deployt, keine Produktionsdaten berührt.**

## Fehlerbericht der SL

„Spielpause geht noch nicht beim Spieler, also sie sehen die Objekte nicht.“ Rückfrage über die Ausgangssitzung: Gemeint ist Fall B. Ein Spieler öffnet seine **eigene** Spielpause über das Symbol links und sieht trotzdem kein Spielzeug. Ein geteiltes Verhalten soll nicht gebaut werden. Gerät, Browser und Spielzeug wurden nicht genannt.

## Abgleich mit der Codex-Übergabe

`docs/spielpause-integration.md` (PR #87) stimmt mit dem Code überein. Die Spielpause ist rein clientseitig und persönlich, ohne API, Tabellen oder Server-Synchronisation. SL-Bilder, Visionen, Briefe, offene Panels, Würfelergebnisse und Tischauswahl haben absichtlich Vorrang und blenden das Spielzeug vorübergehend aus. Es gibt keinen Spieler-Projektions- oder Rechtepfad, der hier filtern könnte. Live liefert dasselbe Paket aus wie ein lokaler Build aus `df55055`: Der Chunk `workspace-PbJakEJ2.js` enthält dieselben Spielpause-Zeichenketten und ist bis auf 25 Bytes gleich groß. Die Assets `/spielpause/graf-knautsch.webp` und `/spielpause/vampir-spinner.webp` antworten live mit 200.

## Ursache

Die Bühne `main.stage` ist ein eigener Stapelkontext (`isolation:isolate`). Die HUD-Ebene `.hud` (z-index 20), die das **eigene Charakterpanel des Spielers** (unten links, `bodyHud`) enthält, liegt als Geschwister darüber. Die Auswahlliste der Spielpause (`aside.picker`) wurde innerhalb der Bühne gerendert. Auf niedrigeren Bildschirmen überlappt das Charakterpanel die Auswahl. Ein Tipp auf „Vampir-Spinner“ oder „Graf Knautsch“ trifft dann das Charakterpanel, öffnet „Mein Charakter“, und es erscheint kein Spielzeug. Die SL hat dieses Panel nicht und war nie betroffen. Mit z-index allein ist das wegen des isolierten Stapelkontexts nicht lösbar.

Gemessen am alten Stand (lokal, synthetische Konten):

| Ansicht | Spieler | SL |
| --- | --- | --- |
| 375×667 (Handy hochkant) | „Vampir-Spinner“ verdeckt von `hudBox bodyHud` | frei |
| 844×390 (Handy quer) | alle drei Einträge verdeckt | frei |
| 1366×657, 1440×1000 | frei | frei |

Weitere geprüfte und ausgeschlossene Hypothesen: Spieler ohne eigenes Charakterpanel (Spieler B), laufende Erzählszene, für alle eingeblendetes und dann für sich geschlossenes SL-Bild, Mobilbreite 375×812, Asset-Pfade und -Rechte, Unterschiede zwischen Live- und lokalem Paket, `tablePreview` (wird nur an die SL ausgeliefert), dauerhaft offene `role="dialog"`-Elemente. Ist das Spielzeug erst gewählt, ist es in allen geprüften Größen sichtbar.

## Änderung

- `app/spielbereich/modules/spieltisch/spielpause/spielpause.tsx`: neue optionale Eigenschaft `pickerHost`. Die Auswahl wird per `createPortal` dorthin gerendert. Ohne Host wird sie wie bisher an Ort und Stelle gerendert, etwa in der Einzeldatei-Vorschau.
- `app/spielbereich/modules/spieltisch/stage.tsx`: Die HUD-Ebene erhält einen Callback-Ref (`setHudLayer`) und wird als `pickerHost` übergeben.
- `spielpause.module.css`, `.picker`: `pointer-events:auto` (die HUD-Ebene ist `pointer-events:none`), `max-height:calc(100% - 36px)`, `overflow-y:auto` und `box-sizing:border-box`, damit die Liste auf sehr niedrigen Bildschirmen scrollt statt abgeschnitten zu werden.

Unverändert: Spielzeuge, Vorrangregeln, Fokus- und Escape-Verhalten, Rollen und Server. Es gibt weiterhin keine neue Route und keine Datenänderung.

## Tests

- `tests/spielpause.test.mjs`: neue Regressionsprüfung (Portal in die HUD-Ebene, Picker-CSS). In `pnpm test` enthalten.
- `tests/spielpause-picker-browser.mjs` (neu): Browserprüfung gegen eine isolierte lokale `--zustandswerte`-Instanz. Für Spieler A, Spieler B und SL bei 375×667, 844×390, 1024×600 und 1440×1000 muss jeder Eintrag beim echten Klick das oberste Element sein, und jedes der drei Spielzeuge muss danach sichtbar sein, ohne dass etwas außerhalb der Spielpause es verdeckt. Außerdem: Spieler B erhält das Spielzeug von Spieler A nicht, und nicht angemeldet gibt es weder Bühne noch Spielpause. Vorher wird ein eventuell eingeblendetes SL-Bild über die SL-API zurückgezogen, die Erzählszene bleibt stehen.

Ausführen (PowerShell, im Projektordner, nach `node scripts/run-framework.mjs build`):

```powershell
$env:CVK_TEST_PORT='8861'; node --experimental-strip-types scripts/test-local.mjs --zustandswerte
```

```powershell
$env:CVK_TEST_URL='http://127.0.0.1:8861'; node tests/spielpause-picker-browser.mjs
```

## Ausgeführte Prüfungen (beobachtet)

- `tsc --noEmit --incremental false`: Exit 0.
- ESLint auf den geänderten und neuen Dateien: Exit 0. Gesamtes Repo (`eslint .`): 18 Fehler und 19 Warnungen, alle in fremden, unveränderten Dateien (u. a. `favors.tsx`, `mvp-vote-*.tsx`, `xp-session-desk.tsx`, `prototypes/spieltisch-2`). Das ist der bekannte Altbestand.
- Build (`node scripts/run-framework.mjs build`): Exit 0.
- Alle Unit-Tests `node --experimental-strip-types --test tests/*.test.mjs` (105 Dateien): **702/702 bestanden**, 0 fehlgeschlagen.
- `tests/spielpause-picker-browser.mjs` auf dem Fix: 14/14 PASS (Edge über Playwright, ohne sichtbares Fenster).
- **Gegenprobe** auf dem alten Stand (Fix zurückgenommen, neu gebaut): schlägt fehl mit `command-a 375x667: "Vampir-Spinner" is covered by _hudBox_… _bodyHud_…`.
- Bestehende Codex-Prüfungen gegen den Fix: `tests/spielpause-browser.mjs` 13/13 PASS, `tests/spielpause-3d-browser.mjs` 5/5 PASS (nach `node scripts/build-spielpause-preview.mjs`).
- Sichtprüfung im eingebauten Browser: Spieler B bei 375×667, die Auswahl liegt über dem Charakterpanel.

Lokale Prüfdaten: isolierter Speicher `.local-test/zustandswerte`, synthetische Konten `command-a`, `command-b` und `command-gm` (`@example.invalid`). Danach gelöscht: `.local-test/`, `.local-work/` (Screenshots der Codex-Prüfungen) und `outputs/` (Vorschaudatei). Der Server ist beendet.

## Prüfgrenzen

- Kein Test auf einem echten Mobilgerät und nicht in Safari oder iOS. Touch und Größen sind nur in Chromium emuliert.
- Die genaue Situation der Spieler am Live-Abend (Gerät, Fenstergröße, Spielzeug) ist nicht bekannt. Die Ursache ist durch Messung und Gegenprobe belegt, dass sie genau den gemeldeten Fall abdeckt, ist aber nicht nachgewiesen.

## Offene Punkte

- Auf sehr niedrigen Querformat-Bildschirmen (z. B. 844×390) verdeckt das **eigene Bedienfeld** des Spielzeugs dessen untere Hälfte. Das betrifft alle Rollen und ist eine Layoutgrenze der Codex-Umsetzung, nicht dieser Fehler. Nicht geändert.
- Nach jedem Neuladen öffnet sich ein noch eingeblendetes SL-Bild erneut für den Spieler (`mediaDismissed` ist nur ein Komponentenzustand). Das ist bestehendes Verhalten, nicht geändert.
- Freigabe für Merge und Deployment liegt bei der SL bzw. dem Besitzer.

## Ausdrücklich nicht getan

Kein Push, kein Merge auf `main`, kein Tag, kein Deployment, keine Remote-D1-Befehle, keine Produktionsdaten gelesen oder verändert. Live wurden nur öffentliche Dateien abgerufen (Anmeldeseite, JS-Chunks, Spielpause-Bilder). Kein geteiltes Spielpause-Verhalten gebaut.
