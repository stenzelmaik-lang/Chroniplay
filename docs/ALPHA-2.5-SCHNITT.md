# Schnitt für Alpha 2.5 (Stand 24.11.2026)

Ziel des Eigentümers: einen sauberen Schnitt machen, damit Alpha 2.5 ohne Altlasten und ohne Fehler beginnt.

## Was dieser Schnitt enthält (PR aus `claude/stabilisieren`)
| Bereich | Inhalt |
|---|---|
| CI | Der Browser-Journey-Job ist wieder grün. Er war seit dem 12.11. rot, weil die Tests nach dem Storyboard-Release die alte Ansicht erwarteten. |
| Sicherheit | Header für alle Antworten: HSTS, nosniff, Frame-Schutz, Referrer- und Permissions-Policy (`middleware.ts`) |
| Voice | Aufgeräumt (`/simplify`): gemeinsamer Freigabe-Helfer, weniger toter Code. Sprechen rendert nur noch das betroffene Profilbild neu. |
| Lint | Die App-Module sind fehlerfrei: Gefallen, MVP-Abstimmung, EP-Vergabe. |
| Handy | Footer-Links haben eine Tippfläche von 44 px. |
| Doku | Release-Nachweise (Google-Verifizierung, Voice, GE-02) sind zusammengeführt. Dazu kommen `docs/STABILISIERUNG-2026-11-24.md` und `docs/ARCHIV-BRANCHES-2026-11-24.md`. |
| GitHub | 83 vollständig zusammengeführte Branches sind gelöscht. Jeder Tip-Commit ist im Archiv dokumentiert und wiederherstellbar. |

## Ausgangslage danach
- **Live:** Worker `3273d466`, Code `dfc1d07`. Der Schnitt wird erst nach Merge und Freigabe deployed. Danach gilt der neue Live-Stand als Basis für Alpha 2.5.
- **Schalter in Produktion:**
  - `AUTH_ACCESS_ENVIRONMENT=closed-alpha-production`
  - `GE01_ALPHA_CAMPAIGNS`, `AJ01_JOURNAL_CAMPAIGNS` (ohne Wirkung)
  - `CVK_ENGAGEMENT_*`, `CVK_PRIVACY_*`, `CVK_IMPRESSUM_*`
  - `CVK_VOICE_CAMPAIGNS=chronik-von-kleve` und `CF_REALTIME_*` (Geheimnisse)
- **Tests:** `pnpm test`, alle Unit-Tests und die Integration laufen grün, ebenso beide Browser-Journeys.

## Noch offen: Entscheidungen des Eigentümers
| Thema | Empfehlung |
|---|---|
| Entwurfs-PRs #79 bis #82 (Alpha 2.0) | Schließen, denn der Inhalt ist schon in `main` (die Branches waren zusammengeführt). |
| PR #78 `chatgpt/alpha2-ep-abrechnung-ui` (22 Commits) | Von ChatGPT prüfen lassen. Vermutlich durch #79 überholt, dann schließen. |
| PR #46 `claude/erzaehlung-ux` | Schließen, denn er ist in `main` enthalten. |
| PR #70 `claude/ge02-release-nachweis` | Schließen, denn der Inhalt ist mit diesem Schnitt übernommen. |
| `claude/chroniplay-abenteuerjournal-23ec22` | Archivieren oder löschen, weil das Journal entfernt wurde. |
| `codex/privacy-hide-residential-address-20261123` | Löschen, weil er durch #95 (`b2524ef`) erledigt ist. |
| „Workers Builds“ (Cloudflare-Git-Anbindung) | Abschalten. Sonst ginge jeder Merge ohne Freigabe live, sobald der Build gelingt. |
| Große Bilder (13 MB auf der NPC-Seite) | Als erster Alpha-2.5-Auftrag Vorschaubilder beim Hochladen erzeugen. |
| Prototyp `prototypes/spieltisch-2` (12 Lint-Fehler) | Archivieren oder aus dem Lint nehmen, weil er nicht live ist. |
| Git-Tag `alpha-2.5-basis` | Nach dem Deploy des Schnitts setzen. Das geschieht nur auf ausdrücklichen Auftrag. |

## Arbeitsregeln ab Alpha 2.5
1. **Ein Auftrag, ein Branch, ein PR.** Mit „Squash and merge“ bleibt die Historie von `main` lesbar. Nach dem Merge wird der Branch gelöscht (GitHub-Einstellung „Automatically delete head branches“).
2. **Lokale Tests mit eigenem Port**, damit Codex und Claude gleichzeitig arbeiten können: `CVK_TEST_PORT=88xx`.
3. **Vor jedem Deploy** muss der Live-Commit ein Vorfahre von `main` sein (`git merge-base --is-ancestor`). Es gibt einen Release-Nachweis in `docs/releases/`, und das Deployment kommt nur mit ausdrücklicher Freigabe.
4. **Grün vor Merge:** typecheck, Lint der geänderten Dateien, `pnpm test`, alle `tests/*.test.mjs` und bei Serveränderungen die Integration.
5. Keine Testartefakte ins Repo. `/artifacts/` steht in `.gitignore`.
