# Storyboard 2.0 · Phase 2 – Dynamisches Handlungsnetz

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1` (gemeinsam mit Phase 1, Wunsch des Besitzers: erst committen, wenn alles fertig ist) · Basis `5ab984c`.
Nicht committet, nicht gepusht, nicht deployt. Keine Migration, keine neuen Abhängigkeiten, keine neuen API-Routen.

Auftrag: P2 aus dem Konzept „Storyboard 2.0“. Freigegeben vom Besitzer am 25.11.2026. Phase 1 steht in [`storyboard-2-phase-1.md`](storyboard-2-phase-1.md).

## Was neu ist

- **Verbindungen zwischen Szenen.** Unter „Verbindungen und Zeit“ in der Szene:
  - Ziel, Art (Weiter, Alternative, Optionaler Zweig, Rückkehr), Beschriftung und Bedingung
  - mehrere Nachfolger je Szene, höchstens 20
  - eine Zusammenführung entsteht, wenn mehrere Szenen auf dieselbe zeigen; sie wird im Netz markiert
  - „Hierher führen“ zeigt eingehende Verbindungen
  - Ziele kommen aus diesem Abend, diesem Buch oder weiteren Szenen, in Spielreihenfolge
  - Verbindungen dienen nur der Orientierung, nichts wird erzwungen oder gesperrt
- **Zeit und Spur.** Pro Szene gibt es einen Zeitpunkt in der Spielwelt (Text), eine Zeitfolge (Zahl; gleiche Zahl heißt gleichzeitig) und eine Spur (Gruppe oder Handlungsstrang; leer heißt ganze Runde).
- **Vier Ansichten auf dieselben Daten**, im Abend und im Buch (dort heißt „Karten“ „Spielabende“). Die Wahl steht in der Adresse (`sicht=`).
  1. **Karten:** wie bisher.
  2. **Handlungsnetz:** Spalten folgen den Verbindungen.
     - Zusammenführungen stehen hinter dem längsten Weg.
     - Rückkehr und Kreise werden als Bogen gezeichnet, ohne Endlosschleife.
     - Linienart je Verbindungsart, mit Legende.
     - Verbindungen zu Szenen außerhalb der Ansicht werden gezählt.
     - Ein Klick öffnet die Szene.
  3. **Liste:** Schnellbearbeitung von Typ, Status, Priorität, Dauer und Spur. Jede Änderung speichert sofort und lädt dafür vorher den aktuellen Stand der Szene; Texte und Verbindungen bleiben unberührt. Auf dem Handy wird jede Zeile zur Karte.
  4. **Zeitlinie:** Zeilen sind Spuren, Spalten die Zeitfolge. Parallele Szenen stehen in derselben Spalte, Szenen ohne Zeitfolge hinten.
- **Gleichzeitige Handlungen mehrerer Spielergruppen** werden über Spuren und Zeitlinie sichtbar.
- **Rückkehr zu besuchten Orten** und **optionale Ermittlungszweige** sind eigene Verbindungsarten.

## Entwicklungsgrundsatz

Verbindungsarten, Spuren und Zeit sind neutral: Die Zeit ist ein freier Text plus eine Zahl, es gibt keinen Kalender einer bestimmten Spielwelt. Das Layout (`domain/storyboard-views.ts`) kennt keine Kampagne.

## Daten und Sicherheit

- Alles liegt im optionalen `board` der Szene (`links`, `timeLabel`, `timeOrder`, `lane`). Keine Migration.
- Der Server prüft beim Speichern:
  - Eine Szene kann nicht mit sich selbst verbunden werden (400).
  - Jedes neue Ziel muss eine Szene dieser Kampagne sein (400).
  - Eine schon gespeicherte Verbindung zu einer später verschwundenen Szene bleibt erhalten und erscheint als „Szene nicht verfügbar“.
- Alles bleibt SL-only, wie das Szenendokument (`gmOnly`). Spieler sehen nichts davon.
- Der Rückführ-Helfer und das Rollback-Skript aus Phase 1 schreiben jetzt auch Verbindungen (als Liste), Zeit und Spur verlustfrei in die SL-Notizen.

## Dateien

- `domain/storyboard-blocks.ts`: `boardLinkSchema`, Verbindungsarten, `links`, `timeLabel`, `timeOrder`, `lane`; Rückführung erweitert
- `domain/storyboard-views.ts` (neu): `plotGraph` (Schichten-Layout, Kreiserkennung) und `plotTimeline`
- `server/story-scenes.ts`: Prüfung der Verbindungsziele
- `app/spielbereich/modules/storyboard-views.tsx` (neu): Umschalter, Netz, Liste, Zeitlinie, Bereich „Verbindungen und Zeit“
- `app/spielbereich/modules/storyboard.tsx`, `storyboard.module.css`: Einbindung im Abend, im Buch und in der Szene; Schnellbearbeitung
- `tests/storyboard-views.test.mjs` (neu, 5 Tests, in `npm test`)

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | bestanden |
| ESLint auf allen geänderten und neuen Dateien | bestanden |
| `npm run build` | bestanden |
| `npm test` | 717 bestanden, 0 fehlgeschlagen |
| Alle Unit-Tests `tests/*.test.mjs` | 819 bestanden, 0 fehlgeschlagen |
| Verbindung über die Oberfläche | angelegt, beschriftet, gespeichert (per API gelesen) |
| Serverregeln (per API im Browser) | Selbstverbindung → 400; unbekanntes Ziel → 400; gültige Verbindungen → 200 |
| 1440×900: Netz im Abend | Abzweigung, Zusammenführung markiert, Rückkehr als Bogen, Beschriftungen, Spur und Zeit in den Knoten |
| 1440×900: Netz im Buch | 7 Szenen über zwei Abende und die Ideenablage |
| 1440×900: Liste | Dauer 40 und Status „Zurückgestellt“ sofort gespeichert; Verbindungen danach unverändert (2); Fortschritt und Spielzeit aktualisiert |
| 1440×900: Zeitlinie | Spuren Gemeinsam, Gruppe A, Gruppe B; parallele Szenen in derselben Spalte |
| 375×812 | Liste als Karten, Netz und Zeitlinie nur innerhalb ihres Kastens verschiebbar, Verbindungen bedienbar; die Seite selbst scrollt nirgends seitlich |
| Browserkonsole | nur erwartete Meldungen: Verbindungsabbrüche beim Neustart der Demo und die zwei absichtlichen 400er |

Der lokale Prüfspeicher (`.local-test/storyboard`) ist danach gelöscht.

## Prüfgrenzen

- Die Serverregeln für Verbindungen sind nur im Browser gegen die lokale Demo geprüft, nicht durch einen automatischen Integrationstest. `test:integration` und die Browser-Skripte habe ich nicht ausgeführt.
- Auswahlfelder in „Verbindungen“ und in der Liste habe ich im Testbrowser teils per Skript gesetzt, weil das Werkzeug sie nicht direkt erreichte. Die Wirkung habe ich jeweils am gespeicherten Stand geprüft.
- Auf dem Handy ist das Netz eng. Für unterwegs ist die Liste die bessere Ansicht.
- Kein echtes Mobilgerät.
- Das Netz ordnet automatisch. Knoten von Hand verschieben ist nicht Teil dieser Phase.
- Beim automatischen Speichern entfernt der Server Leerzeichen am Ende von Spur und Beschriftung. Wer nach einem Leerzeichen 1,4 Sekunden pausiert, sieht es verschwinden; danach tippt man normal weiter. So verhält sich der Titel schon heute.

## Offen (mit der SL abzustimmen)

- Reichen die vier Verbindungsarten?
- Soll das Netz Knoten von Hand verschieben können? Dafür wären gespeicherte Positionen nötig.
- P3 (Handlungsstränge, Hinweise, Konsequenzen) baut auf Spuren und Verbindungen auf. Erst nach eigener Freigabe.
- Vor dem Live-Gang: Integrationstest für die Verbindungsprüfung ergänzen, Release-Nachweis, Rollback-Plan.
