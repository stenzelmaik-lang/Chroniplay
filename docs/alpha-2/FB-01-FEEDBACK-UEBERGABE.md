# FB-01 In-App-Feedback (2.5, Issue #5): Übergabe

- **Branch:** `claude/2.5-feedback`, Basis `main` @ `f921656`
- **Stand:** gebaut und lokal geprüft, **nicht deployt**. Für den Deploy braucht es eine **Migration auf Produktion** (siehe unten), nur mit Freigabe des Eigentümers.

## Was es tut
- Im Profil gibt es den neuen Abschnitt **„Feedback & Fehler melden“** (`/profil#feedback`). Oben im Profil steht ein Link dorthin.
- Arten: Fehler, Verbesserungsidee, Allgemeines Feedback. Bereiche mit Markierung der Alpha-kritischen Fälle: Anmeldung, Verlust von Charakter oder Inventar, falsche Freigabe oder Geheimnis, Karte und Orte, Veröffentlichen als SL.
- Bei Fehlern gibt es zusätzlich Felder für Nachstellen, Erwartet und Passiert.
- Kontext nur mit **ausdrücklichem Häkchen:**
  - App-Version
  - Seite: nur der Pfad, ohne Parameter und ohne fremde Hosts
  - Gerätetyp: grob, nur Gerät und Browser, ohne Versionsnummern
- Die meldende Person sieht ihre **eigenen** Meldungen mit Status (Eingegangen, In Prüfung, Erledigt, Nicht umgesetzt) und der Antwort der SL.
- **SL bzw. Eigentümer (Betreiber)** sieht unter „Eingegangene Meldungen“ alle Meldungen der Kampagne und kann Status, Schweregrad, interne Notiz und Antwort pflegen. Die interne Notiz und der Schweregrad bleiben für die meldende Person unsichtbar.
- Es gibt **keine automatische Weiterleitung** an GitHub oder Discord. Kann das Senden nicht gelingen, erscheint ein Kontakthinweis, aber nie eine falsche Erfolgsmeldung.

## Sicherheit und Datenschutz
- Die meldende Person kommt immer aus der Sitzung, nie aus der Anfrage. Unbekannte Felder werden abgelehnt (striktes Schema).
- `sameOrigin` bei POST und PATCH, Eingaben höchstens 20 KB, Begrenzung auf **5 Meldungen pro Person und Stunde**.
- Gesperrte Mitglieder und andere Kampagnen können nicht melden. Andere Spieler sehen fremde Meldungen nicht.
- Änderungen der SL mit Versionsprüfung (409 bei veraltetem Stand).
- Noch **kein Screenshot-Upload**. Laut Issue braucht er eine Vorschau und eine strikt private Ablage, das folgt in einem eigenen Schritt.

## Dateien
- `db/schema.ts`: Tabelle `feedback_reports`, dazu **Migration `drizzle/0019_alpha25_feedback_reports.sql`**. Sie legt nur eine neue Tabelle mit zwei Indizes an und ändert nichts Bestehendes.
- `domain/feedback.ts`: Arten, Bereiche, Status, Grenzen, Bereinigung von Seite und Browser.
- `server/feedback.ts`, `app/api/feedback/route.ts`: GET (eigene), GET `?alle=1` (Betreiber), POST, PATCH.
- `app/profil/feedback-ui.tsx`, eingebunden in `app/profil/account-ui.tsx`.
- Tests: `tests/feedback.test.mjs` (in `pnpm test`), `tests/feedback-integration.mjs` (in `tests/integration.mjs`).

## Deploy (nur mit Freigabe)
1. Migration auf Produktion: `npx wrangler d1 migrations apply chronik-von-kleve-db --remote`. Das betrifft nur `0019`. Vorher mit `wrangler d1 migrations list chronik-von-kleve-db --remote` prüfen, dass nur `0019` offen ist.
2. Danach den Worker wie gewohnt deployen und den Release-Nachweis schreiben.
3. Rücknahme: Den Code zurückzunehmen reicht. Die leere Tabelle stört nicht.

## Prüfungen
Siehe PR: typecheck, Lint, `pnpm test`, alle Unit-Tests, Integration mit dem Block „FEEDBACK“.

## Offen und später
- Optionaler Screenshot.
- „Melden“-Knopf direkt auf Spiel-, Orts- und Charakterseiten (Issue #5 nennt ihn optional).
- Betreiberrolle außerhalb der SL, sobald es mehrere Kampagnen gibt.
