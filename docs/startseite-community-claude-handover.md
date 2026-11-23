# Übergabe: Community-Bereich auf der Startseite (Discord und GitHub)

Stand: 23.11.2026 · Claude Code

## Auftrag
Auf der öffentlichen Startseite (chroniplay.cc) ein Discord-Modul einbauen, damit Besucher auf den Discord-Server „Die Weltenrast“ kommen, und das GitHub-Projekt sichtbar machen.

## Branch und Basis
- Branch: `claude/startseite-community`, eigener Worktree `../chronik-von-kleve-startseite`
- Basis: `origin/main` @ `a86fa9ce56a58923c63f69d33b2344971c4eb39b` (Merge PR #88)
- Der Hauptcheckout (`claude/spieltisch-medien` mit ungespeicherten Dateien) wurde nicht verändert.

## Änderungen
| Datei | Änderung |
|---|---|
| `app/visitor/content.ts` | neuer Block `community`: Texte, dauerhafte Discord-Einladung, GitHub-Links |
| `app/visitor/community-logos.tsx` | neu: Discord- und GitHub-Logo als Inline-SVG (lucide-react 1.x enthält keine Markenlogos mehr) |
| `app/visitor/visitor-shell.tsx` | Menüpunkt „Community“ (`#community`), neuer Bereich vor dem FAQ, Community-Links im Footer, externe Links mit `target="_blank" rel="noopener noreferrer"` |
| `app/visitor/visitor-shell.module.css` | Stile für Bereich, Karten, Discord-Button (Blurple `#5865F2`), Footer-Links, Umbrüche bei 1050 px und 760 px |

Keine neuen Abhängigkeiten, keine Route, keine Server- oder Datenbankänderung, keine Migration.

## Links (geprüft)
- Discord: `https://discord.gg/y3n5JETXv3`. Über die öffentliche Discord-API geprüft: Server „Die Weltenrast“ (1355905395134042113), Kanal #am-waldrand, `expires_at: null` (läuft nicht ab)
- Entwicklertagebuch: `https://github.com/stenzelmaik-lang/chronik-von-kleve/discussions/categories/entwicklertagebuch` (HTTP 200)
- Repository: `https://github.com/stenzelmaik-lang/chronik-von-kleve` (HTTP 200)

## Prüfungen (beobachtet)
- `npm run typecheck`: ohne Fehler
- `npx eslint app/visitor`: ohne Fehler
- `npm test`: 605/605 bestanden
- `node --experimental-strip-types --test tests/*.test.mjs` (108 Dateien): 716/716 bestanden
- Lokaler Dev-Server (`scripts/run-framework.mjs dev`, nur lokale Platzhalter-Bindungen) mit Edge headless bei 1440×900 und 390×844: Bereich vorhanden, kein horizontales Überlaufen, Menüeintrag und Footer-Links vorhanden, alle drei Links mit korrektem Ziel und `noopener`.
- Abhängigkeiten im Worktree per `npm ci` installiert, weil pnpm auf dem Rechner nicht verfügbar war.

## Prüfgrenzen
- Kein echtes Mobilgerät, nur Emulation
- Angemeldeter Zustand der Startseite nicht geprüft (der Bereich ist unabhängig von der Anmeldung)
- Kein `pnpm run build`, kein `test:integration`

## Offene Punkte
- Der Abschnitt „Entwicklungsstand“ nennt noch „Alpha geplant für Oktober 2026“ (veraltet). Nicht geändert, die Entscheidung liegt beim Besitzer.

## Ausdrücklich nicht getan
Kein Commit (bis zur Freigabe), kein Push, kein Pull Request, kein Deployment, keine Änderung an Produktion.
