import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {THUMB_PX,THUMB_MAX_BYTES,thumbKey,legacyThumbKey,fileIdFromUrl} from '../domain/file-thumb.ts';

test('previews are sharp enough for cards and carry their size in the key',()=>{
 assert.ok(THUMB_PX>=640,'NPC cards are about 320 css px wide; high-density screens need about twice that');
 assert.equal(thumbKey('users/a/galerie/1'),'users/a/galerie/1.thumb720');
 assert.notEqual(thumbKey('k'),legacyThumbKey('k'),'an older, smaller preview is never served for the new size');
 assert.ok(THUMB_MAX_BYTES<=256*1024);
});
test('only plain protected file URLs map to a file id',()=>{
 assert.equal(fileIdFromUrl('/api/files?id=abc-123'),'abc-123');
 assert.equal(fileIdFromUrl('/api/files?id=a%20b'),'a b');
 for(const url of [undefined,'','https://example.org/x.png','/api/files?id=1&size=thumb','/api/cms/media?id=1','/api/files?other=1'])assert.equal(fileIdFromUrl(url),'',String(url));
});
test('lists and cards use previews, deleting a file removes both preview generations',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 assert.match(read('app/spielbereich/modules/npc-panel.tsx'),/<ThumbImage id=\{fileIdFromUrl\(image\)\}/);
 assert.match(read('app/spielbereich/modules/preparation-figures.tsx'),/<ThumbImage id=\{image\.id\}/);
 assert.match(read('app/spielbereich/modules/spieltisch/regie-figures.tsx'),/<ThumbImage className=\{styles\.portrait\}/);
 assert.match(read('app/spielbereich/modules/player-gallery.tsx'),/<GalleryThumb url=\{img\.url\}\/>/);
 assert.match(read('app/spielbereich/modules/gallery-preview.tsx'),/<GalleryThumb key=\{i\.url\}/);
 assert.match(read('server/character-gallery.ts'),/thumbKey\(file\.key\)/);
 assert.match(read('app/api/files/route.ts'),/thumbKey\(removed\.key\),legacyThumbKey\(removed\.key\)/);
});
