# Release 21.11.2026: Druck, Charakterpanel und Spielerleiste ein-/ausblendbar

Freigabe des Besitzers (21.11.): „ja, live bringen“.

| | |
|---|---|
| Live-Codecommit | `04150e7` (Branch `claude/hud-einklappen`, Basis `726e723`), `main` per Fast-Forward auf denselben Commit |
| Worker-Version | `0ad70f48-0ad9-4db1-a35d-bfe4c3c06e40`, Tag `04150e7-HUD-einklappen` |
| Vorversion | `21f225a2-b118-4cab-8524-ab95c7f60095` (Tag `e2b4361-Kopfleistenname`), vor dem Deploy zweimal geprüft |
| Migration | keine; Konfiguration unverändert |
| D1-Lesezeichen vor dem Deploy | `0000022a-0000340a-0000512a-2476a34d184a27b8c4d8480c43f42593` |

Inhalt: Am Spieltisch lassen sich „Druck“, das eigene Charakterpanel und die Spielerleiste einzeln einklappen; der Zustand wird pro Gerät gemerkt (localStorage, nichts an den Server). Übergabe: `docs/releases/2026-11-21-hud-einklappen-claude-handover.md`.

Vor dem Deploy: `tsc`, ESLint, Build grün, alle Unit-Tests 716/716 (Browsertest der Fix-Sitzung 17/17 laut Übergabe). Nach dem Deploy: `/anmelden` 200, `/api/files` ohne Anmeldung 401, neues Bundle mit der Einklapp-Logik ausgeliefert. Angemeldete Live-Ansicht und echtes Mobilgerät nicht geprüft.

Rückweg: `wrangler rollback 21f225a2-b118-4cab-8524-ab95c7f60095 --name chronik-von-kleve`.
