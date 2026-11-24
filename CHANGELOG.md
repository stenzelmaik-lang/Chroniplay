# Changelog

Was sich auf chroniplay.cc geändert hat, die neueste Version zuerst. Versionsschema `A.M.N` (siehe `docs/VERSIONIERUNG.md`). Technische Nachweise stehen in `docs/releases/`.

## [Unveröffentlicht]
- **Feedback & Fehler melden** im Profil: Fehler, Ideen und Feedback direkt an die Spielleitung, mit Status und Antwort; für die SL eine Übersicht zum Abarbeiten (Issue #5). Braucht beim Deploy die Datenbank-Migration `0019`.
- CI auf zwei Prüfungen zusammengelegt („ChroniPlay · Prüfung“, „ChroniPlay · Windows“). Server-, Browser- und Lockfile-Teile laufen nur bei betroffenen Dateien, Doku-PRs ohne Prüfung (`docs/CI.md`).
- Statusblock im README, dieses Changelog.

## [2.5.0] – 24.11.2026: Schnitt für Alpha 2.5
Nachweis: `docs/releases/2026-11-24-v2.5.0-schnitt.md` · Tag `v2.5.0` · Worker `81993d8f`
- **Sicherheit:** Schutz-Header für alle Seiten. HTTPS wird erzwungen, kein Einbetten in fremde Seiten, Kamera und Mikrofon nur für ChroniPlay.
- **Voice am Spieltisch:** schneller, weil beim Sprechen nur noch das betroffene Profilbild neu gezeichnet wird.
- **Handy:** Die Links im Footer sind größer und leichter zu tippen.
- **GitHub:** Das Repository heißt jetzt `Chroniplay`. Website-Links und die Weiterleitung des Entwicklertagebuchs nach Discord sind angepasst.
- **Aufgeräumt:** 83 erledigte Branches gelöscht und archiviert, Lint-Fehler behoben, der rote Browser-Test repariert.

## Vor 2.5: Alpha 2.0 (Oktober bis November 2026)
Zusammengefasst aus den Release-Nachweisen in `docs/releases/`.
- **23.11.:**
  - Voice am Spieltisch für Chronik von Kleve: nur Sprache, Steuerung in der oberen Leiste, goldener Ring beim Sprechen.
  - Startseite mit Community-Bereich, FAQ, Entwicklungsstand, Impressum, Datenschutz und SEO.
  - Google Search Console verifiziert.
- **22.11.:** Performance und Stabilität (P1).
- **21.11.:**
  - HUD-Teile am Spieltisch einklappbar.
  - Name in der Kopfleiste wählbar.
  - Galerie zeigt nur eigene Bilder.
  - Auswahl in der Spielpause.
- **15.11.:** Storyboard als neue Vorbereitung („Bücher und Kampagnen“).
- **10. bis 12.11.:** EP-System, Engagement-EP, MVP-Abstimmung, Gefallen und Schulden (Issues #74 bis #77).
- **9.11.:**
  - Zuflucht und Navigation.
  - Charakter-Galerie, Chronik-Zeitstrahl, Rückblicke mit Abstimmung.
  - Live-Regie für Spieler.
  - Notizbuch-Design und Tisch-Panels.
- **7.11.:** Abenteuerjournal (später wieder entfernt).
- **28. bis 31.10.:** Spieltisch 2.0, Galerie und Material, W10-Würfel.
- **12.10.:** Spieltisch.
- **2.10.:** Inventar 2.
- **Ende September:** Pre-Alpha v0.1.035 bis v0.1.037, Rollen und Zugang für die geschlossene Alpha.
