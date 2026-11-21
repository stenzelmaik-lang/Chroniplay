# Release 21.11.2026: Galerie und Archiv nur eigene Bilder, Spielpause-Auswahl für Spieler

Freigabe des Besitzers (21.11.): „Ja, live bringen“.

| | |
|---|---|
| Live-Codecommit | `381c080` (Merge von `claude/confident-nightingale-d96d82` mit `62284d8` und `fd2a052` sowie `claude/spielpause-spieler` mit `19b9199` auf `df55055`), `main` per Fast-Forward auf denselben Commit |
| Worker-Version | `686646e6-c197-418b-80d6-bfd74d5c376e`, Tag `381c080-Galerie-Spielpause` |
| Zeitpunkt | 21.11.2026 (`wrangler deploy --config dist/server/wrangler.json`) |
| Vorversion | `b191ca45-beff-4464-95b3-5337a514f2a3` (Tag `df55055-Werkzeugfelder`), vor dem Deploy zweimal geprüft, keine fremde Version |
| Migration | keine; Konfiguration aus der Vorversion gelesen, unverändert |
| D1-Lesezeichen vor dem Deploy | `0000022a-00001a88-0000512a-3513a9d71077483eefaea25f1fa4c6bb` |

## Inhalt
- Galerie: Spieler sehen nur Bilder ihrer eigenen Charaktere, fremde Bilder auch per direkter ID 404. Die SL sieht weiter alle mit der Gruppe geteilten Bilder. Übergabe: `docs/releases/2026-11-21-galerie-nur-eigene-bilder-claude-handover.md`.
- Persönliches Archiv und Dateiauswahl: Spieler sehen nur eigene Dateien und Gruppenfreigaben der SL, keine Dateien anderer Spieler. SL-Erkennung wie in `server/access.ts` (Mitgliedschaft, sonst `GM_EMAIL`).
- Spielpause: Die Spielzeug-Auswahl liegt über dem Charakterpanel des Spielers. Übergabe: `docs/releases/2026-11-21-spielpause-auswahl-spieler-claude-handover.md`.

## Prüfungen
Vor dem Deploy: `tsc` grün, ESLint auf allen geänderten Dateien grün, alle Unit-Tests 714/714, Build grün. Die Prüfungen der beiden Fix-Sitzungen (lokal mit synthetischen Konten) stehen in deren Übergaben.
Nach dem Deploy: `/anmelden` 200; `/api/files`, `/api/character-gallery`, Vorbereitung ohne Anmeldung 401; neues Workspace-Stylesheet mit der Spielpause-Regel ausgeliefert (200). Angemeldete Live-Ansicht nicht geprüft (Anmeldung nur durch die SL), kein echtes iOS-Gerät.

## Rückweg
`wrangler rollback b191ca45-beff-4464-95b3-5337a514f2a3 --name chronik-von-kleve`.
