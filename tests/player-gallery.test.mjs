import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {galleryImagesFor,ownImages,sharedImages} from '../domain/player-gallery.ts';

// SL report 21.11.2026: players saw other players' images in their gallery. The gallery is personal now.
const a={id:'player-a',gm:false,status:'active'},b={id:'player-b',gm:false,status:'active'},gm={id:'sl',gm:true,status:'active'};
const bodyOfA={characterMedia:[
 {fileId:'a-portrait',type:'portrait',caption:'Porträt',shared:true},
 {fileId:'a-private',type:'reference',caption:'',shared:false},
],presentation:{published:false,gallery:[{fileId:'a-legacy',caption:'alt'}]}};
const ids=list=>list.map(e=>e.fileId).sort();

test('player A sees every image of the own character, shared or not', () => {
 assert.deepEqual(ids(galleryImagesFor(a,'player-a',bodyOfA)),['a-legacy','a-portrait','a-private']);
});

test('player B sees none of player A\'s images, not even the ones shared with the group', () => {
 assert.deepEqual(galleryImagesFor(b,'player-a',bodyOfA),[]);
 assert.deepEqual(galleryImagesFor(b,'player-a',{...bodyOfA,presentation:{published:true,gallery:[{fileId:'x',caption:''}]}}),[]);
});

test('the SL sees only images shared with the group', () => {
 assert.deepEqual(ids(galleryImagesFor(gm,'player-a',bodyOfA)),['a-portrait']);
});

test('inactive or blocked viewers see nothing, even of their own character', () => {
 assert.deepEqual(galleryImagesFor({...a,status:'pending'},'player-a',bodyOfA),[]);
 assert.deepEqual(galleryImagesFor({...gm,status:'blocked'},'player-a',bodyOfA),[]);
});

test('broken bodies give empty lists instead of errors', () => {
 assert.deepEqual(ownImages({characterMedia:'x',presentation:{gallery:{}}}),[]);
 assert.deepEqual(sharedImages({characterMedia:[null,{fileId:3,shared:true}]}),[]);
});

test('the gallery query keeps other players out on the server, and gallery uploads stay private', () => {
 const server=readFileSync(new URL('../server/character-gallery.ts',import.meta.url),'utf8');
 assert.match(server,/r\.owner_id=\?/,'players only load their own characters');
 assert.match(server,/galleryImagesFor\(a,row\.owner_id/,'list and direct image use the same rule');
 const client=readFileSync(new URL('../app/spielbereich/modules/player-gallery.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(client,/shared:true/,'a picture added in the gallery is not shared with the group automatically');
});
