# Spieltisch: „Druck“, Charakterpanel und Spielerleiste ein-/ausblendbar – Übergabe Claude Code

**Stand:** 21.11.2026 · **Branch:** `claude/hud-einklappen` · **Basis:** `726e723` (main) · **nicht gepusht, nicht deployt**

## Auftrag

Wunsch der SL (mit Screenshot des Panels „Druck“): „Das und die Spielerleiste muss ein- und ausblendbar sein.“

## Umsetzung

- **Druck** (unten rechts) und das **eigene Charakterpanel** (unten links; bei Spielern ohne eigene Figur „Am Tisch“) haben je einen kleinen Reiter mit Pfeil nach unten auf der Oberkante. Ein Klick klappt das Kärtchen ein; an derselben Ecke bleibt ein dezenter Griff („Druck ⌃“ bzw. Figurname ⌃), der es wieder öffnet.
- **Spielerleiste** (Kopfleiste, `nav[aria-label="Spielerleiste"]`): am Ende ein Auge-Symbol „Spielerleiste ausblenden“. Eingeklappt steht dort ein Griff „Spielerleiste (Anzahl)“. Eine ausstehende Probe bleibt neben dem Griff als Hinweis sichtbar und öffnet weiter den eigenen Bogen. Beim Einklappen wird ein offenes Spielermenü geschlossen.
- Die drei Teile sind unabhängig. Der Zustand wird **pro Gerät** in `localStorage` gemerkt (`chroniplay:spieltisch:eingeklappt:pressure|body|roster`) und überlebt Neuladen. Sperrt der Browser den Speicher, funktioniert das Einklappen für den Besuch, Fehler werden abgefangen.
- Gilt für Spieler und SL. Die SL hat am Tisch standardmäßig kein eigenes Charakterpanel; dort gibt es daher nur Druck und Spielerleiste.
- Touch-Ziele: Griffe 44 px hoch; der Reiter ist sichtbar 44×24 px, seine Trefferfläche (`::before`) 44×44 px.
- Keine Änderung an Daten, Rechten, Routen oder Inhalten. Kein Seitenmenü.

### Nebenbefund behoben (nötig für 375 px)

Auf dem Ausgangsstand war die **SL-Kopfleiste bei 375 px überfüllt**: die Spielerleiste hatte 0 px Breite (Avatar über dem Schriftzug) und „Abend beenden“ ragte rechts aus dem Bild. Bis 600 px Breite sind Schriftzug und Kopfleisten-Knöpfe („Regie im zweiten Fenster“, „Zur Zuflucht/Übersicht“, „Abend beenden“) jetzt Symbole mit 44 px und zugänglichem Namen (`aria-label`, Text nur für Screenreader). Darüber unverändert.

## Geänderte Dateien

- `app/spielbereich/modules/spieltisch/use-collapsed.ts` (neu): Hook `useCollapsed` mit abgesichertem `localStorage`.
- `app/spielbereich/modules/spieltisch/vitals.tsx`: `HudSlot` um Charakterpanel und Druck.
- `app/spielbereich/modules/spieltisch/vitals.module.css`: Positionierung von `.hudBox` auf den neuen Rahmen `.hudSlot` verlegt (inkl. Handy-Regel und der Spielpause-Kompaktregel), Reiter `.hudFold`, Griff `.hudHandle`.
- `app/spielbereich/modules/spieltisch/participants.tsx` / `.module.css`: Ein-/Ausblenden der Spielerleiste.
- `app/spielbereich/modules/spieltisch/stage.tsx` / `.module.css`: Kopfleiste bis 600 px als Symbole.
- `tests/hud-einklappen-browser.mjs` (neu): Browserprüfung.

Die Spielpause-Auswahl bleibt über dem Charakterpanel (z-index unverändert, Gegenprobe unten).

## Ausgeführte Prüfungen (beobachtet)

- `tsc --noEmit --incremental false`: Exit 0.
- ESLint auf allen geänderten und neuen Dateien: Exit 0. Ganzes Repo (`eslint .`): 18 Fehler, 19 Warnungen, alle in fremden, unveränderten Dateien (bekannter Altbestand, u. a. `favors.tsx`, `mvp-vote-*.tsx`).
- Build (`node scripts/run-framework.mjs build`): Exit 0.
- Alle Unit-Tests `node --experimental-strip-types --test tests/*.test.mjs` (108 Dateien): **716/716 bestanden**, 0 fehlgeschlagen.
- `tests/hud-einklappen-browser.mjs` gegen isolierte lokale `--zustandswerte`-Instanz (Port 8862, synthetische Konten `command-a`, `command-gm`, Edge headless über Playwright): **17/17 PASS** – Spieler A und SL bei 1440×900 und 375×812 (Touch): einklappen, Griff liegt oben und im Bild, ≥44 px, Zustand nach Neuladen erhalten, wieder öffnen, nach Neuladen offen; Teile unabhängig; gesperrter Speicher; Server-Schnappschuss (Zustände, Besetzung) vor/nach unverändert; keine Seitenfehler.
- Gegenprobe `tests/spielpause-picker-browser.mjs` auf demselben Stand: **14/14 PASS**.
- Sichtprüfung der Bildschirmfotos (Spieler 1440 eingeklappter Druck, Spieler 375 eingeklappte Spielerleiste).
- Prüfdaten danach gelöscht: `.local-test/` und `.local-work/` im Worktree entfernt; Testcontexte waren flüchtig, die zwei Speicher-Schlüssel wurden im Test wieder entfernt.

Ausführen (PowerShell, nach Build):

```powershell
$env:CVK_TEST_PORT='8862'; node --experimental-strip-types scripts/test-local.mjs --zustandswerte
```

```powershell
$env:CVK_TEST_URL='http://127.0.0.1:8862'; node tests/hud-einklappen-browser.mjs
```

## Prüfgrenzen und offen

- Kein Test auf echtem iOS-/Android-Gerät; Querformat-Handy nicht eigens geprüft.
- Bei sehr vielen Spielern läuft die Spielerleiste auf 375 px weiterhin über (unverändertes Verhalten); der Ausblend-Knopf sitzt am Ende der Leiste.
- `node_modules` war für die Prüfungen per Verzeichnisverknüpfung aus einem Nachbar-Worktree mit identischem `pnpm-lock.yaml` geliehen und ist wieder entfernt.

## Ausdrücklich nicht getan

Kein Push, kein Merge auf `main`, kein Deployment, keine Migration, keine Produktionsdaten.
