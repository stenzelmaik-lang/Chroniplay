# Szene 2.0 – klickbarer Entwurf

Entwurf der zukünftigen Szenenvorbereitung zum Konzept [`docs/szene-2-konzept.md`](../../docs/szene-2-konzept.md).
**Keine Verbindung zu ChroniPlay-Daten, nichts wird gespeichert.** Alle Änderungen gelten nur, bis die Seite neu geladen wird.

## Öffnen

`index.html` im Browser öffnen (Doppelklick genügt). Es braucht keinen Server und keine Abhängigkeiten.

## Daten

- `referenzfall.local.js`: der echte Referenzfall „Der Junge im Keller“ mit SL-Geheimnissen. **Nur lokal**, steht in `.gitignore` und darf nicht ins Repo.
- `beispiel.js`: neutrales, frei erfundenes Beispiel („Die Stimme im Leuchtturm“). Der Entwurf nutzt es, wenn die lokale Datei fehlt.

## Was man ausprobieren kann

- Bereiche links: Überblick, Schauplätze, Beteiligte, Erzählung, Atmosphäre, Interaktionen, Material, Proben, Erkenntnisse, Visionen, Ereignisse, Ausgänge, Notizen
- **Bibliothek rechts:** NSCs, Orte, Material und Akten zuordnen; es entsteht nur ein Verweis, keine Kopie
- **Erzählung:** Abschnitte verschieben; je Abschnitt festlegen, ob die Stimmung wechselt
- **Material:** festlegen, wie es ins Spiel kommt (offen, durch Untersuchung, übergeben von einem NSC)
- **Erkenntnisse:** Stufe wechseln (bekannt, entdeckbar, nur SL)
- **Am Spieltisch:** Jeder Bereich sagt, was dort mit dem Inhalt passiert. Die Erzählung wird zum Beispiel nur vorgelesen, ein Ort wird über die Karte freigeschaltet und ist danach dauerhaft im Wiki sichtbar.
- **Spieltisch-Vorschau:** zeigt, was Spieler aus dieser Szene sehen *können* (Figuren, Orte, Stimmungen, Material, Visionen); ohne Erzähltext, Regiehinweise und Geheimnisse

Der Entwurf zeigt nur die **Szenenvorbereitung**. Die neue Regie wird danach aus dem Storyboard abgeleitet.

## Gestaltungsprobe `design.html` (Fassung 2, 26.11.)

Die Szenen-Werkstatt ist die **Vorbereitung** (Storyboard), nicht die Regie. Das Fenster rechts ist nur eine Vorschau.

- **Farbwelt der SL:** aus der Wortmarke abgeleitet. „Chroni“ ist Silber, die Chronistin bzw. der Chronist: **Silber auf Nachtviolett** heißt „nur für dich“. „Play“ ist Gold: **Gold** heißt „kommt am Tisch an“. So hebt sich der SL-Bereich vom tealfarbenen Spielerbereich ab und bleibt ChroniPlay.
- **Spiel statt Büro:** Kopfbild aus dem ChroniPlay-Startbild, Stimmungen als **goldene Portale** auf einer **Orbit-Linie** (wie im Startbild), Vorschau als **gotisches Bogenfenster**, D10 aus der Wortmarke als Zeichen.
- **Aufgeräumte Steuerung:** 4 Kapitel statt 13 Bereiche; nur Bereiche mit Inhalt stehen da, leere unter „+ Weitere Bereiche“; seltene Aktionen (Klassische Ansicht, Verlauf, Aus dem Abend nehmen, Archivieren) hinter „⋯“.
- **Ansehen / Gestalten:** Im Modus „Gestalten“ wird direkt an Ort und Stelle bearbeitet; die Felder sehen aus wie der fertige Text, ein Rahmen erscheint erst beim Schreiben. Speichert scheinbar von selbst („Alles gespeichert“) – in der Probe bleibt alles nur bis zum Neuladen.
  - Erzählung: Titel, Vorlesetext und Regie direkt schreiben; Raute auf der Orbit-Linie = Abschnitt dazwischen einfügen; unter dem Text die Stimmung als kleine Portale wählen (◇ = bleibt, + = neue Stimmung); verschieben, entfernen.
  - Atmosphäre: Portal antippen öffnet die Werkbank (Name, Bild aus der Galerie oder Upload, Klang, Effekt, „Beginnt mit der Szene“); das Bogenfenster zeigt die Stimmung sofort; „+“-Portal legt eine neue an.
  - Beteiligte: „NSC aus der Welt hinzufügen“ (nur Verweis), Zusatz direkt auf der Tischkarte, Rollenfragen als Felder.
- Direkt öffnen: `design.html#moods`, `design.html#cast`, mit `-edit` im Modus Gestalten (z. B. `design.html#passages-edit`).

Bilder: `bilder.local.js` (nur lokal, `.gitignore`) zeigt auf die Bilder in der Szenenakte. Ohne die Datei zeigt die Probe „Bild fehlt noch“.
