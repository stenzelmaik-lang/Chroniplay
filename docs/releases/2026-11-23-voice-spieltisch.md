# Release 23.11.2026: Voice am Spieltisch (nur Sprache) für Chronik von Kleve

| | |
|---|---|
| Live-Codecommit | `4f50c5f` auf `main` (Merge PR #98; enthält PR #96, #97, #98 sowie Codex' #95 `b2524ef`) |
| Vorherige Live-Version | `ac65cf45-1631-4563-b12d-5f7a96a19fd4`, Tag `a199d22-Rechtsseiten-noindex` (Vorfahre von `main` geprüft) |
| Worker-Version | `3da188b6-c2e0-4290-91df-3e761d4a36b5`, Tag `4f50c5f-Voice-Spieltisch`, 100 % Verkehr |
| Zeitpunkt | 23.11.2026, abends (MEZ) |
| Migration | keine |
| Konfiguration | wie Vorversion (D1 `a4bc79e6-…`, R2 `chronik-von-kleve-r2`, `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`, `GE01_ALPHA_CAMPAIGNS`, `AJ01_JOURNAL_CAMPAIGNS`, `CVK_ENGAGEMENT_*`, `CVK_PRIVACY_*`, `CVK_IMPRESSUM_*`, Kompatibilität 2026-09-21), **neu** `CVK_VOICE_CAMPAIGNS=chronik-von-kleve`; `CVK_VOICE_VIDEO` nicht gesetzt (nur Sprache) |
| Geheimnisse | vom Eigentümer per Skript gesetzt (Token verdeckt, vorher geprüft: aktiv, Presets vorhanden): `CF_REALTIME_ACCOUNT_ID`, `CF_REALTIME_APP_ID`, `CF_REALTIME_API_TOKEN`, `CF_REALTIME_PRESET_HOST=cp_voice_host`, `CF_REALTIME_PRESET_PARTICIPANT=cp_voice_participant` (beide Meeting-Typ „Voice“, keine Aufnahme) |

## Build und Prüfung
- `pnpm install --frozen-lockfile`, Build mit `WORKERS_CI=1 WORKERS_CI_BRANCH=main`, `wrangler versions upload` + `versions deploy` mit `--name chronik-von-kleve`.
- Vorab (Branch, siehe `docs/alpha-2/VV-01-VOICE-PROTOTYP-UEBERGABE.md`): typecheck, `pnpm test` 633/633, alle Unit-Tests 744/744, Integration 2364 PASS ohne Fehler; GitHub-CI grün („Workers Builds“ schlägt wie bei allen PRs unabhängig davon fehl).
- Live-Rauchtest: `/` 200, `/datenschutz` 200 mit Abschnitt „Sprachchat am Spieltisch“, `/api/live-voice` ohne Anmeldung 401.

## Prüfgrenzen
Noch kein echter Beitritt mit RealtimeKit getestet (braucht einen laufenden Spielabend mit angemeldeten Konten). Das ist der erste Testabend des Eigentümers.

## Rücknahme
`CVK_VOICE_CAMPAIGNS` leeren (neue Version, gleicher Code) oder Vorversion `ac65cf45-…` wieder auf 100 % setzen.

## Folge-Release 23.11.2026, 23:13 MEZ: Voice in der oberen Leiste
| | |
|---|---|
| Live-Codecommit | `dfc1d07` auf `main` (Merge PR #99) |
| Worker-Version | `3273d466-395f-4bd7-9940-ed1eba322a9d`, Tag `dfc1d07-Voice-Topbar`, 100 % Verkehr; Vorversion `3da188b6-…` |
| Migration | keine |
| Konfiguration | unverändert (inklusive `CVK_VOICE_CAMPAIGNS=chronik-von-kleve` und `CF_REALTIME_*`), Bindungen in der Version geprüft |
| Rauchtest | `/` 200, `/datenschutz` 200, `/api/live-voice` ohne Anmeldung 401 |
| Rücknahme | Vorversion `3da188b6-…` auf 100 % |
