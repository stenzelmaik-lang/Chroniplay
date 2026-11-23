// P1 2026-11-22: long scene texts are accepted completely or rejected with a precise reason, never shortened.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyScene, sceneDocumentSchema, sceneCommandSchema, sceneIssueMessage } from '../domain/story-scene.ts';
import { htmlToRichText, richTextToPlainText, readRichText, richTextStructureLimits } from '../domain/location-rich-text.ts';

const word = i => ['Der', 'Junge', 'im', 'Keller', 'flüstert', 'leise', 'Kerzenlicht', 'Staub', 'Schritte', 'Treppe'][i % 10];
const sentence = (n, s = 0) => Array.from({ length: n }, (_, i) => word(i + s)).join(' ') + '.';
const table = rows => '<table><tbody><tr><th>Sprecher</th><th>Dialog</th><th>Regie</th></tr>' + Array.from({ length: rows }, (_, i) => `<tr><td><strong>${i % 2 ? 'Junge' : 'SC'}</strong></td><td>„Zeile ${i + 1}: ${sentence(14, i)}“</td><td><em>${sentence(4, i)}</em></td></tr>`).join('') + '</tbody></table>';
const scene = fields => ({ ...emptyScene(''), title: 'Szene 05 – Der Junge im Keller', ...fields });
const html = v => 'cvk-html-v1:' + v;

test('a long dialogue table (30, 45 and 120 lines) is accepted and stored completely, line by line', () => {
  for (const rows of [30, 45, 120]) {
    const parsed = sceneDocumentSchema.safeParse(scene({ dialogueNotes: html(table(rows)) }));
    assert.ok(parsed.success, rows + ' rows: ' + (parsed.success ? '' : parsed.error.issues[0].message));
    const stored = readRichText(parsed.data.dialogueNotes).blocks[0];
    assert.equal(stored.type, 'table');
    assert.equal(stored.rows.length, rows + 1, 'header plus every dialogue line');
    assert.match(richTextToPlainText(parsed.data.dialogueNotes), new RegExp('Zeile ' + rows + ':'));
  }
});

test('many short dialogue paragraphs and heavily formatted narration are no longer rejected below the text limit', () => {
  const dialogue = Array.from({ length: 130 }, (_, i) => `<p><strong>${i % 2 ? 'Junge' : 'SC'}:</strong> ${sentence(8, i)}</p>`).join('');
  const formatted = Array.from({ length: 110 }, (_, i) => '<p>' + Array.from({ length: 4 }, (_, j) => `<strong>${word(j)}</strong> ${sentence(3, i + j)} `).join('') + '</p>').join('');
  for (const [field, value] of [['narration', dialogue], ['secrets', formatted]]) {
    const parsed = sceneDocumentSchema.safeParse(scene({ [field]: html(value) }));
    assert.ok(parsed.success, field + ': ' + (parsed.success ? '' : parsed.error.issues[0].message));
    assert.equal(richTextToPlainText(parsed.data[field]).replace(/\n/g, '').length, richTextToPlainText(htmlToRichText(value)).replace(/\n/g, '').length);
  }
});

test('there is no 5,000-character limit on scene texts; the 20,000 visible-character limit has a clear message', () => {
  assert.ok(sceneDocumentSchema.safeParse(scene({ narration: html('<p>' + 'x'.repeat(5001) + '</p>') })).success);
  assert.ok(sceneDocumentSchema.safeParse(scene({ narration: html('<p>' + 'x'.repeat(20000) + '</p>') })).success);
  const over = sceneCommandSchema.safeParse({ action: 'save', id: 'scene-1', version: 1, document: scene({ narration: html('<p>' + 'x'.repeat(20001) + '</p>') }) });
  assert.equal(over.success, false);
  assert.match(sceneIssueMessage(over.error.issues[0]), /^Erzählung: .*20\.000 sichtbare Zeichen/);
});

test('a table beyond the structure bound is rejected with the exact reason and field, never shortened', () => {
  const rows = richTextStructureLimits.tableRows + 5;
  assert.throws(() => htmlToRichText(table(rows)), new RegExp('Eine Tabelle hat ' + (rows + 1) + ' Zeilen; erlaubt sind höchstens ' + richTextStructureLimits.tableRows));
  const result = sceneCommandSchema.safeParse({ action: 'save', id: 'scene-1', version: 1, document: scene({ dialogueNotes: html(table(rows)) }) });
  assert.equal(result.success, false);
  assert.match(sceneIssueMessage(result.error.issues[0]), /^Dialoge: Eine Tabelle hat \d+ Zeilen/);
  const element = { id: crypto.randomUUID(), kind: 'text', title: 'Lange Tabelle', text: html(table(rows)), referenceId: '', fileId: '' };
  const inElement = sceneCommandSchema.safeParse({ action: 'save', id: 'scene-1', version: 1, document: scene({ elements: [element] }) });
  assert.match(sceneIssueMessage(inElement.error.issues[0]), /^Baustein 1: Eine Tabelle/);
});

test('the editor no longer cuts pasted tables and reports the row limit instead of ignoring the click', () => {
  const source = readFileSync('app/spielbereich/modules/rich-text.tsx', 'utf8');
  assert.doesNotMatch(source, /split\(\/\\r\?\\n\/\)\.slice\(0,30\)/);
  assert.doesNotMatch(source, /split\('\\t'\)\.slice\(0,10\)/);
  assert.match(source, /richTextStructureLimits\.tableRows\} Zeilen, das Maximum je Tabelle/);
});
