import type { Metadata, Viewport } from 'next';
import './globals.css';

const BESCHREIBUNG = 'ChroniPlay ist die Plattform für Pen-&-Paper-Rollenspiele: Kampagnen vorbereiten, Charaktere und Inventar verwalten und am digitalen Spieltisch mit Karten, Handouts und Würfeln spielen. Jetzt in der geschlossenen Alpha.';
const OG_BILD = { url: '/images/og-chroniplay.jpg', width: 1200, height: 630, alt: 'ChroniPlay – Die Plattform für Pen-&-Paper-Kampagnen' };

export const metadata: Metadata = {
  metadataBase: new URL('https://chroniplay.cc'),
  title: { default: 'ChroniPlay – Plattform für Pen-&-Paper-Rollenspiele', template: '%s · ChroniPlay' },
  description: BESCHREIBUNG,
  applicationName: 'ChroniPlay',
  keywords: ['Pen and Paper', 'Pen & Paper', 'Rollenspiel', 'Tabletop', 'virtueller Spieltisch', 'Kampagnen-Verwaltung', 'Spielleitung', 'Charakterbogen', 'Vampire: The Masquerade', 'TTRPG'],
  authors: [{ name: 'pan0ram' }],
  creator: 'pan0ram',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  openGraph: { type: 'website', locale: 'de_DE', siteName: 'ChroniPlay', url: '/', title: 'ChroniPlay – Plattform für Pen-&-Paper-Rollenspiele', description: BESCHREIBUNG, images: [OG_BILD] },
  twitter: { card: 'summary_large_image', title: 'ChroniPlay – Plattform für Pen-&-Paper-Rollenspiele', description: BESCHREIBUNG, images: [OG_BILD.url] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: '#061018' };

export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="de"><body>{children}</body></html>}
