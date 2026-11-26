# Storyboard 2.0 – Überarbeitung von Phase 1 und 2

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1` · Basis `5ab984c`.
Nicht committet, nicht gepusht, nicht deployt. Keine Migration, keine neuen Abhängigkeiten, keine neuen API-Routen.

## Anlass

Der Besitzer hat gefragt, ob Phase 1 und 2 seinen Anforderungen genügen. Er will, dass Claude Logik und Verbesserungen selbstständig einbaut und weiterdenkt, und dass Altsysteme irgendwann verschwinden.

Die Prüfung ergab: Sie genügen noch nicht.

1. Weiterführungen gab es dreifach: als Textfeld (Phase 1), als alte Abzweigungen und als Verbindungen.
2. Die Live-Regie kannte nur die alten Abzweigungen.
3. Die klassische Ansicht blieb nötig für Archivieren, aus dem Abend Nehmen und den Termin.
4. Verzweigungen aufzubauen war mühsam.

## Was geändert wurde

**Doppelungen aufgelöst**
- Das Textfeld „Mögliche Weiterführungen“ ist entfernt. Es war nie live.
- Alte Abzweigungen (`possibilities`) lassen sich im Storyboard nicht mehr neu anlegen. Vorhandene erscheinen unter „Ältere Abzweigungen“ mit **„In Szene umwandeln“** und **„Alle umwandeln“**.
  - Jede Abzweigung wird eine Szenenidee in der Ideenablage desselben Buchs: Der Titel wird zum Szenentitel, der Text zur groben Idee (bei Überlänge vollständig in den SL-Notizen).
  - Die Szene wird als „Alternative“ mit der Ausgangsszene verbunden.
  - Eine Abzweigung verschwindet erst, wenn ihre Szene angelegt ist.
- **Live-Regie:** Im Bereich „Folgen“ (Regie und Regie-Fenster) stehen jetzt die „Möglichen Weiterführungen“ aus den Verbindungen, mit Art, Zielszene, Beschriftung und Bedingung. Alte Abzweigungen werden bis zur Umwandlung weiter angezeigt.

**Klassische Ansicht seltener nötig**
- Szene archivieren: Sie verlässt den Abend; Inhalte, Verbindungen und Spielverlauf bleiben.
- Szene aus dem Abend nehmen: Beide Verknüpfungsrichtungen werden gelöst, die Szene geht in die Ideenablage.
- Termin des Abends direkt im Kopf.
- Nicht verfügbare Verknüpfungen eines Abends lassen sich mit einem Klick bereinigen.

**Arbeitsfluss**
- **„Anlegen und verbinden“:** In „Verbindungen und Zeit“ entsteht eine Nachfolgeszene mit Titel und Typ in einem Schritt. Im Abend wird sie direkt hinter der aktuellen Szene eingereiht, sonst landet sie in der Ideenablage.
- **„Weiter laut Verbindungen“:** Eine Leiste unter der Szene springt zu den verbundenen Szenen, auch über Abende hinweg.
- **Karten** zeigen die erste Weiterführung, zum Beispiel „→ Der Umschlag +1“.
- **Handlungsnetz:**
  - Ziele außerhalb der Ansicht erscheinen als blasse Geisterknoten, damit kein Zweig im Nichts endet.
  - Im Abend dient die Abendfolge als blasse, gestrichelte Linie, solange eine Szene keine eigene Verbindung hat. So liest sich ein unverbundener Abend von links nach rechts.
  - Echte Verbindungen haben immer Vorrang.
- Ziele in der Verbindungsauswahl stehen in Spielreihenfolge.
- Verbindungen zu archivierten Szenen behalten ihren Titel mit dem Zusatz „archiviert“.
- **Buch ableiten:** Fehlt `buch` in der Adresse, ergibt sich das Buch aus dem Abend oder aus der Szene. Pfad, Ideenablage und Buchansichten sind dann trotzdem da.

**Ablöseplan:** [`storyboard-2-abloeseplan.md`](storyboard-2-abloeseplan.md) listet jedes Altsystem mit Ersatz, Stand, Zählabfrage und nächstem Schritt.

## Dateien

- `domain/storyboard-blocks.ts`: `followUps` entfernt; `possibilityAsScene` (Umwandlung)
- `domain/storyboard-views.ts`: `linkedOutside` (Geisterknoten), `nextScenes`, Abendfolge in `plotGraph` (`implicit`)
- `server/live-stage.ts`: Verbindungen mit Zieltiteln im Regie-Kontext
- `app/spielbereich/modules/spieltisch/regie-links.tsx` (neu), `regie.tsx`, `regie-window.tsx`, `types.ts`
- `app/spielbereich/modules/storyboard.tsx`, `storyboard-views.tsx`, `storyboard.module.css`
- `tests/storyboard-views.test.mjs` (jetzt 8 Tests), `tests/storyboard-blocks.test.mjs` angepasst
- `docs/storyboard-2-abloeseplan.md` (neu)

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck`, ESLint auf allen geänderten Dateien, `npm run build` | bestanden |
| `npm test` | 720 bestanden, 0 fehlgeschlagen |
| Alle Unit-Tests `tests/*.test.mjs` | 822 bestanden, 0 fehlgeschlagen |
| Browser: „Alle 2 umwandeln“ | 2 Szenen im selben Buch mit grober Idee, 2 Verbindungen „Alternative“, Altfeld leer |
| Browser: „Anlegen und verbinden“ | Nachfolger im Abend direkt nach der Ausgangsszene, verbunden, in der Weiter-Leiste |
| Browser: Netz | Geisterknoten für Ziele außerhalb des Abends; Abendfolge-Linien zwischen unverbundenen Szenen |
| Browser: Termin | `2026-12-05T19:30` gespeichert |
| Browser: aus dem Abend nehmen | Abend- und Szenenverknüpfung gelöst, Szene erhalten |
| Browser: archivieren | `archived` gesetzt, grobe Idee und eingehende Verbindung erhalten |
| Browser: Abend ohne `buch` | Pfad zeigt das Buch, Ideenablage sichtbar |

Der lokale Prüfspeicher ist danach gelöscht.

## Prüfgrenzen

- **Die Anzeige der Verbindungen in der Live-Regie habe ich nicht im Browser gesehen.** Dafür braucht es einen laufenden Live-Raum. Geprüft sind nur Typecheck, Lint und Build.
- Der Zusatz „archiviert“ in der Kartenzeile kam nach dem letzten Browserlauf hinzu; geprüft ist er nur durch Typecheck und Lint.
- `test:integration` und die Browser-Skripte habe ich nicht ausgeführt.
- Kein echtes Mobilgerät. Die neuen Bedienelemente bei 375 px habe ich in dieser Runde nicht erneut angesehen.

## Danach

Mit dieser Überarbeitung tragen Phase 1 und 2 das Prinzip „nur gute Systeme“. Als Nächstes kommt Phase 3 (Handlungsstränge, Hinweise, Konsequenzen). Sie löst laut Ablöseplan auch die „Vorbereiteten Möglichkeiten“ der Handlungsstränge ab.
