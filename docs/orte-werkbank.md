# Orte im Werkbank-Stil – Weg B, Teil 1 (Aufbau, Optik, Aufräumen)

**Branch:** `claude/storyboard-2-phase-1` (Basis `5ab984c`), nicht committet, nicht gepusht, kein Deployment, keine Migration.
**Entscheidung:** `.10x/adrs/003-orte-werkbank.md`

## Was sich geändert hat
Nur Darstellung und Beschriftung. Keine Zeile an Daten, Freigaberegeln, Entdeckung, Revisionen, Karte oder Server.

- `app/spielbereich/modules/location-cms.tsx` (nur JSX und Texte)
  - Baum heißt „Orte / Hauptort, Bereiche und Räume“. Jede Zeile hat einen Punkt: Gold = für Spieler freigegeben, Silber = noch nicht freigegeben, gestrichelt = nur für die SL. Der Status steht in normalen Worten, das Spielerwissen als Tooltip.
  - Der Block „ORTSSTRUKTUR“ ist entfernt.
  - „Ortsverwaltung“ ist aus dem Baum herausgenommen. Sie steht jetzt eingeklappt als „Weitere Einstellungen“ unter dem Editor (Zielgruppe, frühere Fassungen, Verknüpfungen, Medien, Archiv).
  - Kopf: Ebene in Klartext (Hauptort/Bereich/Raum/Erkenntnis), keine technische Kennung, Status als Marke mit Punkt.
  - Reiter ohne Nummern, keine Großbuchstaben-Etiketten. Die Vorschau-Überschrift heißt „So sehen es die Spieler“.
  - Texte öffnen im normalen Editor statt im HTML-Quelltext. Der Quelltext bleibt per Knopf erreichbar, das Speicherformat ist gleich.
- `app/spielbereich/modules/location-cms.module.css`: angehängter Block mit `--or-*`-Variablen, die auf die Command-Center-Variablen `--cc-*` zeigen. Damit gelten alle vier Farbmodelle auch hier.
- `tests/open-issues-browser.mjs` (inzwischen auf Wunsch des Besitzers entfernt): Selektoren auf „Weitere Einstellungen“ umgestellt.

## Prüfungen (beobachtet)
- `npm test`: 766 von 766 bestanden.
- `node --experimental-strip-types --test tests/location*.test.mjs tests/world-map*.test.mjs`: 62 von 62 bestanden.
- `npm run build`: erfolgreich.
- Integration (`CVK_TEST_PORT=8867`): 2489 Prüfungen bestanden, nur isolierte lokale Testdatenbank.
- ESLint auf `location-cms.tsx`: ohne Befund. (`tests/open-issues-browser.mjs` ist seit dem Wunsch des Besitzers entfernt.)
- Browser (Playwright mit Edge, lokale Demo): Editor startet in „Visuell“, Reiter „Inhalt“ und „Vorschau & Freigabe“, keine Seitenfehler, bei 375 px kein waagerechtes Scrollen.

## Prüfgrenzen
- `tests/open-issues-browser.mjs` war angepasst, ist aber auf Wunsch des Besitzers entfernt worden.
- Kein Test auf echtem Mobilgerät, kein manueller Klicktest durch den Besitzer.

## Teil 2: Abschnitte einzeln freischalten
**Entscheidung:** `.10x/adrs/004-orte-abschnitte-freischalten.md`

### Server-Prüfung
- Freigabe und Entdeckung arbeiten bereits je Ortsknoten (Hauptort, Bereich, Raum, Erkenntnis). „Abschnitt“ heißt deshalb Ortsknoten.
- Freischalten einzelner Textfelder innerhalb eines Knotens bietet der Server nicht. Das bräuchte ein neues Schema und ist nicht gebaut.
- **Keine Server-, Schema- oder Datenänderung.**
- Befund: Abschnitte, die nie über das CMS freigegeben wurden, zeigen den Spielern ihre Grundfassung, sobald sie entdeckt sind. Nach der ersten Freigabezeile gilt die Grundfassung nicht mehr.

### Gebaut
- Reiter „Für Spieler“ (vorher „Vorschau & Freigabe“) mit der Überschrift „So sehen es die Spieler“.
- `app/spielbereich/modules/location-release-overview.tsx` (neu): alle Abschnitte des Ortes eingerückt.
  - Jede Zeile hat einen Punkt (Gold = Spieler sehen ihn), einen Zustand in Worten und genau einen Knopf: Freischalten, Neue Fassung freischalten, Sichtbar machen, Verbergen, Sperre aufheben oder Fertigstellen.
  - Kopf: „x von y Abschnitten sehen die Spieler“, Wissensstand beim Freischalten (Standard „Bekannt“), „Spieleransicht öffnen“ und Neu laden.
  - Ob die Spieler etwas sehen, wird aus der echten Gruppen-Spielerprojektion gelesen und über den Dossier-Schlüssel zugeordnet.
  - Aufrufe: `/api/cms/releases` (publish, revoke) und `/api/locations/state` (discovery), jeweils mit Versionsschutz. Ein Konflikt (409) lädt neu und meldet sich.
- `domain/location-release-sections.ts` (neu): reine Regeln `playerSeenIds`, `sectionState`, `sectionAction`, `sectionActionText`.
- `location-cms.tsx`:
  - Übersicht oben eingebaut. Für den gewählten Abschnitt mit gespeichertem Entwurf gibt es „Entwurf fertigstellen und freigeben“ (vorhandener Ablauf).
  - Alle bisherigen Einzelsteuerungen, das Protokoll und die Sammelfreigabe liegen eingeklappt unter „Einzelheiten zu …“. Für Spieler- und Public-Ziele sind sie aufgeklappt.
  - Der Baum links nutzt dieselbe Lesart („Grundfassung sichtbar“, „freigegeben, noch unentdeckt“, „verborgen“).
- CSS-Block „Orte Teil 2“ in `location-cms.module.css`.
- Tests:
  - `tests/location-release-sections.test.mjs` (5 Tests, in `npm test` eingetragen).
  - `tests/location-release-overview-integration.mjs` (11 Prüfungen). In `tests/integration.mjs` hinter den Ortstests und vor den Kontotests eingehängt, weil diese Spielersitzungen widerrufen.

### Prüfungen Teil 2 (beobachtet)
- `npm test`: 771 von 771 bestanden.
- Alle `tests/location*.test.mjs`: 61 von 61 bestanden.
- Integration (`CVK_TEST_PORT=8867`): 2500 Prüfungen bestanden, nur isolierte lokale Testdatenbank.
  - Neu geprüft: Freischalten, Verbergen, erneut Freischalten; Spieler dürfen nicht verbergen; ein veralteter Stand ergibt 409.
  - Der Grundfassungs-Fall war im Integrationslauf nicht auslösbar, weil frühere Tests die Beispielräume schon verwalten. Er ist per Unit-Test abgedeckt.
- ESLint auf allen geänderten Dateien ohne Befund. `tsc --noEmit` ohne Fehler. Build erfolgreich.
- Browser (Playwright mit Edge, lokale Demo, nur ansehen): „8 von 8 Abschnitten sehen die Spieler“, Grundfassungen korrekt erkannt, Spieleransicht öffnet sich, bei 375 px kein waagerechtes Scrollen, keine Seitenfehler.

### Prüfgrenzen Teil 2
- In der Demo habe ich keinen Knopf gedrückt, um die Demodaten nicht dauerhaft zu ändern: Verbergen einer Grundfassung ist nicht rückgängig zu machen, außer über eine neue Fassung. Der Klickweg ist nur durch die Integrationsprüfungen belegt, die dieselben Aufrufe senden.
- Kein Test auf echtem Mobilgerät, kein Klicktest durch den Besitzer.

## Nachbesserung: Knöpfe ohne Wirkung
- **Befund des Besitzers:** Die Knöpfe in der Übersicht und „Standardkapitel anlegen“ reagierten nicht.
- **Ursache:** Der eingebaute Browser der Claude-App unterdrückt `window.confirm` und `window.prompt` und antwortet automatisch mit „Nein“. Belegt in der Browser-Konsole.
- **Lösung:** neuer Baustein `location-dialog.tsx` (`ask`, `askText`) auf Basis des vorhandenen AlertDialog. Alle 15 nativen Dialoge in 7 Orte-Dateien sind umgestellt:
  - location-cms
  - location-chapters
  - location-connections
  - location-media-manager
  - location-structure-controls
  - location-tree-release
  - location-release-overview
- `canLeaveEditor` ist jetzt asynchron; die aufrufenden Handler wurden angepasst.
- **Prüfung:**
  - `npm test` 771 von 771 bestanden. ESLint und `tsc` ohne Befund. Build erfolgreich.
  - Headless Edge: Der Dialog erscheint in der Seite, es kommt kein natives Fenster, und nach „Abbrechen“ wird nichts gesendet.

## Etappen 1–3 (Speichern oben, Vorschau-Fenster, Stufenleiste)
- **Speichern oben:** Die Speicherleiste unten ist entfernt.
  - Der Kopf des Abschnitts (Ebene, Titel, Statusmarke) ist fest (`position:sticky` im inneren Scrollbereich der Shell). Er trägt „Vorschau-Fenster“, „Speichern“ / „Gespeichert“ und bei „In Prüfung“ zusätzlich „Genehmigen“ / „Zur Überarbeitung“.
  - Die Erklärtexte stehen als Tooltip an der Statusmarke.
- **Vorschau-Fenster:** neue Seite `/sl/orte-vorschau` (`app/sl/orte-vorschau/page.tsx`, nur aktive SL; Spieler bekommen eine Absage, ohne Anmeldung geht es zur Anmeldeseite).
  - Client: `location-preview-window.tsx` mit eigenem CSS. Umschalter „Mein Entwurf“ / „Was die Spieler sehen“, Zeitstempel des Stands, echtes Ortsdossier über `WorldExperience`.
  - Kopplung über `BroadcastChannel` (`location-preview-channel.ts`). Übertragen werden nur Kennungen, keine Inhalte. Die Inhalte lädt das Fenster über die vorhandenen, geprüften Routen (`/api/cms/preview`, `/api/locations`).
  - Die Werkstatt meldet Auswahl, Speichern, Freigabe und Entdeckung. Ein neu geöffnetes Fenster fragt per „hello“ den aktuellen Stand ab.
  - Ohne Entwurf für Spieler (zum Beispiel ein SL-Abschnitt oder noch kein Entwurf) zeigt es den Spielerstand und sagt das.
- **Stufenleiste:** `location-discovery-steps.tsx` (Unbekannt, Gerücht, Bekannt, Besucht, Untersucht) mit Erklärung je Stufe und Markierung „heute“.
  - Sie ersetzt die Auswahlliste in der Abschnittsübersicht („Wissen beim Freischalten“, ohne „Unbekannt“).
  - In den Einzelheiten ersetzt sie die Auswahlliste („Was wissen die Spieler?“, mit „Unbekannt“ für Korrekturen).
- **Prüfungen:**
  - `npm test` 771 von 771 bestanden. ESLint und `tsc` ohne Befund. Build erfolgreich.
  - Integration 2503 Prüfungen bestanden, darunter 3 neue Zugriffsprüfungen für die Vorschau-Seite (SL 200, Spieler Absage ohne Ortsinhalt, anonym 307).
  - Browser (Edge headless, nichts gespeichert):
    - Der Speichern-Knopf bleibt nach dem Scrollen oben sichtbar.
    - Das Vorschau-Fenster öffnet sich, zeigt „Electric Taberna“ und folgt beim Klick auf „03 Tanzfläche“.
    - Der Umschalter funktioniert, die Stufenleiste lässt sich wählen.
    - Bei 375 px kein waagerechtes Scrollen, keine Seitenfehler.
- **Prüfgrenzen:**
  - Das Neuladen der Vorschau nach einem echten Speichern ist nur über die gemeldeten Versionsstände abgeleitet, nicht in der Demo durchgeklickt, um keine Testdaten anzulegen.
  - Das Pop-up-Verhalten im Claude-App-Browser ist nicht geprüft. Bei blockiertem Pop-up erscheint ein Hinweis.

## Etappe 4 (Icons, Zustand vor Ort, SL-Bereiche)

### Server-Prüfung
- Je Ortsknoten gibt es schon einen Zustand vor Ort (`world_state`: active, changed, inaccessible, destroyed, abandoned) über `/api/locations/state` mit `mode:"world"` (nur SL, Versionsschutz über `location_nodes.revision`). Die Spieler sehen ihn bereits im Dossier. Eine Werkstatt-Oberfläche dafür fehlte.
- **Keine Serveränderung.**
- Einen SL-Bereich (`attributes.visibility="gm"`) für Spieler zu öffnen, kann der Server nicht. Dafür gibt es keinen Weg; das bräuchte eine Server-Änderung mit eigener Freigabe.

### Gebaut
- `location-icons.tsx`: eine Icon-Sprache (lucide).
  - Spielerwissen: Unbekannt durchgestrichenes Auge, Gerücht Ohr, Bekannt Kartennadel, Besucht Fußspuren, Untersucht Lupe.
  - Zustand: offene Tür, Funken, geschlossene Tür, Flamme, Geist.
  - Eingesetzt in der Stufenleiste, in den Zeilen der Abschnittsübersicht und im **Spieler-Dossier** (Hero, Bereichs- und Raumstatus, Karten-Karten, Kartenvorschau, Zustandshinweis des Bereichs).
- `location-world-state.tsx`: Schalter „Zustand vor Ort“ (Offen, Verändert, Geschlossen, Zerstört, Verlassen) mit Erklärung je Stufe.
  - Er steht im Reiter „Für Spieler“ für den gewählten Abschnitt und bei SL-Bereichen direkt über den Notizen.
  - Zeilen der Übersicht zeigen eine Marke, wenn ein Abschnitt nicht „Offen“ ist.
- SL-Bereiche:
  - Ein Hinweis erklärt, dass der Bereich nur der SL gehört.
  - Die Kapitel heißen jetzt „Deine Notizen“; „Standardkapitel anlegen“ heißt jetzt „Kapitel-Vorlage anlegen“, mit Erklärung der acht Kapitel.
  - „Alle öffnen/schließen“ erscheint erst, wenn es Kapitel gibt.

### Prüfungen (beobachtet)
- `npm test` 771 von 771 bestanden. ESLint und `tsc` ohne Befund. Build erfolgreich.
- Integration 2508 Prüfungen bestanden. Neu: Spieler dürfen den Zustand nicht umschalten; die SL schließt und öffnet; Spieler sehen „inaccessible“; ein veralteter Stand ergibt 409.
- Browser (Edge headless, nichts gespeichert): Schalter mit 5 Stufen im Reiter und beim SL-Bereich, Icons in Übersicht und Dossier, keine Seitenfehler.

### Prüfgrenzen und Befunde
- Im Dossier zeigen die Spieler den Zustand bisher nur bei Bereichen an, nicht bei Räumen. Beispiel: die Demo-Tanzfläche ist „Verändert“, das Dossier zeigt es nicht. Das liegt an der vorhandenen Dossier-Darstellung.
- Die Regie-Anbindung des Schalters ist nicht gebaut. Die Route ist dafür geeignet (nur SL, Versionsschutz).

## Etappe 4b (Räume im Dossier, Schalter in der Regie)
- **Räume im Spieler-Dossier:** Der Zustand erscheint neben dem Wissensstand des Raumes (`world-experience.tsx`, Klasse `roomWorldState`), nur wenn er nicht „Offen“ ist.
- **Regie:** neuer Block „Orte der Szene“ im Bereich „Szene führen“ (`app/spielbereich/modules/spieltisch/regie-locations.tsx`, Stil `regie-locations.module.css`).
  - Zeigt die Orte der laufenden Szene mit den fünf Zuständen als große Schaltflächen.
  - Schaltet über `/api/locations/state` (mode `world`), mit Versionsschutz über die Revision.
  - Nur die SL bekommt den Kontext; Spieler sehen den Block nicht.
- **Serverseitig:** `server/live-stage.ts` liefert in `stageRegie` das Feld `locations` (Ort, Ebene, Titel, Revision, Zustand, Hauptschauplatz). Typ `RegieLocation` in `spieltisch/types.ts`.
- **Regie-Gliederung:** `domain/regie-studio.ts` führt den Bereich `locations` in der Gruppe „Szene führen“.

### Prüfungen Etappe 4b (beobachtet)
- `npm test` 771 von 771 bestanden. ESLint und `tsc` ohne Befund. Build erfolgreich.
- Demo, Regie geöffnet (nur lesen, keine Schreibzugriffe, keine Seitenfehler): Die erste Szene „Rückkehr nach Kleve“ zeigt „Kaserne Schwarzholz im Reichswald“ als Hauptschauplatz mit fünf Zuständen, Stand „Offen“.
- Die Regie-Route `/api/live-stage?regie=` liefert `locations` für diese Szene. Die anderen Szenen der Demo haben keinen Ort.

### Nachtrag Etappe 4b (Review und Fehlerbehebung)
- **Fehler gefunden und behoben:** Beim Einfügen der Funktion war der Platzhalter der SQL-Abfrage verloren gegangen (`IN ()`). Die Regie-Route antwortete dadurch mit 503 („Wrong number of parameter bindings“), sobald eine Szene einen Ort hat. Die Demo hat das gezeigt, der Integrationslauf nicht.
- **Zuordnung ausgelagert:** `domain/regie-locations.ts` (`sceneLocationsFrom`) mit Unit-Tests `tests/regie-locations.test.mjs` (3 Tests). Entfernt werden archivierte und gelöschte Orte; der Titel kommt aus den Attributen, sonst aus der Entität.
- **Regie-Block aktualisiert sich:** Der Block wird über die Revisionen und Zustände neu aufgebaut (Key). Bei einem Konflikt (409) zeigt er „Dieser Ort wurde woanders geändert …“ und lädt den Kontext der Szene neu.
- **Prüfungen nach der Behebung:**
  - `npm test` 774 von 774 bestanden.
  - Integration 2508 Prüfungen bestanden.
  - Demo: Endpunkt `/api/live-stage?regie=…` liefert für die erste Szene den Ort „Kaserne Schwarzholz im Reichswald“ (offen, Revision 1).
  - Regie im Browser: Block sichtbar, fünf Zustände, Stand „Offen“, keine Schreibzugriffe, keine Seitenfehler.
  - Spieler-Dossier (Vorschau „Was die Spieler sehen“): bei der Tanzfläche steht „Bekannt · Verändert“ (Textprüfung).

### Integrationsfixture Regie-Ort (`tests/regie-location-integration.mjs`)
- Legt im Hauptlauf eine Szene mit dem bestehenden Ort `place.electric-taberna` an, startet einen Spielabend und prüft:
  - SL liest den Regie-Kontext mit `locations` (Ort, Hauptschauplatz, Revision, Zustand).
  - Spieler bekommen weder Kontext noch `locations` (403) und können den Zustand nicht umschalten (403).
  - SL schließt den Ort aus der Regie; der Kontext zeigt den neuen Zustand und die neue Revision.
  - Ein veralteter Klick ergibt 409, kein Überschreiben.
  - SL öffnet den Ort wieder; der Fixture-Zustand ist wiederhergestellt.
- Eingehängt in `tests/integration.mjs` am Ende, nach den Ortstests.
- Anonyme Anfrage an den Regie-Kontext: 401.
- **Ergebnis:** Integration 2522 Prüfungen bestanden (14 neu), keine Fehler.
- **Gesamter Unit-Lauf** `node --experimental-strip-types --test tests/*.test.mjs`: 876 von 876 bestanden, 0 fehlgeschlagen (die Projektregel verlangt den vollen Lauf, nicht nur `npm test` mit 774).

### Browser-Tests (Stand)
- `tests/open-issues-browser.mjs`: auf den In-Seite-Dialog umgestellt (Entfernen und Wiederherstellen klicken „Bestätigen“ im Dialog, statt den nativen Dialog anzunehmen). Lint sauber. **Nicht ausgeführt:** das Skript braucht eine eigene Fixture auf Port 8898, die es im Projekt nicht gibt (kein npm-Script). Ein Lauf würde dort Testdaten anlegen und löschen.
- `tests/character-management-browser.mjs`: nimmt Dialoge an, betrifft aber keine Orte-Flows. Nicht ausgeführt, nicht geändert.
- Die Fixture hätte den SQL-Platzhalter-Fehler von vorhin gefunden: Ohne Behebung antwortet der Kontext mit 503, und die erste Prüfung schlägt fehl. Das ist aus dem Code abgeleitet, nicht durch Rückbau getestet.

### Prüfgrenzen Etappe 4b (Stand nach der Fixture)
- Umschalten über die Regie-Oberfläche (Klick) ist nur über die Demo belegt, nicht durch einen Browsertest. Die Route selbst ist im Integrationslauf geprüft.
- Die Regie-Verdrahtung mit der Demo-Szene „Rückkehr nach Kleve“ wurde nicht durch einen Klick gegen Testdaten geprüft. Es nutzt dieselbe Route wie die Werkstatt, die dort geprüft ist. Ein eigener Test wäre der nächste Schritt; er braucht einen laufenden Spielabend (Testfixture `--ultio-pager`).
- Die Demo wurde nicht geschaltet, damit keine Testdaten geändert werden.

## Textfeld: kürzere Werkzeugleiste (`app/spielbereich/modules/rich-text.tsx`)
- Die Leiste zeigt jetzt nur noch Rückgängig, Wiederholen, Absatzformat, Fett, Kursiv, Liste und „Mehr Formatierung“.
- „Mehr Formatierung“ öffnet eine zweite Zeile: Unterstrichen, Durchgestrichen, Ausrichtung, Nummerierte Liste, Trennlinie, Tabelle, aufklappbarer Abschnitt, Hinweiskasten, Farben, Format löschen.
- Die Tabellenzeile (Zeile, Spalte, Kopfzeile) erscheint nur, wenn der Cursor in einer Tabelle steht.
- Gilt für Textfelder ohne eigene Vorbereitungswerkzeuge (zum Beispiel Orte). Die Vorbereitungsfelder behalten ihr bisheriges Verhalten.
- Speicherformat, Schaltflächen „HTML-Quelltext“ und „Weitere Formatierung“ unverändert.
- Prüfungen: ESLint und `tsc` ohne Befund; Unit-Glob 876 von 876; Demo-Ansicht per Screenshot (nur lesen).

## Offen
- Zustände visuell ausbauen (Wiki): dynamische, auffällige Darstellung für offen, verändert, geschlossen, zerstört, mit Effekt (zum Beispiel Feuer bei „Zerstört“). Noch nicht gebaut.
- Schieber „Ort“ am Spieltisch als Flyer-Ansicht: Bild, Eindruck, Einordnung, bekannte Atmosphäre; Verweis auf das Wiki. Noch nicht gebaut.
- Umschalten aus der Regie im Integrationslauf prüfen (braucht laufenden Spielabend).
- SL-Bereich für Spieler öffnen (Server-Änderung, eigene Freigabe).
- Freischalten je Textfeld (Schemaänderung, eigene Freigabe).
- Freischalten je Textfeld (zum Beispiel nur die Atmosphäre) bräuchte ein neues Schema und eine eigene Freigabe.
- Die Werkzeugleiste des Editors ist recht groß.
- Die Speicherleiste unten liegt im Reiter „Für Spieler“ über der Liste; dort wird nichts gespeichert.
- Die große Komponente (~60 KB) sollte später aufgeteilt werden.

## Etappe 1 der Ort-Neuordnung (Oberfläche)
- **Reiter „Ort beschreiben“** (nur Hauptort): Ortsbeschreibung und Atmosphäre sind aus „Grunddaten“ herausgelöst. Grunddaten behalten Name, Untertitel, Stadtteil, freigegebene Adresse und Kurze Beschreibung.
- **„Eintrag anlegen“** erklärt jede Ebene in einem Satz: Hauptort (eigene Karte), Bereich (Teil des Ortes), Raum (im Bereich). Die Erkenntnis steht nicht mehr in diesem Menü.
- **Erkenntnisse im Baum:** nach den Orten, unter der Überschrift „Erkenntnisse“, mit eigenem Knopf „Neue Erkenntnis“.
- Daten, Speicherlogik und Freigabe bleiben unverändert. Keine Migration.
- Prüfungen: ESLint und `tsc` ohne Befund; `tests/location-creation.test.mjs` 6 von 6; Unit-Glob 876 von 876. Demo-Ansicht per Screenshot, nur lesen, keine Schreibzugriffe.
- Offen für Etappe 2 und 3: Erkenntnis-Modell mit Freischaltbedingung (Meilenstein), Auslöser in der Regie, Kachel am Tisch. Diese ändern Daten und brauchen deine Freigabe.

## Deploy (nicht durchgeführt)
- Der Live-Stand braucht deine ausdrückliche Freigabe. Der Branch `claude/storyboard-2-phase-1` liegt 89 Commits vor `main`, 111 Dateien sind uncommittet. Keine Migration im Arbeitsbaum.

## Etappe 2 und 3: Erkenntnis mit Meilenstein
- **Modell (Etappe 2):** Eine Erkenntnis trägt optional `unlockMilestone` in den Knotenattributen. Gleicher Name = gleiche Freischaltung. Kein Schema, keine Migration.
- **Editor:** Im Eintrag einer Erkenntnis steht „Freischaltung durch Meilenstein“ mit Vorschlägen aus den erreichten Meilensteinen. Speichern ist sofort wirksam und versionsgeschützt (`/api/cms/location-unlock`).
- **Auslösen (Etappe 3, Regie):** Block „Meilensteine“ im Bereich „Szene führen“. Der Name wird mit einer Bestätigung in der Seite erreicht. Das lässt sich nicht rückgängig machen; das steht in der Bestätigung.
- **Wirkung:** Gebundene, nicht geheime und nicht gesperrte Erkenntnisse werden der Gruppe bekannt (Stufe „Bekannt“). Ein zweites Erreichen desselben Namens ändert nichts.
- **Am Tisch:** Auf der Weltkarte stehen die erspielten Meilensteine als Kacheln mit Name, Datum und Anzahl der Erkenntnisse. Spieler sehen nie die Begründung des SL und nie den Auslösenden.
- **Server:** `server/location-milestones.ts`, Routen `/api/cms/location-unlock` und `/api/locations/milestone` (GET für aktive Mitglieder, POST nur SL). Reine Regeln in `domain/location-milestones.ts`.
- **Prüfungen:**
  - Unit: `tests/location-milestones.test.mjs` 4 von 4; Unit-Glob 880 von 880.
  - Integration: `tests/milestone-integration.mjs` 13 Prüfungen, Gesamtlauf 2535 bestanden. Geprüft: Binden nur für SL, veralteter Stand 409, Spieler kennen die Erkenntnis vorher nicht, nach dem Erreichen ja, zweites Erreichen ohne Wirkung, Spieler sehen nur Name, Zeit und Anzahl.
  - Demo: Editor-Feld und Regie-Block angesehen, nur lesend.
- **Prüfgrenzen:**
  - Die Kacheln am Tisch sind nicht visuell geprüft. Die Demo hat keinen erreichten Meilenstein, und ich habe die Demodaten nicht verändert.
  - Gesperrte Erkenntnisse zeigen Spielern noch keinen Hinweis „Öffnet sich mit …“. Das braucht eine Änderung an der Spielerprojektion und ist nicht gebaut.
  - Erreichen lässt sich nicht zurücknehmen. Ein Rückbau bräuchte eine eigene Entscheidung.
- **Deploy:** nicht durchgeführt. Erst nach Abschluss des heutigen Stands und deiner ausdrücklichen Freigabe.

### Nachtrag Etappe 2 und 3 (Prüfung des Beraters)
- Die Überschrift „Erkenntnisse“ mit dem Knopf „Neue Erkenntnis“ erscheint jetzt auch dann, wenn keine Erkenntnis im Baum sichtbar ist (neuer Ort, Suche, eingeklappter Ort).
- Ein Meilenstein gewährt bei jedem Erreichen alle gebundenen Erkenntnisse, die der Gruppe noch unbekannt sind. Das gilt auch für Erkenntnisse, die nach dem ersten Erreichen gebunden wurden. Die Ereigniszeile entsteht nur einmal je Name.
- Die SL sieht im Regie-Block die gebundenen, noch nicht erreichten Namen mit Anzahl als Vorschläge. Die Bestätigung nennt die Anzahl, auch 0 bei einem Tippfehler.
- Ein Text, den die SL freigegeben hat, ohne Entdeckung, erscheint nach dem Meilenstein den Spielern. Die Integrationsprüfung deckt diesen Weg ab.
- Fehler im Baum behoben: Der Meilenstein der Erkenntnis wurde nicht angezeigt, weil die Route den Text der Attribute nicht auswertete. Die Integrationsprüfung hat das gefunden.
- Integration 2547 bestanden; Unit-Glob 880 von 880; ESLint und `tsc` ohne Befund.
- `tests/location-milestones.test.mjs` ist in `npm test` eingetragen.
- Offen: Spieler sehen gesperrte Erkenntnisse noch nicht als Hinweis „Öffnet sich mit …“. Die Kacheln am Tisch sind visuell nicht geprüft.
