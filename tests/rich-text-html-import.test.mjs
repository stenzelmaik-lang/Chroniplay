import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanHtmlSource, cssColorToHex, htmlImportNotes, htmlAuthoringGuide, htmlToRichText, htmlTextToRichText, readRichText, richTextToHtml } from '../domain/location-rich-text.ts';

const blocks = html => readRichText(htmlToRichText(html)).blocks;

test('Wrapped HTML from other tools is unwrapped: code fences and whole pages', () => {
  assert.equal(cleanHtmlSource('```html\n<p>Hallo</p>\n```'), '<p>Hallo</p>');
  assert.equal(cleanHtmlSource('<!DOCTYPE html><html><head><title>Seite</title><style>p{color:red}</style></head><body><p>Inhalt</p></body></html>'), '<p>Inhalt</p>');
  const page = blocks('<!DOCTYPE html><html><head><title>Seitentitel</title></head><body><h1>Kopf</h1><p>Text</p></body></html>');
  assert.deepEqual(page.map(b => b.type), ['heading2', 'paragraph']);
  assert.ok(!richTextToHtml(htmlToRichText('<title>Seitentitel</title><p>Text</p>')).includes('Seitentitel'));
  assert.ok(htmlTextToRichText('```html\n<p>Aus der KI</p>\n```'), 'pasted fenced HTML is recognised');
});

test('Inline styles become safe marks: colour, bold, italic, underline, strike', () => {
  const [p] = blocks('<p><span style="color:#c33; font-weight:700">A</span><span style="font-style:italic">B</span><span style="text-decoration: underline line-through">C</span><span style="color: rgba(10, 20, 30, .5)">D</span><span style="color:gold">E</span></p>');
  assert.deepEqual(p.children, [
    { text: 'A', bold: true, color: '#cc3333' },
    { text: 'B', italic: true },
    { text: 'C', underline: true, strike: true },
    { text: 'D', color: '#0a141e' },
    { text: 'E', color: '#ffd700' },
  ]);
  assert.equal(cssColorToHex('#ABC'), '#aabbcc');
  assert.equal(cssColorToHex('rgb(300,0,0)'), undefined);
  assert.equal(cssColorToHex('url(javascript:alert(1))'), undefined);
});

test('Alignment from style, align attribute and <center> is kept, also inherited from containers', () => {
  const out = blocks('<div style="text-align:center"><h2>Titel</h2><p>Mitte</p></div><p align="right">Rechts</p><center>Alt</center><p style="text-align:left">Links</p>');
  assert.deepEqual(out.map(b => [b.type, b.className || '']), [['heading2', 'cp-align-center'], ['paragraph', 'cp-align-center'], ['paragraph', 'cp-align-right'], ['paragraph', 'cp-align-center'], ['paragraph', '']]);
});

test('More tags map to the existing blocks; unsafe content still disappears', () => {
  const out = blocks('<h5>Klein</h5><dl><dt>Begriff</dt><dd>Erklärung</dd></dl><p><mark>wichtig</mark></p><script>alert(1)</script><iframe src="https://x"></iframe><img src="https://evil/x.png">');
  assert.deepEqual(out.map(b => b.type), ['heading3', 'paragraph', 'paragraph', 'paragraph']);
  assert.deepEqual(out[1].children, [{ text: 'Begriff', bold: true }]);
  assert.equal(out[3].children[0].className, 'cp-highlight');
  const html = richTextToHtml(htmlToRichText('<p onclick="x()" style="background:url(javascript:1)">Text</p>'));
  assert.equal(html, '<p>Text</p>');
});

test('Import notes say what is not taken over; the guide lists the allowed classes', () => {
  const notes = htmlImportNotes('<style>.x{}</style><div class="box cp-note" style="border:1px solid red;background:#000;color:#fff">x</div><script></script><img src="https://x/y.png">');
  assert.equal(notes.length, 5);
  assert.match(notes[0], /border, background/);
  assert.match(notes[1], /box/);
  assert.ok(!notes[1].includes('cp-note,') || notes[1].includes('Gestalten kannst du'));
  assert.deepEqual(htmlImportNotes('<p class="cp-intro" style="color:#ffffff;text-align:center">ok</p>'), []);
  for (const name of ['cp-intro', 'cp-highlight', 'cp-note', 'cp-align-center']) assert.ok(htmlAuthoringGuide.includes(name));
});
