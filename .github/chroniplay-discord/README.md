# ChroniPlay – Entwicklertagebuch → Discord

**Isolierte Bridge.** Nur neue Dateien unter .github/; bestehende Workflows, App, Tests, Build und Deployment bleiben unangetastet. Der Workflow erzeugt **keine** Discussions und läuft **niemals zeitgesteuert**. Der separate Sonntagsbericht bereitet Inhalte vor.

## Eigentümer richtet ein

1. GitHub Discussions aktivieren; die Kategorie **Entwicklertagebuch** im Format **Announcements** anlegen.
2. Discussion-Label **discord-freigabe** anlegen.
3. Discord-Webhook in **#chroniplay-updates** anlegen: Name exakt **ChroniPlay · Entwicklertagebuch**, Avatar das ChroniPlay-Logo.
4. GitHub-Environment **discord-chroniplay** anlegen. Darin das Webhook-Secret **DISCORD_WEBHOOK_CHRONIPLAY** hinterlegen. Die URL gehört nie in den Chat, Code, Issue, PR oder Logs.
5. Die **nicht geheime** Environment-Variable **CHRONIPLAY_UPDATES_CHANNEL_ID** mit der numerischen Kanal-ID von #chroniplay-updates anlegen (Discord-Entwicklermodus → Kanal rechtsklicken → ID kopieren). Ein Webhook-GET liefert nur die Kanal-ID, nicht den Kanalnamen. **Ohne ID kein Versand.**
6. Die Environment-Variable **CHRONIPLAY_SEND_ENABLED** zunächst nicht setzen oder auf false lassen. Der erste Label-Lauf bleibt dadurch ein **Trockenlauf ohne Versand**. Erst nach Prüfung auf true setzen.

## Discussion-Format

**Titel:** Entwicklertagebuch #4 – Ein Spieltisch, der euch mehr Raum lässt

~~~markdown
## Kurzfassung
Ein Spieltisch, der euch mehr Raum lässt: mehr Platz für
gemeinsame Geschichten und ein sicherer persönlicher Bereich.

## Hinter den Kulissen
Hier steht der längere Community-Bericht.
Dieser Abschnitt wird NICHT an Discord gesendet.
~~~

Die neue Vorlage unter `.github/DISCUSSION_TEMPLATE/entwicklertagebuch.yml` bietet passende Felder für Kurzfassung, abgeschlossene Verbesserungen, Fehlerbehebungen, laufende Arbeiten und Feedback. Das Pflichtfeld **Kurzfassung** wird von GitHub als `### Kurzfassung` ausgegeben und vom Workflow gezielt ausgelesen. Die drei Sicherheits-Häkchen müssen bestätigt sein. Im Titel die Nummer und nach `–` ein Thema ergänzen.

In Discord erscheinen **Titel, Kurzfassung und ein klickbarer Titel-Link zur vollständigen GitHub-Discussion** sowie ein fester ChroniPlay-Footer. Der Link stammt ausschließlich aus der GitHub-GraphQL-Antwort und muss zur genau freigegebenen Discussion im eigenen Repository gehören. Fremde oder abweichende Links führen zum Abbruch. Titel und Kurzfassung dürfen weiterhin keine Links, Erwähnungen, persönlichen Daten, Pfade, Kennungen, Tokens oder Konfigurationsnamen enthalten. Unsichere Texte werden vollständig **abgebrochen**, nicht gekürzt. Titel: maximal 180 Zeichen im Format Entwicklertagebuch #N – ...; Kurzfassung: 12–700 Zeichen.

## Erstbetrieb

1. Diesen **Pull Request** und die Tests prüfen und erst nach eigener Entscheidung mergen.
2. Als Eigentümer die Discussion #4 in der richtigen Kategorie veröffentlichen, **ohne** Label. Danach **discord-freigabe** selbst setzen.
3. Unter GitHub Actions den **Trockenlauf** prüfen. Er meldet erfolgreich geprüfte Inhalte, sendet aber nichts und hinterlässt keinen Kommentar.
4. Erst nach dieser Prüfung **CHRONIPLAY_SEND_ENABLED=true** setzen.
5. Label entfernen und **selbst erneut setzen**. Erst jetzt wird nach erneuter Prüfung einmalig gesendet.

## Sicherheitsregeln

- Einziger Workflow-Trigger: discussion:labeled. Owner, eigenes Autorenkonto, Kategorie und Freigabelabel müssen im Ereignis passen und werden anschließend anhand der aktuellen Discussion nochmals geprüft.
- Keine Pings: `allowed_mentions` ist leer. Keine Dateien, unkontrollierten Links oder versteckten Volltexte im Discord-Post. Einzige URL ist der streng validierte Link auf die eigene GitHub-Discussion.
- Das Ziel wird über exakten Webhook-Namen, Webhooktyp und Kanal-ID gegen #chroniplay-updates validiert; bei Abweichung erfolgt ein Abbruch.
- Nur contents:read und discussions:write; keine zusätzlichen Python-Pakete, keine weiteren App-Änderungen.
- Serielle Abarbeitung pro Discussion plus Kommentar-Vermerke gegen Doppelversand. Vor der Sendung wird ein **claimed**-Vermerk und nach bestätigtem Versand ein **sent**-Vermerk in der Discussion hinterlassen.
- **Fehlerfall:** Scheitert die Sendung nach dem claimed-Vermerk, gibt es keinen automatischen Zweitversuch. Nur du darfst anhand der GitHub- und Discord-Anzeigen prüfen, ob die Nachricht schon existiert, anschließend den Claim-Kommentar entfernen und das Label bewusst erneut setzen. Doppelte Posts werden so zugunsten eines kontrollierten manuellen Wiederanlaufs vermieden.
- Not-Aus: Webhook löschen, Workflow in GitHub deaktivieren oder CHRONIPLAY_SEND_ENABLED=false.
- Kein KI-Modell, kein zusätzliches Hosting und kein kostenpflichtiger Dienst für die Bridge nötig.

## Prüfung

~~~sh
python3 -m unittest discover -s .github/chroniplay-discord -p 'test_*.py'
~~~

Der erste Live-Lauf muss ausdrücklich ein **Trockenlauf** bleiben. Der erste Echtversand benötigt deine Entscheidung. **Das Schreiben der Sonntagsbeiträge ist vom Discord-Workflow getrennt**, weil nur das Label eine Discord-Nachricht auslösen darf.
