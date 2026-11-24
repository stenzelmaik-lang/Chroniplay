# Versionierung und Meilensteine (ab 24.11.2026)

Damit Eigentümer, Claude, Codex und ChatGPT jederzeit wissen, wo ChroniPlay steht, trägt jeder Stand eine Version: **`A.M.N`**, aktuell **`2.5.0`**.

| Stelle | Bedeutung | Wer zählt hoch |
|---|---|---|
| **A**: Alpha-Generation | `2` = Alpha 2, die geschlossene Alpha mit echter Runde | Eigentümer, bei einem großen Sprung (z. B. offene Alpha = 3) |
| **M**: Meilenstein | `5` = Meilenstein 2.5, der laufende Arbeitsabschnitt mit eigenem Ziel | Eigentümer, wenn ein Abschnitt abgeschlossen ist |
| **N**: Ausgabe | `0, 1, 2 …` = jede Veröffentlichung auf chroniplay.cc innerhalb des Meilensteins | Wer deployt, bei jedem Live-Gang +1 |

Beispiele: `2.5.0` ist der Schnitt (Grundlage). `2.5.1` ist der nächste Live-Gang. `2.6.0` ist der Beginn des nächsten Meilensteins.

## Warum Meilenstein statt Monat
Ein Monat sagt nur, *wann* gearbeitet wurde. Ein Meilenstein sagt, *woran*. Er hat ein Ziel und eine Liste, und er endet, wenn das Ziel erreicht ist, egal ob nach drei oder sechs Wochen. Das Datum steht trotzdem in jedem Release-Nachweis.

## Wo die Version steht
1. **`package.json`** → `"version": "2.5.0"`, wird bei jedem Live-Gang erhöht.
2. **Worker-Tag bei Cloudflare** → `v2.5.0-<commit>`, zum Beispiel `v2.5.0-f2334de`.
3. **Git-Tag** → `v2.5.0` auf dem Commit, der live ist. Ein Tag wird nur mit Freigabe des Eigentümers gesetzt.
4. **Release-Nachweis** → `docs/releases/JJJJ-MM-TT-vA.M.N-<thema>.md`.
5. **GitHub-Meilenstein** → „Alpha 2.5“. Jeder PR des Abschnitts wird ihm zugeordnet.

## Branches und PRs
- Branch-Name: **`<agent>/<A.M>-<thema>`**, zum Beispiel `claude/2.5-ci-struktur` oder `codex/2.5-inventar-verkauf`. So ist am Namen sichtbar, zu welchem Meilenstein die Arbeit gehört.
- PR-Titel: **`[2.5] <Thema>`**, zum Beispiel `[2.5] CI strukturieren`.
- Ein Auftrag ist ein Branch und ein PR. Gemergt wird mit **Squash**, danach wird der Branch gelöscht.
- Ein PR ändert die Version nicht. Erst der Live-Gang erhöht `N` und schreibt den Release-Nachweis.

## Meilenstein 2.5: Ziel
Sauber weiterarbeiten ohne Altlasten. Grundlage ist der Schnitt `2.5.0` (siehe `docs/ALPHA-2.5-SCHNITT.md`). Die Themenliste pflegt der Eigentümer im GitHub-Meilenstein „Alpha 2.5“.
