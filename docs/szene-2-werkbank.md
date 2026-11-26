# Szene 2.0 · Werkbank – moderner, logischer, ruhiger (Übergabe)

- **Branch:** `claude/storyboard-2-phase-1` (Basis `5ab984c`, zusammen mit allen bisherigen Etappen, uncommittet)
- **Stand:** lokal gebaut und geprüft. **Nicht committet, nicht gepusht, nicht deployt, keine Migration.**
- **Grundlage:** Auftrag des Besitzers vom 26.11. („nur die Werkbank … moderner, aber nicht übertrieben; logisch strukturiert; drei Ebenen ein System“), Team-Entwurf `.10x/specs/2026-11-26-szene-werkbank-design.md`, ADR `.10x/adrs/001-werkbank-gold-silber.md`.

## Drei Ebenen, eine Sprache

Werkbank (Vorbereitung) → Regie (zweiter Bildschirm, Ausspielen per Knopfdruck) → Spieltisch. Jeder Bereich der Werkbank trägt jetzt eine feste **Reichweite** (`workshopAreas[].reach`):
- **Gold** = kommt an den Tisch, die Regie wird es auslösen: Schauplätze, Beteiligte, Atmosphäre, Material, Proben, Erkenntnisse, Visionen, Ereignisse
- **Silber** = nur für die SL: Überblick, Erzählung (wird vorgelesen), Interaktionen, Ausgänge, Notizen

Die neue Regie soll ihre Knöpfe genau aus den goldenen Bereichen ableiten.

## Was sich sichtbar ändert

- **Kopf:** „Vorbereitung · Szene x von y“, Titel, Speicherstatus („Gespeichert“ / „Ungespeichert“ / „Speichert …“), vorige/nächste Szene. Seltene Aktionen hinter **„⋯“**: Klassische Ansicht, Aus dem Spielabend nehmen, Szene archivieren. Die Aktionszeile unter der Szene und der Link „Klassische Vorbereitungsansicht öffnen“ (auf Szenenebene) entfallen.
- **Gliederung links:** 4 Kapitel mit Trennlinie, je Bereich Gold- oder Silberpunkt und Füllstand; leere Bereiche leiser; Legende „am Tisch / nur du“.
- **Bereichskopf:** Titel + Zeichen („Kommt an den Tisch“ / „Nur für dich“); die Erklärung, was am Tisch passiert, hinter **„?“**.
- **Alte Freitexte** (Dialognotizen, Atmosphäre in eigenen Worten, Interaktionen, Folgen, Geheimnisse, SL-Notizen) sind eingeklappt und nur offen, wenn Text darin steht.
- **Farbwelt:** SL-Töne über die vorhandenen Variablen (Nachtviolett, Silber, Gold), flach, Ecken 4 px, kein Blur; eingebettete ältere Werkzeuge (Bildwähler, NSC-Auswahl) auf derselben ruhigen Fläche.
- **Texte:** Führungsschritt „Ausarbeiten“ beschreibt jetzt Gliederung und Gold/Silber statt „acht Bereiche“; Bildwähler heißt „Bühnenbild“ mit kurzer, richtiger Erklärung.

## Nachschärfung (26.11., auf Wunsch des Besitzers)

- **Kein Lila mehr, vier Farbmodelle:** Nacht (Standard, Tealgrau des ChroniPlay-Way), Mitternacht (Nachtblau), Graphit, Bordeaux. Alle fest eingetragenen Farbwerte des Moduls sind jetzt Variablen; das Modell wechselt über `data-theme` am Storyboard. Auswahl über das Paletten-Symbol rechts in der Kopfzeile, gemerkt je Person im Browser (`localStorage`, reine Bequemlichkeit). Gold und Silber bleiben in allen Modellen gleich.
- **Kopfbereich neu aufgebaut** (vorher drei Kästen: Pfad, „Führung“-Schritte, Szenenstreifen): eine schlanke Zeile mit Pfad (Chronik › Buch › Spielabend), den Szenen des Abends als nummerierte Kacheln (aktuelle in Gold, Titel beim Darüberfahren) und rechts der Farbwahl. Die „Führung“-Schritte und der Szenenstreifen entfallen auf Szenenebene (die Gliederung führt), ebenso der Knopf „Zum Storyboard“ (der Pfad übernimmt das). Auf dem Handy zeigt die Zeile nur Spielabend und Kacheln.
- Ruhigere Karten: Abschnittsnummer als leiser Marker, Bilder in Karten als Vorschau (max. 360 × 220 px), eingebettete Knöpfe angeglichen.

## Dateien

- `domain/scene-workshop.ts` (`reach`, `WorkshopReach`), `domain/storyboard.ts` (Führungstext)
- `app/spielbereich/modules/storyboard-workshop.tsx` (`WorkshopNav`, `WorkshopHead`, neu `LegacyText`)
- `app/spielbereich/modules/storyboard.tsx` (Kopf, „⋯“-Menü, Freitexte)
- `app/spielbereich/modules/preparation-upload.tsx` (Kopftext des Bildwählers)
- `app/spielbereich/modules/storyboard.module.css` (Farbmodelle als Variablen, Werkbank-Block, Kopfzeile)
- `app/spielbereich/modules/storyboard-themes.ts` (neu: Liste der Farbmodelle)
- `tests/scene-workshop.test.mjs` (+1 Test: Reichweite je Bereich)

## Prüfungen (beobachtet)

- `npm test`: 766 bestanden, 0 fehlgeschlagen. `npm run typecheck`: grün. ESLint auf den geänderten Dateien: ohne Befund.
- `npm run build` und volle Integration: **2489 integration checks passed**.
- Browser (Edge ohne Fenster über Playwright, lokale Demo, Szene 05): Gliederung mit Punkten und Füllstand, Bereichskopf mit „?“, „⋯“-Menü mit drei Einträgen, eingeklappte bzw. offene Freitexte, keine Seitenfehler; **375 px ohne waagerechtes Scrollen**.
- Nach der Nachschärfung erneut: `npm test` 766/766, Typecheck grün, ESLint ohne Befund, Integration 2489 grün; alle vier Farbmodelle per Klick gewechselt (Bildschirmfotos), Kopfzeile bei 1440 und 375 px ohne Querscrollen, keine Seitenfehler.

## Prüfgrenzen

- Kein echtes Mobilgerät. Volles `npm run lint` nicht gelaufen.
- Die Farbänderung wirkt im ganzen Storyboard-Modul (auch Bücher und Abende) – gewollt als SL-Bereich; die übrige App (Command-Center-Kacheln darüber) ist unverändert.
- Bereiche sind weiter Listen (mehrere Abschnitte auf einer Seite); „ein Element je Ansicht“ wäre ein späterer Schritt.

## Offen

Neue Regie (zweiter Bildschirm) aus diesem Modell · Etappe 7 Test · Fäden → Erkenntnisse · Ablösung der Altsysteme.
