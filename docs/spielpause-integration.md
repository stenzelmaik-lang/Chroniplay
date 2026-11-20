# Persönliche Spielpause am Spieltisch

Stand: 18.11.2026. Umsetzung auf `codex/spielpause`, ausgehend vom frisch abgerufenen `origin/main` bei `44e15be`. Der Nutzer hat Korrekturen an 3D-Auftritt/Fokus und die anschließende Live-Veröffentlichung ausdrücklich freigegeben. Der tatsächliche Live-Stand wird im gesonderten Releaseprotokoll dokumentiert.

Arbeitsordner: `C:\Users\Stenz\Documents\ChatGPT\Pen&Paper Spielabend\chroniplay-spielpause`. Der ältere Release-Checkout und der Chronik-Checkout bleiben unverändert. Im Projekt und seinen geprüften übergeordneten Verzeichnissen wurde keine geltende AGENTS.md gefunden.

## Integration

- `app/spielbereich/modules/spieltisch/stage.tsx`: neuer seitlicher Eintrag **Spielpause** und die persönliche Ebene innerhalb der tatsächlichen Spielbühne.
- `app/spielbereich/modules/spieltisch/spielpause/spielpause.tsx`: Auswahl, ein aktives Spielzeug, transparente Objekte und Bedienung am unteren Tischrand.
- `spielpause/toys-core.js`: übernommene physische Würfellogik, Quetschfeder und Spinner-Reibung; ES-Modul statt globalem Objekt. Spinner zeichnet die zentrierte Textur um ihre Lagerkappe.
- `spielpause/toys-runtime.js`: bestehende Gesten und Zähler in einer aufräumbaren Instanz; neue Auftritte, fokussierte Tastatursteuerung, reduzierte Bewegung und Vorrang vorhandener Dialoge.
- `spielpause/doll-3d.js`: echtes räumliches Modell aus 47 geschlossenen bzw. extrudierten Teilen, mit perspektivischer Kamera und berechneten Licht-/Kontaktschatten. Kopf, Rumpf, Gliedmaßen und Augen besitzen Volumen; der Mantel hat Rück- und Kantenflächen. Das Plüschfoto wird auf Vorderflächen projiziert, seitliche und hintere Flächen erhalten Stoffmaterial. Eine erhabene Naht bleibt auf dem Hinterkopf sichtbar. Keine gekippte Bildkarte und kein CSS-Kippen der Zeichenfläche.
- `spielpause/doll-pose.js`: Rückwärtsfallen, weicher Aufprall, körperliche Rückenlage und Aufrichten auf die Füße. Erst danach erscheint „Massier mich“. Bei reduzierter Bewegung steht das Modell sofort bereit.
- Maus/Touch zeigen keinen rechteckigen Fokusrahmen mehr. Die Tastatur behält ein kleines elliptisches Fokuszeichen am Tischboden. Quetschen und Rückfedern verformen das gesamte 3D-Modell.
- `stage.module.css`: der Leerbühnenhinweis wird während eines persönlichen Spielzeugs ausgeblendet.
- `vitals.module.css`: während sichtbarer Spielpause unter 1100 px kompakte, weiterhin anklickbare Statuszugänge oberhalb des Aktionsdocks. Nach dem Wegräumen kehrt die normale Anzeige zurück.

Es gibt keine neuen API-Aufrufe, Tabellen, Rollen, Charakterbuchungen oder Stress-/EP-Effekte. Nur Knautschs Klickzahl wird unter `chroniplay:spielpause:<actorId>` im Browser gespeichert. Würfel und Spinner leben in der persönlichen Instanz und werden beim Wegräumen verworfen. Dialoge und Tischwerkzeuge halten die Instanz an. Beim Wechseln/Verlassen werden Ereignisse, Beobachter, Pointer-Captures und Animationsanforderungen bereinigt.

## Vorschau öffnen

Direkt per Doppelklick, ohne Anmeldung und ohne Server:

`outputs/ChroniPlay-Spieltisch-Spielpause.html`

Diese Datei bündelt dieselbe React-Komponente, dasselbe 3D-Modell und dieselben Assets wie das Projekt. Nur die umgebende Beispiel-Tischfläche ist vereinfacht. Die Datei wurde über `file://` mit allen drei Spielzeugen geprüft; keine Browserfehler und keine externen Anfragen. Neu bauen: `node scripts/build-spielpause-preview.mjs`. Mit `?modellpruefung` zeigt dieselbe Datei Vorderseite, Seite, Rücken und Rückenlage des tatsächlichen Modells nebeneinander.

Vollständige Anwendung: `http://127.0.0.1:8847/spielbereich?bereich=sitzung`. Der isolierte lokale Testserver läuft mit synthetischen Daten. Anmeldung als `command-a@example.invalid`, `command-b@example.invalid` oder `command-gm@example.invalid`; Passwort jeweils `ChroniPlay-Demo-2036!`. Das ist ausschließlich eine lokale Testanmeldung.

Zum Neustart im Arbeitsordner (PowerShell):

```powershell
node scripts/run-framework.mjs build
$env:CVK_TEST_PORT='8847'
node --experimental-strip-types scripts/test-local.mjs --zustandswerte
```

## Prüfung

- Projekt-Build, TypeScript und ESLint der geänderten JS-/TS-Dateien bestanden.
- Neun Modellprüfungen bestanden: sieben übernommene Prüfungen für Würfel, Quetschfeder und Spinner sowie zwei neue Prüfungen für die echte Tiefe der Puppenteile und die Lage über dem Tisch während des gesamten Auftritts.
- `tests/spielpause-browser.mjs` prüft den echten Einstieg mit synthetischen Spieler- und SL-Anmeldungen: gelöster Fall und anschließendes animiertes Mischen; WASDQE und vier Pfeile samt Shift, Rückgängig, Mauswischen und Ansicht; Knautschs Rückenlage/Aufrichten, „Massier mich“, wechselnde Sprechblasen, Halten, Quetschen und Rückfedern; Spinner-Kurven, Schwung, Reibung und Stoppen; Wechseln, Schließen und sofortigen Auftrittsabbruch.
- Browserprüfung bei 320, 390, 768, 1024 und 1440 px; Knöpfe werden auch auf schmalem Tisch nicht durch Statusfelder verdeckt. Spinner-Auftritt zusätzlich bei 320×700 innerhalb der Tischgrenzen geprüft. Native Chromium-Touch-Ereignisse prüfen Würfelwischen, Puppentippen/Abbruch und Spinner-Tippen/Stoppen.
- Echte SL-Bildpräsentationen, persönliche Visionen und Botschaften haben Vorrang und machen das Spielzeug vorübergehend unsichtbar/inert. Nach Zurückziehen kehrt es zurück. Spieler B erhält kein Spielzeug von Spieler A. Tischobjekte und Charakterwerte bleiben identisch; außer den schon bestehenden Presence-Aufrufen entstehen keine schreibenden Spieltischanfragen.
- Bestehende `spieltisch-regie-integration.mjs` bestanden: private Regie und Kataloge geschützt, gezielte Freigaben, Wiederaufnahme und Zurückziehen von Erzählungen unverändert.
- Frischer vollständiger Testlauf: **597/597 bestanden**, ausgeführt über einen normalisierten lokalen Pfad mit `--preserve-symlinks-main`. Damit umgehen auch die fünf bestehenden Design-Token-Tests ihr nicht decodiertes `%20` im ursprünglichen Ordnernamen. Keine Änderung dieser fremden Tests.
- `tests/spielpause-3d-browser.mjs`: fünf zusätzliche Prüfgruppen für echte 3D-Zwischenphasen, rahmenlose Maus-/Touch-Aktivierung, erhaltenen Tastaturfokus, Vorder-/Seiten-/Rückenansichten und ehrliches Verhalten ohne 3D-Unterstützung.

Screenshots und maschinenlesbare Browserergebnisse liegen in `outputs/Spielpause-Pruefung/`. Browser: Edge/Chromium, ohne sichtbares Browserfenster. Touch ist emuliert; kein Test an einem physischen Mobilgerät. Knautsch benötigt funktionierendes WebGL; andernfalls wird seine Nichtverfügbarkeit gemeldet und die anderen Spielzeuge bleiben erreichbar. Es wird dann kein flacher Ersatzauftritt als 3D ausgegeben.

## Quellen und Assets für den ursprünglichen Chat

Quellordner, nur gelesen:

`C:\Users\Stenz\Documents\Codex\2026-11-15\realtime-voice-chat\`

| Quelle relativ zu diesem Ordner | Verwendung |
| --- | --- |
| `work/spielpause/toys-core.js` | Physische Modelle, Renderer, Picking und Wischachsen übernommen; Modulkapsel und Spinner-Textur ergänzt. |
| `work/spielpause/toys-app.js` | Gesten, Undo/Mischen, Sprüche und Beschriftungen übernommen und auf persönliche Lebensdauer begrenzt. |
| `work/spielpause/toys-shell.html` | Bedienelemente und Benennung als Referenz; Kartenlayout nicht übernommen. |
| `work/spielpause/verify.cjs` | Sieben reine Modellprüfungen nach `tests/spielpause.test.mjs` übernommen; Browserprüfungen für die tatsächliche Integration ergänzt. |
| `outputs/ChroniPlay-Spielpause.html` | Vorhandener eigenständiger Entwurf als Referenz; unverändert. |
| `outputs/Graf-Knautsch-Pluesch.png` | Im ursprünglichen Chat auf Benutzerwunsch mit der integrierten Bildgenerierung erstelltes PNG-Original; hier nicht neu generiert. |
| `work/spielpause/graf-knautsch.webp` | Identisch nach `public/spielpause/graf-knautsch.webp` kopiert, 188364 Bytes. |
| `outputs/Vampir-Spinner.png` | Im ursprünglichen Chat auf Benutzerwunsch mit der integrierten Bildgenerierung erstelltes freigestelltes PNG-Original; hier nicht neu generiert. |
| `work/spielpause/vampir-spinner-centered.webp` | Neuere, um die Lagerkappe zentrierte 800×800-Textur; nach `public/spielpause/vampir-spinner.webp` kopiert, 184168 Bytes. Ersetzt die frühere unzentrierte Variante. |

SHA-256 der eingebauten Assets:

```text
graf-knautsch.webp  08FB7BA957904CD324C9C32E549F04205AC29D640FE1A9ADB6F8B2990D84147C
vampir-spinner.webp 411F187FE1873940E85EE9C340C418DB33D1BCFACDF98AC1A44FDA5F5647C5B4
```

Keine Datei im ursprünglichen Quellordner wurde bearbeitet. Die später offene Anbindung an ein Stresssystem bleibt außerhalb dieser Umsetzung.
