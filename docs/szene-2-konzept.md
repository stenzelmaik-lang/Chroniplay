# Szene 2.0 – Fachliches und technisches Zielkonzept

Stand: 25.11.2026 · Version 2 (ersetzt den ersten Entwurf „Szene = Ablauf aus Schritten“) · **Konzept, nichts umgesetzt.**
Grundlage: „ChroniPlay – Fachliches Grundverständnis und Anforderungen an die Spielabendvorbereitung“ des Besitzers (25.11.2026), Bestandsaufnahme des Codes, Referenzfall Szene 05 „Der Junge im Keller“.
Klickbarer Entwurf: `prototypes/szene-2/index.html`.

> **Leitgedanke:** Hervorragend vorbereitet sein und trotzdem jederzeit frei improvisieren können. Die Technik dient der Geschichte.
>
> **Leitbild (Besitzer):** Die Spielleitung bereitet rund 80 % vor und nutzt fast alles, die Spieler sehen vielleicht 20 %. Die SL braucht deshalb viele, logisch auffindbare Möglichkeiten, wie ein Pilot im Cockpit. Für die Spieler soll es sich anfühlen wie Magie, Theater, Improvisationskunst. **Erst ein funktionierendes System, Feinheiten später.**

## Ausgabe am Spieltisch: Was passiert mit welchem Inhalt?

Nicht alles wird ausgespielt. Manche Knöpfe der Regie lösen am Tisch etwas aus, manche bewusst nicht.

| Inhalt | Am Spieltisch | Was die Szenenvorbereitung dafür enthält | Grundlage heute |
|---|---|---|---|
| **Erzählung** | wird **nicht** ausgespielt; die SL liest vor | Vorlesetext und Regiehinweise, nur SL | Erzählfeld |
| **Atmosphäre** | liegt als Stimmung auf dem Tisch | Stimmungen (Bild, Klang, Effekte), Wechsel je Abschnitt | Bühnenbild, Musik, Effekte |
| **NSC** | Figurenbild auf dem Tisch („ist vor Ort“); rechts im Slider die Charakterkarte wie im Wiki | Verweis auf die NSC-Akte; **Zusatz für die Spieler-Karte in dieser Szene** (getrennt von der Wiki-Karte); SL-Rolle (nur SL) | NSC auf dem Tisch, NSC-Karten |
| **Ort** | über die Karte unten freigeschaltet; die Spieler sehen die Ortsinfos; **einmal freigeschaltet, dauerhaft im Wiki sichtbar** | welche Orte und Bereiche in dieser Szene freigeschaltet werden können; Szenenbezug (nur SL) | Tischkarte, Ortsfreigaben |
| **Material und Akten** | ausgespielt; manches einsteckbar, manches nicht; **jedes nur einmal**, also nur eine Person kann es haben | Material aus der Bibliothek, einsteckbar ja oder nein, wie es ins Spiel kommt | Spielmaterial 3.0, Tisch-Tasche (`takeable`) |
| **Probe** | Würfel vorbereitet: Der Spieler tippt auf seinen Charakter, wählt Attribut und Fähigkeit, die Punkte ergeben den Würfelpool, gewürfelt wird gegen die vorbereitete Schwierigkeit | Schwierigkeit, vorgeschlagene Werte, Folgen; **das volle Probensystem mit festen Bögen ist ein späterer, eigener Schritt** | Probenzentrale GE-02 |
| **Interaktion** | läuft zwischen SL und Spielern | was damit verbunden ist (Material, Erkenntnis, Probe, Ereignis) | – |
| **Erkenntnis** | nur für bestimmte Spieler | wer sie entdecken kann, Fundweg | `knowledge` |
| **Vision** | für alle oder bestimmte Spieler, einmal kurz | Vision der Vision Engine, mögliche Empfänger | Zustellung |
| **Ereignis** | global, kann über längere Zeit laufen (auch über Szenen und Abende) | Auslöser, Wirkung, Dauer | – |

**Anforderung an die Inventar-Schnittstelle** (Inventar bleibt geschützt): Ein Material, das jemand eingesteckt hat, darf die Regie nicht ein zweites Mal ausspielen, solange es in einer Tasche liegt. Heute nimmt das Einstecken das Material zwar vom Tisch, ein erneutes Ausspielen durch die SL ist aber nicht gesperrt. Das wird beim Inventar-Auftrag gelöst; die Regie fragt dann nur den Besitzstand ab.

Es gibt sehr viele Materialarten (Briefe, Fax, Pager, Akten, Fotos, Ton, Video …), und das System wächst weiter. Die Bibliothek ist deshalb nach Materialart erweiterbar und nicht auf eine feste Liste beschränkt.

## 0. Was sich gegenüber Version 1 ändert

Version 1 machte aus einer Szene einen **Ablauf aus Schritten** (wie ein Drehbuch). Das widerspricht dem Grundverständnis: Spieler ignorieren Wege, fragen Unerwartetes, teilen sich auf. **Interaktionen haben keine feste Reihenfolge.**

Version 2: **Die Szene ist eine Werkstatt voller Möglichkeiten.** Reihenfolge gibt es nur dort, wo sie fachlich besteht, also bei den Erzählabschnitten. Alles andere sind Angebote, die die SL am Tisch frei auswählt. Die Regie stellt bereit, sie entscheidet nicht.

## 1. Welche Anforderungen erfüllt ChroniPlay bereits?

Legende: **●** erfüllt · **◐** teilweise · **○** fehlt

| Anforderung | Stand | Wo heute |
|---|---|---|
| Szenenkontext: Titel, Typ, Status, Zweck, Voraussetzungen, Zeit, Dauer | ◐ | Storyboard Phase 1 (`board`); „Mögliche Einstiege“ fehlt als eigenes Feld |
| Mehrere Erzählabschnitte | ○ | Nur *ein* Erzähltext je Szene; Abschnitte nur per Überschrift im Text |
| Erzählung von SL-Anweisungen unterscheiden | ◐ | getrennte Felder (Erzählung, SL-Notizen); Regieanweisungen *im* Abschnitt nicht möglich |
| Atmosphäre je Szene | ● | Bühnenbild, YouTube-Liste, Tischeffekte |
| Atmosphäre je Moment, ohne Zwangswechsel | ◐ | mehrere Hintergrund-Materialien möglich, aber ohne Bezug zu Abschnitten |
| NSCs aus der Welt zuordnen | ● | NSC-Auswahl (`npcIds`) |
| Szenenspezifische NSC-Rolle (warum, Ziel, Wissen, verschweigt, Reaktion, Eingreifen, Abgang) | ○ | nur ein gemeinsamer Freitext „NPCs & Dialoge“ |
| Mehrere oder keine Orte, Bereiche eines Ortes | ◐ | ein Hauptort plus Baustein „Unterort“; Ortsbaum vorhanden |
| Material vorbereiten, ansehen, Verwendung planen | ◐ | Spielmaterial 3.0 (stark: Effekte, Darstellungen); bearbeitet im eigenen Fenster; „wann, warum, wie“ nur als Freitext |
| Dasselbe Material in mehreren Szenen ohne Kopie | ○ | Material lebt *in* der Szene; nur Dateien und Darstellungs-Assets sind wiederverwendbar |
| Interaktionen ohne feste Reihenfolge, verknüpft mit Material, Erkenntnis, Probe, Ereignis | ◐ | 16 Bausteinarten, unverknüpft |
| Proben mit Werten, SG, Folgen | ● für V20 | Probenzentrale GE-02, fest an W10 gebunden |
| Proben regelwerksunabhängig | ○ | kein Regelprofil |
| Erkenntnisse: bekannt, entdeckbar, nur SL | ◐ | Hinweis-Akten mit Sichtbarkeit; Stufe „von Anfang an bekannt“ nicht je Szene |
| Tatsächlich entdeckt und von wem | ● | Wissens-Freigaben (`knowledge`: Gruppe, Spieler, Charakter) |
| Visionen gestalten und gezielt zustellen | ● | Vision Engine, Zustellung an Einzelne, Teilgruppen, alle |
| Optionale Ereignisse manuell auslösen, verschieben, verwerfen | ◐ | Ereignis als Szenentyp und als Faden (Phase 3); in der Szene kein Ereignis-Baustein, kein Auslösen |
| Timer | ○ | – (nur Kampfrunden-Zähler) |
| SL-Notizsystem mit Bezug zu Szene, Figur, Ort, Abend, Kampagne | ◐ | Szenen-Notiz (Text), Momente (Abend), SL-Teile in NSC-Akten; kein gemeinsames System. Für Spieler gibt es ein ausgereiftes Notizbuch. |
| Übergänge und Ausgänge | ● | Verbindungen (Phase 2) |
| Ergebnis testen | ◐ | Spieler-Vorschau einer Szene (Server); Vision-Vorschau; keine Gesamtvorschau |
| Vorbereitung und Spielverlauf trennen | ● | Durchläufe, Momente, Wissens-Freigaben, Zustellungen (Phase 4) |
| Szene als Werkstatt ohne Bereichswechsel | ◐ | Storyboard-Szene; Material im zweiten Fenster, Proben im Material |

## 2. Welche Funktionen sind mehrfach vorhanden?

| Doppelung | Heute | Auflösung |
|---|---|---|
| **Hinweise / Erkenntnisse** | Hinweis-Verweise (`clueIds`), Baustein „Hinweis“, Faden „Hinweis“ (Phase 3) | Eine **Erkenntnis** in der Szene, optional verknüpft mit einer Hinweis-Akte der Welt; der Faden verweist darauf, statt eigenen Stand zu führen. Entdeckt wird nur über `knowledge`. |
| **NSCs in der Szene** | NSC-Auswahl, Baustein „Personenverweis“, Baustein „Dialog“, Freitext | **Beteiligte**: Verweis auf die NSC-Akte plus szenenspezifische Rolle |
| **Material** | 16 Bausteinarten und Spielmaterial 3.0 (8 Arten) | **Material-Bibliothek** (Spielmaterial 3.0) plus **Verwendung** in der Szene |
| **Folgen** | Freitext, alte Abzweigungen, Verbindungen, Konsequenz-Fäden | **Ausgänge** (Verbindungen) und **Ereignisse**; Freitext wird Notiz |
| **Visionen** | Vision Engine, alter Freitext „Visionen“, zwei Felder ohne Oberfläche | nur Vision Engine |
| **Geheimnisse** | Freitext „Geheimnisse“ und Faden „Geheimnis“ | **Erkenntnis „nur SL“** in der Szene; der Faden verweist darauf |
| **SL-Notizen** | Szenen-Freitext, Abendnotiz, Momente, SL-Felder in Akten | ein **Notizsystem** mit Bezügen (siehe 7.11) |
| **Szene „läuft“** | Durchläufe im alten Kommandoraum-Panel und Tischstart | Tischstart (Phase 4); altes Panel entfällt nach Abnahme |
| **Vorbereitungsansicht** | Storyboard und klassische Ansicht | Storyboard; klassische Ansicht entfällt nach Abnahme |

## 3.–5. Was gehört wohin?

| **Welt** (dauerhaft, kampagnenweit) | **Szene** (Vorbereitung dieses Abends) | **Spiel** (entsteht erst am Tisch) |
|---|---|---|
| NSC-Akten: Identität, Biografie, Beziehungen, öffentliches und SL-Wissen, **Charakterbogen** | **Beteiligte**: Rolle, Motivation, Verhalten, situatives Wissen, Reaktionen *in dieser Szene* | Wer tatsächlich auftrat; Zustände, Verletzungen |
| Orte mit Bereichen und Räumen | **Schauplätze**: welche Orte und Räume, was hier anders ist | Wo die Runde tatsächlich war |
| Fraktionen, Geschichte, Ereignisse der Welt | Zweck, Voraussetzungen, Einstiege | – |
| Hinweis- und Handout-Akten | **Erkenntnisse**: bekannt, entdeckbar, nur SL; wie man sie findet | **Entdeckt von wem** (`knowledge`) |
| **Material-Bibliothek**: Dateien, Darstellungs-Assets, wiederverwendbare Materialien | **Material-Verwendung**: offen liegend, durch Untersuchung, von NSC übergeben; Bedingung, Zielgruppe | Gezeigt wem, wann (Tisch-Ereignis); übergeben als Gegenstand (Inventar) |
| Regelprofil der Kampagne | **Proben** nach Regelprofil | Würfelergebnisse |
| Handlungsstränge (kampagnenweit, Phase 3) | Zuordnung der Szene, vorgemerkte Fäden | Fäden-Stand (eingetreten, gefunden) |
| – | **Visionen** (Vision Engine) | Zugestellt an wen |
| – | **Ereignisse**: können eintreten, mit oder ohne Timer | Ausgelöst, verschoben, übersprungen, verworfen |
| Kampagnen-Notizen | **Notizen** zur Szene | Live-Notizen, Entscheidungen, Versprechen |
| – | **Ausgänge** (Verbindungen) | Tatsächlicher Weg, spontane Szenen |

**Grundregel:** Eine Szene **verweist** auf die Welt und **ergänzt** nur den Szenenbezug. Sie kopiert keine Weltdaten. Der Spielverlauf **schreibt nie in die Vorbereitung**.

## 6. Wie werden die Systeme verbunden?

```
 WELT ────────────── wird referenziert von ─────────────► SZENE (Werkstatt)
 NSC · Orte · Akten · Material · Regelprofil · Stränge     Kontext · Erzählung · Atmosphäre · Beteiligte · Schauplätze
                                                           Material · Interaktionen · Proben · Erkenntnisse · Visionen
                                                           Ereignisse · Notizen · Ausgänge
                                                                   │ liefert Inhalte und mögliche Aktionen
                                                                   ▼
 SPIELTISCH ◄── gibt frei / spielt aus ──  LIVE-REGIE  ── schreibt ──► SPIELVERLAUF
 (nur Freigegebenes)                        (entscheidet nichts       Durchläufe · Momente · knowledge
                                             selbst)                  Zustellungen · Ereignis-Log · Würfel
```

- **Eine Quelle je Wahrheit:** Entdeckung steht nur in `knowledge`, Zustellung nur in Zustellungen, gespielte Szenen nur in Durchläufen.
- **Referenzen statt Kopien:** Beteiligte → NSC-Akte, Schauplatz → Ortsknoten, Verwendung → Material, Erkenntnis → Hinweis-Akte (optional), Probe → Regelprofil.
- **Schutz vor versehentlicher Freigabe:** Alles in der Szene ist standardmäßig nur für die SL sichtbar. Freigabe ist immer eine bewusste Aktion der Regie, mit Zielgruppe.

## 7. Die Szene als Werkstatt

Eine Seite. Oben der Kopf, links eine Bereichsleiste mit Füllstand, in der Mitte der Bereich, rechts eine **Bibliothek** (NSCs, Orte, Material, Hinweis-Akten, Visionen) zum Zuordnen, ohne Fensterwechsel. Jeder Bereich ist freiwillig. Ein Szenentyp (Phase 1) blendet passende Bereiche zuerst ein, nichts ist versteckt.

| # | Bereich | Inhalt | Was die Regie daraus macht |
|---|---|---|---|
| 7.1 | **Überblick** | Ausgangssituation, Zweck, Voraussetzungen, Einstiege, Grundton, Ende offen/fest, Typ, Status | Kopfzeile der laufenden Szene |
| 7.2 | **Erzählung** | Abschnitte in Reihenfolge; je Abschnitt Vorlesetext, **Regiehinweis** (sichtbar abgesetzt, nur SL) und optional „Stimmung wechselt hier“ | Abschnitt aufrufen und vorlesen (wird nicht ausgespielt); Stimmung nur, wenn so markiert |
| 7.3 | **Atmosphäre** | benannte **Stimmungen** (Bild, Musik oder Geräusch, Effekte); eine ist Szenenstandard | Stimmung mit einem Klick aktivieren |
| 7.4 | **Beteiligte** | NSC aus der Welt plus SL-Rolle (warum da, will, weiß, verschweigt, reagiert auf, greift ein wenn, verlässt die Szene wenn; Dialoghilfen) und **Zusatz für die Spieler-Karte in dieser Szene** | Figurenbild auf den Tisch, Charakterkarte mit Szenenzusatz im Slider; SL sieht die Rolle |
| 7.5 | **Schauplätze** | Orte oder Räume aus dem Ortsbaum (keiner, einer, mehrere, „im Spiel bestimmt“) mit Szenenbezug; welche in dieser Szene freigeschaltet werden können | Ort über die Tischkarte freischalten (danach dauerhaft im Wiki); Ortsbild als Stimmung |
| 7.6 | **Material** | Verwendungen von Bibliotheks-Material: *offen*, *durch Untersuchung*, *übergeben von (NSC)*, *sonstig*; einsteckbar ja oder nein; Bedingung, Zielgruppe | Vorschau, ausspielen an Person, Teilgruppe oder alle; jedes Material nur einmal |
| 7.7 | **Interaktionen** | ungeordnete Karten „Wenn die Spieler … → dann …“, verknüpft mit Material, Erkenntnis, Probe, Ereignis; ausdrücklich optional | Karte antippen → verknüpfte Aktionen griffbereit |
| 7.8 | **Proben** | nach Regelprofil: Art, Werte, SG, Modifikatoren, Ergebnisse, Folgen, SL-Hinweis | Probe ausgeben, Ergebnis und passende Folge zeigen |
| 7.9 | **Erkenntnisse & Geheimnisse** | je Erkenntnis: *bekannt* / *entdeckbar* / *nur SL*, Fundweg, optional Hinweis-Akte | „als entdeckt markieren“ für Person, Teilgruppe oder Gruppe |
| 7.10 | **Visionen** | Visionen der Vision Engine, Bedingung, mögliche Empfänger | gezielt zustellen |
| 7.11 | **Ereignisse** | kann eintreten: Auslöser, Wirkung, optional Timer, Folgen | auslösen, verschieben, überspringen, verwerfen; Timer |
| 7.12 | **Notizen** | Notizen mit Bezug zu dieser Szene (und auf Wunsch zu Figur, Ort, Abend, Kampagne) | Notizblock, schnell ergänzen |
| 7.13 | **Ausgänge** | Verbindungen (Phase 2), „kein fester Ausgang“ erlaubt | Weiter zu …, spontane Szene |
| | **Testen** | Spieltisch-Vorschau (nur Freigebbares), Material- und Vision-Vorschau, „Regie-Probelauf“ ohne Zustellung | – |

### Technisches Modell (ohne destruktive Migration)

Alles kommt als **optionale Felder** in das bestehende Szenendokument. Alte Felder bleiben lesbar, bis sie leer gezählt sind.

```ts
SceneDocument (+ optional)
  context?:      { situation, purpose, prerequisites, entries[], tone, ending: 'open'|'fixed' }   // board bleibt
  passages?:     { id, title, text(rich), direction(rich, nur SL), moodId? }[]                    // Erzählabschnitte
  moods?:        { id, name, backdrop?: fileId, audio?: {kind:'file'|'youtube', ref}, effects[], isDefault }[]
  cast?:         { npcId, present, reason, goal, knows, hides, reactions, intervenes, leaves, lines[],
                   playerCardNote(rich) }[]                                                      // Zusatz für die Spieler-Karte
  // passages: Erzählung wird nicht ausgespielt (kein Freigabe-Status)
  places?:       { nodeId?, note, unlockable: boolean }[]                                          // Freischalten wirkt dauerhaft im Wiki
  materialUses?: { id, materialId, how: 'open'|'search'|'handover'|'other', byNpcId?, condition, audienceHint, takeable }[]
  interactions?: { id, when, then, materialUseIds[], insightIds[], checkIds[], eventIds[] }[]
  checks?:       { id, title, profileId, spec: RuleProfileCheck, difficulty, modifiers[], outcomes[], note }[]
  insights?:     { id, title, text, availability: 'known'|'discoverable'|'gm', howFound, clueEntityId? }[]
  whispers:      (bestehend, Vision Engine)
  events?:       { id, title, trigger, effect, timer?: { seconds, visibleToPlayers }, followUps }[]
  board.links:   (bestehend, Ausgänge)
```

- **Material-Bibliothek:** neue Akte `documentKind: 'material'` (SL-intern) mit dem heutigen `material`-Block aus Spielmaterial 3.0. Bestehende Szenenmaterialien werden auf Wunsch zu Bibliothekseinträgen plus Verwendung. Dateien und Darstellungs-Assets bleiben, wie sie sind.
- **Notizsystem:** baut auf dem bestehenden **Notizbuch** auf (Seiten, Titel, Tags, Suche), als SL-Notizbuch mit Bezügen `{ sceneId?, npcId?, placeId?, sessionId?, campaign }`. Szenen-Notizen sind gefilterte Seiten. „Festhalten“ in der Regie (Phase 4) wird eine Notiz mit Art.
- **Spielverlauf:** neues Ereignis-Log (Moment-Art `event` mit `eventId` und Zustand ausgelöst, verschoben, übersprungen, verworfen); Timer als Tischzustand. Erkenntnisse: bestehender Endpunkt `/api/knowledge`.

## 8. Was braucht die spätere Regie?

**Daten** (ein Lesemodell je Szene, SL-only): Kontext, Abschnitte, Stimmungen, Beteiligte mit NSC-Kurzprofil und Bogen-Verweis, Schauplätze, aufgelöste Material-Verwendungen, Interaktionen, Proben, Erkenntnisse mit Entdeckt-Stand, Visionen, Ereignisse mit Zustand, Notizen, Ausgänge, vorgemerkte Fäden, Durchläufe.

| Aktion am Tisch | Grundlage heute | neu nötig |
|---|---|---|
| Szene beginnen, wechseln | Tischstart, Durchläufe (Phase 4) | – |
| Atmosphäre aktivieren | Bühnenbild, Musik, Effekte | Stimmung als Bündel |
| Erzählabschnitt aufrufen und vorlesen | – | Abschnitte (Erzählung wird nicht ausgespielt) |
| Anwesende NSCs einsehen, zeigen | NSC auf den Tisch | Rolle aus `cast` |
| Bogen öffnen, Probe ausführen | Probenzentrale, Würfel (W10) | NSC-Bogen, Regelprofil |
| Handout einer Person zeigen | Tischobjekt mit Empfängern | Verwendung aus der Bibliothek |
| Vision auslösen | Zustellung | – |
| Hinweis als entdeckt markieren | `knowledge` | Knopf in der Regie |
| Ereignis auslösen, verschieben, überspringen | – | Ereignis-Log |
| Timer starten | – | Tisch-Timer (optional sichtbar) |
| Spontane Notiz | „Festhalten“ (Phase 4) | SL-Notizbuch |
| Suche | – | Schnellsuche über Szene und Welt |

## 9. Technische Grundlagen für NSC-Charakterbögen

Ziel: Jeder NSC kann einen Bogen bekommen, das Würfelsystem kann ihn lesen, und ChroniPlay bleibt regelwerksunabhängig.

1. **Regelprofil-Register** (`domain/rule-profiles`):
   - Ein Profil besteht aus `id`, `name`, Bogen-Schema (Gruppen von Werten mit Schlüssel, Art und Bereich, Ressourcen, Zustände), Proben-Schema und einem **Würfel-Adapter** (`pool(sheet, check) → roll`, `evaluate(roll) → Ergebnisstufe`).
   - Erstes Profil: **V20 (W10) mit Hausregeln**, aus den bestehenden Modulen `w10-core` und `trait-ids` abgeleitet.
   - Später auch erzählerische Profile ohne Würfel.
2. **Bogen am NSC:** `sheet: { profileId, values: Record<key, number|string>, resources, conditions, notes }`. Er liegt im SL-Teil der NSC-Akte; Freigaben für Spieler gelten wie bisher feldweise.
3. **Standardfiguren** werden Vorlagen, die einen Bogen erzeugen (statt fest verdrahteter W10-Werte).
4. **Proben in Szenen** speichern `profileId` plus `spec` des Profils. Die Regie fragt den Würfel-Adapter, kennt also keine V20-Begriffe.
5. **Spielercharaktere** können später auf dasselbe Bogenmodell wechseln. Das ist hier nicht Teil des Auftrags.
6. **Eingabe der Werte** erfolgt später im NSC-Bereich (separater Auftrag). Jetzt nur Schema, Register und Adapter.

**Grundsatzbefund:** Die NSC-Akte führt heute `clan` und `generation` als feste Felder. Das ist vampirspezifisch und gehört in Welt- beziehungsweise Profilfelder. Zu lösen im NSC-Auftrag, hier nur notiert.

## 10. Was wird später separat entwickelt?

| Bereich | Schnittstelle, die Szene 2.0 vorsieht | Nicht Teil dieses Umbaus |
|---|---|---|
| **NSC-Verwaltung** (Neugestaltung, Werte-Eingabe) | `cast.npcId`, `sheet` nach Regelprofil | Oberfläche und Felder der NSC-Akte |
| **Ortsverwaltung** (Neugestaltung) | `places.nodeId` auf den Ortsbaum | Oberfläche der Orte |
| **Gefallen & Schulden** (geschützt) | Notiz-Art „Versprechen“ mit Verweis auf eine Gefallen-Akte; keine eigene Schuldenlogik | jede Änderung am System |
| **Inventar** (geschützt) | Material-Verwendung „übergeben als Gegenstand“ nutzt die bestehende Tisch-Tasche (`take`/`play`/`reclaim`) | jede Änderung am System |
| **Würfelsystem** | Würfel-Adapter je Regelprofil | Ausbau der Würfel |
| **Live-Regie** | Lesemodell und Aktionen aus Abschnitt 8 | Neubau folgt nach diesem Konzept |
| **Vermarktung** (Phase 6) | Szenen nur mit Verweisen und Regelprofil sind exportierbar | Marktplatz |

## 11. Prüfung am Referenzfall „Der Junge im Keller“

| Inhalt der Szene 05 | Ort in Szene 2.0 | Passt? |
|---|---|---|
| Auftrag, Anschluss an Szene 04, Ziel, Grundton, Ende offen | Überblick | ja |
| Vier Erzählabschnitte (Hinter den Kulissen · Unter der Taberna · Lagerraum · Emil) | Erzählung, 4 Abschnitte mit Regiehinweisen | ja |
| Bild je Abschnitt (Treppe, Kellergang, Lager vorne/hinten, Tisch) | Stimmungen; Abschnitte 01–04 mit „Stimmung wechselt hier“ | ja; Club-Musik bleibt, nur Bild wechselt |
| Electric Taberna: Personalbereich, Kellergang, Getränkelager | Schauplätze (3 Knoten des Ortsbaums) | ja |
| Avi und Emil, Verhalten, Dialoghilfen, Eingreifen | Beteiligte mit Rolle | ja (Emil: Rolle, Wissen, Lücken; Avi: greift bei Bedrohung ein) |
| Freies Gespräch, optionale medizinische Untersuchung | Interaktionen (optional), Probe „Zustand untersuchen“ | ja |
| Neun mögliche Proben mit SG und Folgen | Proben nach Regelprofil V20 | ja |
| Zwei Visionen, nur bei individueller Initiative | Visionen mit Bedingung „nur einzeln, keine Gruppe“ | ja |
| Geheimnisse (nur SL) | Erkenntnisse „nur SL“ | ja |
| Mögliche Erkenntnisse (Zustand, Parallelen) | Erkenntnisse „entdeckbar“ | ja |
| Möglicher Kontrollverlust | Ereignis „Wenn das Tier erwacht“, nur manuell | ja |
| Sechs optionale Abzweigungen | 4 als Ausgänge oder Interaktionen, 2 als Ereignisse | ja |
| Bewusster Verzicht auf künstliche Interaktionen | Interaktionen leer erlaubt | ja |
| SL-Notizen „nicht als Lexikon spielen“ … | Notizen zur Szene | ja |
| Spielprotokoll „erst während des Abends“ | entsteht automatisch im Spielverlauf | ja, ohne Formular |
| Zugestellte Tür (späterer Plotpunkt) | Notiz „offene Frage“ plus Faden im Strang | ja |

Alle Inhalte finden einen Platz, ohne dass die SL etwas doppelt pflegt. Eine Lücke zeigt der Fall: **Stimmung je Abschnitt** (nur Bildwechsel, Club-Musik bleibt). Sie ist eingeplant. Die Erzählung wird vorgelesen, nicht freigegeben.

## 12. Etappen (jede einzeln freizugeben, nichts destruktiv)

1. **Werkstatt-Gerüst:** neue Szenenseite mit Bereichsleiste, Überblick, Erzählabschnitten mit Regiehinweis, Stimmungen. Umwandlung „Erzählung → Abschnitt 1“ verlustfrei.
2. **Beteiligte und Schauplätze:** Rollen je NSC, mehrere Orte und Räume; Umwandlung aus NSC-Auswahl, Personenverweis und Dialog.
3. **Material-Bibliothek und Verwendungen:** Bibliotheksakte, Seitenleiste, Umwandlung der Szenenmaterialien.
4. **Erkenntnisse, Interaktionen, Ereignisse:** eine Erkenntnis-Quelle, Fäden verweisen darauf; Ereignis-Log.
5. **Regelprofil und Proben:** Register, V20-Profil, Proben umstellen (ohne Änderung am Würfelergebnis).
6. **SL-Notizbuch** mit Bezügen; „Festhalten“ schreibt dorthin.
7. **Testen:** Spieltisch-Vorschau und Regie-Probelauf.
8. **Danach:** neue Live-Regie aus diesem Modell; anschließend Abbau der Altsysteme nach Zählung und Freigabe.

## 13. Offene Entscheidungen für den Besitzer

1. Sollen Stimmungen auch **Raumklang** (Dauerschleife) und **Einzelgeräusche** (auf Knopfdruck) trennen?
2. Sollen Spieler einen **Timer** sehen können, etwa bei Fristen?
3. Soll eine Erkenntnis „von Anfang an bekannt“ automatisch beim Szenenstart freigegeben werden oder immer erst auf Knopfdruck? Empfehlung: auf Knopfdruck, wegen des Schutzes vor versehentlicher Freigabe.
