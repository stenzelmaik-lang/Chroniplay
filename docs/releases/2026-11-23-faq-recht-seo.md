# Release 23.11.2026: FAQ, Entwicklungsstand, Impressum, Datenschutz und SEO

Freigabe des Besitzers (23.11.): „okey, dann live damit“ / „schieb live“.

| | |
|---|---|
| Live-Codecommit | `5c5421c` auf `main` (Merge PR #92, inhaltlich identisch mit geprüftem `e93e70d`) |
| Worker-Version | `85724d6f-cf8f-466f-8191-10541a07bc4b`, Tag `5c5421c-FAQ-Recht-SEO`, 100 % Verkehr |
| Zeitpunkt | 23.11.2026 15:15 UTC (`wrangler deploy --config dist/server/wrangler.json --name chronik-von-kleve`) |
| Vorversion | `5ce9dc7e-99fd-479e-a059-3808fb5ac7cd` (Variablenänderung des Besitzers im Dashboard; Skript-Etag identisch mit `ce3752c9` = `6068899`, in `main` enthalten) |
| Migration | keine |
| Konfiguration | unverändert, neun Variablen über `keep_vars` erhalten (neu vom Besitzer gesetzt: `CVK_IMPRESSUM_NAME`, `CVK_IMPRESSUM_EMAIL`), D1 `chronik-von-kleve-db`, R2 `chronik-von-kleve-r2`, `limits.cpu_ms=5000`; Probelauf vorab ok |
| D1-Lesezeichen vor dem Deploy | `00000244-00000000-0000512c-96cfc23760e5a91a17a59c888a80a76f` |

## Inhalt
Siehe `docs/startseite-faq-rechtliches-seo-claude-handover.md`: Entwicklungsstand aktuell, FAQ mit 12 Fragen, neues Impressum (mit Werbe- und Kooperationsanfragen per E-Mail), ausführliche Datenschutzerklärung, gemeinsame Fußzeile mit Impressum, Datenschutz und „Alle Rechte vorbehalten“, SEO (Metadaten, Vorschaubild 1200×630, JSON-LD, robots.txt, sitemap.xml).

## Prüfungen
Vor dem Deploy (Stand `5c5421c`, pnpm 11.25.0 frozen lockfile): `tsc` grün, alle Unit-Tests (111 Dateien) 735/735, Produktions-Build grün, GitHub „Project CI and W10 checks“ erfolgreich.
Nach dem Deploy: `/`, `/impressum`, `/datenschutz`, `/anmelden`, `/sitemap.xml`, `/images/og-chroniplay.jpg` 200. `/api/dashboard`, `/api/files` ohne Anmeldung 401. Startseite liefert neuen Titel, `og:image` absolut, FAQ, JSON-LD und Fußzeile. Impressum zeigt Kontakt-E-Mail und Werbeanfrage-Button. robots.txt enthält unsere Regeln hinter der von Cloudflare verwalteten Präambel. Ohne Anmeldung kein `Set-Cookie`.
Nicht geprüft: angemeldete Ansicht, echtes Mobilgerät, Google Rich-Results-Test.

## Offen
- `CVK_IMPRESSUM_ANSCHRIFT` ist bewusst nicht gesetzt (Entscheidung des Besitzers: Anschrift auf geprüfte Anfrage per E-Mail). Das Impressum zeigt bis dahin den Ergänzungshinweis. Hinweis an den Besitzer: § 5 DDG verlangt bei geschäftsmäßigen Angeboten eine ladungsfähige Anschrift. Eine c/o- bzw. Impressum-Service-Adresse wäre eine Lösung ohne Wohnadresse.

## Rückweg
`node node_modules/wrangler/bin/wrangler.js rollback 5ce9dc7e-99fd-479e-a059-3808fb5ac7cd --name chronik-von-kleve`. Gefahrlos (gleicher P1-Stand), es entfallen nur FAQ, Rechtsseiten und SEO.
