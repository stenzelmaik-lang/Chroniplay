# Release 23.11.2026: Google-Search-Console-Bestätigungsdatei

Freigabe des Besitzers (23.11.): Bestätigungsdatei übergeben, „Beides erledigt“ (Merge PR #93, Cloudflare-Anmeldung).

| | |
|---|---|
| Live-Codecommit | `4ee1a51` auf `main` (Merge PR #93: Bestätigungsdatei und Release-Protokoll `2026-11-23-faq-recht-seo.md`) |
| Worker-Version | `2f6e0b7d-f55f-4515-b0c9-12bd6d195fed`, Tag `4ee1a51-Google-Verifizierung`, 100 % Verkehr |
| Zeitpunkt | 23.11.2026, kurz nach 15:30 UTC (`wrangler deploy --config dist/server/wrangler.json --name chronik-von-kleve`) |
| Vorversion | `85724d6f-cf8f-466f-8191-10541a07bc4b` (Tag `5c5421c-FAQ-Recht-SEO`) |
| Änderung gegenüber der Vorversion | nur `public/googlefd909cdd0b7e41ff.html` (statisch) und Doku, kein Programmcode |
| Migration | keine. Konfiguration unverändert (`keep_vars`) |

## Prüfungen
- Vor dem Deploy: alle Unit-Tests (111 Dateien) 735/735, Produktions-Build grün, Datei im Build enthalten.
- Ausnahme: Das Deploy erfolgte, bevor „Project CI and W10 checks“ für `4ee1a51` fertig war (Nutzungslimit, keine Code-Änderung). Nachträglich geprüft: **erfolgreich**. „Command Center – Story Editor checks“ scheitert unverändert am bekannten Altbefund.
- Nach dem Deploy: Startseite 200, Bestätigungsdatei liefert den erwarteten Inhalt.

## Befund: Cloudflare leitet `.html`-Adressen um
`https://chroniplay.cc/googlefd909cdd0b7e41ff.html` antwortet mit **307** auf `/googlefd909cdd0b7e41ff`. Das ist die Standardbehandlung statischer HTML-Dateien bei Cloudflare. Die erste Bestätigung in der Search Console schlug deshalb fehl, beim erneuten Versuch meldete Google „Inhaberschaft automatisch bestätigt“ (HTML-Datei). Falls Google die Bestätigung künftig verliert: `assets.html_handling = "none"` in der Build-Konfiguration setzen oder zusätzlich per DNS-TXT-Eintrag bestätigen.

**Die Datei `public/googlefd909cdd0b7e41ff.html` muss im Repository bleiben, sonst verfällt die Bestätigung.**

## Search Console
- Property `https://chroniplay.cc/` bestätigt (HTML-Datei).
- Sitemap `https://chroniplay.cc/sitemap.xml` eingereicht (200, `application/xml`, 3 URLs, ohne Umleitung). Status zunächst „konnte nicht abgerufen werden“, wie direkt nach dem Einreichen üblich.

## Hinweis für das nächste Release
`main` enthält inzwischen PR #94 (`codex/legal-address-privacy`, Änderungen an Impressum und Datenschutz). **Nicht Teil dieses Releases, noch nicht live.** Vor dem nächsten Deploy prüfen und ausdrücklich freigeben lassen.

## Rückweg
`node node_modules/wrangler/bin/wrangler.js rollback 85724d6f-cf8f-466f-8191-10541a07bc4b --name chronik-von-kleve`. Es entfällt nur die Bestätigungsdatei.
