# Command Center als Modulauswahl – Schritt 1 (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Basis `5ab984c`, mit allen bisherigen Etappen, uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Grundlage:** Wunsch des Besitzers vom 26.11. (Startseite = Modulauswahl mit Erklärung, ein Modul pro Seite, zurück zur Auswahl, erweiterbar, alles aus einem Guss), ADR `.10x/adrs/002-command-center-modulauswahl.md`.

## Was sich ändert

- **Startseite `/sl/command-center` (ohne `bereich`)** = Modulauswahl: „Was bereitest du heute vor?“, acht Kacheln mit Name und Erklärung, was man dort tut; „Weitermachen: …“ führt direkt zur zuletzt geöffneten Szene (aus dem gemerkten Storyboard-Stand, nur wenn vorhanden).
- **Im Modul** stehen die Kacheln nicht mehr über der Seite. Stattdessen eine schlanke Leiste: **„← Übersicht“** + Symbol, Name und Kurzbeschreibung des Moduls. Ungespeicherte Eingaben sperren „Übersicht“ wie bisher den Modulwechsel.
- **Ein Farbschalter für alles:** Paletten-Symbol im Kopf des Command Centers (Nacht, Mitternacht, Graphit, Bordeaux). Die Hülle trägt `data-cp-theme`; die Werkbank erbt das Modell (`:global([data-cp-theme=…]) .board`) und hat keinen eigenen Schalter mehr.
- **Stil der Hülle** wie die Werkbank: Variablen je Farbmodell, flache Karten, Ecken 4 px.
- **Unverändert:** Server-Seite, Navigation (`useNavigation`), Standardbereich für Daten, alle Deep Links mit `bereich=` (öffnen direkt das Modul), Rolle `campaign_editor` (nur Orte, ohne Übersicht).

## Dateien

- `app/spielbereich/modules/sl-workspace-shell.tsx` (Übersicht, Modulleiste, Farbschalter, Weitermachen)
- `app/spielbereich/modules/sl-workspace-shell.module.css` (Farbmodelle, Übersicht, Modulleiste)
- `app/spielbereich/modules/storyboard.tsx`, `storyboard.module.css` (eigener Farbschalter entfernt, erbt vom Center)
- `tests/story-browser-smoke.mjs` (Ablauf an die Modulauswahl angepasst: Einstieg per `?bereich=sitzung`, Wechsel über „Übersicht“ + Kachel)

## Prüfungen (beobachtet)

- `npm test`: 766/766. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration: **2489 integration checks passed**.
- Browser (Playwright/Edge, lokale Demo): Übersicht zeigt die Kacheln; im Modul **keine** Kacheln (0), Leiste „Übersicht · Orte · Schauplätze, Bereiche und Räume verwalten“; „Übersicht“ → anderes Modul funktioniert; Browser-Zurück führt zur Übersicht; Farbmodell aus dem Kopf wirkt auf Übersicht und Werkbank; Deep Link direkt in Szene 05 öffnet die Werkbank; 375 px ohne Querscrollen; keine Seitenfehler.

## Prüfgrenzen

- `tests/story-browser-smoke.mjs` angepasst, aber nicht ausgeführt (braucht eine eigene Fixture/Port); kein echtes Mobilgerät.
- Beim Aufruf der Übersicht wird kurz der Standardbereich im Hintergrund vorbereitet (Daten von „Spielabende & Szenen“), bevor die Übersicht erscheint; sichtbar ist nur die Übersicht.

## Offen

**Schritt 2:** die Module (Spieler & Charaktere, Galerie, Material, NPCs, Orte, Gefallen & Schulden – nur Optik, Rückblicke & Chronik) optisch an die Werkbank angleichen, Modul für Modul mit Freigabe.
