# Automatische Prüfungen (CI) auf GitHub (ab 2.5)

Bei jedem PR prüfen GitHub-Rechner den neuen Code mit **erfundenen Testdaten**, bevor er in `main` kommt. Auf der PR-Seite stehen höchstens **zwei Prüfungen**. Grün heißt bestanden, rot heißt, es ist etwas kaputt, und so darf der Code nicht gemergt werden.

Datei: `.github/workflows/ci.yml`

## 1. ChroniPlay · Prüfung
Ein Linux-Rechner, die Schritte laufen nacheinander. Im Protokoll beginnt jeder Schritt mit seinem Bereich.

| Bereich | Läuft bei einem PR, wenn … | Was geprüft wird |
|---|---|---|
| **Basis** | immer | gesperrte Installation (`pnpm install --frozen-lockfile`), TypeScript, ESLint (Dateiliste), `pnpm test`, W10-Kern, C1-Proben, Tagebuch-Brücke (Python), Build |
| **Lockfile** | `package.json` oder `package-lock.json` geändert | `npm ci` in eigenem Ordner: passt `package-lock.json` zu `package.json`? |
| **Server** | Server, API, Domäne, Datenbank, Migrationen, Integrationstests oder gemeinsame Dateien geändert | W10-Integration und Projekt-Integration: lokaler Worker mit Test-Datenbank, über 2300 HTTP-Prüfungen |
| **Browser** | Oberfläche (`app/`, `components/`, `public/`), Browsertests oder gemeinsame Dateien geändert | echter Chromium: Spielabend als SL anlegen, Szenen, Vorschau, Neuladen, Handy, Datenschutz für Spieler, Löschen, Vorbereitungsführung. Bildschirmfotos werden als Anhang gesichert. |

„Gemeinsame Dateien“ sind `package.json`, `pnpm-lock.yaml`, `scripts/test-local.mjs`, `middleware.ts`, `next.config.ts`, Vite-, Wrangler- und Workflow-Datei. Wer sie ändert, löst Server und Browser aus.

## 2. ChroniPlay · Windows
Ein Windows-Rechner, nur wenn Würfel-Dateien geändert wurden (`prototypes/spieltisch-2/shared-dice*`, `dice-*`, `use-shared-dice`). Sonst steht die Prüfung als „übersprungen“ da. Sie prüft, ob die Würfel-Logik mit Windows-Pfaden funktioniert.

## Immer alles
- **Push auf `main`** (also jeder Merge) und **manueller Start** („Run workflow“) prüfen alle Bereiche. So fällt sofort auf, falls ein PR einen Bereich übersprungen hat, der doch betroffen war.
- **Reine Doku-PRs**, die nur `docs/` oder `.md`-Dateien ändern, starten keine Prüfung.

## Lokal nachstellen
| Bereich | Befehl |
|---|---|
| Basis | `pnpm run typecheck`, `pnpm test`, `pnpm run build` |
| Lockfile | `package.json` und `package-lock.json` in einen leeren Ordner kopieren, dort `npm ci --ignore-scripts` |
| Server | `CVK_TEST_PORT=88xx pnpm run test:integration:run` (eigener Port, damit Codex und Claude sich nicht stören) |
| Browser | Server: `node --experimental-strip-types scripts/test-local.mjs --spieltisch-release` (Port 8820), dann `CVK_TEST_URL=http://127.0.0.1:8820 node tests/story-browser-smoke.mjs` und `… tests/preparation-guide-browser.mjs`. Unter Windows mit `CVK_BROWSER_CHANNEL=msedge`. |
| Windows | `node --experimental-strip-types --test prototypes/spieltisch-2/shared-dice.test.mjs` |
| Tagebuch-Brücke | in `.github/chroniplay-discord`: `python -m unittest` |

## Was nicht von uns ist
**Workers Builds: chronik-von-kleve** (rot) kommt aus der Git-Anbindung von Cloudflare, nicht aus dieser Datei. Cloudflare versucht, selbst zu bauen und zu veröffentlichen, und scheitert dabei. Würde das gelingen, ginge jeder Merge ohne Freigabe live. Empfehlung: im Cloudflare-Dashboard trennen (Workers & Pages → chronik-von-kleve → Settings → Build → Disconnect).

**Entwicklertagebuch → Discord** (`.github/workflows/chroniplay-discussion-discord.yml`) ist keine Prüfung. Der Workflow sendet freigegebene Tagebuch-Beiträge an Discord.

## Regeln
- Vor dem Merge müssen die angezeigten Prüfungen grün sein. „Workers Builds“ zählt nicht.
- Bei Rot wird zuerst die Ursache geklärt und im PR behoben, nie der Test abgeschaltet.
- Neue Dateien in einem gelinteten Bereich kommen in die ESLint-Liste in `ci.yml`.
- Neuer Ordner mit eigener Logik: in der Bereichserkennung von `ci.yml` (Schritt „Geänderte Bereiche erkennen“) einem Bereich zuordnen.

## Geschichte
- Bis 2.5.0 gab es zwei Workflows mit vier Prüfungen („Project CI and W10 checks“ und „Command Center – Story Editor checks“). Typen, Tests, Build und Integration liefen doppelt, und der Windows-Würfeltest lief bei jedem PR.
- Der Browser-Rundgang war vom 12.11. bis 24.11.2026 rot, weil die Tests nach dem Storyboard-Release vom 15.11. die alte Ansicht erwarteten.
