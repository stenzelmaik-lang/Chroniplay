import type { Metadata } from 'next';
import Link from 'next/link';
import { Hinweis, LegalSection, LegalShell, legalStyles as s } from '../rechtliches/legal-shell';
import { legalContact } from '@/server/legal-config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Datenschutzerklärung', description: 'Datenschutz bei ChroniPlay: kein Tracking, keine Werbung, nur ein Anmelde-Cookie. Welche Daten wir verarbeiten und welche Rechte du hast.', robots: { index: false, follow: true, nosnippet: true }, alternates: { canonical: '/datenschutz' }, openGraph: { url: '/datenschutz', title: 'Datenschutzerklärung · ChroniPlay' } };

const toc = [
  { id: 'ueberblick', label: 'Das Wichtigste in Kürze' },
  { id: 'verantwortlich', label: 'Verantwortlicher' },
  { id: 'hosting', label: 'Hosting und Server-Protokolle' },
  { id: 'cookies', label: 'Cookies und Browser-Speicher' },
  { id: 'konto', label: 'Konto und Spielbereich' },
  { id: 'engagement', label: 'Freiwillige Aktivitätsmessung' },
  { id: 'sprache', label: 'Sprachchat am Spieltisch' },
  { id: 'extern', label: 'Externe Inhalte im Spielbereich' },
  { id: 'links', label: 'Links zu Discord, GitHub und Co.' },
  { id: 'kontakt', label: 'Kontakt und Werbeanfragen' },
  { id: 'speicherdauer', label: 'Speicherdauer' },
  { id: 'rechte', label: 'Deine Rechte' },
  { id: 'aenderungen', label: 'Änderungen' },
];

export default function Datenschutz() {
  const k = legalContact();
  return <LegalShell kicker="Rechtliches" title="Datenschutzerklärung" stand="23. November 2026" toc={toc}
    intro={<p>Hier erfährst du, welche Daten ChroniPlay verarbeitet, wofür und welche Rechte du hast. Kurz gesagt: so wenig wie möglich, kein Tracking, keine Werbung.</p>}>

    <LegalSection id="ueberblick" title="Das Wichtigste in Kürze">
      <ul>
        <li><strong>Kein Tracking, keine Werbung, keine Analysedienste.</strong> Wir verwenden weder Google Analytics noch vergleichbare Werkzeuge, und wir verkaufen keine Daten.</li>
        <li><strong>Nur ein Cookie</strong>, und zwar erst nach dem Anmelden, damit du angemeldet bleibst. Ein Cookie-Banner ist deshalb nicht nötig.</li>
        <li><strong>Die öffentliche Startseite</strong> kannst du nutzen, ohne dass wir ein Konto oder persönliche Angaben von dir benötigen.</li>
        <li><strong>Der Spielbereich</strong> ist nur mit persönlicher Einladung zugänglich. Kampagneninhalte sehen nur freigegebene Konten.</li>
      </ul>
    </LegalSection>

    <LegalSection id="verantwortlich" title="Verantwortlicher">
      <p>Verantwortlich für die Datenverarbeitung auf chroniplay.cc im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:</p>
      {k.name
        ? <address className={s.adresse}>{k.name}{k.email && <><br /><a href={`mailto:${k.email}`}>{k.email}</a></>}</address>
        : <Hinweis>Die Angaben zum Verantwortlichen werden gerade ergänzt. Siehe auch das <Link href="/impressum">Impressum</Link>.</Hinweis>}
      <p>Ein Datenschutzbeauftragter ist nicht benannt, da hierfür keine gesetzliche Pflicht besteht.</p>
    </LegalSection>

    <LegalSection id="hosting" title="Hosting und Server-Protokolle">
      <p>ChroniPlay läuft auf der Infrastruktur von <strong>Cloudflare, Inc.</strong>, 101 Townsend St., San Francisco, CA 94107, USA. Dort werden die Website ausgeliefert sowie die Datenbank und hochgeladene Medien gespeichert. Cloudflare verarbeitet die Daten in unserem Auftrag.</p>
      <p>Beim Aufruf der Website verarbeitet Cloudflare technisch notwendige Verbindungsdaten: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene Datenmenge sowie Browser- und Systemangaben. Das ist nötig, um die Seite auszuliefern, sie vor Angriffen zu schützen und Störungen zu beheben.</p>
      <p>Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren und stabilen Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Cloudflare kann Daten auch in den USA verarbeiten. Die Übermittlung stützt sich auf die Zertifizierung von Cloudflare nach dem EU-US Data Privacy Framework (Art. 45 DSGVO) und ergänzend auf Standardvertragsklauseln der EU-Kommission.</p>
    </LegalSection>

    <LegalSection id="cookies" title="Cookies und Browser-Speicher">
      <h3>Anmelde-Cookie</h3>
      <p>Nach der Anmeldung setzt ChroniPlay genau ein Cookie namens <strong>chroniplay_session</strong>. Es enthält eine zufällige Sitzungskennung, damit du angemeldet bleibst. Das Cookie ist für Skripte nicht lesbar (HttpOnly), wird nur verschlüsselt übertragen (Secure), nicht an fremde Websites gesendet (SameSite=Lax) und läuft nach höchstens 30 Tagen ab. Beim Abmelden wird es gelöscht.</p>
      <p>Das Cookie ist für den angemeldeten Bereich unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b DSGVO). Auf der öffentlichen Startseite wird ohne Anmeldung kein Cookie gesetzt.</p>
      <h3>Lokaler Browser-Speicher</h3>
      <p>Einige Anzeige-Einstellungen im Spielbereich speichert ChroniPlay nur in deinem Browser (Local Storage), zum Beispiel Textgröße, stummgeschaltete Geräusche oder eingeklappte Leisten am Spieltisch. Diese Angaben werden nicht an uns übertragen, sie dienen allein deiner Bequemlichkeit. Du kannst sie jederzeit über die Einstellungen deines Browsers löschen.</p>
    </LegalSection>

    <LegalSection id="konto" title="Konto und Spielbereich">
      <p>Ein Konto entsteht nur über eine persönliche Einladung der Spielleitung. Für Konto und Spielbereich verarbeiten wir:</p>
      <ul>
        <li><strong>Kontodaten:</strong> E-Mail-Adresse, Anzeigename und dein Passwort, das ausschließlich als sicherer Hash gespeichert wird und für niemanden lesbar ist.</li>
        <li><strong>Spieldaten:</strong> Charaktere, Notizen, Inventar, Nachrichten, Würfelergebnisse, Erfahrungspunkte sowie Bilder und Dateien, die du hochlädst.</li>
        <li><strong>Einladungs- und Sicherheitsdaten:</strong> Einladungen, Sitzungen und Zeitpunkte von Anmeldungen, um Missbrauch zu verhindern.</li>
      </ul>
      <p>Zweck ist die Bereitstellung der Plattform und eurer gemeinsamen Kampagne. Rechtsgrundlage ist die Nutzung des Dienstes (Art. 6 Abs. 1 lit. b DSGVO). Spieler- und Spielleitungsansichten sind serverseitig getrennt: Inhalte der Spielleitung bleiben für Spieler verborgen, und private Inhalte anderer Spieler sind für dich nicht sichtbar.</p>
    </LegalSection>

    <LegalSection id="engagement" title="Freiwillige Aktivitätsmessung für Engagement-EP">
      <p>In der geschlossenen Alpha ist die Aktivitätsmessung standardmäßig an. ChroniPlay speichert für dein Konto und deine Kampagne die aktive Zeit je Tag und Bereich. Die Messung zeigt dir deinen Fortschritt bei der Spielabendvorbereitung und kann nach bestätigter Vorbereitung Engagement-EP auslösen. Sie pausiert bei Inaktivität, außerhalb des sichtbaren Tabs und am Spieltisch.</p>
      <p>Für die Prüfung einer Figurnotiz verarbeitet ChroniPlay den Text beim Speichern. Im Aktivitätsnachweis stehen die Seitenkennung, der bestätigte Textumfang und die angerechneten Sekunden. Tastatureingaben, Mausbewegungen und Notiztexte werden als Teil der Messung nicht gespeichert. Du siehst deine eigenen Messdaten. Die Spielleitung sieht bestätigte Summen je Figur und gebuchte Stufen.</p>
      <p>Du kannst die Messung jederzeit unter <Link href="/profil#aktivitaetsmessung">Profil &amp; Einstellungen</Link> ausschalten und die Änderung mit „Profil speichern“ übernehmen. Danach kannst du ChroniPlay weiterspielen. Die Einstellung gilt für dein Konto und bleibt beim Neuladen und auf anderen Geräten erhalten. ChroniPlay wertet Zeit- und Nachweisdaten aus den letzten 365 Berliner Kalendertagen aus. Ein täglicher Löschlauf entfernt ältere Daten aus der laufenden Datenbank. Bereits gebuchte EP bleiben im Charakter-Ledger nachvollziehbar.</p>
    </LegalSection>

    <LegalSection id="sprache" title="Sprachchat am Spieltisch">
      <p>Für freigeschaltete Kampagnen gibt es am Spieltisch einen Sprachchat. Er ist <strong>freiwillig</strong> und startet erst, wenn du selbst auf „Beitreten“ klickst. Dein Mikrofon bleibt aus, bis du es einschaltest. Du kannst den Sprachchat jederzeit wieder verlassen.</p>
      <p>Die Sprachübertragung läuft über <strong>Cloudflare Realtime</strong> (Cloudflare, Inc., siehe „Hosting“). Der Dienst arbeitet in unserem Auftrag. Verarbeitet werden dein Anzeigename, eine interne Teilnehmerkennung, deine IP-Adresse, Beitritts- und Austrittszeiten sowie deine Stimme, solange dein Mikrofon an ist. <strong>Gespräche werden weder aufgezeichnet noch transkribiert.</strong> Die Stimme wird nur live an die anderen Teilnehmenden des Spielabends übertragen. Den Zugang zum Raum erhalten nur Mitglieder des laufenden Spielabends, und er gilt höchstens zwölf Stunden.</p>
      <p>Rechtsgrundlage ist die Nutzung des Dienstes auf deinen Wunsch (Art. 6 Abs. 1 lit. b DSGVO). Für eine mögliche Verarbeitung in den USA gilt dasselbe wie beim Hosting: Grundlage sind das EU-US Data Privacy Framework und ergänzend Standardvertragsklauseln.</p>
    </LegalSection>

    <LegalSection id="extern" title="Externe Inhalte im Spielbereich">
      <p>Die öffentliche Startseite lädt keine Inhalte von Drittanbietern. Im angemeldeten Spielbereich werden in zwei Fällen Inhalte externer Anbieter geladen. Dabei erhält der jeweilige Anbieter technisch bedingt deine IP-Adresse:</p>
      <table className={s.tabelle}>
        <thead><tr><th>Anbieter</th><th>Wann</th><th>Zweck</th></tr></thead>
        <tbody>
          <tr><td><strong>YouTube</strong> (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland), über youtube-nocookie.com</td><td>nur wenn die Spielleitung Ambiente-Musik am Spieltisch abspielt</td><td>Hintergrundmusik und Atmosphäre</td></tr>
          <tr><td><strong>OpenFreeMap</strong> (openfreemap.org), Kartendaten von OpenStreetMap</td><td>beim Öffnen der Weltkarte</td><td>Anzeige von Kartenkacheln</td></tr>
        </tbody>
      </table>
      <p>Rechtsgrundlage ist unser berechtigtes Interesse an einem stimmungsvollen und funktionsfähigen Spielbereich (Art. 6 Abs. 1 lit. f DSGVO). YouTube wird im erweiterten Datenschutzmodus eingebunden. Google kann Daten dennoch in die USA übermitteln. Grundlage ist dann das EU-US Data Privacy Framework. Weitere Informationen findest du in der Datenschutzerklärung von Google.</p>
      <p>Für die Adresssuche im Verwaltungsbereich der Spielleitung fragt unser Server Geodaten des Kreises Kleve ab. Dabei werden keine Daten von Besuchern übermittelt.</p>
    </LegalSection>

    <LegalSection id="links" title="Links zu Discord, GitHub und Co.">
      <p>Auf unserer Website findest du Links zu Discord, GitHub, YouTube und Twitch. Diese Dienste sind <strong>nicht eingebettet</strong>. Es werden also keine Daten an sie übertragen, solange du nicht auf einen Link klickst. Erst nach dem Klick gelten die Datenschutzbestimmungen des jeweiligen Anbieters.</p>
    </LegalSection>

    <LegalSection id="kontakt" title="Kontakt und Werbeanfragen">
      <p>Wenn du uns per E-Mail schreibst, auch mit einer Werbe- oder Kooperationsanfrage über das <Link href="/impressum#werbung">Impressum</Link>, verarbeiten wir deine Angaben, um dein Anliegen zu beantworten (Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Die E-Mail wird von deinem eigenen E-Mail-Programm versendet, ChroniPlay speichert dabei nichts. Wir löschen deine Nachricht, sobald sie erledigt ist und keine gesetzlichen Aufbewahrungspflichten bestehen.</p>
    </LegalSection>

    <LegalSection id="speicherdauer" title="Speicherdauer">
      <ul>
        <li><strong>Konto- und Spieldaten:</strong> solange dein Konto besteht. Auf Wunsch löschen wir dein Konto und die zugehörigen persönlichen Daten.</li>
        <li><strong>Aktivitätsdaten:</strong> Auswertung der letzten 365 Tage, ältere Daten entfernt ein täglicher Löschlauf.</li>
        <li><strong>Sprachchat:</strong> keine Aufzeichnung. Technische Sitzungsdaten wie Beitritts- und Austrittszeiten speichert Cloudflare nach seinen Standardfristen.</li>
        <li><strong>Anmelde-Cookie:</strong> höchstens 30 Tage oder bis zur Abmeldung.</li>
        <li><strong>Server-Protokolle:</strong> nach den kurzen Standardfristen von Cloudflare.</li>
        <li><strong>E-Mails:</strong> bis zur Erledigung deines Anliegens.</li>
      </ul>
    </LegalSection>

    <LegalSection id="rechte" title="Deine Rechte">
      <p>Du hast jederzeit das Recht auf:</p>
      <ul>
        <li><strong>Auskunft</strong> über deine bei uns gespeicherten Daten (Art. 15 DSGVO),</li>
        <li><strong>Berichtigung</strong> unrichtiger Daten (Art. 16 DSGVO),</li>
        <li><strong>Löschung</strong> deiner Daten (Art. 17 DSGVO),</li>
        <li><strong>Einschränkung</strong> der Verarbeitung (Art. 18 DSGVO),</li>
        <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO),</li>
        <li><strong>Widerspruch</strong> gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO).</li>
      </ul>
      <p>Wende dich dafür an den oben genannten Verantwortlichen{k.email && <> unter <a href={`mailto:${k.email}`}>{k.email}</a></>}. Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Behörde deines Wohnorts.</p>
      <p>Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne von Art. 22 DSGVO findet nicht statt.</p>
    </LegalSection>

    <LegalSection id="aenderungen" title="Änderungen">
      <p>ChroniPlay wird weiterentwickelt. Wenn sich dabei die Datenverarbeitung ändert, passen wir diese Datenschutzerklärung an. Es gilt jeweils die hier veröffentlichte Fassung.</p>
    </LegalSection>
  </LegalShell>;
}
