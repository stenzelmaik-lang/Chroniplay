# Spielpause: Rubikwürfel – Steuerung, Stoppuhr, Konfetti, Bestenliste (Übergabe Claude Code)

Stand: 24.11.2026. Branch `claude/spielpause-wuerfel`, Basis `origin/main` bei `73c214b`. Eigener Worktree `.claude/worktrees/spielpause-wuerfel`. **Kein Commit, kein Push, kein Deployment, keine Migration auf Produktion.**

## Mit dem Besitzer abgestimmt

- Drehungen: Maus + Knöpfe + Tastatur. Standard ist Maussteuerung. Das untere Menü ist standardmäßig ausgeblendet und wie die Bestenliste ein- und ausblendbar.
- Tastatur ist optional (Schalter im Menü, standardmäßig aus), Gamer-Belegung: W oben, S unten, A links, D rechts, Q vorne, E hinten. Umschalt = gegen den Uhrzeigersinn. Strg = Mittelebene: Strg+A = M, Strg+D = M′, Strg+S = E, Strg+E = S′ (Strg+Umschalt jeweils umgekehrt). Strg+Z = rückgängig, Pfeiltasten = Ansicht. **Strg+W und Strg+Q kann eine Webseite nicht nutzen** (Browser schließt Tab bzw. beendet sich), deshalb liegen die Mittelebenen auf A/D/S/E.
- Stoppuhr und Bestenliste sind vom Steuermenü gelöst: schwebende Rundenleiste oben (Zeit, Züge, Status, Neue Runde, Bestenliste, Menü, Wegräumen), Bestenliste als eigenes Feld rechts.
- Bestenliste auf ChroniPlay gespeichert, sichtbar nur für den Spieler selbst. „Andere zum Zuschauen einladen“ ist gewünscht, aber **noch nicht gebaut** (siehe offene Punkte).

## Änderungen

- `spielpause/cube-moves.js` (neu, rein): Schreibweise der 12 Grunddrehungen U U′ D D′ L L′ R R′ F F′ B B′ plus M/E/S, `parseMove`/`formatMove`, `invertMove`/`invertSequence`, `scramble`, `SolveTimer`, `formatTime`, Gestenregeln `chooseSwipe`/`releaseQuarter`, Ranglistenvergleich. Undo, Mischen und Prüfung nutzen dieselbe Definition.
- `toys-core.js`: `swipeCandidates` liefert beide drehbaren Ebenen eines Stickers samt Bildschirmrichtung. Bestehende Würfelphysik unverändert (die Drehrichtungen wurden per Test bestätigt, nicht geändert).
- `toys-runtime.js`: Maus: erst ab 12 Einheiten Weg, Richtung muss eindeutig dominieren (Diagonale dreht nichts), Drehung folgt dem Finger, Einrasten erst ab ~38 % einer Vierteldrehung oder bei klarem Schwung → keine versehentlichen Drehungen. Modus „Ziehen: Ansicht“ als Alternative. Jede neue Runde mischt einen gelösten Würfel (Mischfolge steht in `data-scramble`). Stoppuhr startet mit dem ersten eigenen Zug, stoppt beim Lösen; Rückgängig zählt als Zug. Bei Lösung: Gelöst-Fenster, Konfetti (nicht bei reduzierter Bewegung), Speichern über Rückruf des Aufrufers. Einstellungen (Ziehmodus, Tastatur, Menü offen) pro Spieler im Browser.
- `confetti.js` (neu): kurzer Konfetti-Effekt auf eigener Zeichenfläche, ohne Abhängigkeiten.
- `spielpause.tsx` / `.module.css`: neue Rundenleiste, Bestenlistenfeld, ausblendbares Menü mit 12 Drehknöpfen (Farbstreifen der Seite) und einklappbaren Mittelebenen, Gelöst-Fenster. Unter 1100 px rückt die Leiste unter Tisch-Kontext/Bühnenhinweis, unter 700 px zweizeilig.
- Server: `domain/spielpause.ts` (Prüfregeln, 1,5 s bis 24 h, ganze Millisekunden, keine fremden Felder, 60 Einträge/Stunde), `server/spielpause.ts` (jede Abfrage an `campaign_id` + `member_id` des angemeldeten Mitglieds gebunden), `app/api/spielpause/route.ts` (GET eigene Top 10, POST mit Same-Origin-Prüfung).
- `db/schema.ts` + `drizzle/0020_spielpause_results.sql`: neue Tabelle `spielpause_results` (über `pnpm run db:generate` erzeugt, danach nur umbenannt). Keine Verbindung zu Charakteren, EP oder Tischzustand.
- `package.json`: neue Tests in `test` und `test:spielpause`. `.github/workflows/ci.yml`: neue Dateien in die ESLint-Liste.
- `tests/spielpause-browser.mjs`: auf neue Bedienung angepasst und erweitert (Menü standardmäßig aus, Tastatur aus/an, WASD/QE, Strg-Mittelebenen, Strg+Z, 12 Knöpfe je mit Rückgängig, ganze Runde bis Gelöst mit gestoppter Uhr und Bestenliste).

## Prüfungen (beobachtet)

- `node --experimental-strip-types --test tests/*.test.mjs`: **775/775 bestanden**. `pnpm test`: **664/664 bestanden**.
- Neue Logiktests `tests/spielpause-cube-moves.test.mjs`: jede der 12 Drehungen + Gegenzug = Ausgangszustand; X′ = X³, X2 = X X; 25 Mischungen + umgekehrte invertierte Zugliste = gelöst; schrittweises Rückgängig = gelöst; Stoppuhr, Zeitformat, Gestenregeln, Rangfolge. `tests/spielpause-results.test.mjs`: Prüfregeln und dass Server-Abfragen nur eigene Zeilen lesen.
- `pnpm run typecheck` ohne Fehler; ESLint der geänderten Dateien ohne Befund.
- `tests/spielpause-browser.mjs` gegen den isolierten lokalen Server (`test-local.mjs --zustandswerte`, Port 8848, synthetische Konten, Edge headless, Playwright aus der Codex-Laufzeit): **alle 14 Prüfgruppen bestanden**, inkl. 320/390/768/1024/1440 px, emuliertem Touch und „keine Browserfehler“.
- API lokal mit synthetischen Konten: A und B sehen nur eigene Zeiten; zu schnelle Zeit 400, fremde `memberId` 400, fremder Origin 403, ohne Anmeldung 401.
- Offline-Vorschau `node scripts/build-spielpause-preview.mjs` im eingebauten Browser angesehen (dort meldet die Bestenliste ehrlich „nicht erreichbar“, weil kein Server da ist).

## Prüfgrenzen

- Kein Test auf echtem Mobilgerät, Touch nur emuliert. Kein Test in Firefox/Safari.
- Migration nur lokal angewendet. Für Produktion braucht es die gesonderte Freigabe des Besitzers (Migration 0020 vor dem Deployment).
- Beim allerersten Öffnen in der Vorschau blieb der Fallauftritt einmal kurz vor dem Ende stehen, solange das Vorschaufenster im Hintergrund war; danach nicht mehr reproduzierbar. Vermutlich gedrosselte Animationsbilder im verdeckten Fenster, nicht weiter untersucht.

## Offen

- „Zum Zuschauen einladen“: ein anderer Spieler darf live mitschauen. Braucht eine Freigabe-/Einladungslogik und Live-Übertragung des Würfelzustands; nicht Teil dieses Stands.
- Spielbox auf der Startseite mit freiem Zugang und weiteren Minispielen (Mau-Mau, Vier gewinnt, Schiffe versenken): eigener Auftrag, betrifft `chronik-von-kleve-startseite`.
