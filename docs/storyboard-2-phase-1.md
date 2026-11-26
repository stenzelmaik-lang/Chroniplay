# Storyboard 2.0 · Phase 1 – Bausteine, Eigenschaften, Vorbereitungsstatus

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1` · Basis `5ab984c` (main, PR #114).
Nicht committet, nicht gepusht, nicht deployt. Keine Migration, keine neuen Abhängigkeiten, keine neuen API-Routen.

Auftrag: Phase 1 (= P1) aus dem Konzept „Storyboard 2.0“ (liegt auf dem Branch `claude/chroniplay-development-principles-a3388d` als `docs/storyboard-2-0-idee.md`). Freigegeben vom Besitzer am 25.11.2026.

## Was neu ist

- **Bausteintypen.** Jede Szene hat einen Typ:
  - Reguläre Szene, Optionale Szene, Freies Spiel
  - Entscheidungspunkt, Beratung und Auswertung, Übergang
  - Begegnung, Ereignis, Sammelpunkt, Platzhalter und kreative Notiz

  Jeder Typ zeigt nur seine Bereiche. Ein Übergang zeigt zum Beispiel nur Erzählung, Atmosphäre und SL-Notizen. **Bereiche mit Inhalt bleiben immer sichtbar.** „Weitere Bereiche (n)“ blendet alle acht ein. Bestehende Szenen gelten als „Reguläre Szene“ und sehen aus wie bisher.
- **Vorbereitungsstatus.** Die SL setzt ihn selbst: Idee, In Ausarbeitung, Prüfung erforderlich, Spielbereit oder Zurückgestellt. Ohne Wahl gilt „Automatisch“, der bisher abgeleitete Reifegrad (Idee → Idee, Entwurf → In Ausarbeitung, bereit → Spielbereit). Leere Bereiche bremsen nichts: Eine reine Gesprächsszene darf spielbereit sein. Der Status beschreibt nur die Vorbereitung. Gespielte Durchläufe bleiben getrennt im Szenenstand, wie bisher.
- **Weitere Angaben**, alle freiwillig und eingeklappt:
  - grobe Idee
  - Haupt- oder Nebenhandlung
  - Priorität
  - geschätzte Spieldauer
  - optional
  - Voraussetzungen und Auslöser

  Beteiligte und Schauplatz nutzen die vorhandenen Felder. Das Textfeld „Mögliche Weiterführungen“ ist in der Überarbeitung wieder entfallen, weil Weiterführungen jetzt Verbindungen sind (siehe [`storyboard-2-ueberarbeitung.md`](storyboard-2-ueberarbeitung.md)).
- **Karten im Abend** zeigen:
  - Status, auch „Prüfung erforderlich“ (gestreift) und „Zurückgestellt“ (gedämpft)
  - Typ, optional, Nebenhandlung, hohe Priorität und Dauer
  - die grobe Idee, solange es keinen Vorlesetext gibt

  Der Fortschrittsbalken zählt die fünf Status. Der Abend zeigt die geschätzte Spielzeit; zurückgestellte Szenen zählen nicht mit.
- **Neue Einträge** über die Ideenkarte wählen gleich ihren Typ. Die grobe Idee landet jetzt in `board.premise`, bisher stand sie als „Idee: …“ in den SL-Notizen.
- **Führung:** „Spielbereit“ gilt, wenn alle Szenen spielbereit oder zurückgestellt sind.

## Entwicklungsgrundsatz

Typen, Status und Eigenschaften sind welt- und regelwerksneutral (`domain/storyboard-blocks.ts`). Kein Vampire-Begriff liegt im Kern. Die bestehende Kopplung der vorbereiteten Probe an W10-Eigenschaften (`sceneCheckSchema`) bleibt unverändert. Sie ist ein Kandidat für ein späteres Regelprofil.

## Daten

- Neues optionales Feld `board` im Szenendokument (`gm_body`, JSON). Keine Migration.
- Unberührte Angaben werden nicht gespeichert (`compactBoard`). Eine Szene ohne Änderung bekommt kein `board`.
- Alle Speicherwege (Storyboard, klassische Ansicht, Material-Fenster) senden das geladene Dokument vollständig zurück. `board` bleibt dort erhalten; das ist am Code geprüft, nicht im Browser.
- **Rollback:** Ältere Builds lehnen unbekannte Felder strikt ab (409). Vor einem Rollback auf einen Build ohne Phase 1 gilt deshalb:
  - `scripts/storyboard2-rollback-board.mjs` ausführen. Es liest einen JSON-Export und schreibt nur SQL.
  - Alle Werte wandern als Text in die SL-Notizen, nichts geht verloren.
  - Das Skript ist idempotent und versionsgeschützt, nach dem Muster von GE-02.

## Dateien

- `domain/storyboard-blocks.ts` (neu): Typen und ihre Bereiche, Status, Schema `sceneBoardSchema`, Hilfen und Rückführ-Helfer `sceneWithoutBoard`
- `domain/story-scene.ts`: `board` im Schema und in `SceneSummary`
- `domain/scene-list.ts`: `board` in der Liste; die grobe Idee ist durchsuchbar
- `domain/storyboard.ts`: `sceneStatus`, `eveningStatusProgress`; `guideState` berücksichtigt zurückgestellte Szenen
- `app/spielbereich/modules/storyboard.tsx`, `storyboard.module.css`: Panel, Bereichsfilter, Karten, Fortschritt, Spielzeit, Typ in der Ideenkarte
- `scripts/storyboard2-rollback-board.mjs` (neu)
- `tests/storyboard-blocks.test.mjs` (neu, 8 Tests, in `npm test` aufgenommen)

## Prüfungen (beobachtet)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | bestanden |
| ESLint auf allen geänderten und neuen Dateien | bestanden |
| `npm run build` | bestanden |
| `npm test` | 712 bestanden, 0 fehlgeschlagen |
| Alle Unit-Tests `node --experimental-strip-types --test tests/*.test.mjs` | 814 bestanden, 0 fehlgeschlagen |
| Rollback-Skript mit Beispieldaten | eine Szene umgewandelt, Szene ohne `board` unberührt |
| 1440×900: Szene „Treffen im Hafen“ | Typ Übergang → 3 Bereiche plus „Weitere Bereiche (5)“; Status, grobe Idee, Nebenhandlung und 20 Min. gespeichert (Version 3, per API gelesen); nach Neuladen erhalten; „Weitere Bereiche“ zeigt alle acht |
| 1440×900: Abend | Karte zeigt Übergang, Nebenhandlung, 20 Min., grobe Idee, „Prüfung erforderlich“; Balken „1/4 spielbereit · 1 Prüfung erforderlich · 1 In Ausarbeitung · 1 Idee“; Spielzeit „20 Min. · für 1 von 4 Szenen geschätzt“ |
| Ideenkarte | Eintrag vom Typ Ereignis mit grober Idee angelegt, erscheint als Karte 05 |
| 375×812 | Abend und Szene ohne seitliches Scrollen |
| Browserkonsole | keine Fehler |

Der lokale Prüfspeicher (`.local-test/storyboard`) ist danach gelöscht.

## Prüfgrenzen

- `npm ci` statt `pnpm install`, weil auf dem Rechner kein `pnpm` im Pfad liegt. npm hat Install-Skripte (z. B. `workerd`) blockiert. Build und Demo liefen trotzdem.
- `test:integration` und die Browser-Skripte (`*-integration.mjs`, `*-browser.mjs`) habe ich nicht ausgeführt.
- Speichern in der klassischen Ansicht mit gesetztem `board` habe ich nur am Code geprüft, nicht im Browser.
- Kein echtes Mobilgerät. Auf dem Handy wird das Panel lang, wenn viele Angaben ausgefüllt sind; es öffnet sich dann von selbst.
- Die Typ-Auswahl in der Ideenkarte habe ich im Testbrowser per Skript gesetzt, weil das Werkzeug das Feld nicht direkt erreichte. Die Auswirkung (Typ gespeichert) habe ich an der Karte geprüft.

## Offen (mit der SL abzustimmen)

- Sollen die Typen und ihre Bereiche so bleiben? Die Zuordnung steht in `boardBlockTypes` und lässt sich leicht ändern.
- Soll die klassische Ansicht Typ und Status ebenfalls zeigen?
- P2 (Verbindungen, Handlungsnetz, Listen- und Zeitansicht) baut auf `board.followUps` und den vorhandenen „Möglichkeiten“ auf. Erst nach eigener Freigabe.
- Vor dem Live-Gang: Release-Nachweis und Rollback-Plan mit dem Skript oben.
