# Automatische Prüfungen (CI) auf GitHub (Stand 2.5)

Jeder PR und jeder Push auf `main` startet automatische Prüfungen. Auf der PR-Seite stehen sie als **„Workflow / Prüfung“**. Grün heißt: Diese Prüfung ist bestanden.

| Angezeigter Name | Datei | Läuft wann | Was geprüft wird | Lokal nachstellen |
|---|---|---|---|---|
| **CI · Grundprüfung / Typen, Lint, Tests, Build, Server-Integration** | `.github/workflows/project-ci.yml` | jeder PR, jeder Push auf `main` | `pnpm install --frozen-lockfile`, TypeScript, ESLint (Dateiliste), `pnpm test`, W10-Tests, Build, W10- und Projekt-Integration (lokaler Worker mit Test-Datenbank) | `pnpm run typecheck`, `pnpm test`, `pnpm run build`, `CVK_TEST_PORT=88xx pnpm run test:integration:run` |
| **CI · Grundprüfung / Würfel unter Windows** | `project-ci.yml` | jeder PR, jeder Push auf `main` | Würfel-Regression mit Windows-Pfaden | `node --experimental-strip-types --test prototypes/spieltisch-2/shared-dice.test.mjs` |
| **CI · Spielleitung (Vorbereitung) / npm-Lockfile und Lint Vorbereitung** | `.github/workflows/story-editor-checks.yml` | Push auf `main` und PRs, die Vorbereitung, Nachrichten oder Story-Dateien ändern | `npm ci` (passt `package-lock.json`?), ESLint der Vorbereitungs- und Nachrichtendateien | `npm ci --ignore-scripts`, `npx eslint <Dateien>` |
| **CI · Spielleitung (Vorbereitung) / Browser-Rundgang SL (Desktop, Handy)** | `story-editor-checks.yml` | wie oben | echter Browser (Chromium): Spielabend anlegen, Szenen, Vorschau, Neuladen, Handy, Datenschutz für Spieler, Löschen; Vorbereitungsführung | Server `node --experimental-strip-types scripts/test-local.mjs --spieltisch-release` (Port 8820), dann `CVK_TEST_URL=http://127.0.0.1:8820 node tests/story-browser-smoke.mjs` und `tests/preparation-guide-browser.mjs` (unter Windows mit `CVK_BROWSER_CHANNEL=msedge`) |
| **Entwicklertagebuch → Discord / Freigegebenen Beitrag senden** | `.github/workflows/chroniplay-discussion-discord.yml` | wenn der Eigentümer einer Discussion im Entwicklertagebuch das Label `discord-freigabe` gibt | sendet den Beitrag einmal an `#chroniplay-updates` | `python -m unittest` in `.github/chroniplay-discord` |
| **Workers Builds: chronik-von-kleve** (rot) | keine Datei, sondern die Cloudflare-Git-Anbindung | jeder Push | **keine Prüfung von uns.** Cloudflare versucht selbst zu bauen und zu veröffentlichen und scheitert. | Empfehlung: im Cloudflare-Dashboard trennen (Workers & Pages → chronik-von-kleve → Settings → Build → Disconnect). Sonst ginge jeder Merge ohne Freigabe live. |

## Regeln
- **Vor dem Merge** müssen die GitHub-Prüfungen grün sein. „Workers Builds“ zählt nicht.
- Rot bei einer Prüfung bedeutet: zuerst die Ursache klären und im PR beheben, nie den Test abschalten.
- Neue Dateien in einem gelinteten Bereich kommen in die ESLint-Liste der jeweiligen Datei.
- **Zweimal installiert** wird absichtlich: pnpm in der Grundprüfung, npm in der Spielleitung. Beide Lockfiles müssen stimmen (siehe Arbeitsregeln).

## Geschichte
- Bis 2.5.0 hießen die Workflows „Project CI and W10 checks“ und „Command Center – Story Editor checks“. Die Spielleitungs-Prüfung hat Typen, Tests, Build und Integration doppelt ausgeführt. Mit 2.5 ist sie umbenannt und die Doppelung entfernt.
- Der Browser-Rundgang war vom 12.11. bis 24.11.2026 rot, weil die Tests nach dem Storyboard-Release vom 15.11. die alte Ansicht erwarteten. Seit 2.5.0 öffnen sie die klassische Vorbereitung über `?ansicht=klassisch`.
