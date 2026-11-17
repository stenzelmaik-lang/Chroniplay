# Persönliche Spielpause am Spieltisch

Stand: 17.11.2026. Lokale Umsetzung auf `codex/spielpause`, ausgehend vom frisch abgerufenen `origin/main` bei `44e15be`. Kein Push und kein Live-Deployment.

Arbeitsordner: `C:\Users\Stenz\Documents\ChatGPT\Pen&Paper Spielabend\chroniplay-spielpause`. Der ältere Release-Checkout und der Chronik-Checkout bleiben unverändert. Im Projekt und seinen geprüften übergeordneten Verzeichnissen wurde keine geltende AGENTS.md gefunden.

## Integration

- `app/spielbereich/modules/spieltisch/stage.tsx`: neuer seitlicher Eintrag **Spielpause** und die persönliche Ebene innerhalb der tatsächlichen Spielbühne.
- `app/spielbereich/modules/spieltisch/spielpause/spielpause.tsx`: Auswahl, ein aktives Spielzeug, transparente Objekte und Bedienung am unteren Tischrand.
- `spielpause/toys-core.js`: übernommene physische Würfellogik, Quetschfeder und Spinner-Reibung; ES-Modul statt globalem Objekt. Spinner zeichnet die zentrierte Textur um ihre Lagerkappe.
- `spielpause/toys-runtime.js`: bestehende Gesten und Zähler in einer aufräumbaren Instanz; neue Auftritte, fokussierte Tastatursteuerung, reduzierte Bewegung und Vorrang vorhandener Dialoge.
- `stage.module.css`: der Leerbühnenhinweis wird während eines persönlichen Spielzeugs ausgeblendet.
- `vitals.module.css`: während sichtbarer Spielpause unter 1100 px kompakte, weiterhin anklickbare Statuszugänge oberhalb des Aktionsdocks. Nach dem Wegräumen kehrt die normale Anzeige zurück.

Es gibt keine neuen API-Aufrufe, Tabellen, Rollen, Charakterbuchungen oder Stress-/EP-Effekte. Nur Knautschs Klickzahl wird unter `chroniplay:spielpause:<actorId>` im Browser gespeichert. Würfel und Spinner leben in der persönlichen Instanz und werden beim Wegräumen verworfen. Dialoge und Tischwerkzeuge halten die Instanz an. Beim Wechseln/Verlassen werden Ereignisse, Beobachter, Pointer-Captures und Animationsanforderungen bereinigt.

## Vorschau öffnen

Direkt per Doppelklick, ohne Anmeldung und ohne Server:

`outputs/ChroniPlay-Spieltisch-Spielpause.html`

Diese Datei bündelt dieselbe React-Komponente und dieselben Assets wie das Projekt. Nur die umgebende Beispiel-Tischfläche ist vereinfacht. Die Datei wurde über `file://` mit allen drei Spielzeugen geprüft; keine Browserfehler und keine externen Anfragen. Neu bauen: `node scripts/build-spielpause-preview.mjs`.

Vollständige Anwendung: `http://127.0.0.1:8847/spielbereich?bereich=sitzung`. Der isolierte lokale Testserver läuft mit synthetischen Daten. Anmeldung als `command-a@example.invalid`, `command-b@example.invalid` oder `command-gm@example.invalid`; Passwort jeweils `ChroniPlay-Demo-2036!`. Das ist ausschließlich eine lokale Testanmeldung.

Zum Neustart im Arbeitsordner (PowerShell):

```powershell
node scripts/run-framework.mjs build
$env:CVK_TEST_PORT='8847'
node --experimental-strip-types scripts/test-local.mjs --zustandswerte
```

## Prüfung

- Projekt-Build, TypeScript und ESLint der geänderten JS-/TS-Dateien bestanden.
- Sieben übernommene Modellprüfungen bestanden: 26 Steine/54 Sticker, alle neun Ebenen, Umkehrungen, 1000 gemischte Drehungen und vollständiges Zurückdrehen, Mischen, Quetschfeder und bildratenunabhängiger Spinner-Nachlauf.
- `tests/spielpause-browser.mjs` prüft den echten Einstieg mit synthetischen Spieler- und SL-Anmeldungen: gelöster Fall und anschließendes animiertes Mischen; WASDQE und vier Pfeile samt Shift, Rückgängig, Mauswischen und Ansicht; Knautschs Rückenlage/Aufrichten, „Massier mich“, wechselnde Sprechblasen, Halten, Quetschen und Rückfedern; Spinner-Kurven, Schwung, Reibung und Stoppen; Wechseln, Schließen und sofortigen Auftrittsabbruch.
- Browserprüfung bei 320, 390, 768, 1024 und 1440 px; Knöpfe werden auch auf schmalem Tisch nicht durch Statusfelder verdeckt. Spinner-Auftritt zusätzlich bei 320×700 innerhalb der Tischgrenzen geprüft. Native Chromium-Touch-Ereignisse prüfen Würfelwischen, Puppentippen/Abbruch und Spinner-Tippen/Stoppen.
- Echte SL-Bildpräsentationen, persönliche Visionen und Botschaften haben Vorrang und machen das Spielzeug vorübergehend unsichtbar/inert. Nach Zurückziehen kehrt es zurück. Spieler B erhält kein Spielzeug von Spieler A. Tischobjekte und Charakterwerte bleiben identisch; außer den schon bestehenden Presence-Aufrufen entstehen keine schreibenden Spieltischanfragen.
- Bestehende `spieltisch-regie-integration.mjs` bestanden: private Regie und Kataloge geschützt, gezielte Freigaben, Wiederaufnahme und Zurückziehen von Erzählungen unverändert.
- Gesamtsuite im Arbeitsordner: **590/595 bestanden**. Fünf bestehende Design-Token-Tests scheitern am nicht decodierten `%20` im Ordnernamen. Dieselben fünf Prüfungen bestehen separat über einen normalisierten Pfad. Keine Änderung dieser fremden Tests.

Screenshots und maschinenlesbare Browserergebnisse liegen in `outputs/Spielpause-Pruefung/`. Browser: Edge/Chromium, ohne sichtbares Browserfenster. Touch ist emuliert; kein Test an einem physischen Mobilgerät. Es wurde keine Live-Umgebung verändert.

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
