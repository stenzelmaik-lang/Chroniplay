# Release 15.11.2026: Storyboard „Spielabend vorbereiten“

Freigabe des Besitzers (15.11.): „Schieb das mal Ganze bitte live.“

| | |
|---|---|
| Live-Codecommit | `97f598f` auf `claude/storyboard-kommandozentrum-323cfc`, `main` per Fast-Forward auf denselben Commit |
| Worker-Version | `9f4d25c6-acb6-4534-a0bd-583a3128f4e5`, Tag `97f598f-Storyboard` |
| Zeitpunkt | 15.11.2026 (Deploy über `wrangler deploy --config dist/server/wrangler.json`) |
| Vorversion | `497ab047-fe32-4b01-8f74-75d5dc2f3fa6` (Tag `c4418db-p1-09`), vor dem Deploy zweimal geprüft: identisch mit `origin/main` und Basis des Branches, keine fremde Version |
| Migration | keine |
| D1-Lesezeichen vor dem Deploy | `00000217-00000cde-00005124-81d7dc17d1edb8afbe169292b0bcf772` |
| Konfiguration | aus der Live-Vorversion übernommen: D1 `chronik-von-kleve-db` (`a4bc79e6-…`), R2 `chronik-von-kleve-r2`, Variablen `AJ01_JOURNAL_CAMPAIGNS`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, `CVK_ENGAGEMENT_AWARDS_ENABLED=1`, `CVK_ENGAGEMENT_ENABLED=1`, `CVK_PRIVACY_CONTACT`, `CVK_PRIVACY_CONTROLLER`, `GE01_ALPHA_CAMPAIGNS`, `limits.cpu_ms=5000`, Kompatibilität 2026-09-21 |

## Inhalt
Siehe `docs/storyboard-spielabend-vorbereiten.md` (Runde 3): Storyboard Chronik → Buch → Spielabend → Szene, Abende in Spielreihenfolge, Szenenkarten mit Inhalten/Mitwirkenden/Material, acht Szenenbereiche in voller Breite, Galerie nur unter Interaktionen, Materialliste, Optik Visionen/Botschaften. Klassische Ansicht über `?ansicht=klassisch`.

## Prüfungen
Vor dem Deploy: `tsc` grün, ESLint grün, Build grün, alle Unit-Tests 686/686, lokale Browserprüfung (1440 px und 375 px, Neuladen).
Nach dem Deploy: `/anmelden` 200, `/api/dashboard` 401, `/api/command-center/preparation` ohne Anmeldung 401; neues Bundle ausgeliefert („Spielmaterial dieser Szene“ im Workspace-Chunk); angemeldete Live-Ansicht der SL zeigt das Storyboard ohne Konsolenfehler (nur gelesen, nichts geändert).

## Hinweise
- Live gibt es noch kein Buch (Handlungsstrang); „Der Hunger bleibt“ erscheint als „Spielabend ohne Buch“. Ein bestehender Abend lässt sich derzeit nur in der klassischen Ansicht („Spielabend bearbeiten“ → Handlungsstränge verknüpfen) einem Buch zuordnen.
- Wrangler meldet: Preview-URLs sind für workers.dev aktiv, weil `preview_urls` nicht in der Konfiguration steht (wie bei früheren Deploys aus demselben Build).

## Rückweg
`wrangler rollback 497ab047-fe32-4b01-8f74-75d5dc2f3fa6 --name chronik-von-kleve`.

## Nachtrag 15.11.2026: Buch-Zuordnung und Buch „Blut ohne Erbe“

Freigabe des Besitzers: „Live + Buchtitel 1“.

| | |
|---|---|
| Live-Codecommit | `44e15be` (Abend einem Buch zuordnen), `main` per Fast-Forward auf denselben Commit |
| Worker-Version | `03a81f3c-ea0e-45d7-a9eb-5de95d4cc000`, Tag `44e15be-Buchzuordnung` |
| Vorversion | `9f4d25c6-acb6-4534-a0bd-583a3128f4e5` (Tag `97f598f-Storyboard`), vor dem Deploy geprüft |
| Migration | keine; Konfiguration wie oben |
| D1-Lesezeichen vor dem Deploy | `00000217-00000d4a-00005124-9a3a66a3e80fa162473c578301e33dbf` |

Nach dem Deploy: `/anmelden` 200, Vorbereitung ohne Anmeldung 401, neues Bundle („Buch oder Kampagne“) ausgeliefert.

**Live-Datenänderungen (freigegeben, über die Oberfläche in der angemeldeten SL-Ansicht):**
- Buch (Handlungsstrang) „Blut ohne Erbe“ angelegt: `plot-f92ce66c-cb8e-4f9f-a05f-6fc95158d0de`, Status Entwurf.
- Spielabend „Der Hunger bleibt“ (`session-61dee204-d0c8-4dda-ba41-dc6b932848c9`) diesem Buch zugeordnet (`storyIds` vorher leer). 6 Szenen, Status „Vorbereitet“ und Kurzüberblick unverändert.
- Geprüft: Buchseite „Blut ohne Erbe“ zeigt den Abend unter „Vorbereitet“, keine Konsolenfehler.

Rückweg Code: `wrangler rollback 9f4d25c6-acb6-4534-a0bd-583a3128f4e5 --name chronik-von-kleve`. Rückweg Daten: im Abendkopf „Ohne Buch“ wählen; das Buch lässt sich in der klassischen Ansicht archivieren.
