# P1 – Performance- und Stabilitätsanalyse (Claude-Übergabe, 22.11.2026)

**Branch:** `claude/p1-performance-stabilitaet` · **Basis:** `077a167` (= `origin/main` am 22.11.2026)
**Commits:** `5aad65b` (Liste/Robustheit) · `90542fe` (Inhaltsgrenzen) · `30aa26b` (ETag-Teil wieder entfernt) · plus diese Übergabe
**Nicht getan:** kein Push, kein Pull Request, kein Deployment, keine Migration, keine Remote-D1-Abfrage, keine Datenänderung.

## Prüfgrenzen vorweg
- **Keine Messung auf chroniplay.cc.** Produktionsdaten, Worker-Logs und Remote-D1 wurden bewusst nicht angefasst (Freigabe nötig). Alle Befunde sind lokal reproduziert: isolierter Speicher `.local-test/storyboard`, synthetische Konten, 39 synthetische Szenen im Umfang von Szene 05.
- Szene 05 „Der Junge im Keller“ selbst lag mir nicht vor. Ob ihr gespeicherter Inhalt eine der unten genannten Grenzen trifft, ist **nicht geprüft**.
- Zeiten sind lokale Miniflare-Zeiten (nicht Workers-Produktion), Bytes ohne Kompression. Langsames Netz wurde nicht gedrosselt gemessen, sondern über Zeitlimit und abgebrochene Antworten im Unit-Test geprüft.

## 1. Nachgewiesene Ursachen
| # | Befund | Beleg |
|---|---|---|
| 1 | **Szenentexte werden weit unter 20.000 Zeichen abgelehnt.** Feste Strukturgrenzen im Rich-Text-Format: 120 Blöcke, 30 Tabellenzeilen (inkl. Kopfzeile), 800 formatierte Textstellen, 5.000 HTML-Knoten. | Probe auf Basis-Code: Dialogtabelle mit 30 Zeilen (≈4.900 Zeichen) → abgelehnt; 29 → angenommen. 130 kurze Dialogabsätze (≈6.000 Zeichen) → abgelehnt. 110 formatierte Absätze → abgelehnt. |
| 2 | **Unklare Fehlermeldung.** Nur „Ungültiges oder zu komplexes HTML.“, ohne Feld und ohne Grund. | gleiche Probe |
| 3 | **Stilles Kürzen im Editor.** Eingefügte Tabellen (Tabulator-Text) wurden auf 30 Zeilen/10 Spalten abgeschnitten; „Zeile +“ tat ab 30 Zeilen kommentarlos nichts. | `rich-text.tsx` (vorher `slice(0,30)`, `slice(0,10)`) |
| 4 | **Eine nicht lesbare Szene legt alles lahm.** Szenenliste, Command Center **und** Regie-Katalog des Spielabends antworten alle mit 409. Die Regie wertet 409 als „Spielabend weg“ und verliert den Raum. | Reproduziert: Basis-Build auf einem Bestand mit einer Szene, die er nicht lesen kann → alle drei Endpunkte 409. |
| 5 | **Szenenliste ist überwiegend Ballast.** 1,07 MB für 39 Szenen; ~95 % je Eintrag ist `searchText` mit der rohen Rich-Text-JSON der Erzählung. Die Suche traf dadurch auch Formatierungsschlüssel („text“, „bold“) in jeder Szene. Command Center und Szenenverwaltung laden das bei jedem Öffnen. | Feldanalyse eines Listeneintrags: `searchText` 32.846 von ~34.400 Zeichen |
| 6 | **Abgebrochene Antworten führten zu stillen Leerdaten.** Bei einem unvollständigen 200-Body gab der API-Client `{error}` als Daten zurück; Lesezugriffe hatten kein Zeitlimit, ein hängender Request blockierte Polling-Sperren („in flight“) dauerhaft. | `api-client.ts` (vorher `.catch(() => ({error}))` ohne Statusprüfung) |
| 7 | Spieler-Szenenabfrage (alle 10 s im Spielerbereich) las mit `SELECT *` auch das komplette SL-Dokument jeder Szene aus D1, obwohl nur der Freigabestand gebraucht wird. | `server/story-scenes.ts` |

**Die 5.000-Zeichen-Grenze aus der früheren Planung gilt für Szenentexte nicht mehr.** Szenenfelder erlauben 20.000 sichtbare Zeichen und 130.000 Zeichen Quelltext; 5.000 gibt es nur noch an anderer Stelle (z. B. Ortsdossier-Kapitel, `allies` im Charakterprofil).

**Verworfen nach Nachprüfung:**
- „Command Center lädt 1 MB alle 10 s“ – die Komponente `CommandWorkspace` wird nirgends eingebunden (toter Code). Die zunächst gebaute ETag/304-Lösung ist in `30aa26b` wieder entfernt.
- „Szenenverwaltung lädt doppelt“ – bei einem frischen Seitenaufruf wird alles genau einmal geladen. Die Doppelung kam von meiner eigenen zweifachen Navigation.
- N+1-Abfragen auf den Szenenpfaden: keine gefunden. Die Spielerprojektion lädt Verweise gebündelt.

## 2. Behobene Probleme
| Datei | Änderung |
|---|---|
| `domain/location-rich-text.ts` | `richTextStructureLimits`: 1.000 Blöcke, 300 Tabellenzeilen, 10 Spalten, 10.000 Textstellen, 60.000 HTML-Knoten. Die eigentlichen Grenzen bleiben die sichtbaren Zeichen je Feld und die Quelltextlänge. Neu `richTextStructureIssue()` mit konkreter Meldung („Eine Tabelle hat 320 Zeilen; erlaubt sind höchstens 300 …“). |
| `domain/story-scene.ts`, `app/api/command-center/scenes/route.ts` | Der Grund wird durchgereicht, die API nennt das Feld: „Dialoge: …“, „Baustein 3: …“. |
| `app/spielbereich/modules/rich-text.tsx` | Kein Abschneiden beim Einfügen; an der Zeilen-/Spaltengrenze kommt eine Meldung; Reader-Bilder `loading="lazy"`. |
| `domain/scene-list.ts` (neu), `server/story-scenes.ts` | Listeneintrag mit sichtbarem Text als Suchindex. Eine nicht lesbare Szene bleibt als `unsupported` unter ihrem Titel sichtbar statt Totalausfall; beim Öffnen weiter 409, nichts wird umgeschrieben. Spielerprojektion liest nur `id,content`. |
| `server/live-stage.ts` | Szenenwähler des Spielabends ohne Suchindex. |
| `app/spielbereich/modules/api-client.ts` | GET-Zeitlimit 45 s; unvollständige oder unlesbare Antwort → `ApiError` Status 0 (wiederholbar). Schreibzugriffe ohne Zeitlimit, weil ein abgebrochener Speichervorgang ein ungewisses Ergebnis hätte. |

## 3. Vorher/Nachher (lokal, gleicher Bestand: 39 Szenen, je 15 Läufe, Median)
| Endpunkt | Bytes vorher | Bytes nachher | Median vorher | Median nachher |
|---|---|---|---|---|
| Szenenliste `/api/command-center/scenes` | 1.066.582 | 823.236 (−23 %) | 114 ms | 119 ms |
| Command Center `/api/command-center` | 1.073.362 | 830.016 (−23 %) | 143 ms | 161 ms* |
| Einzelszene | 77.714 | 77.714 | 13 ms | 15 ms |
| Live-Poll `/api/live-stage` | 2.616 | 2.620 | 21,9 ms | 20,4 ms |

\* Der Nachher-Lauf enthielt noch die inzwischen entfernte SHA-256-Berechnung für das ETag. Die Zeitunterschiede liegen im Rauschen: Die Einzelszene läuft im alten und neuen Stand über denselben Code und schwankt trotzdem um ±15 %. **Belastbar ist die Bytemenge, nicht die Millisekunde.** Mit echtem, stärker formatiertem Text fällt die Ersparnis größer aus, weil JSON-Overhead pro Formatierung entfällt. Eine Messung dazu steht aus.

Größter Gewinn ist nicht die Zeit, sondern die Funktion: Inhalte, die vorher **gar nicht** speicherbar waren (Befund 1), und Listen, die vorher **gar nicht** luden (Befund 4).

## 4. Tests
- Typecheck grün. Lint der geänderten Dateien grün. Gesamt-Lint: 18 Fehler, alle in nicht geänderten Dateien (`favors.tsx`, `mvp-vote-*.tsx`, `xp-session-desk.tsx`, `prototypes/spieltisch-2/*`), bestehender Stand.
- `node --experimental-strip-types --test tests/*.test.mjs`: **110 Dateien, 726/726 bestanden** (Basis: 108 Dateien, 716/716).
- `pnpm test`-Liste: 615/615 bestanden. Neu aufgenommen: `tests/p1-scene-performance.test.mjs`, `tests/p1-scene-content-limits.test.mjs`.
- **Geänderter bestehender Test:** `tests/npc-rich-text.test.mjs` schrieb die alte 120-Block-Grenze fest (130 Absätze = „nicht formatierbar“). Er prüft jetzt dieselbe Absicht an der neuen Grenze (Grenze + 1 → nicht formatierbar).
- HTTP-Regressionslauf auf dem Abschlussbuild, **20/20 bestanden:** Szene 05 im Umfang (45-zeilige Dialogtabelle, 130 Absätze, 12 Geheimnisse, 3 Bilder, Vision mit 3 Bildern) speichern → neu laden → identisch; Bearbeiten/Speichern/Neuladen; Grenzüberschreitung mit Feld und Grund, gespeicherter Inhalt unverändert; Regie-Kontext vollständig; Spieler: Regie 403, Live-Snapshot ohne SL-Daten, nach Gruppenfreigabe nur die Erzählung, keine Geheimnisse, SL-Notizen oder Dialogtabelle in `/api/session-scenes`, `/api/command-center(/scenes)`; nicht angemeldet → 401.
- Derselbe Lauf auf dem **Basis-Build**: Speichern der Szene schlägt fehl. Liegt sie im Bestand, antworten Liste, Command Center und Regie-Katalog mit 409.
- Rücksprungprobe: **`5aad65b` allein** auf dem Bestand mit der neuen Szene → Liste 200 (40 Szenen, die neue als `unsupported`), Öffnen 409, nichts überschrieben.
- Browser (lokal): Szenenverwaltung zeigt Absatz 130, Dialogtabelle mit 46 Zeilen, 12 Geheimnisse; keine Konsolenfehler.
- Bestehende Integrationssuite `scripts/test-local.mjs`: siehe Nachtrag unten.

## 5. Verbleibende Probleme und Risiken
1. **Rücksprung:** Szenen, die die neuen Grenzen nutzen, kann ein Build vor `5aad65b` nicht lesen (Totalausfall wie Befund 4). Empfehlung: zuerst `5aad65b` ausliefern, dann `90542fe`, oder beides zusammen, aber nie auf eine Version vor `5aad65b` zurückspringen.
2. Die Szenenliste bleibt groß (~21 KB je großer Szene), weil die Volltextsuche den sichtbaren Text braucht. Nächster Schritt wäre ein Suchindex, der erst beim Tippen geladen wird. Bewusst nicht umgesetzt (UX-Änderung).
3. `/api/command-center` liest Szenen doppelt aus D1 (`loadEntities` und `listScenes`). Nicht geändert, weil `loadEntities` breit genutzt wird.
4. Bilder werden in Originalgröße geladen; Vorschaubilder (`thumbnail`) gibt es nur in der Galerie.
5. Nicht gemessen: Verhalten auf echtem Mobilgerät, gedrosseltes Netz, Workers-CPU in Produktion.

## Nachtrag Integrationssuite
`node --experimental-strip-types scripts/test-local.mjs` auf dem Abschlussbuild (frischer, temporärer Speicher): **Exit 0, 2.348 PASS-Zeilen, keine FAIL-Zeile.** Die `SQLITE_CONSTRAINT`-Meldungen im Log sind absichtlich injizierte Fehler der Suite („Synthetic/M24 isolated failure“). Letzte Zeile: „Role foundation Test-D1 checks passed: 46 … no production database was used.“

Lokale Umgebung: `node_modules` im Worktree ist eine Junction auf den Worktree `storyboard-kommandozentrum-323cfc` (gleicher Commit, gleiches Lockfile), weil pnpm in dieser Sitzung nicht verfügbar war. Sie ist nicht Teil des Repos.
