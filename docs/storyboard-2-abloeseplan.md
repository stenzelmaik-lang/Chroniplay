# Storyboard 2.0 – Ablöseplan für Altsysteme

Stand: 25.11.2026 · Branch `claude/storyboard-2-phase-1`.
Ziel des Besitzers: Am Ende gibt es nur die guten Systeme. Alte Wege werden nicht ewig parallel gepflegt.

## Regeln für jede Ablösung

1. **Erst ersetzen, dann überführen, dann entfernen.** Ein Altsystem fällt erst weg, wenn das neue alles kann, was im Alltag gebraucht wird.
2. **Daten werden nie stillschweigend umgeschrieben.** Die Überführung startet die SL selbst (Knopf) oder ein geprüftes Skript mit ausdrücklicher Freigabe. Vorher gibt es eine Sicherung.
3. **Zählen vor Entfernen.** Vor dem Abbau zeigt eine lesende Abfrage, ob noch Bestandsdaten im Altsystem stecken. Auf Produktion läuft sie nur mit Freigabe.
4. **Jede Entfernung ist ein eigener Auftrag** mit eigenem PR, Tests und Rollback-Weg.

## Übersicht

| Altsystem | Ersatz | Stand | Nächster Schritt |
|---|---|---|---|
| Szenen-Abzweigungen (`possibilities`, Text) | Verbindungen zu eigenen Szenen (`board.links`) | Ersatz fertig. Im Storyboard wandelt **„In Szene umwandeln“** jede Abzweigung verlustfrei um. Neue Abzweigungen lassen sich im Storyboard nicht mehr anlegen. Die Regie zeigt beide Wege. | Zählen, wie viele Szenen noch Abzweigungen haben. Danach umwandeln (SL oder Skript). Dann Anzeige in Regie und klassischer Ansicht entfernen, zuletzt das Feld im Schema. |
| Textfeld „Mögliche Weiterführungen“ (Phase 1) | Verbindungen | **Entfernt.** Es war nie live, es gibt keine Bestandsdaten. | – |
| Klassische Vorbereitungsansicht (`story-workspace.tsx`, `?ansicht=klassisch`) | Storyboard | Im Storyboard neu: Szene archivieren, Szene aus dem Abend nehmen, Termin des Abends, nicht verfügbare Verknüpfungen bereinigen. | Restliche Lücken schließen (siehe unten). Danach den Knopf „Klassische Ansicht“ entfernen und das Modul samt CSS löschen. |
| Abgeleiteter Reifegrad (Idee, Entwurf, bereit) | Vorbereitungsstatus, von der SL gesetzt | Der Reifegrad dient nur noch als Rückfall („Automatisch“), wenn kein Status gesetzt ist. | Bleibt als Rückfall. Er stört nicht und spart bei neuen Szenen einen Klick. |
| Ideen als „Idee: …“ in den SL-Notizen (alte Ideenkarte) | Grobe Idee (`board.premise`) | Neue Ideen landen in `premise`. | Optional: Umwandlung für alte Ideen anbieten (Präfix erkennen, in `premise` verschieben). Erst Bestand zählen. |
| Unterszenen (`parentId`, nur klassisch) | Verbindungen und Typ (z. B. „Begegnung“ oder „Ereignis“ als eigene Szene) | Kein Ersatz in der Oberfläche, Nutzung unbekannt. | Bestand zählen. Falls genutzt: Überführung Hauptszene → Unterszene als Verbindung „Weiter“, dann `parentId` stilllegen. |
| „Vorbereitete Möglichkeiten“ eines Buchs (`StoryDocument.possibilities`) | Szenenideen in der Ideenablage, dazu Handlungsstränge | Ersatz fertig (Phase 3). In der Buchansicht wandelt **„In Szenenideen umwandeln“** jede Möglichkeit um: offen wird zur Idee, genutzt zu Spielbereit, verworfen zu Zurückgestellt. | Bestand zählen und umwandeln. Danach Anzeige im Kommandoraum (`command-story.tsx`) und klassische Ansicht entfernen, zuletzt das Feld. |
| Plotdossier-Abschnitte „Wissen & Geheimnisse“, „Hinweise“, „Mögliche Folgen“ (Freitext im Buch) | Fäden in Handlungssträngen (Geheimnis, Hinweis, Konsequenz) mit Stand, Szene und Akten | Ersatz vorhanden; die Abschnitte bleiben vorerst als Notiz. | Mit der SL klären, ob die Abschnitte als freie Notiz bleiben oder in Fäden überführt werden. Eine Überführung bräuchte eine manuelle Aufteilung, weil Freitext keine Struktur hat. |
| Bücher heißen im Code „Handlungsstrang“ (`emptyStory().title`, „Plotdossier“) | Buch = Plotdossier; Handlungsstrang = eigene Akte (`plot_thread`) | Phase 3 trennt beides. | Beim nächsten Auftrag am Kommandoraum die Bezeichnungen angleichen („Neues Buch“ statt „Neuer Handlungsstrang“). |
| Szenen-Panel im Kommandoraum (`story-scene-manager.tsx`: Erzählung freigeben, Durchläufe von Hand, Momente) | Live-Regie: Szenenstart legt Durchläufe an (Phase 4), Erzählung freigeben, „Festhalten“ | Ersatz für den Spielabend fertig. Einen Durchlauf für eine Teilgruppe (nur bestimmte Charaktere) kann nur das alte Panel anlegen. | Mit der SL klären, ob Teilgruppen-Durchläufe gebraucht werden. Falls nein: Panel aus dem Kommandoraum entfernen. Falls ja: Teilgruppe beim Szenenstart in der Regie anbieten, dann entfernen. |

## Restliche Lücken, bevor die klassische Ansicht entfallen kann

- Archivierte Szenen ansehen und wiederherstellen
- Versionsverlauf einer Szene und Wiederherstellung (Server und Verlauf existieren, Oberfläche nur klassisch)
- Notizen und Orte des Spielabends (`notes`, `placeIds`)
- Buch bearbeiten: Abschnitte, Verweise, Status, Favorit und Anheften (der Titel geht schon im Storyboard)
- Suche und Filter über alle Akten. In Phase 5 als „Globale Suche und Filter“ vorgesehen.

Die Punkte sind Kandidaten für eine kurze Etappe vor oder mit Phase 5. Jeder Punkt wird nur übernommen, wenn die SL ihn tatsächlich braucht. Was niemand nutzt, fällt mit der klassischen Ansicht weg.

## Zählabfragen (lesend, nur lokal oder mit Freigabe)

```sql
-- Szenen mit alten Abzweigungen
SELECT COUNT(*) FROM entities WHERE type='SCENE' AND json_array_length(json_extract(gm_body,'$.possibilities'))>0;
-- Unterszenen
SELECT COUNT(*) FROM entities WHERE type='SCENE' AND COALESCE(json_extract(gm_body,'$.parentId'),'')<>'';
-- Bücher mit alten Möglichkeiten
SELECT COUNT(*) FROM entities WHERE type='CHRONICLE' AND json_extract(content,'$.documentKind')='plot_dossier' AND json_array_length(json_extract(content,'$.document.possibilities'))>0;
-- Alte Ideen in den SL-Notizen
SELECT COUNT(*) FROM entities WHERE type='SCENE' AND json_extract(gm_body,'$.gmNotes') LIKE 'Idee: %';
```
