# Storyboard 2.0 · Phase 3 – Handlungsstränge, Hinweise und Konsequenzen

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1` (gemeinsam mit Phase 1, 2 und Überarbeitung; Commit erst, wenn alles fertig ist) · Basis `5ab984c`.
Nicht committet, nicht gepusht, nicht deployt. **Keine Migration**, keine neuen Abhängigkeiten. **Neue API-Route:** `/api/command-center/threads` (nur SL).

Auftrag: P3 aus dem Konzept „Storyboard 2.0“. Freigegeben vom Besitzer am 25.11.2026.

## Bestandsaufnahme vorab

- **Bücher heißen im Code „Handlungsstrang“** (Plotdossier, `emptyStory().title`). Buch und Strang waren also dasselbe. Phase 3 trennt das: Ein Handlungsstrang ist eine eigene Akte und zieht sich über mehrere Bücher und Abende.
- **Hinweis-Akten mit echtem Entdeckt-Stand gibt es schon** (Wissens-Freigaben). Phase 3 liest diesen Stand nur, statt ihn doppelt zu führen.
- **„Gefallen & Schulden“ verwaltet formale Schulden zwischen Figuren.** Versprechen im Strang sind bewusst einfache Notizen mit Verweis darauf, damit kein zweites Schuldensystem entsteht.
- **Die „Spur“ aus Phase 2 war mit „Gruppe oder Handlungsstrang“ beschriftet.** Sie ist jetzt nur noch die Spielergruppe; Handlungsstränge haben ein eigenes Feld.

## Was neu ist

- **Handlungsstränge** haben eine Art, einen Stand und eine Zusammenfassung:
  - Arten: Hauptgeschichte, Nebenhandlung, Persönliche Geschichte, Geheimnis, Konflikt, Langzeitereignis
  - Stand: Offen, Läuft, Aufgelöst, Fallen gelassen
  - Ein Strang kann zu mehreren Büchern gehören. Szenen ordnen sich in der Szene selbst zu (`board.threads`, höchstens 10).
- **Fäden in jedem Strang**, jeweils mit Stand, Szene, betroffenen Akten (Figuren, Orte, Hinweise, Handouts, Fraktionen), Frist und Notiz:

  | Art | Stände |
  |---|---|
  | Hinweis | verborgen, ausgelegt, gefunden |
  | Geheimnis | verborgen, angedeutet, gelüftet |
  | Entscheidung | getroffen |
  | Versprechen | offen, gehalten, gebrochen |
  | Konsequenz | vorgemerkt, eingetreten, verworfen |
  | Ereignis | vorbereitet, eingetreten, verworfen |

  - Ein Hinweis, der mit einer Hinweis-Akte verknüpft ist, zeigt zusätzlich den echten Entdeckt-Stand aus den Freigaben. Der eigene Stand bleibt die Planung der SL.
  - Nichts wird automatisch gelüftet oder freigegeben.
- **„Offene Fäden“** in Chronik und Buch, das Dringendste zuerst:
  1. Ereignisse und Versprechen mit Frist
  2. Vorgemerktes für die nächsten Szenen in Spielreihenfolge
  3. alles Übrige
- **In der Szene:**
  - Strang-Chips zum Zuordnen oder Lösen; einen neuen Strang kann man direkt anlegen und zuordnen.
  - „Für diese Szene vorgemerkt“ listet alle offenen Fäden aus allen Strängen. Ihr Stand lässt sich direkt hier ändern, etwa Konsequenz → eingetreten.
- **In der Live-Regie:** Unter „Folgen“ steht „Aus Handlungssträngen vorgemerkt“, mit Art, Titel, Stand, Frist, Notiz und Strang. Das ist nur für die SL sichtbar.
- **Zeitlinie:** Umschalter „Nach Spielergruppe“ oder „Nach Handlungsstrang“.
- **Altsystem abgelöst:** Die alten „Vorbereiteten Möglichkeiten“ eines Buchs (Plotdossier) werden in der Buchansicht mit einem Klick zu Szenenideen: offen → Idee, genutzt → Spielbereit, verworfen → Zurückgestellt. Erst wenn die Szenen angelegt sind, werden sie aus dem Plotdossier entfernt. Siehe [Ablöseplan](storyboard-2-abloeseplan.md).

## Entwicklungsgrundsatz

Strang-Arten, Faden-Arten und Stände sind welt-, genre- und regelwerksneutral (`domain/plot-threads.ts`). Fristen sind freier Text („bis Nacht 3“); es gibt keinen Kalender einer bestimmten Spielwelt.

## Daten und Sicherheit

- Ein Strang ist eine Akte vom Typ `NOTE`, `canon_status='GM_SECRET'`, `visibility='sl'`, `documentKind='plot_thread'`. Damit braucht es keine Migration. Den Typ `storyline` habe ich bewusst nicht genutzt, weil die EP-Vergabe ihn als Quelle liest.
- Jede Änderung ist ein Compare-and-set auf die Version. Im selben Batch entsteht ein Verlaufseintrag (`command.thread.*`). Eine Wiederholung derselben Anlage liefert dieselbe Akte zurück; abweichender Inhalt ergibt 409.
- **Der Server prüft:**
  - Bücher müssen Plotdossiers sein.
  - Akten müssen existieren und vom passenden Typ sein; reine Wiederherstellungsdaten werden abgelehnt.
  - Szenen müssen Szenen der Kampagne sein.
  - Der Stand muss zur Art des Fadens passen.
  - Eine Szene kann sich nur existierenden Strängen zuordnen.
  - Schon gespeicherte Verweise auf später verschwundene Ziele bleiben stehen.
- Alles läuft über `gmOnly`. Spielerrouten lesen keine Stränge; das prüft der Integrationstest auf den Spielerszenen.
- Der Rückführ-Helfer und das Rollback-Skript übernehmen `board.threads` als Text in die SL-Notizen. Die Strang-Akten selbst stören ältere Builds nicht, weil sie nur über die neue Route gelesen werden.

## Dateien

- `domain/plot-threads.ts` (neu): Schema, Faden-Arten, offene Fäden, Fäden je Szene, Entdeckt-Stand, Umwandlung der Buch-Möglichkeiten
- `server/plot-threads.ts` (neu), `app/api/command-center/threads/route.ts` (neu)
- `domain/storyboard-blocks.ts` (`board.threads`), `domain/storyboard-views.ts` (Zeitlinie mit wählbarer Zeile)
- `server/story-scenes.ts` (Prüfung der Strang-Zuordnung), `server/live-stage.ts` (Vorgemerktes in der Regie)
- `app/spielbereich/modules/storyboard-threads.tsx` (neu), `storyboard.tsx`, `storyboard-views.tsx`, `storyboard.module.css`
- `app/spielbereich/modules/spieltisch/regie-links.tsx`, `types.ts`, `regie.tsx`, `regie-window.tsx`
- `tests/plot-threads.test.mjs` (neu, 6 Tests, in `npm test`)
- `tests/plot-threads-integration.mjs` (neu, 36 Prüfungen, in `tests/integration.mjs` eingehängt; deckt auch die Verbindungsprüfung aus Phase 2 ab)

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck`, ESLint auf allen geänderten Dateien, `npm run build` | bestanden |
| `npm test` | 726 bestanden, 0 fehlgeschlagen |
| Alle Unit-Tests `tests/*.test.mjs` | 828 bestanden, 0 fehlgeschlagen |
| `npm run test:integration:run` (vollständig, isolierte Test-D1) | **2417 Prüfungen bestanden**, darunter alle 36 neuen; Rollenbasis 46 bestanden |
| Integration: Rollen | Anonym, Spieler A/B, Editor, gesperrte und ausstehende SL, fremde Kampagne, nur Plattform → Lesen und Schreiben abgelehnt |
| Integration: Regeln | Idempotente Anlage, genau ein Gewinner bei gleichzeitigem Speichern, Fremd-Origin abgelehnt, unbekanntes Buch/Szene/Strang abgelehnt, falscher Akten-Typ und falscher Stand abgelehnt, nichts in Spielerszenen |
| Browser: Strang anlegen und füllen | Titel, Buch, Konsequenz mit Szene, Ereignis mit Frist, Hinweis mit Hinweis-Akte; ein Autospeichern (Version 2) |
| Browser: Entdeckt-Stand | verknüpfter Hinweis „Laut Freigaben noch nicht entdeckt“ |
| Browser: Chronik | Strang-Karte; offene Fäden in der Reihenfolge Frist → Szene → Rest |
| Browser: Szene | „Für diese Szene vorgemerkt“ sichtbar; Strang zugeordnet; Konsequenz auf „eingetreten“ gesetzt und danach nicht mehr offen |
| Browser: Buch-Möglichkeiten | 2 umgewandelt (offen → Idee mit grober Idee, verworfen → Zurückgestellt), Plotdossier danach leer, Szenen in der Ideenablage |
| Browser: Zeitlinie | Zeilen „Ohne Handlungsstrang“ und der Teststrang |
| 375×812 | Strang-Seite ohne seitliches Scrollen |

Die lokale Demo (`.local-test/storyboard`) und die vier Testverzeichnisse meiner Integrationsläufe sind gelöscht. Ältere `cvk-phase-c-tests-*`-Verzeichnisse im Temp-Ordner stammen nicht aus dieser Sitzung und sind unberührt.

## Prüfgrenzen

- **Die Anzeige in der Live-Regie habe ich nicht im Browser gesehen.** Dafür braucht es einen laufenden Live-Raum. Geprüft sind Typecheck, Lint und Build; die Daten kommen aus derselben Funktion wie in der Szene (`strandsForScene`), und die ist getestet.
- Nach dem letzten Build kam eine Kleinigkeit hinzu: Nach dem Speichern wird der Entdeckt-Stand neu verknüpfter Hinweise nachgeladen. Geprüft nur durch Typecheck und Lint; nach Neuladen der Seite war der Stand im Browser korrekt.
- Kein echtes Mobilgerät.

## Offen (mit der SL abzustimmen)

- Reichen die sechs Strang-Arten und sechs Faden-Arten?
- Sollen die Plotdossier-Abschnitte „Hinweise“, „Wissen & Geheimnisse“ und „Mögliche Folgen“ als Notiz bleiben? Siehe Ablöseplan.
- **Phase 4 (Live-Regie)** liegt nahe: Szenen aus dem Storyboard starten, Spielverlauf dokumentieren, Entscheidungen direkt als Faden festhalten, „eingetreten“ aus der Regie heraus setzen. Die Regie zeigt Vorgemerktes schon an, ändert es aber noch nicht.
