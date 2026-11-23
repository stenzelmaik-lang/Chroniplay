import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseLegalContact, werbeanfrageMailto} from '../domain/legal-contact.ts';
import {visitorContent} from '../app/visitor/content.ts';

const lies = (pfad) => readFileSync(new URL(`../${pfad}`, import.meta.url), 'utf8');

test('Impressum-Angaben: vollständig aus eigenen Variablen, Anschrift zeilenweise', () => {
  const k = parseLegalContact({CVK_IMPRESSUM_NAME: ' Erika Muster ', CVK_IMPRESSUM_ANSCHRIFT: 'Musterweg 1 | 12345 Musterstadt', CVK_IMPRESSUM_EMAIL: 'kontakt@example.test', CVK_IMPRESSUM_TELEFON: '0123 456'});
  assert.equal(k.name, 'Erika Muster');
  assert.deepEqual(k.anschrift, ['Musterweg 1', '12345 Musterstadt']);
  assert.equal(k.email, 'kontakt@example.test');
  assert.equal(k.telefon, '0123 456');
  assert.equal(k.werbungEmail, 'kontakt@example.test', 'Werbeanfragen fallen auf die Kontakt-E-Mail zurück');
  assert.equal(k.vollstaendig, true);
});

test('Impressum-Angaben: Rückfall auf bestehende Datenschutz-Variablen, ohne Anschrift unvollständig', () => {
  const k = parseLegalContact({CVK_PRIVACY_CONTROLLER: 'Erika Muster', CVK_PRIVACY_CONTACT: 'datenschutz@example.test'});
  assert.equal(k.name, 'Erika Muster');
  assert.equal(k.email, 'datenschutz@example.test');
  assert.deepEqual(k.anschrift, []);
  assert.equal(k.vollstaendig, false);
});

test('Impressum-Angaben: ungültige E-Mail wird verworfen, eigene Werbe-Adresse hat Vorrang', () => {
  const k = parseLegalContact({CVK_IMPRESSUM_NAME: 'A', CVK_IMPRESSUM_ANSCHRIFT: 'x|y', CVK_IMPRESSUM_EMAIL: 'keine-mail', CVK_WERBUNG_EMAIL: 'werbung@example.test'});
  assert.equal(k.email, null);
  assert.equal(k.werbungEmail, 'werbung@example.test');
  assert.equal(k.vollstaendig, false);
  assert.equal(parseLegalContact({}).werbungEmail, null);
});

test('Werbeanfrage: vorbelegter Betreff und Fragenkatalog, sauber kodiert', () => {
  const link = werbeanfrageMailto('werbung@example.test');
  assert.match(link, /^mailto:werbung@example\.test\?subject=/);
  assert.ok(!/[\n\s]/.test(link), 'keine rohen Leer- oder Zeilenumbrüche');
  const body = decodeURIComponent(link.split('&body=')[1]);
  for (const feld of ['Unternehmen / Projekt:', 'Ansprechpartner:', 'Art der Anfrage', 'Gewünschter Zeitraum:', 'Budget (optional):']) assert.ok(body.includes(feld), feld);
});

test('Öffentlicher Code enthält keine fest eingetragene persönliche E-Mail-Adresse', () => {
  for (const datei of ['app/impressum/page.tsx', 'app/datenschutz/page.tsx', 'app/visitor/content.ts', 'app/visitor/site-footer.tsx', 'domain/legal-contact.ts']) {
    const fremd = (lies(datei).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) ?? []).filter((m) => !m.endsWith('example.test'));
    assert.deepEqual(fremd, [], datei);
  }
});

test('FAQ: mindestens zehn vollständige Fragen, Registrierung nur per Einladung', () => {
  const {items} = visitorContent.faq;
  assert.ok(items.length >= 10);
  for (const i of items) { assert.ok(i.q.trim().endsWith('?') || i.q.includes('Was nun')); assert.ok(i.a.length > 20); }
  const reg = items.find((i) => i.q.includes('registrieren'));
  assert.match(reg.a, /persönliche Einladung/);
  for (const l of items.flatMap((i) => i.links ?? [])) assert.match(l.href, /^(https:\/\/|\/)/);
});

test('Entwicklungsstand: aktuell, ohne veraltete Alpha-Planung', () => {
  const s = visitorContent.status;
  assert.ok(!/geplant/.test(s.text));
  assert.deepEqual(s.steps.map((x) => x.title), ['Konzept', 'Geschlossene Alpha', 'Alpha 2.0', 'Weitere Runden & Kampagnen']);
  assert.equal(s.steps.at(-1).erreicht, false);
});

test('Fußzeile: Impressum, Datenschutz und „Alle Rechte vorbehalten“', () => {
  const f = lies('app/visitor/site-footer.tsx');
  assert.match(f, /href="\/impressum"/);
  assert.match(f, /href="\/datenschutz"/);
  assert.match(f, /Alle Rechte vorbehalten/);
  assert.match(lies('app/visitor/visitor-shell.tsx'), /<SiteFooter \/>/);
  assert.match(lies('app/rechtliches/legal-shell.tsx'), /<SiteFooter \/>/);
});

test('SEO: Metadaten mit absoluter Adresse, Vorschaubild 1200×630, robots und Sitemap', () => {
  const layout = lies('app/layout.tsx');
  assert.match(layout, /metadataBase: new URL\('https:\/\/chroniplay\.cc'\)/);
  assert.ok(!layout.includes('localhost'));
  const jpg = readFileSync(new URL('../public/images/og-chroniplay.jpg', import.meta.url));
  assert.equal(jpg.readUInt16BE(0), 0xffd8, 'JPEG');
  let i = 2; let groesse = null;
  while (i < jpg.length) { const marker = jpg.readUInt16BE(i); const len = jpg.readUInt16BE(i + 2); if (marker >= 0xffc0 && marker <= 0xffc2) { groesse = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; } i += 2 + len; }
  assert.deepEqual(groesse, [1200, 630]);
  const robots = lies('public/robots.txt');
  for (const pfad of ['/api/', '/spielbereich', '/sl', '/profil']) assert.ok(robots.includes(`Disallow: ${pfad}`), pfad);
  assert.match(robots, /Sitemap: https:\/\/chroniplay\.cc\/sitemap\.xml/);
  const sitemap = lies('public/sitemap.xml');
  assert.ok(sitemap.includes('<loc>https://chroniplay.cc/</loc>'));
  for (const pfad of ['/impressum', '/datenschutz']) {
    assert.ok(!sitemap.includes(`<loc>https://chroniplay.cc${pfad}</loc>`), `${pfad} wird nicht zur Indexierung eingereicht`);
    assert.ok(!robots.includes(`Disallow: ${pfad}`), `${pfad} muss zum Lesen von noindex crawlbar bleiben`);
    assert.match(lies(`app${pfad}/page.tsx`), /robots: \{ index: false, follow: true, nosnippet: true \}/);
  }
  assert.ok(!/spielbereich|\/sl|profil/.test(sitemap));
});
