# Szene 2.0 · Etappe 5 – Regelprofil und Proben (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c` (zusammen mit Phase 1–4 und Etappe 1–4, alles uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md`, Abschnitt 9 (Technische Grundlagen für NSC-Bögen) und 12

## Was sich ändert

**Regelprofil-Register** (`domain/rule-profiles.ts`): Ein Profil beschreibt Eigenschaftsgruppen, Schwierigkeit (Bereich, Namen), mögliche Ergebnisse, die profilspezifischen Angaben einer Probe (`checkSpec`), eine lesbare Kurzform und – bei Würfelprofilen – den **Würfel-Adapter** (`pool(sheet, spec)`, `evaluate(faces, spec, difficulty)`). Dazu das Bogen-Schema nach Profil (`ruleSheetSchema`: Werte, Ressourcen, Zustände, Notizen) für spätere NSC-Bögen.

Zwei Profile:
- **V20 (W10) mit Hausregeln** – Eigenschaften und Gruppen exakt wie im Charakterbogen (Test gegen `character-engine`), Auswertung über `evaluateV20` (dieselbe Funktion wie `evaluateNormalV20` und der Live-Pfad).
- **Erzählerisch (ohne Würfel)** – Ansatz, Schwierigkeit 1–4, Ergebnisse *gelingt / gelingt mit Preis / misslingt*. Zeigt, dass der Kern regelunabhängig ist (Entwicklungsgrundsatz „Plattform vor Kampagne“).

**Proben in der Szene** (`checks`): Titel, Regelprofil, profilspezifische Angaben, Schwierigkeit, Folgen je Ergebnis, Hinweis für die SL, vorgesehene Figuren. Der Bereich „Proben“ bearbeitet sie direkt (kein zweites Fenster mehr nötig).

## Würfelergebnis unverändert (GE-02)

- Der Live-Würfelpfad (`requestCheck` → `deriveW10Preview` → Modifikator-Register) ist **nicht angefasst**. GE-02 bleibt der eine Serverpfad.
- V20-Proben werden 1:1 in die bisherigen Proben-Bausteine gespiegelt (gleiche ID, jedes Feld). Die Probenzentrale der Regie gibt also exakt das aus, was sie vorher ausgegeben hat.
- Der Adapter rechnet mit derselben Funktion; ein Test vergleicht 2000 Würfe über alle Schwierigkeiten mit `evaluateNormalV20`: identisch.

## Verträglichkeit

- **Umwandlung beim Öffnen:** strukturierte Proben-Bausteine werden zu Proben nach Regelprofil, verlustfrei (Test: die Regie sieht danach exakt denselben Baustein).
- **Ältere Freitext-Proben** (ohne festen Block) werden **nicht** automatisch umgewandelt, weil die Regie sie aus Titel und Text liest. Der Bereich bietet „Übernehmen“ an (gleiche Lesart wie die Regie; der Text bleibt als Hinweis).
- **Klassische Bearbeitung gewinnt:** Ändert das alte Material-Fenster einen Proben-Baustein, folgt die Probe; löscht es ihn, verschwindet die Probe; legt es eine neue strukturierte Probe an, wird sie übernommen.
- **Würfelfreie Proben** haben keinen Baustein; die alte Regie zeigt sie im Reiter „Folgen“ als Text (beim Lesen zusammengesetzt).
- **Server prüft:** unbekanntes Profil, unbekannte Eigenschaft, Schwierigkeit außerhalb des Profils, unbekanntes Ergebnis → 400. Interaktionskarten dürfen auf Proben beider Arten verweisen.
- **Rollback:** `sceneWithoutChecks` (im Rollback-Skript eingebunden) entfernt `checks`; V20-Proben bleiben als Bausteine, würfelfreie gehen als Text in die SL-Notizen.

## Bewusst nicht gebaut

- Eingabe von NSC-Bögen (NSC-Auftrag, separat). Hier nur Schema und Adapter.
- Standardfiguren als Vorlagen für Bögen (NSC-Auftrag).
- Regelprofil je Kampagne (heute wählt die SL das Profil je Probe; Standard V20).
- Neue Modifikatoren: weiterhin nur über das Modifikator-Register nach Regelfreigabe (Hausregel > V20 > Erschaffung).

## Dateien

- `domain/rule-profiles.ts` (neu), `domain/scene-checks.ts` (neu)
- `domain/story-scene.ts` (`sceneRuleCheckSchema`, Feld `checks`), `domain/scene-workshop.ts` (Spiegel, Umwandlung, Füllstand), `domain/scene-possibilities.ts` (Verweise, Lesesicht)
- `app/spielbereich/modules/storyboard-checks.tsx` (neu), `storyboard.tsx`, `storyboard.module.css`
- `scripts/storyboard2-rollback-board.mjs` (inkl. Export-Abfrage für `checks`)
- `tests/rule-profiles.test.mjs` (neu, 8 Tests, in `npm test`), `tests/plot-threads-integration.mjs` (CHECK)

## Prüfungen (beobachtet)

- `npm test`: 762 bestanden, 0 fehlgeschlagen. Zusätzlich **alle** 129 Testdateien in `tests/` (`node --experimental-strip-types --test tests/*.test.mjs`): 864 bestanden, 0 fehlgeschlagen.
- `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration: **2471 integration checks passed**, darunter 7 CHECK-Prüfungen und die bestehenden GE-Prüfungen.
- Browser: **keine Klickprüfung** des neuen Proben-Bereichs. Sie war blockiert, solange ein von der Seite geöffnetes Zusatzfenster offen war; der Besitzer hat entschieden, ohne Klicktest weiterzumachen (26.11.).

## Prüfgrenzen

- Ausgabe einer gespiegelten Probe in der laufenden Regie nicht von Hand geprüft; abgesichert über identische Bausteine und die bestehenden GE-02-Tests.
- Kein echtes Mobilgerät; volles `npm run lint` nicht gelaufen.

## Offen (je eigene Freigabe)

Etappe 6 SL-Notizbuch · Etappe 7 Test · Fäden → Erkenntnisse · Regelprofil je Kampagne · Design-Prototyp · neue Regie · Ablösung der Altsysteme.
