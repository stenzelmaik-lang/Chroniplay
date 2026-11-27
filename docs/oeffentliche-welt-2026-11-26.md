# Öffentliche Welt – Übergabe (26.11.2026)

**Branch:** `claude/funny-clarke-dc9430` · **Basis:** `e701030` (main, live v2.6.0) · **Geprüfter Stand:** `1b944fb` · PR offen, nicht gemergt, nicht deployt.

## Was neu ist

Gäste (ohne Anmeldung) lesen unter **`/kampagne/welt`** eine öffentliche, rein lesende Ansicht der Chronik von Kleve mit drei Bereichen: **Orte**, **Persönlichkeiten**, **Chronik**. Auf **`/kampagne`** führt die Kachel **„Die Welt“** dorthin (für angemeldete Mitglieder zusätzlich ein Knopf „Die Welt“).

### Regel: Website ⊆ Gruppe

Ein Eintrag erscheint nur, wenn **beides** gilt:

1. Die SL hat ihn ausdrücklich mit **„Auf der Website zeigen“** markiert.
2. Die **ganze Gruppe** sieht ihn bereits (bestehende Gruppenprojektion).

Gruppenfreigaben werden nie automatisch öffentlich. Spielerbezogene Freigaben (ein einzelner Spieler) zählen nicht. Der Inhalt stammt immer aus der bestehenden Gruppenprojektion und wird danach auf eine feste Feldliste reduziert.

| Bereich | Markierung gespeichert in | Gäste sehen | Bleibt im Spielbereich |
|---|---|---|---|
| Orte (nur Hauptorte) | `location_nodes.attributes.showOnWebsite` | Name, Untertitel, Stadtteil, Beschreibung, Eindruck, Zustand | Bereiche, Räume, Erkenntnisse, Adresse, Karte, Marker, Fraktionen, Aktivität, Medien |
| Persönlichkeiten (NSC) | `entities.content.show_on_website` | nur freigegebene Felder: Name, Alias, Beiname, Rolle, Clan, Kurzprofil, Text, Bekannt für, Zugehörigkeiten | Aufenthaltsnotiz, Status, Inhaltsblöcke, Beziehungen, SL-Blöcke |
| Chronik | `records.body.showOnWebsite` | Titel, Datum, Art (Ereignis/Rückblick), Text | Spielabend-Bezug, Quelle, SL-Text |

Zusätzlich gilt: Ein NSC ohne freigegebenen Namen erscheint nicht; archivierte, gelöschte, unbekannte oder nur gerüchteweise bekannte Orte erscheinen nicht; Chronik-Entwürfe (`visibility='sl'`) erscheinen nicht.

**Bilder und Links:** Ausgegeben werden nur mitgelieferte statische Bilder (`/images/…`). Hochgeladene Bilder (`/api/files`, `/api/cms/media`, `/api/locations/media`) verlangen eine Anmeldung und werden serverseitig entfernt, ebenso eingebettete Bilder im Fließtext (auch in aufklappbaren Blöcken) und interne Links in den Spielbereich (Text bleibt, Ziel entfällt). Alte Einträge ohne Rich-Text-Format laufen durch denselben Schutz: HTML geht über den vorhandenen Konverter (`htmlToRichText`), als Klartext eingefügte Adressen geschützter Dateien oder des Spielbereichs sowie Markdown-Bilder werden entfernt.

> Achtung Begriff: „public“ im Ortsmodell heißt „im Spiel allgemein bekannt“. Die Website-Freigabe nutzt deshalb eigene Schlüssel (`showOnWebsite` / `show_on_website`).

### Bedienung für die SL (Command Center)

- **Orte:** Orte-Werkstatt → Hauptort → Tab „Für Spieler“ → Schalter „Auf der Website zeigen“. Speichert sofort, versionsgeschützt über die Knotenrevision (wie die Meilenstein-Bindung). Hinweis, falls die Gruppe den Ort noch nicht kennt.
- **Persönlichkeiten:** NSC-Editor → unter „NPC-Akte freigeben“. Wirksam beim Speichern. Hinweis, falls Akte oder Name noch nicht freigegeben sind.
- **Chronik:** Rückblicke & Chronik → Eintrag → Schalter über den Speicherknöpfen. Wirksam beim Speichern. In der Übersicht ein Etikett „Website“.

## Neue und geänderte Dateien

- `domain/public-world.ts` – Flaggenschlüssel, Feldlisten, Bereinigung von Fließtext (Bilder, interne Links), Kurztexte. Kampagnenneutral.
- `server/public-world.ts` – einziger Weg von Kampagnendaten zu Gästen; liest die Markierung aus dem gespeicherten JSON und schneidet mit der Gruppenprojektion; `setPlaceWebsite` (nur SL).
- `app/api/public-world/route.ts` – **neu, anonym, nur GET**.
- `app/api/cms/location-website/route.ts` – **neu, nur SL** (POST, `sameOrigin`, Revision).
- `app/api/cms/locations/route.ts` – Knotenliste meldet `showOnWebsite` für Hauptorte.
- `app/kampagne/welt/page.tsx`, `public-rich-text.tsx`, `welt.module.css` – öffentliche Leseseite, reine Serverkomponente ohne Client-Code, ohne Formular.
- `app/kampagne/page.tsx`, `app/globals.css` – Kachel „Die Welt“.
- `app/spielbereich/modules/website-release.tsx` (+ CSS) – gemeinsamer Schalter; eingebaut in `location-cms.tsx`, `npc-editor.tsx`, `recap-desk.tsx`.
- `domain/npc-profile.ts` – `show_on_website` als optionaler Schemaschlüssel (kein freigebbares Profilfeld, nicht in `npcFieldNames`).
- Tests: `tests/public-world.test.mjs` (in `npm test`), `tests/public-world-integration.mjs` (in `tests/integration.mjs`). CI-Lintliste ergänzt.

Keine Datenbank-Migration, keine neue Abhängigkeit, keine Änderung an Dateiberechtigungen.

## Prüfungen (lokal, Windows, Stand `1b944fb`)

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck` | Exit 0 |
| ESLint (alle geänderten/neuen Dateien) | Exit 0 |
| `npm test` | 788/788 bestanden |
| `node --experimental-strip-types --test tests/*.test.mjs` (134 Dateien) | 890/890 bestanden |
| `npm run test:integration` (Build + isolierte lokale D1/R2) | Exit 0 · 2630 Integrationsprüfungen, davon 83 `PUBLIC-WORLD` · Rollen-Grundlage 46 · atomarer Batch-Rollback bestanden |

Die neuen Integrationsprüfungen decken je neuer Route Gast, Spieler und SL ab: anonyme Lesung ohne Login und ohne Cookie; leerer Ausgangszustand; `POST/PUT/PATCH/DELETE` auf `/api/public-world` → 405 für alle; Orts-Markierung Gast 401, Spieler 403, veraltete Revision 409, Nicht-Hauptort 400; identische Antwort für Gast, Spieler und SL; markierte, aber der Gruppe unbekannte, nicht freigegebene oder archivierte Orte bleiben unsichtbar; gesperrte, namenlose oder nicht markierte NSC bleiben unsichtbar; Chronik-Entwürfe bleiben unsichtbar; alter HTML-Eintrag behält Text, verliert Bild und interne Links; Marker-Texte, `/api/files`, `/api/cms/media`, `/api/locations/media`, `/spielbereich`, Mitglieds-IDs erscheinen weder in der API noch im HTML der Gastseite; ein normales NSC-Speichern behält die Markierung; Entmarkieren entfernt den Eintrag.

**Browserprüfung** (App-Browser, `scripts/test-local.mjs --command-center`, frischer temporärer Bestand, nur 127.0.0.1, synthetische Konten):
- Desktop: Als synthetische SL über die Oberfläche markiert – Ort (Orte-Werkstatt → „Für Spieler“), Chronik-Eintrag (Rückblicke & Chronik, inkl. Hinweis vor der Freigabe) und NSC (NSC-Editor, Akte/Name/Kurzprofil freigegeben). Danach abgemeldet (`/api/members` → 401) und `/kampagne` sowie `/kampagne/welt` als Gast geprüft, inkl. „Weiterlesen“.
- 375 px: `/kampagne` (Kachel) und `/kampagne/welt` ohne horizontales Überlaufen.
- Nach zwei kleinen Korrekturen (Schalter im NSC-Editor einzeilig, Bereichsleiste auf 375 px) neu gebaut und gezielt nachgeprüft. In diesem zweiten Durchgang wurden die Testdaten **nicht** über die Oberfläche, sondern direkt über die SL-Routen angelegt; geprüft wurden nur Schalterdarstellung, Bereichsleiste und Initialen.

Alle temporären Testbestände dieser Läufe wurden danach gelöscht.

## Prüfgrenzen

- Keine Prüfung auf einem echten Mobilgerät; mobile Ansicht nur per 375-px-Emulation im App-Browser.
- Keine Prüfung gegen Produktionsdaten. Welche echten Einträge die SL markieren möchte, ist offen.
- Keine Last- oder Missbrauchsprüfung der anonymen Route (sie liest pro Aufruf die Ortsübersicht der Gruppe; bei viel Verkehr ggf. kurz cachen).
- Die Rolle `campaign_editor` ist gegen `POST /api/cms/location-website` nicht per Integrationstest geprüft (das Testkonto hat keine Sitzung); der Server weist sie über `requireCmsPublisher` ab.

## Offene Punkte / Vorschläge

- **Bilder für Gäste:** Porträts und Ortsbilder sind Uploads und brauchen heute eine Anmeldung. Ein eigener, eng geprüfter Bildweg nur für markierte Einträge wäre ein eigener Schritt.
- Optional: Detailseiten je Eintrag (`/kampagne/welt/orte/…`) und Suchmaschinen-Metadaten je Eintrag.

## Ausdrücklich nicht getan

Kein Merge, kein Push auf `main`, kein Deployment, keine Migration, keine Änderung an Live-Daten.
