# Visionen in ChroniPlay 2.5

Stand 24.11.2026. Basis ist `main` bei `73c214b4b5e9203d17098985f2b622a2358f73ef`. Entwicklungsbranch `codex/2.5-visionen-bildblitze`.

## Ursache und Umsetzung

Der ursprüngliche Player hat den Ablauf nach Textabschnitten getaktet. Bei fünf Bildern und drei Texten ergab die Formel nur die Bildindizes 0, 1 und 3. Der Abschluss zeigte dasselbe letzte im Ablauf erreichte Motiv. Der Volltext machte gleichzeitig die Abschlussbestätigung verfügbar. In der Darstellung kamen eine kleine feste Bildbreite, `object-fit: cover`, eine flächige Radialmaske und je nach Preset Bewegungen oder starke Abdunkelung hinzu.

Die gemeinsame Reihenfolge umfasst beide vorhandenen Listen. Die kürzere Liste wird auf die Momente der längeren verteilt. Bei fünf Bildern und drei Texten beginnen die Texte in den Momenten 1, 3 und 5. Dazwischen gibt es reine Bildmomente. Die gespeicherten Listen und Inhalte ändern sich dadurch nicht.

- Eine große Bildfläche zeigt jeweils ein Motiv vollständig mit `object-fit: contain`. Nebel und Farbgebung stammen aus den bisherigen sechs Presets. Das Motiv bleibt während des Haltens unbewegt. Vordergrundnebel liegt hinter dem Bild und bleibt am Rand sichtbar.
- Jede Bildphase hat einen separaten Übergang hinein und hinaus. Die vollständig sichtbare Zeit beträgt abhängig vom Tempo mindestens 2,1 Sekunden. Beim Zusammentreffen mit Text gilt die längere Lesedauer.
- Der aktuelle und der nächste Moment dürfen Bildanfragen vorbereiten. Die Bildphase startet nach Dekodierung. Bei einem Fehler oder nach höchstens 6,5 Sekunden Wartezeit läuft der Text beziehungsweise der nächste Moment weiter.
- Der Volltext bleibt während der Bildfolge bedienbar. Abschluss oder erneute Wiedergabe erscheinen am Ende. Der Spielende kann gezielt weitergehen oder die Vision bewusst überspringen.
- `VisionPlayer` bleibt der bestehende Einstieg für SL-Vorschau und Spielerzustellung. Zustellungs-API und Medienfreigabe wurden in diesem Branch nicht geändert.

## Betroffene Dateien

| Datei | Änderung |
| --- | --- |
| `app/spielbereich/modules/spieltisch/delivery-players.tsx` | Ablauf, begrenztes Vorladen, Volltext und Wiedergabesteuerung |
| `app/spielbereich/modules/spieltisch/delivery-players.module.css` | Bühne, Bildübergänge, Filter und Responsive-Darstellung |
| `domain/vision-moments.ts` | Gemeinsame Reihenfolge aus vorhandenen Bildern und Fragmenten |
| `tests/vision-moments.test.mjs`, `package.json` | Regressionstest und Einbindung in die Testsuite |
| `tests/live-deliveries-browser.mjs`, `tests/scene-whispers-browser.mjs` | Bewusste Abkürzung im Rollentest und Abdeckung der Volltext-Steuerung |

## Prüfung und Grenzen

| Prüfung | Ergebnis |
| --- | --- |
| Visionen- und Zustellungs-Unit-Tests | 13 von 13 bestanden |
| Voller Unit-Testlauf | 646 von 648 bestanden. Tests zur Ersteinrichtung und Mediensicherung konnten lokale Miniflare-Ports nicht erreichen |
| Typecheck | Blockiert durch den rekonstruierten Abhängigkeitsstand. Fehler betreffen unter anderem RealtimeKit und Base UI |
| Projektbuild | Blockiert durch fehlende Abhängigkeiten der PostCSS-Installation |
| Isolierter Vorher-Nachher-Player | Gebaut. Verwendet synthetische Texte und öffentliche Projektbilder mit den Bild- und Textanzahlen der Referenzvisionen |
| Automatisierter Browserablauf, Screenshots, Aufzeichnung | Offen. Browserstart und Zugriff auf die lokale Testseite waren in der Sitzung gesperrt |
| Abnahme mit den tatsächlichen Kampagnenvisionen | Offen. Die Originalvisionen wurden für die Vorschau nicht verwendet |

Weniger gleichzeitig eingebundene Bilddateien und keine kontinuierlichen Bildtransformationen reduzieren erwartbar Netzwerk- und Zeichenarbeit. Gemessene GPU-Zeit, FPS und Downloads unter Drosselung stehen aus.

## Optionale Regie für eine spätere Freigabe

Im Editor bietet sich eine einklappbare Regiespur mit automatisch erzeugter Momentliste an. Ohne Regieeingriff gilt die automatische Reihenfolge. Pro Moment wären Bildgröße, Links/Mitte/Rechts, Presetfilter, Nebelstärke, Mindesthaltezeit, Übergang und Textzuordnung optional überschreibbar. Drag-and-drop verändert dabei die Reihenfolge in der Vorschau. Tastaturbedienung kann dieselbe Aktion über Hoch- und Runter-Schaltflächen anbieten.

Für Speicherung wäre ein optionaler, versionierter Ablauf im Szenen-JSON mit stabilen Referenzen auf Bild- und Textvorkommen nötig. Vor dem Speichern muss geprüft werden, wie Änderungen an einer Galerie oder an Textfragmenten bestehende Vorgaben behandeln. Noch gültige Vorgaben sollten beim Auslösen zusammen mit dem Inhalt in den Zustellungslauf übernommen werden. Der nächste Schritt ist die Abnahme an Szene 05 in einer privaten Vorschau mit den Originalbildern und einem getrennten SL- und Spielerkonto. Danach lässt sich entscheiden, welche Regieoptionen tatsächlich gebraucht werden.
