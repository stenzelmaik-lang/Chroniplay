# Release 21.11.2026: Konto- oder Charaktername in der Kopfleiste

Freigabe des Besitzers (21.11.): „ja, live bringen“.

| | |
|---|---|
| Live-Codecommit | `e2b4361` (Branch `claude/kopfleisten-name`, Basis `be5fefa`), `main` per Fast-Forward auf denselben Commit |
| Worker-Version | `21f225a2-b118-4cab-8524-ab95c7f60095`, Tag `e2b4361-Kopfleistenname` |
| Vorversion | `686646e6-c197-418b-80d6-bfd74d5c376e` (Tag `381c080-Galerie-Spielpause`), vor dem Deploy zweimal geprüft |
| Migration | keine (Einstellung in `auth_profiles.preferences`); Konfiguration unverändert |
| D1-Lesezeichen vor dem Deploy | `0000022a-0000241e-0000512a-04a2ef79b7ce65b580f10672bf6ec380` |

Inhalt: Im Profil wählen Spieler, ob oben ihr Kontoname oder ihr aktiver Charakter steht (neue Route `GET /api/profile/header-name`, nur eigener Name). Nur Anzeige; Rechte und SL-Ansichten nutzen weiter den Kontonamen. Übergabe: `docs/releases/2026-11-21-kopfleisten-name-claude-handover.md`.

Vor dem Deploy: `tsc`, ESLint, Build grün, alle Unit-Tests 716/716. Nach dem Deploy: `/anmelden` 200, `/api/profile/header-name` und `/api/files` ohne Anmeldung 401, neues Profil-Bundle ausgeliefert. Angemeldete Live-Ansicht nicht geprüft (Anmeldung nur durch die SL).

Rückweg: `wrangler rollback 686646e6-c197-418b-80d6-bfd74d5c376e --name chronik-von-kleve`.
