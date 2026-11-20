# Galerie: nur eigene Bilder – Übergabe (21.11.2026)

**Branch:** `claude/confident-nightingale-d96d82` · **Basis:** `df55055` (= main, Live-Tag `df55055-Werkzeugfelder`, Worker-Version b191ca45)
**Status:** lokal geprüft, **nicht** gepusht, **nicht** deployt, keine Produktionsdaten geändert.

## Fehlerbericht der SL
„In der Galerie von anderen Spielern kommen die Bilder von anderen an, das darf nicht sein.“

## Ursache
Kein Zugriffsfehler im engeren Sinn, sondern ein Bauplan, der nicht mehr gewünscht ist:

1. Die Spieler-Galerie (`/api/character-gallery`, `server/character-gallery.ts`) war als **Gruppengalerie** gebaut (4c,
   Commit `8da96d9`). Sie listete von **allen** Charakteren der Kampagne jedes Bild, das „Für die Gruppe sichtbar“
   markiert war, und lieferte diese Bilder auch über die direkte Adresse `?characterId=…&fileId=…` aus.
2. „Bild hinzufügen“ in der Galerie (Commit `672a060`) speicherte jedes neue Bild **automatisch mit `shared:true`**.
   Wer in „seiner“ Galerie ein Bild hochlud, gab es damit unbemerkt allen anderen Spielern frei.

Zusammen landeten so Bilder von Spieler A in der Galerie von Spieler B.

## Änderung (serverseitig)
- **Neu `domain/player-gallery.ts`:** eine Regel `galleryImagesFor(viewer, ownerId, body)` für Liste und Einzelbild.
  - Spieler: nur Bilder **eigener** Charaktere (freigegeben oder privat, dazu die Erscheinungsbild-Galerie).
  - Fremde Charaktere: leer – auch Bilder, die „für die Gruppe“ freigegeben sind.
  - SL: wie bisher nur die mit der Gruppe geteilten Bilder.
  - Nicht aktive Mitglieder: nichts.
- **`server/character-gallery.ts`:** Für Spieler steht `r.owner_id=?` direkt in der SQL-Abfrage; fremde Charaktere
  werden gar nicht erst geladen. Die Einzelbild-Route nutzt dieselbe Zeilenmenge und dieselbe Regel → fremde Bilder per
  direkter ID ergeben **404**. Dateien kommen weiter nur aus den Dateien des Charakterbesitzers.
- **`server/live-participants.ts`:** `sharedImages` liegt jetzt in der Domain und wird von dort übernommen
  (unverändertes Verhalten für das Teilnehmerprofil am Spieltisch).
- **Oberfläche `player-gallery.tsx`:** „Bild hinzufügen“ speichert mit `shared:false`; Hinweise und Leertext sagen,
  dass die Galerie persönlich ist. Menütext der Galerie in `navigation.ts`: „Die Bilder deiner eigenen Charaktere.“

Keine Schemaänderung, keine Migration, keine bestehenden Freigaben geändert. Bilder, die schon `shared:true` tragen,
bleiben am Spieltisch (Teilnehmerprofil) für die Mitspieler sichtbar – das ist die ausdrückliche Gruppenfreigabe im
Charakterprofil. Sie erscheinen nur nicht mehr in fremden Galerien.

## Prüfungen (beobachtet)
| Prüfung | Ergebnis |
|---|---|
| `tsc --noEmit --incremental false` | Exit 0 |
| ESLint, geänderte Dateien | 0 Probleme |
| ESLint, ganzes Repo (`pnpm run lint`-Aufruf) | Exit 1: 18 Fehler, 19 Warnungen, **alle in nicht berührten Dateien** (u. a. `prototypes/spieltisch-2/*`, `favors.tsx`, `mvp-vote-*.tsx`, `xp-session-desk.tsx`, `tests/npc-*`) – Altbestand, nicht verändert |
| Build (`node scripts/run-framework.mjs build`) | Exit 0 |
| `node --experimental-strip-types --test tests/*.test.mjs` | **707 Tests, 707 bestanden, 0 fehlgeschlagen** (inkl. neuem `tests/player-gallery.test.mjs`, 6 Tests) |
| `tests/character-profile-integration.mjs` gegen isolierte lokale Instanz (`scripts/test-local.mjs --ge-01`, Port 8931, synthetische Konten `command-a`, `command-b`, `command-gm`) | **58/58 bestanden** |

Abgedeckte Fälle im Integrationstest: Spieler B sieht A's Bilder weder in der Liste noch per direkter ID (geteilt und
privat), auch nicht über `/api/files?id=` (privat); Spieler A sieht eigene geteilte und private Bilder, nicht B's;
SL sieht geteilte, nicht private Bilder; nicht angemeldet → 401 für Liste und Einzelbild; Upload aus der Galerie bleibt
privat und erscheint nur bei A. Das Teilnehmerprofil am Spieltisch zeigt weiter nur geteilte Bilder.

**Prüfdaten gelöscht:** Der Test löscht seine Bilder und stellt das Profil wieder her; der gesamte lokale Bestand
`.local-test/ge-01` wurde danach entfernt, die Instanz gestoppt.

## Prüfgrenzen
- Keine Sichtprüfung im Browser und keine Prüfung auf echtem Mobilgerät.
- Nicht gegen Live oder Produktionsdaten geprüft.
- `node_modules` war im Worktree per Verzeichnisverknüpfung aus einem Nachbar-Worktree mit identischem Lockfile geliehen.

## Nachtrag: Persönliches Archiv (SL-Entscheidung 21.11.2026: „Ja, auch Archiv“)
Das Archiv (Notizbuch → „Persönliches Archiv“) las über `GET /api/files` auch Dateien anderer Spieler, die diese auf
„Für die Gruppe“ gestellt hatten. Jetzt:
- **Neu `domain/file-list.ts`** (`fileListQuery`): Spieler erhalten nur **eigene Dateien** und **Gruppendateien der
  SL**. SL heißt: aktive Mitgliedschaft `campaign_owner`/`campaign_gm` in der Kampagne, oder – ohne
  Mitgliedschaftszeile – die Alt-SL über `GM_EMAIL` (gleiche Regel wie `server/role-resolver.ts`). Gesperrte SL-Konten
  zählen nicht. Die SL sieht wie bisher eigene, alle Gruppen- und alle SL-Dateien, nie private Spielerdateien.
- `app/api/files/route.ts` nutzt diese Abfrage für die Liste. Der direkte Abruf `?id=` ist unverändert: Gruppendateien
  bleiben dort abrufbar, wo sie eingesetzt sind (z. B. am Spieltisch), private fremde Dateien ergeben 404.
- Texte im Archiv angepasst („Freigaben der Spielleitung“, „Dateien anderer Spieler erscheinen hier nie“).

Prüfungen des Nachtrags (beobachtet): `tsc` Exit 0 · ESLint der geänderten Dateien 0 Probleme · Build Exit 0 ·
`node --experimental-strip-types --test tests/*.test.mjs` **713/713 bestanden** (inkl. neuem `tests/file-list.test.mjs`,
6 Tests gegen eine echte SQLite-Datenbank im Speicher) · `tests/character-profile-integration.mjs` lokal **65/65**
(Archiv A ohne Dateien von B auch bei Gruppenfreigabe, Archiv B ohne Dateien von A, SL-Gruppendateien sichtbar, SL sieht
Spieler-Gruppendateien, nicht angemeldet 401) · `tests/live-deliveries-integration.mjs` lokal **57/57**.
Prüfbestand `.local-test/ge-01` danach gelöscht, Instanz gestoppt.

Hinweis: Spieler sehen eigene ältere Gruppendateien weiterhin; Gruppendateien anderer Spieler verschwinden aus ihrer
Liste, werden aber nicht gelöscht oder umgestellt.

## Offene Punkte
- Vor einem Deploy: `wrangler deployments list` prüfen, Live-Commit muss in HEAD stecken; Konfiguration per
  `wrangler versions view <live-id> --json` übernehmen – nur mit Freigabe.

## Ausdrücklich nicht getan
Kein Push, kein Merge auf main, kein Deployment, keine Remote-D1-Befehle, keine Produktionsdaten geändert.
