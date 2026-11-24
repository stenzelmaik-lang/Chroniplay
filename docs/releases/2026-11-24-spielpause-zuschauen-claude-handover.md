# Spielpause: Andere beim Rubikwürfel zuschauen lassen (Übergabe Claude Code)

Stand: 24.11.2026. Branch `claude/spielpause-wuerfel`, Worktree `.claude/worktrees/spielpause-wuerfel`, Basis-Commit `2bb2653` (Rubikwürfel mit privater Bestenliste). Diese Änderungen liegen **uncommittet** darüber. **Kein Commit, kein Push, kein Deployment, keine Migration.** Für diese Funktion ist keine neue Migration nötig.

## Mit dem Besitzer abgestimmt (24.11.2026)

- Zuschauer sehen **nur den Würfel**, die laufende Zeit und die Zahl der Züge. Die Bestenliste bleibt nur beim Spieler.
- Eine Einladung lässt sich **jederzeit zurücknehmen**. Sie endet außerdem mit dem Spielabend.
- Einladen kann man **Mitspieler und die SL** des laufenden Abends. Ohne Einladung sieht niemand etwas, auch die SL nicht.

## So funktioniert es

- Eigener Würfel offen → in der Rundenleiste der Knopf **„Zuschauen“** (mit Zahl der Zuschauer). Das Feld zeigt alle am Tisch mit „Einladen“ bzw. „Zurücknehmen“ und den Satz, dass die Bestenliste privat bleibt.
- Der Eingeladene bekommt unten rechts einen Hinweis „… lädt dich ein, beim Rubikwürfel zuzuschauen“ (Zuschauen / Später) und zusätzlich im Spielpause-Menü den Eintrag „Zuschauen: Würfel von …“.
- Zuschaueransicht: derselbe Würfel, nur ansehen. Ziehen oder Pfeiltasten drehen **nur die eigene Ansicht**, nie den Würfel. Neue Züge werden animiert (Rückstand wird schneller nachgespielt), Zeit und Züge laufen mit. Wird die Einladung zurückgenommen oder endet der Abend, erscheint „Zuschauen beendet“.

## Technik: wie der Live-Tisch

Wiederverwendet wird das Muster der vorhandenen Live-Kanäle (`live-deliveries`, `live-stage`): kleine JSON-Dokumente in `settings`, je Kampagne und Spielabend, an den laufenden Abend gebunden (`stageRoom`, `runId`), Teilnehmer aus `roomCrew(liveMembers)`, Abholung per Polling nur bei sichtbarem Tab. Bewusst **eigene Route** statt Erweiterung des großen Bühnen-Snapshots, damit nichts davon versehentlich in den Bühnenstand gerät.

- `domain/spielpause-watch.ts` (neu, rein): Befehle `invite` / `withdraw` / `publish`, Prüfregeln für den Würfelstand (nur Runde, Zugfolge in Notation, Zeit, Züge, Uhrstatus; `strict`, also keine Ergebnisse), Einladungsregeln (nicht sich selbst, keine Doppelten, höchstens 8 Zuschauer, alter Abend = leer).
- `server/spielpause-watch.ts` (neu): Gastgeber und Zuschauer kommen immer aus der Anmeldung. Einladungen in `spielpause-watch:<Kampagne>:<Abend>` (CAS über `mutateSetting`), Würfelstand je Spieler in `spielpause-feed:<Kampagne>:<Abend>:<Mitglied>` (nur der Spieler selbst schreibt). Der Würfelstand wird **nur gespeichert, solange jemand eingeladen ist**; mit dem letzten Zurücknehmen wird er gelöscht. Ohne Einladung antwortet der Lesezugriff mit demselben 404 wie für einen unbekannten Spieler.
- `app/api/spielpause/watch/route.ts` (neu): `GET ?sessionId=` eigener Stand (wen ich eingeladen habe, wen ich einladen kann, wer mich eingeladen hat); `GET ?sessionId=&host=` Würfel eines Gastgebers (nur mit Einladung); `POST` mit Same-Origin-Prüfung, max. 20 kB.
- `spielpause/toys-runtime.js`: meldet nach jedem fertigen Zug, bei neuer Runde und beim Lösen den Würfelstand an den Rückruf `services.onCubeChange` (alle Züge der Runde ab gelöstem Würfel, Mischen eingeschlossen; ab 4000 Zügen pausiert die Übertragung bis zur nächsten Runde). Der Rückruf entscheidet, ob etwas den Browser verlässt.
- `spielpause/watch-runtime.js` (neu): Zuschaueransicht (zeichnet mit `drawCube` aus `toys-core.js`), reine Hilfen `feedDelta` und `watchElapsed`.
- `spielpause/spielpause.tsx` / `.module.css`: Einladungsfeld, Hinweis, Zuschaueransicht. Senden höchstens alle 350 ms, immer der neueste Stand, nur bei mindestens einem Zuschauer. Status-Abfrage alle 4 s, Zuschauer-Abfrage alle 0,7 s, beides nur bei sichtbarem Tab.
- `stage.tsx`: gibt `sessionId` und `runId` an die Spielpause weiter (eine Zeile). Ohne diese Angaben (z. B. Offline-Vorschau) ist Zuschauen ausgeblendet.
- `package.json` (`test`, `test:spielpause`), `tests/integration.mjs`, `.github/workflows/ci.yml` (ESLint-Liste) ergänzt.

## Prüfungen (beobachtet)

- `node --experimental-strip-types --test tests/*.test.mjs`: **782/782 bestanden**. `npm test` (= `pnpm test`, pnpm war in dieser Shell nicht im Pfad): **671/671 bestanden**.
- Neu `tests/spielpause-watch.test.mjs` (7 Tests): Einladen/Zurücknehmen, nicht sich selbst, Grenze, alter Abend = leer; Befehle ohne Gastgeber-Feld, Würfelstand ohne Ergebnisse; Zuschauer-Nachbau ergibt denselben Würfel wie beim Gastgeber; Zuschauer-Uhr; Server liest Gastgeber/Zuschauer nur aus der Anmeldung; Route mit Same-Origin.
- `tsc --noEmit` ohne Fehler; ESLint der neuen und geänderten Dateien ohne Befund.
- `npm run test:integration` (Build + isolierter lokaler Server, synthetische Konten): **2374 Prüfungen bestanden**, davon 38 neue `SPIELPAUSE-WATCH` in `tests/spielpause-watch-integration.mjs`: nicht angemeldet 401; vor Abendbeginn nichts; Spieler B und SL sehen ohne Einladung 404; fremde Kampagne, gesperrt, nicht verknüpft abgelehnt; sich selbst / Fremde einladen 400; alter Abend 409; fremde Felder 400; fremder Origin 403; nach Einladung sieht B die Züge (Antwort nur `host`, `feed`, `ageMs`, keine Bestenliste); SL weiterhin 404; Einladung einseitig; B kann A's Würfel nicht überschreiben; SL sieht nach Einladung; nach Zurücknehmen 404 und gespeicherter Würfel gelöscht; nach Abendende 404/409.
- Browser: `tests/spielpause-watch-browser.mjs` gegen `test-local.mjs --zustandswerte` (Port 8849, synthetische Demo-Konten, Edge headless, Playwright aus der Codex-Laufzeit über `CVK_PLAYWRIGHT_MODULE`, `CVK_BROWSER_CHANNEL=msedge`): **alle 6 Prüfgruppen bestanden** – A öffnet „Zuschauen“ und lädt B ein; B bekommt den Hinweis und sieht A's gemischten Würfel (22 Züge); zwei Drehungen von A erscheinen bei B mit Zugzahl 2, ohne Bestenliste; SL bekommt keinen Hinweis und keinen Würfel; A nimmt zurück → bei B „Zuschauen beendet“; keine Browserfehler. Bildschirmfotos (1440 px und 390 px) in `.local-work/spielpause-watch-qa/` (nicht im Repo).
- Nach dem ersten Browserlauf wurde der Einladungshinweis von unten rechts (deckte das „Druck“-Feld ab) nach oben rechts unter „Kontext“ verschoben; danach neu gebaut und der Browsertest erneut bestanden.

## Prüfgrenzen

- „Live“ heißt hier Polling wie am übrigen Spieltisch: Zuschauer sehen Züge mit etwa 0,5–1,5 s Verzögerung, nicht in Echtzeit.
- Kein Test auf echtem Mobilgerät, nicht in Firefox/Safari.
- Würfelstände beendeter Abende bleiben als kleine Zeile in `settings` liegen, falls beim Abendende noch jemand eingeladen war (nur Zugfolge, Zeit, Züge; keine Namen, keine Bestenliste). Sie werden nicht mehr ausgeliefert (anderer `runId`). Aufräumen wäre ein eigener kleiner Auftrag.
- Gastgeber kann technisch auch die SL sein (die Spielpause steht auch ihr zur Verfügung); abgestimmt war nur „Spieler lädt ein“.

## Offen / ausdrücklich nicht getan

- Kein Commit, kein Push, kein Deployment, keine Produktionsmigration (Migration 0020 aus dem Basis-Commit braucht weiterhin die gesonderte Freigabe).
- Spielbox auf der Startseite: eigener Auftrag (andere Sitzung).
