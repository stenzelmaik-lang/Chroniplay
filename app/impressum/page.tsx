import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { Hinweis, LegalSection, LegalShell, legalStyles as s } from '../rechtliches/legal-shell';
import { legalContact, werbeanfrageMailto } from '@/server/legal-config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Impressum', description: 'Impressum von ChroniPlay: Anbieter, Kontakt, Werbe- und Kooperationsanfragen, Haftung und Urheberrecht.', alternates: { canonical: '/impressum' }, openGraph: { url: '/impressum', title: 'Impressum · ChroniPlay' } };

const toc = [
  { id: 'anbieter', label: 'Anbieter' },
  { id: 'kontakt', label: 'Kontakt' },
  { id: 'werbung', label: 'Werbe- & Kooperationsanfragen' },
  { id: 'verantwortlich', label: 'Verantwortlich für den Inhalt' },
  { id: 'projekt', label: 'Über das Projekt' },
  { id: 'haftung-inhalte', label: 'Haftung für Inhalte' },
  { id: 'haftung-links', label: 'Haftung für Links' },
  { id: 'urheberrecht', label: 'Urheberrecht & Marken' },
  { id: 'streitbeilegung', label: 'Streitbeilegung' },
];

export default function Impressum() {
  const k = legalContact();
  const adresse = k.name && k.anschrift.length > 0
    ? <address className={s.adresse}>{k.name}{k.anschrift.map((zeile) => <span key={zeile}><br />{zeile}</span>)}</address>
    : null;
  return <LegalShell kicker="Rechtliches" title="Impressum" stand="23. November 2026" toc={toc}
    intro={<p>Angaben zum Anbieter von chroniplay.cc, Kontaktwege und Hinweise zu Haftung und Urheberrecht.</p>}>
    {!k.vollstaendig && <Hinweis>Die vollständigen Anbieterangaben werden gerade ergänzt. Bis dahin erreichst du uns über den unten genannten Kontakt.</Hinweis>}

    <LegalSection id="anbieter" title="Anbieter">
      <p>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG):</p>
      {adresse}
    </LegalSection>

    <LegalSection id="kontakt" title="Kontakt">
      {k.email && <p><strong>E-Mail:</strong> <a href={`mailto:${k.email}`}>{k.email}</a></p>}
      {k.telefon && <p><strong>Telefon:</strong> {k.telefon}</p>}
      <p>Für Fragen rund um ChroniPlay und die Community erreichst du uns auch im Discord „Die Weltenrast“.</p>
      <p>Bitte schicke niemals Passwörter oder Einladungslinks per E-Mail oder Chat.</p>
    </LegalSection>

    <LegalSection id="werbung" title="Werbe- & Kooperationsanfragen">
      <p>Du möchtest mit ChroniPlay oder pan0ram zusammenarbeiten, etwa für Werbung, Sponsoring, eine Kooperation auf Twitch, YouTube oder im Discord? Wir freuen uns über passende Anfragen rund um Pen &amp; Paper, Gaming und Storytelling.</p>
      <p>Damit wir schnell antworten können, nenne bitte Unternehmen oder Projekt, Ansprechpartner, die Art der Anfrage, den gewünschten Zeitraum und, falls schon bekannt, ein Budget. Wir melden uns, sobald wir die Anfrage geprüft haben. Einen Anspruch auf eine Zusammenarbeit gibt es nicht.</p>
      {k.werbungEmail
        ? <a className={s.aktion} href={werbeanfrageMailto(k.werbungEmail)}><Mail aria-hidden="true" size={18} />Werbeanfrage per E-Mail senden</a>
        : <p>Werbeanfragen sind über den Kontakt oben möglich.</p>}
    </LegalSection>

    <LegalSection id="verantwortlich" title="Verantwortlich für den Inhalt">
      <p>Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV):</p>
      {adresse}
    </LegalSection>

    <LegalSection id="projekt" title="Über das Projekt">
      <p>ChroniPlay ist eine Plattform für Pen-&amp;-Paper-Rollenspiele, die von pan0ram privat entwickelt und betrieben wird. Die Plattform befindet sich in einer geschlossenen Alpha. Der Zugang zum Spielbereich ist nur über persönliche Einladungen möglich, eine öffentliche Registrierung gibt es derzeit nicht.</p>
    </LegalSection>

    <LegalSection id="haftung-inhalte" title="Haftung für Inhalte">
      <p>Die Inhalte dieser Website werden mit großer Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach den §§ 7 bis 10 DDG sind wir jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
      <p>Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine Haftung ist erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Sobald uns entsprechende Rechtsverletzungen bekannt werden, entfernen wir diese Inhalte umgehend.</p>
    </LegalSection>

    <LegalSection id="haftung-links" title="Haftung für Links">
      <p>Unsere Website enthält Links zu externen Websites Dritter, etwa zu Discord, GitHub, YouTube und Twitch. Auf deren Inhalte haben wir keinen Einfluss, deshalb können wir für diese fremden Inhalte keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.</p>
      <p>Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße geprüft. Rechtswidrige Inhalte waren zu diesem Zeitpunkt nicht erkennbar. Eine dauerhafte inhaltliche Kontrolle der verlinkten Seiten ist ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Werden uns Rechtsverletzungen bekannt, entfernen wir derartige Links umgehend.</p>
    </LegalSection>

    <LegalSection id="urheberrecht" title="Urheberrecht & Marken">
      <p>Die durch den Betreiber erstellten Inhalte und Werke auf dieser Website, insbesondere Texte, Grafiken, Logos und Gestaltung, unterliegen dem deutschen Urheberrecht. <strong>Alle Rechte vorbehalten.</strong> Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der vorherigen schriftlichen Zustimmung des Betreibers.</p>
      <p>Soweit Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet und als solche gekennzeichnet. Solltest du trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen Hinweis. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Inhalte umgehend.</p>
      <p>Der Quellcode von ChroniPlay ist auf GitHub öffentlich einsehbar. Für ihn ist keine Open-Source-Lizenz erteilt. Die Einsehbarkeit allein räumt daher keine Rechte zur Nutzung, Vervielfältigung oder Weitergabe ein.</p>
      <p>Vampire: The Masquerade ist eine Marke von Paradox Interactive AB. ChroniPlay ist kein offizielles Produkt von Paradox Interactive und steht in keiner Verbindung zu Paradox Interactive. Discord, GitHub, YouTube und Twitch sind Marken ihrer jeweiligen Inhaber.</p>
    </LegalSection>

    <LegalSection id="streitbeilegung" title="Streitbeilegung">
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </LegalSection>
  </LegalShell>;
}
