// Persönliche Angaben für Impressum und Datenschutz kommen ausschließlich aus Cloudflare-Variablen.
// Das Repository ist öffentlich: Name und Anschrift gehören nicht in den Code.
//   CVK_IMPRESSUM_NAME       Vor- und Nachname (Pflicht)
//   CVK_IMPRESSUM_ANSCHRIFT  Ladungsfähige Anschrift, Zeilen mit "|" getrennt (Pflicht)
//   CVK_IMPRESSUM_EMAIL      Kontakt-E-Mail (Pflicht; Rückfall: CVK_PRIVACY_CONTACT)
//   CVK_IMPRESSUM_TELEFON    Telefon (optional)
//   CVK_WERBUNG_EMAIL        E-Mail für Werbe- und Kooperationsanfragen (optional; Rückfall: Kontakt-E-Mail)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type LegalContact = {
  name: string | null;
  anschrift: string[];
  email: string | null;
  telefon: string | null;
  werbungEmail: string | null;
  vollstaendig: boolean;
};

export function parseLegalContact(source: Record<string, string | undefined>): LegalContact {
  const text = (value: string | undefined) => value?.trim() || null;
  const mail = (value: string | undefined) => {
    const v = text(value);
    return v && EMAIL.test(v) ? v : null;
  };
  const name = text(source.CVK_IMPRESSUM_NAME) ?? text(source.CVK_PRIVACY_CONTROLLER);
  const anschrift = (text(source.CVK_IMPRESSUM_ANSCHRIFT) ?? '').split('|').map((zeile) => zeile.trim()).filter(Boolean);
  const email = mail(source.CVK_IMPRESSUM_EMAIL) ?? mail(source.CVK_PRIVACY_CONTACT);
  return {
    name,
    anschrift,
    email,
    telefon: text(source.CVK_IMPRESSUM_TELEFON),
    werbungEmail: mail(source.CVK_WERBUNG_EMAIL) ?? email,
    vollstaendig: Boolean(name && anschrift.length >= 2 && email),
  };
}

/** Vorbelegte E-Mail für Werbe- und Kooperationsanfragen (ohne Server, ohne Formular-Speicherung). */
export function werbeanfrageMailto(adresse: string): string {
  const betreff = 'Werbe- / Kooperationsanfrage ChroniPlay';
  const text = [
    'Hallo pan0ram,',
    '',
    'Unternehmen / Projekt:',
    'Ansprechpartner:',
    'Art der Anfrage (Werbung, Sponsoring, Kooperation, Sonstiges):',
    'Kanal (ChroniPlay, Twitch, YouTube, Discord):',
    'Gewünschter Zeitraum:',
    'Budget (optional):',
    '',
    'Kurzbeschreibung:',
    '',
  ].join('\n');
  return `mailto:${adresse}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`;
}
