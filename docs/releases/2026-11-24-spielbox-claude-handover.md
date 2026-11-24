# Spielbox auf der Startseite: Rubikwürfel ohne Anmeldung (Übergabe Claude Code)

Stand: 24.11.2026. Branch `claude/spielbox`, Basis `claude/spielpause-wuerfel` bei `2bb2653` (Würfel-Überarbeitung, lokal, nicht gepusht). Eigener Worktree `.claude/worktrees/spielbox`. **Kein Commit, kein Push, kein Deployment, keine Migration.**

## Mit dem Besitzer abgestimmt

- Startseite und Spielpause sind **dasselbe Repo**. Die Spielbox nutzt **dieselben Würfel-Dateien** wie die Spielpause (`app/spielbereich/modules/spieltisch/spielpause/…`), keine Kopie. Eine Würfel-Verbesserung gilt damit für beide.
- Nächstes Spiel nach dem Würfel: **Vier gewinnt**. Danach Mau-Mau und Schiffe versenken (Reihenfolge noch offen).
- Ohne Anmeldung bleiben Ergebnisse nur im Browser (localStorage).

## Änderungen

- `app/spielbox/page.tsx` (neu): öffentliche Seite `/spielbox`, kein Login, kein Serverzugriff, eigene Kopfzeile „Zur Startseite“ und die gemeinsame Fußzeile.
- `app/spielbox/spielbox.tsx` (neu, Client): Spielauswahl als Karten (Rubikwürfel spielbar, Vier gewinnt „Kommt als Nächstes“, Mau-Mau und Schiffe versenken „Geplant“), Spielfläche mit dem Würfel, Hinweis „Nur in diesem Browser“ und Knopf zum Löschen der gespeicherten Würfel-Ergebnisse.
- `app/spielbox/local-results.js` (neu, rein): Bestenliste im Browser. Schlüssel `chroniplay:spielbox:ergebnisse:<spiel>`, nur gültige Einträge (ganze ms bis 24 h, ganze Züge), beste 10, defekter oder gesperrter Speicher ergibt eine leere Liste. `localResultService(spiel)` liefert `{loadResults, saveResult}` in genau der Form, die `toys-runtime.js` erwartet.
- `app/spielbox/katalog.js` (neu): Spieleliste mit Stand. Hier wird Vier gewinnt später auf `spielbar` gesetzt.
- `app/spielbox/spielbox.module.css` (neu): Stil wie die Startseite. Auf der Spielfläche rücken Rundenleiste, Bestenliste und Menü an den Rand, weil hier kein Spieltisch-HUD Platz braucht (über Attribut-Selektoren, die Würfel-CSS bleibt unverändert).
- **Gemeinsame Datei, kleine Änderung:** `spielpause.tsx` exportiert jetzt `ToyTable` und nimmt ein optionales `services` an (Standard bleibt der Server-Dienst der Spielpause). Sonst nichts an den Würfel-Dateien geändert. Bitte beim Zusammenführen mit „Mitspieler zum Zuschauen einladen“ beachten (baut auf demselben Branch).
- `app/visitor/visitor-shell.tsx`: Menüpunkt „Spielbox“ → `/spielbox` (Desktop und mobil).
- `tests/spielbox.test.mjs` (neu, 12 Tests), in `package.json` → `test` eingetragen. Neue Dateien in die ESLint-Liste von `.github/workflows/ci.yml` aufgenommen.

## Prüfungen (beobachtet)

- `node --experimental-strip-types --test tests/*.test.mjs`: **787/787 bestanden** (775 vorher + 12 neue).
- `tests/spielbox.test.mjs`: leerer/kaputter/gesperrter Speicher, Sortierung Zeit vor Zügen, nur beste 10, ungültige Ergebnisse abgelehnt, Spiele getrennt löschbar, Dienst-Form passt zur Würfel-Laufzeit, gleiche Würfel-Logik (Mischung + Umkehrung = gelöst), Katalog, Seite ohne Login/`fetch`/`/api/`, Link auf der Startseite.
- `tsc --noEmit` ohne Fehler, ESLint der neuen und geänderten Dateien ohne Befund.
- `node scripts/run-framework.mjs build` (= `pnpm run build`): **Build complete**, Exit 0, Route `/spielbox` im Build enthalten.
- Im eingebauten Browser gegen `vinext dev` (Port 5187, nicht angemeldet, Startseite zeigt „Anmelden“):
  - `/spielbox` lädt, vier Karten, Würfel startet mit Auftritt, Rundenleiste erscheint.
  - Ganze Runde: „Neue Runde“ mischt, die 22 Mischzüge über die Menüknöpfe zurückgedreht (28 Klicks) → Status „Gelöst“, Uhr steht (12,19), Gelöst-Fenster mit „Neue Bestzeit“, Eintrag in localStorage und in der Bestenliste.
  - Nach Neuladen steht die Zeit weiter in der Bestenliste. Löschen-Knopf entfernt sie (Speicher danach leer).
  - Schließen (×) führt zur Auswahl zurück, Fokus auf „Spielen“.
  - 375 px (mobil emuliert): keine waagrechte Scrollleiste, Rundenleiste, Würfel und Menü überlappen nicht.
  - Keine Fehler in der Browser-Konsole. Startseite zeigt den Menüpunkt „Spielbox“.

## Prüfgrenzen

- Kein Test auf echtem Mobilgerät, Touch nicht geprüft (nur Mausklicks auf Knöpfe; das Ziehen am Würfel selbst ist in der Spielpause geprüft, hier nicht erneut).
- Nur Chromium (eingebauter Browser), kein Firefox/Safari.
- `node_modules` im Worktree ist eine Verknüpfung (Junction) auf `../spielpause-wuerfel/node_modules` (gleiches Lockfile), weil `pnpm` hier nicht im Pfad ist.

## Offen

- **Datenschutz:** Die Spielbox speichert Bestzeiten und Würfel-Einstellungen im localStorage des Besuchers (nichts geht an den Server). Ob die Datenschutzerklärung dazu einen Satz braucht, muss der Besitzer entscheiden. Nicht geändert.
- Reihenfolge der Zusammenführung: zuerst `claude/spielpause-wuerfel`, dann `claude/spielbox`.
- Nächstes Spiel: Vier gewinnt (zu zweit am Gerät oder gegen den Computer). Spiellogik als reine Datei wie `local-results.js`, Eintrag in `katalog.js` auf `spielbar`, Ergebnisse über `addResult('vier-gewinnt', …)`.
- Eventuell später ein Teaser-Abschnitt auf der Startseite (bisher nur der Menüpunkt).

## Ausdrücklich nicht getan

Kein Commit, kein Push, kein Deployment, keine Migration, keine Änderung an Produktionsdaten.
