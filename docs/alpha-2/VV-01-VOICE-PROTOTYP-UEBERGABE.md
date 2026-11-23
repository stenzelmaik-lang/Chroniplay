# VV-01 Voice & Video am Spieltisch – Phase 1 (Prototyp): Übergabe

- **Branch:** `claude/spieltisch-voice-p1`, Basis `origin/main` @ `b2524ef`
- **Auftrag:** Eigentümer am 23.11.2026, Konzept im Werkstatt-Ordner (`KONZEPT-voice-video-spieltisch.md`, `AUFTRAG-voice-video-phase-1.md`)
- **Kein Push auf `main`, kein Deployment, keine Migration, keine Secrets gesetzt.**

## Was es tut
Spielende und SL können während eines laufenden Spielabends direkt am Spieltisch einem Sprach- und Videoraum beitreten (Cloudflare RealtimeKit). Mikrofon und Kamera sind beim Beitreten aus. Es gibt keine Aufnahme und keine Transkription.

## Schalter und Konfiguration
| Variable | Bedeutung |
|---|---|
| `CVK_VOICE_CAMPAIGNS` | Komma-Liste der freigeschalteten Kampagnen, `*` wird ignoriert. **Fehlt sie, ist Voice aus** (Route 404, keine Leiste). |
| `CVK_VOICE_VIDEO` | **Eigentümerentscheidung 23.11.2026: zuerst nur Sprache.** Nur der Wert `1` zeigt die Kamera. Ohne die Variable gibt es keinen Kamera-Knopf. Für eine harte Grenze und den günstigeren Nur-Audio-Preis sollten die RealtimeKit-Presets den Meeting-Typ „Voice“ haben. |
| `CVK_VOICE=local-only` | Nur zusammen mit `AUTH_ACCESS_ENVIRONMENT=local-test`: überall verfügbar, ohne Secrets als Attrappe ohne Verbindung. In Produktion wirkungslos. |
| `CF_REALTIME_ACCOUNT_ID`, `CF_REALTIME_APP_ID`, `CF_REALTIME_API_TOKEN` | **Worker-Secrets**, setzt der Eigentümer selbst (Token mit Recht „Realtime“). Nur alle drei zusammen gelten. |
| `CF_REALTIME_PRESET_HOST` / `CF_REALTIME_PRESET_PARTICIPANT` | optional, Standard `group_call_host` / `group_call_participant` (Standard-Presets einer im Dashboard angelegten App) |

Ist die Kampagne freigeschaltet, aber nicht konfiguriert, zeigt die Leiste einen Hinweis. Die Route antwortet dann mit 503.

## Änderungen
- `domain/live-voice.ts`: Freigabe, Konfiguration, Modus, Preset nach Rolle, Teilnehmer-Anfrage (Token höchstens 12 h gültig, keine E-Mail, Name höchstens 80 Zeichen), ein Raum pro Abend.
- `server/live-voice.ts`:
  - `voiceStatus` und `voiceJoin`.
  - Rechteprüfung über `stageRoom` (nur Mitglieder eines laufenden, offenen Abends).
  - Der Raum pro `runId` liegt im Live-Room-Datensatz unter `$.voice`. Ein bedingtes UPDATE macht gleichzeitige Erstbeitritte eindeutig.
  - Das Cloudflare-API-Token verlässt den Server nie.
- `app/api/live-voice/route.ts`: `GET ?sessionId=` gibt den Status, `POST {action:'join',sessionId,runId}` den eigenen Zugang. Mit `sameOrigin`, 2-KB-Grenze und striktem Schema.
- `app/spielbereich/modules/spieltisch/voice-bar.tsx` und `.module.css`:
  - Einklappbare Karte oben rechts in der HUD-Ebene. Der Zustand wird pro Gerät gemerkt (`use-collapsed`: neu `'voice'`).
  - Kacheln mit Initialen oder Video, Rahmen für die sprechende Person, Steuerung für Mikro, Kamera und Verlassen.
  - Hinweis „Ton der anderen einschalten“, wenn der Browser Autoplay blockiert.
  - Die SDK wird erst beim Beitreten nachgeladen (`import()`).
  - Beim Verlassen des Tisches oder bei einem Abendwechsel wird aufgelegt.
- `stage.tsx`: bindet `VoiceBar` in die HUD-Ebene ein.
- Abhängigkeit `@cloudflare/realtimekit@2.0.4` (exakt, veröffentlicht am 19.10.2026, Apache-2.0). Beide Lockfiles sind aktualisiert. Hinweis: `npm install --package-lock-only` hat in `package-lock.json` zusätzlich `dev`/`peer`-Markierungen anderer Pakete neu berechnet, weil einige transitive Pakete jetzt Produktionsabhängigkeiten sind.
- Tests:
  - `tests/live-voice.test.mjs` (in `pnpm test` aufgenommen).
  - `tests/live-voice-integration.mjs` (in `tests/integration.mjs`).
  - `scripts/test-local.mjs` setzt `CVK_VOICE=local-only` im nicht interaktiven Lauf oder mit `--voice`.
  - Die CI-Lintliste ist ergänzt.

## Prüfungen (23.11.2026, lokal, Node 26, pnpm 11.25.0)
| Prüfung | Ergebnis |
|---|---|
| `pnpm run typecheck` | ohne Fehler |
| ESLint auf allen neuen oder geänderten Dateien | ohne Befund |
| `pnpm run lint` (gesamt) | 18 Fehler, 19 Warnungen, **alle in unveränderten Dateien** (`favors.tsx`, `mvp-vote-*.tsx`, `xp-session-desk.tsx`, `prototypes/spieltisch-2/*`), schon auf `main` vorhanden. Die CI lintet nur die Dateiliste. |
| `pnpm test` | 633 von 633 bestanden |
| `node --experimental-strip-types --test tests/*.test.mjs` | 744 von 744 bestanden |
| `pnpm run test:integration` (Build und lokale Miniflare-Instanz) | durchgelaufen, 2364 PASS, keine Fehler, davon 15 `VOICE`-Prüfungen |

Die `VOICE`-Integration läuft direkt nach `dashboardHubIntegration`, und das hat einen Grund:
- **Davor** brachte der beendete Test-Spielabend die HUB-Prüfung „letzter Spielabend“ zu Fall.
- **Ganz am Ende** sind die Fixture-Sitzungen nach `accountAccessIntegration` nicht mehr gültig.

## Prüfgrenzen
- **Keine echte RealtimeKit-Verbindung getestet:** Es gibt noch keine App und keine Secrets. Ungeprüft sind deshalb:
  - der Raum- und Tokenablauf gegen Cloudflare (Antwortformat `data.id` / `data.token` laut Doku, beide Hüllen `data` und `result` werden akzeptiert),
  - die Tonwiedergabe durch die SDK,
  - die Namen der Standard-Presets.
- **Kein Browsertest mit Kamera oder Mikrofon** und kein Test auf echten Mobilgeräten.
- **Leere Räume:** Gleichzeitige Erstbeitritte können einen zusätzlichen leeren Raum anlegen. Er bleibt ungenutzt und kostet nichts.

## Nicht in Phase 1 (folgt)
- **Phase 2:** Design-Feinschliff, frei verschiebbares Fenster, Sprecheransicht groß, Ducking der Spieltisch-Musik, Geräteauswahl mit Pegel, Handy-Layout.
- **Phase 3:** Minutenmessung pro Kampagne über RealtimeKit-Webhooks und Monatsübersicht.
- **Vor dem ersten Testabend:** Abschnitt zur Datenschutzerklärung (Cloudflare als Auftragsverarbeiter, keine Aufnahme).

## Aufgaben des Eigentümers vor einem echten Test
1. Im Cloudflare-Dashboard unter Realtime → RealtimeKit eine App anlegen. Für den Start mit nur Sprache zwei Presets mit dem Meeting-Typ „Voice“ anlegen (Host und Teilnehmer). Ihre Namen kommen in `CF_REALTIME_PRESET_HOST` / `CF_REALTIME_PRESET_PARTICIPANT`.
2. Ein API-Token mit dem Recht „Realtime“ erstellen.
3. Die Secrets selbst per `wrangler secret put` setzen (nicht im Chat).
4. Nach Freigabe eines Deployments `CVK_VOICE_CAMPAIGNS=chronik-von-kleve` setzen. Das Leeren der Variable schaltet Voice ohne Codeänderung ab.

## Nachtrag 23.11.2026: Voice in der oberen Leiste (Eigentümerwunsch)
- Die schwebende Karte (`voice-bar.tsx`) ist entfernt. Die Steuerung sitzt jetzt in der oberen Leiste neben dem Spielabend-Titel (`voice-control.tsx`): „Voice“ zum Beitreten, danach Mikro an/aus, Zahl der Personen, Auflegen.
- Die Zustandslogik steckt in `use-voice.ts`. **Sprechen wird lokal gemessen:** Pro Audiospur läuft ein Web-Audio-Analyser, der nie mit den Lautsprechern verbunden ist. Liegt der Pegel über der Schwelle, gilt die Person als sprechend, mit 450 ms Nachlauf.
- Die Zuordnung erfolgt über `customParticipantId` (= Mitglieds-ID).
- **Spielerleiste:** Wer im Sprachchat ist, bekommt ein Mikro-Abzeichen am Profilbild (gold = Mikro an, grau mit rotem Symbol = stumm). Wer spricht, bekommt einen pulsierenden goldenen Ring. Der Status steht auch im zugänglichen Namen („spricht“, „im Sprachchat, stumm“).
- **Video-UI** gibt es in der oberen Leiste nicht. Sie folgt in einer späteren Phase. `CVK_VOICE_VIDEO` bleibt ohne Wirkung auf die Oberfläche.
- **Geprüft:**
  - typecheck, ESLint (geänderte Dateien), `pnpm test` 635/635, alle Unit-Tests 746/746.
  - Lokale Browser-Sichtprüfung im Testmodus (1100 px): Leiste, Mikro-Zustände, Abzeichen und Ring. Den Sprechzustand habe ich dafür im DOM gesetzt, weil die Attrappe keinen Ton hat.
  - Die Integration wurde nicht neu ausgeführt, weil am Server nichts geändert ist.
- **Bekannt und nicht neu:** Unter etwa 850 px ist die obere Leiste der SL schon ohne Voice zu voll. Die Voice-Gruppe wird unter 900 px auf Symbole verkleinert.
