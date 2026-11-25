# Benutzerprofil

Stand 25.11.2026 · Branch `codex/profil-redesign` · Basis `d43de73`

`/profil` hat einen eigenen Bildkopf mit ChroniPlay-Weltenmotiv. Tealgraue Flächen, Goldlinien, Spectral und IBM Plex Sans folgen der abgenommenen Designgrundlage. Auf breiten Ansichten stehen Menü, Bearbeitung und Spielerkarte nebeneinander. Das Menü wird auf schmalen Ansichten als zweispaltiges Raster dargestellt.

| Bereich | Direktlink | Inhalt |
| --- | --- | --- |
| Spielerprofil | `/profil#spielerprofil` | Nickname, Bild, Pronomen, Vorstellung, Motive, Spielstil und Freigabe je Kampagne |
| Konto & Anzeige | `/profil#konto` | E-Mail, privater Name, Kopfleiste und Darstellung |
| Sicherheit | `/profil#sicherheit` | Sitzungen, Passwort und Wiederherstellung |
| Feedback | `/profil#feedback` | Meldungen und Antworten, Eingang für Berechtigte |

Der bestehende Link `/profil#aktivitaetsmessung` öffnet den Kontobereich und fokussiert die Einstellung bei aktivierter Messfunktion. Profil und Anzeige teilen sich einen Entwurf und eine Speicherleiste. Die Bildauswahl zeigt eine lokale Vorschau. Der Upload erfolgt beim Speichern und nutzt weiterhin das private Medienobjekt und den bestehenden Profilendpunkt. Die Teilnehmeransicht am Spieltisch verwendet weiterhin dieselben drei Motivfarben.

`public/images/chroniplay-profil-header.webp` enthält die für diese Ansicht erstellte Illustration. `chroniplay-profil-logo.webp` ist eine verkleinerte WebP-Fassung des vorhandenen Schriftzugs. Die beiden Assets wiegen zusammen rund 94 KiB.

## Prüfung und Fortsetzung

- Der Typecheck der geänderten UI und ihrer importierten lokalen Module lief erfolgreich durch.
- Die 19 gezielten Konto-, Profil-, Feedback-, Headername- und Designtoken-Tests waren grün. Die Gesamtsuite meldete 683 von 685 erfolgreichen Tests. Zwei Medienbackup-Tests scheiterten am blockierten Zugriff auf lokalen Loopback.
- Die interaktive HTML-Vorschau bündelt die geänderten React-Komponenten, eingebettete Assets und synthetische Daten. Bundle und Einbettungen sind geprüft. In dieser Ausführung konnte die Vorschau aufgrund der Browserrichtlinie für lokale Dateien nicht visuell geöffnet werden.
- Der vollständige App-Build scheiterte am lokal fehlenden `@cloudflare/realtimekit`. Die lokale ESLint-Installation meldete einen inkompatiblen transitiven Versionsstand. Der nächste Prüflauf benötigt eine vollständige Installation mit `pnpm install --frozen-lockfile`.
- Anschließend `pnpm run typecheck`, `pnpm test` und `pnpm run build` ausführen. Am isolierten Teststand die vier Menüpunkte auf Desktop und Mobilgerät öffnen, den Direktlink zur Aktivitätsmessung prüfen und einen Profilentwurf mit Bild anhand eines synthetischen Kontos speichern. Der bestehende Test `tests/header-name-browser.mjs` deckt die Auswahl des Kopfzeilennamens und den anonymen Zugriff auf `/profil` ab.

Entwicklungsstand auf lokalem Branch. Freigabe für Veröffentlichung und Deployment steht aus.

## Illustrierte Profilmotive und Spielstile

- Sieben Bildmotive im bestehenden Feld „Profilmotiv“. Die überarbeiteten Figuren sind neugierig, verspielt, freundlich oder verschlafen. Drei neutrale Motive ergänzen sie um Sternenkompass, Mondportal und Würfelsiegel. Je Motiv gibt es eine abgestimmte Akzentfarbe. Die Spielerkarte im Profil und am Spieltisch teilt dieselbe Hintergrunddarstellung.
- Die bisherigen Profilmotive und das separate Profilfoto funktionieren weiter. Die sieben WebP-Dateien liegen unter `public/images/profilmotive/`.
- Bis zu acht Vorlagen unter „So spiele ich“, bis zu drei eigene kurze Angaben und optionales Spieltempo. Ungeteilte Angaben bleiben privat. Bei Freigabe der Spielerkarte sieht die zuständige Spielleitung unter „Feedback → Eigene Spielstile prüfen“ die Entwürfe. Eine Freigabe oder Sperre gilt für genau diese Kampagne und diesen Text. Der Spieltisch erhält ausschließlich freigegebene Eigenangaben.
- Das bestehende Profil-JSON speichert Auswahl und Entscheidungen. Die normale Profilmutation akzeptiert keine Moderationsentscheidungen. Die Spielleitung nutzt `/api/profile/style-reviews`. Eine Migration ist hierfür nicht erforderlich.
- Gezielte Prüfungen: 22 Tests erfolgreich. SQLite-Moderationsprüfung mit getrennten Kampagnen, privaten Entwürfen, fehlenden Rechten, Sperre und konkurrierender Profiländerung erfolgreich. Die vollständige Suite meldete 686 von 688. Zwei Medienbackup-Tests scheiterten erneut am lokalen Loopback-Zugriff. Profil-Typecheck und isolierter UI-Build waren erfolgreich. Der vollständige Typecheck und App-Build brauchen lokal `@cloudflare/realtimekit`. HTTP- und Browser-Abnahme am isolierten Gesamtstand stehen aus.

## Nachprüfung vor dem Live-Gang

- Der eigene Avatar hat einen getrennten Abschnitt im Spielerprofil. Eine neue Datei erscheint sofort in der privaten Vorschau. „Auswahl verwerfen“ stellt den gespeicherten Avatar wieder her. Kaputte Bildanzeigen fallen auf die Initiale zurück. „Avatar entfernen“ und der Upload werden beim Speichern übernommen.
- Profil-Links führen samt Tastaturfokus in den gewählten Bereich. Sicherheit und Feedback verlinken bei einem offenen Profilentwurf zurück zum Spielerprofil. Auf kleinen Ansichten sind die Motivwahl und die Spielerkarte in beide Richtungen verlinkt. Klassische Motive zeigen ihren Verlauf schon im Auswahlfeld.
- Komponententest mit synthetischen Daten: alle vier Profilbereiche, Menüfokus und Direktlink zur Aktivitätsmessung, Avatar-Validierung, Bildentwurf, Verwerfen, Speichern und Entfernen, Motivwechsel, Anzeigeoptionen, Sitzungsabmeldung, Passwortformular, Feedback sowie Freigabe und Sperre. Desktop- und Mobile-Layout wurden anhand gerenderter statischer Ansichten überprüft. Eine echte Browser- und Cloudflare-Abnahme bleibt offen, da lokales HTTP in der Arbeitsumgebung gesperrt ist und dem Gesamtbuild die Voice-Abhängigkeit fehlt.
- Der Eigentümer hat den laufenden Release vor der Veröffentlichung gestoppt. Profil-Commits sind für den nächsten Abnahmelauf lokal vorhanden.
