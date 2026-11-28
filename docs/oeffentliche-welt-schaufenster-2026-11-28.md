# Öffentliche Welt: Bilder für Gäste und kuratierter Einblick – Übergabe (28.11.2026)

**Branch:** `claude/public-world-images` · **Basis:** `b1c6f9c` (main, live v2.7.0 = `dc51ec5`) · **Stand:** PR offen, nicht gemergt, nicht deployt.
Vorgänger: `docs/oeffentliche-welt-2026-11-26.md` (Regel „Website ⊆ Gruppe“, Markierungen, Routen).

## 1. Bilder für Gäste (eng geprüfter Bildweg)

- Neue Route **`GET /api/public-world/image?kind=place|person&id=<Eintrags-ID>`**. Adressiert wird der **Eintrag**, nicht die Datei. Der Server ermittelt Ortsbild bzw. Porträt aus denselben, begrenzten Einträgen wie die öffentliche Seite und liefert die Datei aus R2. Datei-IDs verlassen den Server nicht.
- Bildquellen: Ortsbild einer Gruppenfreigabe (Revisions-Titelbild), freigegebenes Ortsmedium mit „Titelbild“ (Medienblock), NSC-Porträt (`image_primary`, nur bei Feldfreigabe).
- 404 für alles, was nicht auf der Seite steht: nicht markiert, der Gruppe unbekannt, archiviert, über der Obergrenze, Porträt nicht freigegeben, falsche Art, unbekannte oder fehlende ID. Nur GET (andere Methoden 405), keine Cookies, nur JPEG/PNG/WebP (kein SVG), keine privaten Dateien von Mitgliedern.
- Kopfzeilen: richtiger `Content-Type`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `Cross-Origin-Resource-Policy: same-origin`, **`Cache-Control: public, max-age=300`** – fünf Minuten genügen, damit ein Seitenbesuch jedes Bild nur einmal lädt, und ein von der SL entfernter Eintrag verschwindet bald aus Browser- und Proxy-Caches. Fehler bleiben `no-store`.
- Bilder im Fließtext bleiben entfernt (nicht Teil dieses Schritts).

## 2. `/kampagne/welt` als kuratierter Einblick

Aufbau: Kopf „Die Welt“ → **Die Geschichte** (Einleitung) → **Orte** als Schaufenster (großes Bild abwechselnd links/rechts, Viertel · Untertitel, Anriss, Knopf „Mehr über den Ort“ mit Beschreibung und Atmosphäre) → **Persönlichkeiten** als Vorstellung (großes Porträt hochkant, Name, Beiname, Clan/Rolle, Anriss, Knopf „Biografie“) → **Chronik** mit drei kurzen Auszügen und Datum → dezenter Aufruf „Werde Teil der Chronik“ (Links nur auf `/anmelden` und `/#projekt`).

- Aufklappen ohne neue Seite mit nativem `<details>/<summary>`: Tastatur (Enter/Leertaste) und Fokus funktionieren ohne Skript; Animation nur unter `prefers-reduced-motion: no-preference`.
- Ruhige Platzhalter ohne Bild (Ortssymbol bzw. Initialen). Alt-Texte „Bild von …“ und „Porträt von …“. Porträtausschnitt folgt der SL-Einstellung „Vertikaler Ausschnitt“.
- Keine Client-Komponente, kein Formular; Stil der Besucherseiten, kein Lila.

### Obergrenzen und Reihenfolge (fest)

| Bereich | Höchstens | Reihenfolge bei mehr Markierungen |
|---|---|---|
| Orte | 4 | wie in der Orte-Werkstatt (Hauptort-Auswahl, also Position und Anlage) |
| Persönlichkeiten | 7 | alphabetisch nach Name |
| Chronik | 3 | die neuesten zuerst |

Die Grenzen gelten in `/api/public-world`, auf der Seite und in der Bildroute (ein abgeschnittener Eintrag bekommt auch kein Bild). Die Texte stehen einmal in `domain/public-world.ts` (`publicWorldLimits`, `publicWorldOrderHints`).

### Einleitung für die Website

- Gespeichert ohne Migration in der Tabelle `settings` (Schlüssel `public-world:intro:<kampagne>`, JSON mit Text, Version, Zeitpunkt). Speichern versionsgeschützt (veraltet → 409), höchstens 2000 Zeichen sichtbarer Text.
- Ändern nur durch die SL (`requireCmsPublisher`, `sameOrigin`): `GET/POST /api/cms/public-world`. Gäste und Spieler: 401 bzw. 403.
- Ausgabe immer über die öffentliche Bereinigung (`publicRichText`). Leer → ruhiger Standardsatz (`app/kampagne/welt/content.ts`).

### Command Center

- **Rückblicke & Chronik → Reiter „Website“** (direkt: `/sl/command-center?bereich=rueckblick&ansicht=website`): Einleitung bearbeiten mit Vorschau „So sehen es Gäste“ (bereinigte Fassung), Übersicht je Bereich „x von höchstens n“, welche Einträge erscheinen, welche die Obergrenze abschneidet und wie viele markiert, aber für die Gruppe noch nicht sichtbar sind. Gebaut aus denselben Einträgen wie die öffentliche Seite.
- Jeder Schalter „Auf der Website zeigen“ nennt die Obergrenze und Reihenfolge und verlinkt die Übersicht. Kachelbeschreibung im Überblick erwähnt die Website.

### Biografie

Die Biografie einer Persönlichkeit setzt sich aus den **für Spieler freigegebenen** erzählenden Blöcken der NSC-Akte zusammen (Kurzprofil als Anriss, falls kein Kurzprofil-Feld; Biografie, Vergangenheit, Beschreibung, Erzähltext, Persönlichkeit). SL-Blöcke und andere Arten bleiben ausgeschlossen. Das bleibt innerhalb von „Website ⊆ Gruppe“, weil die Gruppe genau diese Blöcke in der Akte liest.


## Nachtrag: Ganzkörperbild und zentrale Freigabeliste (Wunsch des Eigentümers)

- **Persönlichkeiten:** Gezeigt wird zuerst das **Sekundärbild** der NSC-Akte (Vollcharakter), sonst das Porträt – jeweils nur bei Feldfreigabe. Das Bild steht groß und unbeschnitten (der Rahmen passt sich dem Bild an), daneben Name, Beiname, Clan/Rolle und Anriss, darunter die aufklappbare Biografie. Die Figuren wechseln die Seite wie die Orte.
- **Zentrale Freigabe:** Rückblicke & Chronik → **Website** zeigt alle Orte, Persönlichkeiten und Chronik-Einträge, die die Gruppe schon kennt, mit Häkchen. **„Für die Website freigeben“** (oben und unten) speichert alle Änderungen auf einmal (`POST /api/cms/public-world/release`, nur SL). Nur gelistete Einträge ändern sich; ein markierter, der Gruppe noch unbekannter Eintrag behält seine Markierung. Der Zähler zeigt die Obergrenzen, über der Grenze steht „über der Obergrenze“.
- Die einzelnen Schalter in Orte-Werkstatt, NSC-Editor und Chronik-Editor sind entfernt; dort steht nur noch ein Hinweis mit Link zur Liste. Die gespeicherten Markierungen und `POST /api/cms/location-website` bleiben unverändert.
- Hinweis: Eine Freigabe aus der Liste erhöht die Version des NSC bzw. Chronik-Eintrags. Ist derselbe Eintrag gleichzeitig im Editor offen, meldet dessen nächstes Speichern einen Konflikt (neu laden) statt zu überschreiben.

## Dateien

Neu: `app/api/public-world/image/route.ts`, `app/api/cms/public-world/route.ts`, `app/kampagne/welt/content.ts`, `app/spielbereich/modules/public-world-desk.tsx` (+ CSS), `tests/public-world-showcase-integration.mjs`.
Geändert: `domain/public-world.ts`, `server/public-world.ts`, `app/kampagne/welt/page.tsx` + `welt.module.css`, `app/spielbereich/modules/recap-desk.tsx`, `website-release.tsx` (+ CSS), `sl-workspace-shell.tsx`, `tests/public-world.test.mjs`, `tests/public-world-integration.mjs`, `tests/integration.mjs`, `.github/workflows/ci.yml` (Lintliste).
Keine Migration, keine neue Abhängigkeit, keine Änderung an bestehenden Dateiberechtigungen.

## Prüfungen (lokal, Windows)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` (auf `cb732a0`) | Exit 0 |
| ESLint, alle geänderten/neuen Dateien (auf `cb732a0`) | Exit 0 |
| `npm test` (auf `cb732a0`) | 793/793 |
| `node --experimental-strip-types --test tests/*.test.mjs`, 134 Dateien (auf `cb732a0`) | 895/895 |
| `npm run test:integration` (auf `9f1d947`) | Exit 0 · 2742 Integrationsprüfungen, davon 111 `SHOWCASE` und 84 `PUBLIC-WORLD` · Rollen-Grundlage 46 |

Der letzte Commit `cb732a0` ändert nur eine CSS-Spaltenbreite (größere Porträts); die Integrationssuite lief davor.

`SHOWCASE` deckt ab: SL-Route 401/403 für Gast und Spieler (lesen und schreiben), Einleitung speichern, veraltete Version 409, zu lang 413, Standardsatz bei leerer Einleitung, bereinigte Ausgabe ohne Bild und internen Link; Bilder aus allen drei Quellen mit gleichen Bytes für Gast, Spieler und SL, `image/png`, `nosniff`, `max-age=300`, kein Cookie; 404 in acht Fällen je Rolle; 405 für POST/PUT/PATCH/DELETE; keine Upload- oder Medien-ID in JSON oder Gast-HTML; Obergrenzen 4/7/3 mit Reihenfolge; abgeschnittene Einträge ohne Bild; SL-Übersicht markiert genau die öffentlich gezeigten Einträge; Archivieren entfernt Eintrag und Bild.

**Browserprüfung** (App-Browser, `scripts/test-local.mjs --command-center`, frischer temporärer Bestand nur auf 127.0.0.1, synthetisches SL-Konto): Einleitung, 3 Orte mit hochgeladenen Bildern plus Electric Taberna, 6 Persönlichkeiten mit Porträt und Biografie-Block sowie 3 Chronik-Einträge über die echten Routen angelegt (Bilder aus `public/images`). Als Gast (abgemeldet, `/api/members` → 401) auf Desktop (1366 px) und 375 px geprüft, kein horizontales Überlaufen. Tastatur: Fokus auf „Mehr über den Ort“, Enter → geöffnet, Fokus bleibt, Beschriftung wechselt zu „Weniger anzeigen“. SL-Übersicht im Command Center geprüft. Screenshots liegen im gemeinsamen Notizordner unter `screenshots-welt/`. Alle temporären Testbestände wurden danach gelöscht.

## Prüfgrenzen

- Kein echtes Mobilgerät (nur 375-px-Emulation), keine Produktionsdaten, keine Lastprüfung. Die Bildroute lädt pro Abruf die Ortsübersicht der Gruppe; mit fünf Minuten Cache bei der jetzigen Größe unkritisch.
- `campaign_editor` gegen die SL-Routen nicht per Integrationstest geprüft (kein Testkonto mit Sitzung); der Server weist die Rolle über `requireCmsPublisher` ab.
- Die Screenshot-Daten (Namen, Texte) sind synthetisch und nur für die Prüfung angelegt.

## Ausdrücklich nicht getan

Kein Merge, kein Push auf `main`, kein Deployment, keine Migration, keine Änderung an Live-Daten.
