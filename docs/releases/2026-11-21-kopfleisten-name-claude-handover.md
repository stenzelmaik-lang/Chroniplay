# Kopfleisten-Name: Konto oder Charakter – Übergabe (Claude Code, 21.11.2026)

## Auftrag
Wunsch der SL: „Spieler möchte wählen können, wie er oben genannt wird: realer oder Ingame-Charakter(name).“

## Stand
- Branch: `claude/kopfleisten-name`, Basis `be5fefa` (main mit Live-Tag `381c080-Galerie-Spielpause`).
- **Nicht gepusht, kein Deploy, keine Produktionsänderung, keine Migration.**

## Wo „oben“ der Name steht
Kontomenü rechts in der Kopfleiste der Zuflucht und der Spielwelt (`app/spielbereich/modules/shell.tsx`). Bisher stand dort nur der Anfangsbuchstabe, der volle Name (`actor().name` = Anzeigename des Kontos oder Mitgliedsname) erschien erst im aufgeklappten Menü.

## Änderungen
- **Einstellung** `preferences.headerName` (`'account'` | `'character'`, Standard `'account'`) im vorhandenen JSON `auth_profiles.preferences`. Gespeichert wird sie über die bestehende Profilroute `PATCH /api/profile` (striktes Zod-Schema in `domain/account-access.ts` erweitert). `GET /api/profile` liefert sie mit. **Keine Schemaänderung, keine neue Migration.**
- **Neue Route** `GET /api/profile/header-name` (`server/header-name.ts`): liefert `{mode, name, accountName, characterName}` nur für das eigene Konto. Als Charakter gilt der in der Zuflucht gespeicherte aktive Charakter der Kampagne (`activeCharacters`, gleiche Prüfung wie `server/character-selection.ts`: eigener, nicht archivierter Charakter, nicht `GM_SECRET`). Ist keiner gewählt, wird nur ein einziger aktiver eigener Charakter verwendet, wie bei der Zuflucht-Übersicht. Sonst bleibt der Kontoname. Konten ohne aktive Freigabe erhalten immer den Kontonamen.
- **Kopfleiste:** Ab 701 px Breite steht der gewählte Name jetzt neben dem Anfangsbuchstaben (max. 180 px, danach Auslassungszeichen). Darunter zeigt er nur den Anfangsbuchstaben. Im Menü steht der gewählte Name. Im Charaktermodus steht darunter klein „Konto: …“. Wechselt der Spieler in der Zuflucht den aktiven Charakter, aktualisiert sich der Name sofort (Fensterereignis `chroniplay:header-name`).
- **Profil** (`app/profil/account-ui.tsx`, Bereich „Konto & Anzeige“): Auswahl „Oben in der Kopfleiste zeigen“ mit „Meinen Namen (…)“ / „Meinen Charakter (…)“ und einem Hinweis, falls noch kein Charakter gewählt ist.
- **Ausdrücklich unverändert:** `actor().name`, Rechte, Projektionen, Empfängerlisten, Whiteboard-Namen, Würfelprotokolle, SL-Ansichten (`sl-workspace-shell.tsx`) und die Kontoverwaltung. Sie nutzen weiter die echte Kontoidentität.

## Prüfungen (beobachtet)
- `pnpm run typecheck`: Exit 0.
- ESLint auf allen geänderten und neuen Dateien: Exit 0, ohne Befund.
- `pnpm run build`: Exit 0.
- Alle Unit-Tests `node --experimental-strip-types --test tests/*.test.mjs`: **716/716 bestanden**, darunter neu `tests/header-name.test.mjs` (2 Tests, auch in `pnpm test` aufgenommen).
- Integration `scripts/test-local.mjs` mit neuem Modul `tests/header-name-integration.mjs` (Spieler A/B, SL, nicht angemeldet, Konto ohne Freigabe, andere Kampagne, fremde Charakter-ID in den Einstellungen, ungültiger Modus, Neuladen): **18/18 neue Prüfungen bestanden**. Gesamtlauf `pnpm run test:integration:run` nach `pnpm run build`: Exit 0, 2349 PASS, kein Fehlschlag (Role-Foundation-Teil 46 PASS). Die im Log sichtbaren `CVK request failed`-Zeilen gehören zu absichtlich ausgelösten Negativtests.
- Browserprüfung `tests/header-name-browser.mjs` gegen eine isolierte lokale `--command-center`-Instanz (Port 8879, Edge headless über Playwright): **12/12 PASS**. Spieler A bei 1440 und 375 px: Standard Kontoname, Auswahl speichern, nach Neuladen erhalten, Kopfleiste zeigt Charakter, Rückwechsel. Spieler B und SL behalten ihren Namen und sehen den Charakter von A nicht. Nicht angemeldet: `/profil` leitet auf `/anmelden`, die Route antwortet 401. Keine Seitenfehler, kein waagerechtes Scrollen.
- Sichtprüfung der Screenshots (Kopfleiste 1440/375, Profilauswahl 375).

Ausführen:
```
$env:CVK_TEST_PORT='8879'; node --experimental-strip-types scripts/test-local.mjs --command-center
$env:CVK_TEST_URL='http://127.0.0.1:8879'; node tests/header-name-browser.mjs
```

## Prüfdaten
Nur synthetische lokale Konten (`command-a/b/gm@example.invalid`, Prüfkonten der Integration) in temporären D1-/R2-Beständen unter `%TEMP%\cvk-phase-c-tests-*`. Die von dieser Sitzung angelegten Bestände wurden nach der Prüfung gelöscht. Produktion wurde nicht berührt.

## Prüfgrenzen und offene Punkte
- Keine Prüfung auf echtem Mobilgerät. 375 px nur im Browserfenster nachgestellt.
- Ab 701 px steht der Name jetzt bei **allen** Konten sichtbar in der Kopfleiste, auch bei der SL (vorher nur der Buchstabe). Das macht die Wahl sichtbar. Falls das unerwünscht ist, lässt sich `.accountLabel` ausblenden.
- Spieltisch (`spieltisch/stage.tsx`) und Command Center haben eigene Kopfzeilen und wurden nicht angepasst.
- Für Konten mit mehreren Kampagnen gilt der Charakter der aktuellen Kampagne (derzeit nur Kleve).
