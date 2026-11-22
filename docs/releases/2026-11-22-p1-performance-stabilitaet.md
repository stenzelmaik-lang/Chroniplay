# Release 22.11.2026: P1 Szenen-Stabilität und Inhaltsgrenzen

Freigabe des Besitzers (22.11.): „push, pr und live bringen“.

| | |
|---|---|
| Live-Codecommit | `30aa26b` (Branch `claude/p1-performance-stabilitaet`, Basis `077a167`); dieser Nachweis folgt als reiner Doku-Commit |
| `main` | **nicht** aktualisiert: Der Pull Request ist offen. Bis zum Merge muss jeder weitere Deploy diesen Branch enthalten, sonst fallen die Änderungen zurück. |
| Worker-Version | `40726ad5-4446-44bc-9fde-d413e8220bb9`, Tag `30aa26b-P1-Szenen`, 100 % Verkehr, deployt am 22.11.2026 16:06 UTC über `wrangler deploy --config dist/server/wrangler.json` |
| Vorversion | `0ad70f48-0ad9-4db1-a35d-bfe4c3c06e40` (Tag `04150e7-HUD-einklappen`), vor dem Deploy per `wrangler deployments list` geprüft |
| Migration | keine; keine Datenänderung |
| Konfiguration | aus der Vorversion übernommen (`wrangler versions view --json`): D1 `chronik-von-kleve-db` (`a4bc79e6-…`), R2 `chronik-von-kleve-r2`, sieben Variablen unverändert, `limits.cpu_ms=5000`, Kompatibilität 2026-09-21; im Probelauf `--dry-run` abgeglichen |
| D1-Lesezeichen vor dem Deploy | `00000233-00000000-0000512b-04cea1bad676e607dbf6daa2b4092919` |

Inhalt und Befunde: `docs/releases/2026-11-22-p1-performance-stabilitaet-claude-handover.md`.

Vor dem Deploy: `tsc` und ESLint der geänderten Dateien grün, Build grün. Alle Unit-Tests 726/726, `pnpm test` 615/615. Lokale Integrationssuite: Exit 0, 2.348 PASS. HTTP-Regression (Szene im Umfang von Szene 05, SL/Spieler/abgemeldet): 20/20.

Nach dem Deploy (ohne Anmeldung): `/anmelden` 200; `/api/files`, `/api/command-center/scenes` und `/api/session-scenes` ohne Anmeldung 401; `/sl/command-center` leitet um (307); die neuen Client-Bundles (`api-client-BXqaDB2B.js`, `ultio-pager-Dij-KFJv.js`) werden ausgeliefert. **Nicht geprüft:** angemeldete SL- und Spieleransicht in Produktion, Szene 05 mit echten Inhalten, Mobilgerät.

**Rückweg – wichtig:** Ein Rücksprung auf `0ad70f48` ist nur sicher, solange keine Szene die neuen Grenzen nutzt (z. B. Tabelle mit mehr als 29 Dialogzeilen, mehr als 120 Absätze). Sonst kann die alte Version diese Szene nicht lesen, und Szenenliste, Command Center und der Regie-Katalog fallen komplett aus (409). In dem Fall stattdessen einen Build von `5aad65b` deployen; der listet solche Szenen als „nicht unterstützt“ weiter.

```powershell
node node_modules/wrangler/bin/wrangler.js rollback 0ad70f48-0ad9-4db1-a35d-bfe4c3c06e40 --name chronik-von-kleve
```

Hinweis: Das Deploy-Protokoll enthält keine Meldung zu Vorschau-URLs, nur die workers.dev-Adresse. Den Zustand der Vorschau-URLs habe ich nicht gesondert geprüft (vgl. Hinweis im Runbook).
