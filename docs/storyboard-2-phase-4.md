# Storyboard 2.0 · Phase 4 – Verbindung mit der Live-Regie

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1` (gemeinsam mit Phase 1–3; Commit erst, wenn alles fertig ist) · Basis `5ab984c`.
Nicht committet, nicht gepusht, nicht deployt. **Keine Migration**, keine neuen Abhängigkeiten, **keine neue API-Route**.

Auftrag: P4 aus dem Konzept „Storyboard 2.0“. Freigegeben vom Besitzer am 25.11.2026.

## Bestandsaufnahme vorab

Die Bausteine gab es schon, nur nicht verbunden:
- **Szenendurchläufe** (`SceneRun` im Szenenstand: aktiv, pausiert, abgeschlossen; je Abend). Bisher nur von Hand im Kommandoraum gesetzt.
- **Momente** (`session_moment`) als Notizen zum gespielten Abend.
- **Szenenwechsel in der Regie** (`activateScene`). Er legte keinen Durchlauf an; der tatsächliche Verlauf ging also verloren.

Phase 4 verbindet diese Teile, statt ein drittes Protokoll zu bauen.

## Was neu ist

- **Der Tisch protokolliert.** Startet die Regie eine Szene auf dem Tisch:
  - Diese Szene bekommt einen Durchlauf für den Abend, und der Durchlauf der vorigen Szene wird abgeschlossen.
  - Kehrt die Runde zu einer schon gespielten Szene zurück, wird sie wieder geöffnet; die Kette `previousRunId` bleibt erhalten.
  - Ein zweiter Start derselben Szene legt nichts doppelt an.
  - Die Vorbereitung bleibt unberührt.
- **Momente haben Arten:** Notiz (wie bisher), Entscheidung, übersprungen.
  - „Übersprungen“ braucht eine Szene und keinen Durchlauf.
  - Alle anderen Momente zu einer Szene brauchen weiterhin einen echten Durchlauf dieses Abends.
  - Alte Momente gelten als Notiz.
- **Regie, neue Ansicht „Abendfolge“** (Alt+7):
  - geplante Szenen mit Stand (läuft, gespielt, übersprungen, nicht gespielt), dazu Starten oder Erneut, Überspringen
  - spontane Szenen werden mit „+“ angehängt
  - **„Spontane Szene“:** wird angelegt, direkt nach der laufenden Szene eingereiht und gestartet
  - **„Festhalten“:** Entscheidung oder Notiz zur laufenden Szene; eine Entscheidung kann zugleich als Faden „Entscheidung“ in einem Handlungsstrang landen
  - Vorgemerktes aus Handlungssträngen für die laufende Szene lässt sich direkt abhaken, etwa Konsequenz → eingetreten
  - eine Liste „Heute festgehalten“
- **Storyboard:**
  - **„In der Regie spielen“** im Kopf des Abends öffnet die Regie im eigenen Fenster.
  - Karten zeigen „Läuft“, „Gespielt“ oder „Übersprungen“.
  - **„Gespielt an diesem Abend“:** Plan und tatsächlicher Verlauf nebeneinander, mit Uhrzeit, mehrfachen Aufrufen, „spontan“ und „früher als geplant“, dazu alles Festgehaltene.
  - **Ungespielte Szenen verschieben:** an das Ende eines späteren Abends oder in die Ideenablage, mit Bestätigung. Erst wird der Zielabend gespeichert, dann der Ausgangsabend, damit nichts verloren geht. Die Vorbereitung bleibt.

## Was es dafür nicht gebraucht hat

Hinweise, NSCs, Visionen und Materialien direkt bereitstellen kann die Regie bereits. Neu ist, dass Fäden aus Handlungssträngen dort erscheinen (Phase 3) und jetzt auch abgehakt werden können.

## Daten und Sicherheit

- Durchläufe laufen über den bestehenden Befehl `executeScene` (activate, complete, reopen) mit Compare-and-set und Verlaufseintrag. Die Buchführung blockiert den Tisch nie: Scheitert sie, steht eine Warnung im Server-Log, und der Szenenwechsel bleibt gültig.
- Momente laufen über die bestehende Route `/api/command-center/moments`; das Schema hat nur ein optionales Feld `kind` dazubekommen.
- Alles bleibt nur für die SL sichtbar. Spieler lesen weder Momente noch Szenendurchläufe; das ist im Integrationstest geprüft.

## Ablöseplan

Die zwei Wege, eine Szene „laufen“ zu lassen, sind jetzt zusammengeführt: Der Tischstart erzeugt den Durchlauf. Das ältere Szenen-Panel im Kommandoraum (`story-scene-manager.tsx`, Durchläufe von Hand) wird dadurch für den Spielabend überflüssig. Es bleibt bis zur Abnahme stehen und steht als Kandidat im [Ablöseplan](storyboard-2-abloeseplan.md).

## Dateien

- `server/scene-play.ts` (neu): `recordSceneRun`
- `server/live-stage.ts`: Aufruf nach `activateScene`
- `domain/command-workspace.ts` (Momentarten), `server/command-workspace.ts` (`kind` beim Lesen), `app/api/command-center/moments/route.ts` (übersprungen ohne Durchlauf)
- `domain/play-log.ts` (neu): Plan und Verlauf, Verschieben
- `domain/regie-studio.ts`, `app/spielbereich/modules/spieltisch/regie-studio.tsx`: Ansicht „Abendfolge“
- `app/spielbereich/modules/spieltisch/regie-evening.tsx` und `.module.css` (neu), `regie-window.tsx`
- `app/spielbereich/modules/storyboard-play.tsx` (neu), `storyboard.tsx`, `storyboard.module.css`
- `tests/play-log.test.mjs` (neu, 4 Tests, in `npm test`)
- `tests/scene-play-integration.mjs` (neu, 9 Prüfungen gegen einen gestarteten lokalen Abend; `npm run test:scene-play`)

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck`, ESLint auf allen geänderten Dateien, `npm run build` | bestanden |
| `npm run test:scene-play` gegen die Demo (Abend live gestartet) | **9 von 9**: Durchlauf beim Start, Abschluss beim Wechsel, Wiederaufnahme mit Verlauf, kein doppelter Durchlauf, übersprungen ohne Durchlauf, Entscheidung zur laufenden Szene, Entscheidung ohne Durchlauf abgelehnt, Spieler ohne Zugriff, Regie-Kontext mit Verbindungen und Vorgemerktem |
| Browser Storyboard | Abzeichen Läuft, Gespielt, Übersprungen; „Gespielt an diesem Abend“ mit Plan, Verlauf (2× aufgerufen) und Entscheidung; ungespielte Szene in die Ideenablage verschoben (Abend danach mit 3 Szenen, Szene in der Ideenablage) |
| Browser Regie | Ansicht 7 „Abendfolge“ mit richtigen Ständen; „Spontane Szene“ angelegt, nach der laufenden Szene eingereiht und gestartet (vorige Szene abgeschlossen); „Festhalten“ als Entscheidung gespeichert, mit Strang-Auswahl zusätzlich als Faden „getroffen“ samt Szene im Handlungsstrang |
| `npm test` | 730 bestanden, 0 fehlgeschlagen |
| Alle Unit-Tests `tests/*.test.mjs` | 832 bestanden, 0 fehlgeschlagen |
| `npm run test:integration:run` (vollständig, isolierte Test-D1) | **2417 Prüfungen bestanden** (inkl. aller bisherigen Moment-Prüfungen); Rollenbasis 46 bestanden |

Die lokale Demo, die beiden Testverzeichnisse dieses Integrationslaufs und die Protokolldatei sind gelöscht.

## Prüfgrenzen

- Eine kleine CSS-Korrektur (Symbol neben „Festhalten zu …“ in einer Zeile) kam nach dem letzten Browserlauf; nicht mehr im Browser angesehen.
- Die Abendfolge in der Regie habe ich nur am Desktop angesehen, nicht bei 375 px. Die Regie ist ein Zweitbildschirm für die SL.
- Kein echtes Mobilgerät.
