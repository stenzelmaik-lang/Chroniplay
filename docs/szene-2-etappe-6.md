# Szene 2.0 · Etappe 6 – SL-Notizbuch (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Worktree `.claude/worktrees/storyboard-2-phase-1`)
- **Basis-Commit:** `5ab984c` (zusammen mit Phase 1–4 und Etappe 1–5, alles uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Konzept:** `docs/szene-2-konzept.md`, Abschnitte 7.12 und „Notizsystem“

## Was sich ändert

**Kein zweites Notizbuch.** SL-Notizen sind Seiten des **eigenen Notizbuchs der SL** (bestehendes Notizbuch: `records` der Art `notizen`, privat). Neu im Seiteninhalt:
- `slKind`: *Notiz*, *Idee*, *Offene Frage*, *Versprechen* (gespeichert nur, wenn nicht „Notiz“)
- `slRefs`: Bezüge zu Szenen, NSCs, Orten und Spielabenden (gespeichert nur, wenn vorhanden)

Die Seiten erscheinen weiter im normalen Notizbuch der SL; das Notizbuch behält beim Speichern alle übrigen Felder, also auch die Bezüge.

**Route** `/api/command-center/notes` (nur SL): Liste gefiltert nach Szene, NSC, Ort oder Spielabend; Anlegen, Bearbeiten (CAS über die Version), Löschen. Neue Bezüge müssen existieren und passen (Szene, NSC-Akte, Ort, Spielabend); bereits gespeicherte bleiben, wenn ihr Ziel später verschwindet. Seiten einer Figur werden nicht gelöscht (dafür bleibt das Archivieren im Notizbuch).

**Bereich „Notizen“ der Szene:** schnelle Notiz mit Art und optionalen Bezügen zu Beteiligten, Schauplätzen und dem aktuellen Spielabend; offene Fragen und Versprechen stehen oben. Darunter **„Am Tisch festgehalten“**: die Momente dieser Szene aus dem Spielverlauf (Notiz, Entscheidung, Ereignis mit Zustand) – nur lesend. Darunter der alte Freitext „SL-Notizen“. Die Bereichsliste zählt die Notizen mit.

## Eine Quelle je Wahrheit

„Festhalten“ in der Regie (Phase 4) schreibt weiterhin einen Moment in den Spielverlauf. Der Notizen-Bereich zeigt diese Momente an, statt sie zu kopieren. So steht ein Ereignis am Tisch genau einmal fest, und die Vorbereitung wird vom Spielverlauf nie überschrieben.

## Verträglichkeit

- Keine Änderung am Szenendokument, keine Migration. Ältere Builds lesen die Seiten als normale Notizbuchseiten (die zusätzlichen Felder bleiben unberührt).
- Spieler: ihre Notizbuch-Route listet nur eigene Seiten; die Integration prüft ausdrücklich, dass SL-Notizen dort nicht erscheinen.
- Versprechen verweisen bewusst noch **nicht** auf Gefallen & Schulden (geschütztes System).

## Dateien

- `domain/sl-notes.ts` (neu), `app/api/command-center/notes/route.ts` (neu)
- `app/spielbereich/modules/storyboard-notes.tsx` (neu), `storyboard.tsx`, `storyboard.module.css`
- `tests/sl-notes.test.mjs` (neu, 3 Tests, in `npm test`), `tests/plot-threads-integration.mjs` (NOTES, 18 Prüfungen)

## Prüfungen (beobachtet)

- `npm test`: 765 bestanden, 0 fehlgeschlagen. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration: **2489 integration checks passed**, darunter alle NOTES-Prüfungen (Rollen, Bezüge, Filter, CAS, Löschen, SL-Notizbuch enthält die Seite, Spieler sehen sie nie).
- **Keine Klickprüfung im Browser** – auf Wunsch des Besitzers („ohne Klicktest weiter“, 26.11.).

## Prüfgrenzen

- Oberfläche nicht im Browser angesehen (siehe oben).
- Notizen zu einer Figur oder einem Ort über alle Szenen hinweg kann die Route filtern; eine eigene Ansicht dafür (etwa in der NSC-Akte) gibt es noch nicht.
- Kein echtes Mobilgerät; volles `npm run lint` nicht gelaufen.

## Offen (je eigene Freigabe)

Etappe 7 Test (Spieltisch-Vorschau, Regie-Probelauf, Klickprüfungen der Etappen 5 und 6) · Fäden → Erkenntnisse · Regelprofil je Kampagne · Notizen in NSC-/Ortsakten anzeigen · Design-Prototyp · neue Regie · Ablösung der Altsysteme.
