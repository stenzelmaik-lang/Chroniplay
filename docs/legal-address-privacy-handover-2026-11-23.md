# Übergabe: Wohnanschrift auf öffentlichen Rechtsseiten

Stand: 23.11.2026. Branch: `codex/legal-address-privacy`.
Basis: `origin/main` nach Fetch, `4ee1a510b3f862834e6faa1b70df9d82962ac408` (Merge PR #93).

Fortsetzung: Der Besitzer hat anschließend mit „dann live bringen“ die Veröffentlichung dieser Vorbereitung ausdrücklich freigegeben. Die folgenden Angaben zu „kein Push/Deploy“ beschreiben den abgeschlossenen Vorbereitungsstand vor dieser Freigabe. Veröffentlichungsnachweis und aktuelle Live-Prüfung werden außerhalb des öffentlichen Repositories geführt.

## Auftrag und Ergebnis

Öffentliche Vorkommen der privaten Wohnanschrift prüfen, deutsche Informationspflichten recherchieren und eine datensparsame Vorbereitung erstellen. Die Anschrift wird hier nicht wiederholt. Der Besitzer hat angegeben, noch keine alternative Anschrift zu haben.

Die Wohnanschrift ist live weiterhin öffentlich sichtbar. Vorbereitet ist ausschließlich eine Verringerung der Auffindbarkeit über Suchmaschinen. Dies ist weder eine Entfernung der Anschrift noch eine Zusage vollständiger Rechtskonformität. Für den vollständigen Ersatz fehlt eine tatsächlich geeignete und geprüfte andere Anschrift.

## Beobachtete Vorkommen

Öffentliche HTTP-Abrufe ohne Anmeldung am 23.11.2026 um 19:41 UTC / 20:41 MEZ, anschließend gezielter Abgleich. Keine Produktionskonten und kein Zugriff auf Remote-D1/R2 oder Cloudflare-Variablenwerte.

| Öffentlicher Ort | Darstellung | Quellstelle am Basisstand |
| --- | --- | --- |
| `/impressum#anbieter` | Wohnanschrift, erster Adressblock | `app/impressum/page.tsx:23–24`, Verwendung in Zeile 32 |
| `/impressum#verantwortlich` | dieselbe Wohnanschrift erneut | `app/impressum/page.tsx:50–52` |
| `/datenschutz#verantwortlich` | dieselbe Wohnanschrift mit Kontakt-E-Mail | `app/datenschutz/page.tsx:38–42` |
| `/` und gemeinsame öffentliche Fußzeile | keine Wohnanschrift | `app/visitor/site-footer.tsx:10–23` |
| Spielerfußzeile | Links zu Rechtsseiten, keine Anschrift | `app/spielbereich/modules/shell.tsx:53` |

Quelle der drei Adressblöcke: `CVK_IMPRESSUM_ANSCHRIFT`, Auswertung in `domain/legal-contact.ts:27`, serverseitige Übergabe in `server/legal-config.ts:6–7`. Die Darstellung ist dynamisch. Ein späterer freigegebener Wechsel dieser einen Konfiguration aktualisiert beide Rechtsseiten und alle drei Adressblöcke.

Die konkrete Straßenzeile wurde nur im Arbeitsspeicher mit aktuellen getrackten Textdateien verglichen: keine Fundstelle. Orts-/Postleitzahlen allein sind kein Nachweis einer privaten Adresse. Git-Historie, Sicherungen und externe Suchindizes wurden nicht vollständig untersucht. Es wurde kein Live-HTML mit der echten Anschrift gespeichert.

Live liefern beide Rechtsseiten `index, follow`; sie stehen in `/sitemap.xml`. Die geprüften öffentlichen Seiten antworteten mit HTTP 200 und ohne `Set-Cookie`. Es wurde nicht festgestellt, ob Google die Seiten bereits indexiert hat.

Die historische Release-Dokumentation `docs/releases/2026-11-23-faq-recht-seo.md` beschreibt noch eine nicht gesetzte Anschrift. Das entspricht nicht der aktuell beobachteten Ausgabe. Auch die dort pauschal genannte c/o-/Adressdienst-Lösung ist kein Eignungsnachweis für einen konkreten Anbieter.

## Rechtliche Bewertung und Vorgehen

Recherche am 23.11.2026; keine verbindliche anwaltliche Einzelfallprüfung.

- **§ 5 DDG:** Bei den erfassten geschäftsmäßigen Diensten sind insbesondere Name, Niederlassungsanschrift und elektronische Kontaktangaben leicht erkennbar, unmittelbar erreichbar und ständig verfügbar anzugeben. Eine Kontakt-E-Mail ersetzt die Anschrift nicht. Ob sämtliche Voraussetzungen bei einem Angebot erfüllt sind, hängt vom tatsächlichen Betrieb ab. Die öffentlich sichtbare Plattformwerbung und der Abschnitt für Werbung/Kooperationen sprechen hier gegen eine ungeprüfte Einordnung als rein private Familienseite. Die geschlossene Alpha und Kostenfreiheit allein tragen eine Ausnahme nicht. [Gesetz](https://www.gesetze-im-internet.de/ddg/__5.html), [LFK-Leitfaden](https://www.lfk.de/service/dokumente-rechtsgrundlagen/leitfaden-zur-impressumspflicht-im-internet).
- **§ 18 Abs. 1 MStV:** Auch außerhalb des DDG besteht für Angebote, die nicht ausschließlich persönlichen oder familiären Zwecken dienen, eine Pflicht zu Name und Anschrift. Abs. 2 betrifft zusätzlich journalistisch-redaktionelle Angebote. Ob ChroniPlay diesen Zusatz benötigt, wurde nicht abschließend beurteilt; sein Entfernen würde die allgemeine Anschriftenfrage nicht lösen. [Amtlicher Normtext](https://www.gesetze-bayern.de/Content/Document/MStV-18).
- **Art. 13 Abs. 1 lit. a DSGVO:** Der Gesetzestext fordert Name und Kontaktdaten des Verantwortlichen, ohne ausdrücklich die private Wohnanschrift festzulegen. Die europäischen Transparenzleitlinien empfehlen eine einfache Identifizierbarkeit und möglichst mehrere Kontaktwege. Daraus folgt keine pauschale Freigabe für nur eine E-Mail ohne namentlichen Verantwortlichen oder für den Verzicht auf anderweitige Anschriftenpflichten. [Art. 13, amtliche Wiedergabe](https://www.ms.niedersachsen.de/startseite/uber_uns/service_kontakt/informationspflichten_nach_art_13_14_dsgvo/daten-179087.html), [Transparenzleitlinien, Anhang S. 42](https://www.tlfdi.de/fileadmin/tlfdi/datenschutz/leitlinie_der_dsk_fur_mehr_transparenz__wp260_rev01.pdf).
- **Andere Anschrift:** Eine tatsächlich genutzte geeignete Büro-/Niederlassungsanschrift kann die Wohnanschrift ersetzen. Eine fremde c/o-Anschrift, ein virtuelles Büro oder ein Impressumsdienst ist nicht automatisch ausreichend. Tatsächliche Nutzung/Niederlassung, persönliche Erreichbarkeit, erlaubte Verwendung und wirksame Zustellung müssen für die konkrete Gestaltung geprüft werden; Postweiterleitung oder eine Werbeaussage des Anbieters allein reichen als Nachweis nicht. [IHK München, Anschrift der Niederlassung](https://www.ihk-muenchen.de/ratgeber/recht/internetrecht/impressum/).

Empfehlung: Zunächst die hier vorbereiteten Suchmaschinenhinweise als begrenzte Maßnahme prüfen. Parallel eine echte alternative Büroanschrift oder die konkrete Dienstgestaltung fachkundig prüfen lassen. Erst danach die freigegebene Anschrift zentral ersetzen. Nicht als rechtssichere Übergangslösung verwenden: E-Mail-only, „Adresse auf Anfrage“, eine leere Anschriftenvariable oder versteckte Pflichtangaben hinter Anmeldung, CSS oder JavaScript.

## Vorbereitete Änderungen

- `app/impressum/page.tsx` und `app/datenschutz/page.tsx`: seitenspezifische Metadaten `noindex, follow, nosnippet`.
- `public/sitemap.xml`: nur die beiden Rechtsseiten entfernt; die Startseite bleibt enthalten.
- `tests/startseite-rechtliches.test.mjs`: bestehende SEO-Prüfung an die beabsichtigte Indexierung angepasst; liest außerdem die Crawl-Freigabe und die Seitenmetadaten.
- Diese Übergabe.

Die Pflichtangaben, ihre Konfiguration, die Links im Footer und die Erreichbarkeit wurden nicht geändert. `public/robots.txt` bleibt crawlbar, damit Suchmaschinen `noindex` lesen können. Keine neuen Abhängigkeiten oder Lockfile-Änderungen.

Grenze: Suchmaschinen müssen die Regeln erst beim erneuten Abruf verarbeiten. Andere Crawler müssen sich nicht daran halten. Die Seiten bleiben öffentlich abrufbar; vorhandene Kopien verschwinden dadurch nicht automatisch. Eine zusätzliche Entfernung aus Google kann gegebenenfalls später über die Search Console beantragt werden. Keine entsprechende Aktion wurde ausgeführt. [Google zu noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing?hl=de), [Google zu nosnippet](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag?hl=de).

## Ausgeführte Prüfungen und beobachtete Ergebnisse

Umgebung: Windows, Node 24.22.3, pnpm 11.25.0. Getrennter neuer Worktree ohne kopierte echte Konten, Datenbestände oder Umgebungsdateien.

| Prüfung | Ergebnis |
| --- | --- |
| `pnpm install --frozen-lockfile` | erfolgreich; Lockfiles unverändert |
| `pnpm run typecheck` | Exit 0 |
| ESLint auf beiden geänderten Rechtsseiten und bestehender Testdatei | Exit 0 |
| `pnpm test` | 624 bestanden, 0 fehlgeschlagen |
| `node --experimental-strip-types --test tests/*.test.mjs` | 735 bestanden, 0 fehlgeschlagen |
| `pnpm run build` mit lokalem Bindungsmodus | Exit 0; Hinweis zur begrenzten statischen Routenklassifikation |
| Zusätzlicher lokaler HTTP-Lauf gegen gebauten Worker | `/`, `/impressum`, `/datenschutz` HTTP 200; Startseite genau ein `index, follow`; Rechtsseiten genau ein `noindex, follow, nosnippet`; synthetische Adresse/E-Mail weiterhin vorhanden; Footerlinks vorhanden; kein Cookie; gebaute Sitemap und Crawl-Freigabe korrekt |
| `pnpm run lint` gesamt | Exit 1: 18 Fehler, 19 Warnungen außerhalb der geänderten Dateien; nicht behoben |
| `git diff --check` | Exit 0 |

Der lokale HTTP-Lauf verwendete ausschließlich synthetische Kontaktdaten, lokale D1/R2-Platzhalter und keine Produktionsverbindung. Das zusätzliche Prüfskript und Protokolle liegen außerhalb des Repositories im Aufgaben-Arbeitsordner.

## Prüfgrenzen und offene Punkte

- Keine Bestätigung vollständiger Rechtskonformität der gesamten Rechtstexte; andere Aussagen dieser Seiten wurden nicht neu auditiert.
- Kein vollständiger HTTP-Integrationstest (`pnpm run test:integration`) und kein angemeldeter Rollenlauf; geändert wurden ausschließlich Metadaten und Sitemap, keine Zugriffslogik oder Routen.
- Kein visueller Browser-/Mobilgerätetest; keine sichtbare Layoutänderung.
- Keine Prüfung eines konkreten Adressdienstes, keine Buchung und keine geeignete Ersatzanschrift vorhanden.
- Keine Behauptung, Suchergebnisse seien bereits bereinigt oder die Wohnanschrift verborgen.

## Ausdrücklich nicht getan

Kein Push, kein Merge, kein Tag, kein Live-Deploy. Keine Änderung von Cloudflare-Variablen, Produktionsdaten oder Freigaben; keine Migration. Keine Bearbeitung von `recovery/`. Eine Veröffentlichung erfordert eine neue ausdrückliche Freigabe des Besitzers. Dies ist kein Release-Nachweis.
