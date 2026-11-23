# Übergabe: Startseite – FAQ, Entwicklungsstand, Impressum, Datenschutz, SEO

Stand: 23.11.2026 · Claude Code · Branch `claude/release-startseite-community` (Basis `origin/main` @ `6068899`), Worktree `../chronik-von-kleve-startseite`

## Änderungen
| Bereich | Dateien | Inhalt |
|---|---|---|
| Entwicklungsstand | `app/visitor/content.ts`, `visitor-shell.tsx` | Konzept ✔ → Geschlossene Alpha ✔ (seit Oktober 2026) → Alpha 2.0 (aktuell, November 2026) → Weitere Runden & Kampagnen (in Planung); Button zum Entwicklertagebuch |
| FAQ | `content.ts`, `visitor-shell.tsx`, `visitor-shell.module.css` | 12 Fragen als `<details>`-Akkordeon (ohne JavaScript). Fakten aus dem Code bzw. vom Besitzer entschieden: Alpha kostenlos, eigene Runden geplant ohne Termin |
| Fußzeile | `app/visitor/site-footer.tsx` + `.module.css` (neu) | gemeinsam für Startseite und Rechtsseiten: Discord, GitHub, Impressum, Datenschutz, „© 2026 ChroniPlay · Alle Rechte vorbehalten“ |
| Rechtsseiten | `app/rechtliches/legal-shell.tsx` + `legal.module.css` (neu), `app/impressum/page.tsx`, `app/datenschutz/page.tsx` | Impressum (§ 5 DDG, § 18 Abs. 2 MStV, Werbe- & Kooperationsanfragen per vorbelegter E-Mail, Haftung, Urheberrecht, Markenhinweis Paradox, keine Open-Source-Lizenz, Streitbeilegung). Datenschutzerklärung nach tatsächlicher Verarbeitung im Code (siehe unten). Text zur Aktivitätsmessung unverändert übernommen |
| Persönliche Angaben | `domain/legal-contact.ts`, `server/legal-config.ts` (neu), `cloudflare-env.d.ts` | ausschließlich aus Cloudflare-Variablen (Repo ist öffentlich); Rückfall auf `CVK_PRIVACY_*`; fehlende Pflichtangaben → sichtbarer Hinweis statt leerer Felder |
| SEO | `app/layout.tsx`, `public/robots.txt`, `public/sitemap.xml`, `public/images/og-chroniplay.jpg` (neu) | Titel und Beschreibung für ChroniPlay statt „Chronik von Kleve · Die Domäne“, `metadataBase` (Vorschaubild zeigte bisher auf `http://localhost:3000/og.png`), Canonical, Open Graph und Twitter mit neuem Bild 1200×630, `themeColor`, Seiten-Metadaten für Impressum und Datenschutz, schema.org-JSON-LD (WebSite, Organization, WebApplication, FAQPage), robots sperrt private Bereiche, Sitemap mit drei öffentlichen Seiten |
| Tests | `tests/startseite-rechtliches.test.mjs` (neu, in `npm test` eingetragen) | 9 Tests: Variablen-Auswertung, Werbeanfrage-Link, keine fest eingetragene persönliche E-Mail im Code, FAQ, Entwicklungsstand, Fußzeile, Metadaten, Vorschaubild 1200×630, robots/Sitemap |

Keine neuen Abhängigkeiten, keine Migration, keine Änderung an Spielbereich-Routen oder Rechten.

## Grundlage der Datenschutzerklärung (im Code geprüft)
- Einziges Cookie `chroniplay_session` (HttpOnly, SameSite=Lax, Secure, 30 Tage) erst nach Anmeldung. Live geprüft: Die Startseite setzt ohne Anmeldung kein Cookie.
- Local Storage nur für Anzeige-Einstellungen im Spielbereich.
- Hosting Cloudflare (Worker, D1, R2). Keine Analyse- oder Tracking-Dienste, keine Google Fonts.
- Externe Inhalte nur im Spielbereich: YouTube über `youtube-nocookie.com` (Ambiente, wenn die SL abspielt), OpenFreeMap-Kacheln (Weltkarte). Adresssuche `gdi-api.krzn.de` serverseitig nur im SL-CMS.
- Discord, GitHub, YouTube, Twitch nur als Links.

## Vom Besitzer vor dem Deploy zu setzen (Cloudflare → Worker `chronik-von-kleve` → Einstellungen → Variablen)
| Variable | Pflicht | Beispiel |
|---|---|---|
| `CVK_IMPRESSUM_NAME` | ja | Vor- und Nachname |
| `CVK_IMPRESSUM_ANSCHRIFT` | ja | `Straße 1 \| 12345 Ort \| Deutschland` (Zeilen mit `\|`) |
| `CVK_IMPRESSUM_EMAIL` | ja (sonst `CVK_PRIVACY_CONTACT`) | Kontaktadresse |
| `CVK_IMPRESSUM_TELEFON` | nein | |
| `CVK_WERBUNG_EMAIL` | nein (sonst Kontaktadresse) | eigene Adresse für Werbeanfragen |

Der Build setzt `keep_vars: true`. Im Dashboard gesetzte Variablen bleiben bei Deploys erhalten.

## Prüfungen (beobachtet)
- `tsc --noEmit`: ohne Fehler. ESLint auf allen geänderten und neuen Dateien: ohne Fehler.
- `npm test`: 624/624. `node --experimental-strip-types --test tests/*.test.mjs` (111 Dateien): 735/735.
- Lokaler Dev-Server (nur lokale Platzhalter-Bindungen) mit Edge headless bei 1440×900 und 390×844: Startseite, Entwicklungsstand, FAQ (aufgeklappt), Impressum (mit lokalen Beispielwerten aus einer von Git ignorierten `.dev.vars`, danach gelöscht), Datenschutz, Fußzeile. Kein horizontales Überlaufen. Ausgeliefert: Titel, `og:image` absolut auf chroniplay.cc, Canonical, JSON-LD.

## Prüfgrenzen
- Keine Rechtsberatung: Impressum und Datenschutzerklärung sind sorgfältig nach dem tatsächlichen Code erstellt, ersetzen aber keine anwaltliche Prüfung.
- Cloudflare stellt eine eigene, verwaltete `robots.txt` voran (Content Signals). Ob unsere Regeln live angehängt werden, erst nach dem Deploy prüfbar.
- Kein echtes Mobilgerät, kein Rich-Results-Test bei Google (erst nach dem Deploy möglich).

## Ausdrücklich nicht getan
Kein Commit, kein Push, kein Deployment.
