# Changelog

Was sich auf chroniplay.cc geändert hat, die neueste Version zuerst. Versionsschema `A.M.N` (siehe `docs/VERSIONIERUNG.md`). Technische Nachweise stehen in `docs/releases/`.

## [Unveröffentlicht]
- Versionsnummer 2.5.6 in `package.json`, Release-Nachweis für 2.5.6.

## [2.5.6] – 25.11.2026: Regie-Werkbank für Visionen
Nachweis: `docs/releases/2026-11-25-v2.5.6-vision-werkbank.md` · Worker `25383441` · keine Migration
- **Regie-Werkbank im Ersteller:** Ablauf mit Eintauchen, Bildmomenten und Abschluss, Live-Bühne im echten Format (Desktop, Tablet, Handy) mit Zeitleiste, Visionstyp-Karten, Moment-Inspektor, Ton, Prüfung mit Lesbarkeitsmessung und „Als Spieler ansehen“ (#114).

## [2.5.5] – 25.11.2026: Vision Engine
Nachweis: `docs/releases/2026-11-25-v2.5.5-vision-engine.md` · Tag `v2.5.5` · Worker `7e61c20b` · keine Migration
- **Vision Engine:** Visionen treten wolkig aus lebendigem Nebel, ohne sichtbare Bildkanten, mit eigener Effektsprache je Visionstyp, frei stehender Schrift und Ton auf demselben Zeitplan (#112).
- **Regie im Ersteller:** neue Visionen mit Live-Bühne, Brennpunkt und geschütztem Kern je Bild, Platz, Größe, Nachhall-Wort, Eintauchen und Schlusssatz. Bestehende Visionen bleiben unverändert („Regie einrichten“ auf Wunsch) (#112).
- **Bilder getrennt:** Eine Vision zeigt nur ihre eigenen Bilder, alle anderen bleiben in der Galerie (#112).

## [2.5.4] – 25.11.2026: Profil
Worker `d9257fa3` · Release durch ChatGPT, Nachweis folgt
- **Profil modernisiert:** Spielerprofil, eigener Avatar, Profilmotive und kampagnenbezogene Moderation (#111).

## [2.5.3] – 24.11.2026: Rubikwürfel, Zuschauen, Spielbox
Nachweis: `docs/releases/2026-11-24-v2.5.3-wuerfel-spielbox.md` · Tag `v2.5.3` · Worker `701370e4` · Migration `0020`
- **Rubikwürfel in der Spielpause:** alle 12 Drehungen vorwärts und rückwärts, Timer ab dem ersten Zug, Konfetti beim Lösen, eigene Bestenliste (#109).
- **Zuschauen:** Am laufenden Spielabend lädst du andere ein, deinem Würfel live zuzusehen (#109).
- **Spielbox:** öffentliche Seite `/spielbox` mit dem Würfel, ohne Anmeldung, Bestzeiten nur im eigenen Browser (#109).
- **Visionenplayer:** filmische Bildblitze (#108).

## [2.5.2] – 24.11.2026: Voice-Ton
Nachweis: `docs/releases/2026-11-24-v2.5.2-voice-ton.md` · Tag `v2.5.2` · Worker `2631adec`
- **Voice am Spieltisch:** Man hört jetzt die anderen. Vorher sendete das Mikrofon, aber die Stimmen wurden nicht abgespielt (#106).

## [2.5.1] – 24.11.2026: Vorschaubilder und Feedback
Nachweis: `docs/releases/2026-11-24-v2.5.1-vorschau-feedback.md` · Tag `v2.5.1` · Worker `f90dc917` · Migration `0019`
- **Feedback & Fehler melden** im Profil: Fehler, Ideen und Feedback gehen direkt an die Spielleitung, mit Status und Antwort. Die SL bekommt eine Übersicht zum Abarbeiten (Issue #5).
- **Schneller:** NPC-Karten, Figurenlisten, Galerie und Zuflucht laden kleine Vorschaubilder statt der Originale. Auf der NPC-Seite sind es 1,1 MB statt rund 46 MB für 23 Bilder.
- Cloudflare „Workers Builds“ vom Repo getrennt: kein rotes Häkchen mehr, kein automatisches Veröffentlichen.
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
