# Prüfung GitHub und chroniplay.cc (24.11.2026)

Branch `claude/stabilisieren`, Basis `main` @ `dfc1d07`. Live geprüft wurde Worker `3273d466`, öffentlich und mit SL-Konto, nur lesend. Es lief kein Deployment, und es wurde nichts gelöscht.

## Behoben in diesem Branch
1. **Roter CI-Job „Isolated SL browser journey“** (`story-editor-checks.yml`), seit dem 12.11.2026 auf `main` rot.
   - Ursache: Seit dem Storyboard-Release vom 15.11.2026 öffnet das Command Center mit „Bücher und Kampagnen“. Beide Browsertests (`tests/story-browser-smoke.mjs`, `tests/preparation-guide-browser.mjs`) erwarteten noch die klassische Ansicht.
   - Lösung: Die Tests öffnen die klassische Ansicht über `?ansicht=klassisch`, so wie es die App vorsieht, und behalten sie auch bei Neuladen.
   - Lokal mit Edge (`CVK_BROWSER_CHANNEL=msedge`) laufen beide Tests grün.
2. **Sicherheits-Header fehlten auf allen Seiten.** `middleware.ts` setzt jetzt:
   - HSTS mit 180 Tagen, ohne Subdomains
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy`: Kamera und Mikro nur für die eigene Seite (Voice), keine Standortabfrage
   - Bereits gesetzte Werte einer Route bleiben erhalten. Eine CSP fehlt bewusst noch, weil YouTube, Kartenkacheln und das Voice-SDK eine eigene, getestete Freigabeliste brauchen.
   - Test: `tests/security-headers.test.mjs`.
3. **Footer-Links auf dem Handy** waren 18 px hoch. Sie haben jetzt eine Tippfläche von 44 px.

## Befunde ohne Änderung (Entscheidung des Eigentümers oder eigener Auftrag)
- **Bilder zu groß:** Die NPC-Seite lädt 13 MB, rund 2 MB pro Porträt bei 1086×1448 px, angezeigt werden 319 px. Galerie- und Ortsbilder verhalten sich genauso, jedes Bild braucht über 1 s. Lösung: Beim Hochladen eine kleine Vorschau erzeugen und in Listen nur diese laden. Das ist ein eigener Auftrag, denn der Cache (`private, no-store`) ist bewusst aus Datenschutzgründen gewählt.
- **„Workers Builds“ ist bei jedem PR rot:** Die Git-Anbindung von Cloudflare baut jeden Push. Würde sie gelingen, würde jeder Merge auf `main` ohne Freigabe live gehen, was gegen die Regel verstößt. Empfehlung: im Cloudflare-Dashboard abschalten oder auf Vorschau-Builds ohne Deploy beschränken.
- **Lokale Testports teilen sich mehrere Agenten:** `scripts/test-local.mjs` nutzt standardmäßig Port 8793. Laufen Codex und Claude gleichzeitig, kollidieren sie (`EADDRINUSE` oder ein zufälliges `fetch failed`). Empfehlung: Jeder Agent setzt `CVK_TEST_PORT`.
- **GitHub-Aufräumliste:**
  - 84 von 91 Branches sind vollständig in `main` und könnten gelöscht werden. Das geschieht nur nach Freigabe.
  - Die Entwurfs-PRs #79 bis #82 sind inhaltlich schon in `main` und könnten geschlossen werden.
  - Offen mit eigenem Inhalt: #78 (`chatgpt/alpha2-ep-abrechnung-ui`, 22 Commits, vermutlich durch #79 überholt), #70 und #46, Release-Nachweise in `claude/release-google-verifizierung`, `claude/release-record-voice` und `claude/ge02-release-nachweis`, `claude/chroniplay-abenteuerjournal-23ec22` (Journal wurde entfernt) und `codex/privacy-hide-residential-address-20261123` (vermutlich durch #95 erledigt).
- **Lint:** 12 Fehler im Prototyp `prototypes/spieltisch-2`, nicht live. Die Fehler in den App-Modulen sind im Branch `claude/aufraeumen` behoben.
- **Live geprüft und unauffällig:**
  - Alle öffentlichen Seiten antworten mit 200, alle 30 eingebundenen Dateien und alle externen Links funktionieren. Robots und Sitemap sind in Ordnung, Google ist verifiziert.
  - Es gibt keine Konsolenfehler, auch nicht im angemeldeten Bereich (Zuflucht, Command Center: Spielabende, Charaktere, NPCs, Orte).
  - Auf dem Handy gibt es keinen waagerechten Überlauf, alle Bilder haben Alt-Texte.
