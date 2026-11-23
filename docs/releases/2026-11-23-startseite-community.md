# Release 23.11.2026: Startseite mit Community-Bereich (Discord, GitHub) und P1 in main

Freigabe des Besitzers (23.11.): „Ja, live bringen“, nach Klärung: „Erst P1 in main“.

| | |
|---|---|
| Live-Codecommit | `6068899` auf `main` (Merge PR #91: P1 nach main), enthält PR #90 (Startseite, `838d7e6`) |
| Worker-Version | `ce3752c9-1c3e-42bb-834f-21f8012054ac`, Tag `6068899-Startseite-Community`, 100 % Verkehr |
| Zeitpunkt | 23.11.2026 14:45 UTC (`wrangler deploy --config dist/server/wrangler.json --name chronik-von-kleve`) |
| Vorversion | `40726ad5-4446-44bc-9fde-d413e8220bb9` (Tag `30aa26b-P1-Szenen`), vor dem Deploy dreimal per `wrangler deployments list` geprüft |
| Migration | keine |
| Konfiguration | unverändert, nach dem Deploy per `wrangler versions view --json` geprüft: D1 `chronik-von-kleve-db` (`a4bc79e6-…`), R2 `chronik-von-kleve-r2`, sieben Variablen (fünf aus dem Build, `CVK_PRIVACY_*` über `keep_vars` erhalten), `limits.cpu_ms=5000`, Kompatibilität 2026-09-21; vorab im Probelauf `--dry-run` abgeglichen |
| D1-Lesezeichen vor dem Deploy | `00000241-00000000-0000512c-906d38c5f00760b598e5a9efad5e5daf` |

## Inhalt
- Startseite: Bereich „Komm ans Lagerfeuer.“ mit Discord-Karte (dauerhafte Einladung `discord.gg/y3n5JETXv3` → Weltenrast, #am-waldrand) und GitHub-Karte (Entwicklertagebuch, Repository), Menüpunkt „Community“, Footer-Links. Übergabe: `docs/startseite-community-claude-handover.md`.
- P1 Szenen-Stabilität (`5aad65b`, `90542fe`, `30aa26b`) jetzt auch in `main`. Dieser Stand war seit 22.11. live, aber nur auf dem Branch `claude/p1-performance-stabilitaet`.

## Wichtiger Befund vor dem Deploy
Der erste Release-Versuch von `838d7e6` wurde gestoppt: Live lief `30aa26b` (P1), das nicht in `main` enthalten war. Ein Deploy von `main` hätte P1 zurückgenommen und laut Release-Protokoll vom 22.11. Szenenliste, Command Center und Regie-Katalog gefährden können. Lösung: P1 per PR #91 nach `main`, dann Deploy von `6068899`. Für künftige Releases gilt deshalb: vor dem Deploy prüfen, ob der Live-Commit Vorfahre des zu veröffentlichenden Stands ist (`git merge-base --is-ancestor <live> <neu>`).

## Prüfungen
Vor dem Deploy (Stand `6068899`, Abhängigkeiten per `pnpm@11.25.0 install --frozen-lockfile`): `tsc` grün, alle Unit-Tests `tests/*.test.mjs` (110 Dateien) 726/726, Produktions-Build (`WORKERS_CI=1`, `WORKERS_CI_BRANCH=main`) grün, GitHub „Project CI and W10 checks“ für `6068899` erfolgreich. „Command Center – Story Editor checks“ scheitert unverändert am Schritt „Run complete local SL browser journey“, wie schon vor diesem Release (bekannter Altbefund, kein Zusammenhang).
Nach dem Deploy: `/` 200 mit Community-Bereich (Discord-Einladung, Entwicklertagebuch-Link, `#community`), `/anmelden` 200, `/kampagne` 200, `/api/dashboard`, `/api/files` und `/api/command-center/preparation` ohne Anmeldung 401.
Nicht geprüft: angemeldete Live-Ansicht, echtes Mobilgerät.

## Hinweise
- `package.json` trägt noch den Starter-Namen `site-creator-vinext-starter`. Daraus entsteht der Worker-Name im Build. Deshalb wurde ausdrücklich `--name chronik-von-kleve` gesetzt. Empfehlung: den Namen in der Konfiguration fest auf `chronik-von-kleve` setzen.
- Der Abschnitt „Entwicklungsstand“ der Startseite nennt noch „Alpha Oktober 2026“ (veraltet, nicht Teil dieses Releases).

## Rückweg
`node node_modules/wrangler/bin/wrangler.js rollback 40726ad5-4446-44bc-9fde-d413e8220bb9 --name chronik-von-kleve`. Gefahrlos, weil die Vorversion denselben P1-Stand enthält. Es entfällt nur der Community-Bereich.
