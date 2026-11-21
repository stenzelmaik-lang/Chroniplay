import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileListQuery} from '../domain/file-list.ts';

// SL decision 21.11.2026: the Persönliches Archiv never lists other players' files, not even group files.
function campaign(){
 const db=new DatabaseSync(':memory:');
 db.exec(`CREATE TABLE files(id TEXT,campaign_id TEXT,owner_id TEXT,visibility TEXT,name TEXT,mime TEXT,size INT,key TEXT,created_at TEXT);
  CREATE TABLE campaign_memberships(campaign_id TEXT,user_id TEXT,role TEXT,status TEXT);
  CREATE TABLE members(id TEXT,campaign_id TEXT,email TEXT,status TEXT);`);
 const member=db.prepare('INSERT INTO members VALUES (?,?,?,?)'),role=db.prepare('INSERT INTO campaign_memberships VALUES (?,?,?,?)');
 for(const [id,email] of [['a','a@x.invalid'],['b','b@x.invalid'],['sl','sl@x.invalid'],['legacy','Old-GM@x.invalid'],['ex','ex@x.invalid']])member.run(id,'k',email,'active');
 role.run('k','a','player','active');role.run('k','b','player','active');role.run('k','sl','campaign_gm','active');role.run('k','ex','campaign_gm','blocked');
 const file=db.prepare("INSERT INTO files VALUES (?,?,?,?,?,'image/png',1,?,'2026-11-21')");
 for(const [id,owner,visibility] of [['a-private','a','private'],['a-group','a','group'],['b-private','b','private'],['b-group','b','group'],['sl-group','sl','group'],['sl-intern','sl','sl'],['legacy-group','legacy','group'],['ex-group','ex','group']])file.run(id,'k',owner,visibility,id,'users/'+owner+'/'+id);
 file.run('other-campaign','x','sl','group','x','users/sl/x');
 return db;
}
const list=(db,viewer,gmEmail='old-gm@x.invalid')=>{const q=fileListQuery({campaignId:'k',...viewer},gmEmail);return db.prepare(q.sql).all(...q.binds).map(r=>r.id).sort();};

test('player A sees own files and SL group files, never player B\'s files', () => {
 assert.deepEqual(list(campaign(),{id:'a',gm:false}),['a-group','a-private','legacy-group','sl-group']);
});

test('player B sees nothing of player A', () => {
 const ids=list(campaign(),{id:'b',gm:false});
 assert.ok(!ids.some(id=>id.startsWith('a-')));
 assert.deepEqual(ids,['b-group','b-private','legacy-group','sl-group']);
});

test('SL-internal files, blocked GMs and other campaigns stay out of a player list', () => {
 const ids=list(campaign(),{id:'a',gm:false});
 for(const hidden of ['sl-intern','ex-group','other-campaign'])assert.ok(!ids.includes(hidden),hidden);
});

test('without GM_EMAIL the legacy GM is not treated as SL', () => {
 assert.ok(!list(campaign(),{id:'a',gm:false},'').includes('legacy-group'));
});

test('the SL keeps the overview: own files, all group files and SL files, never private player files', () => {
 assert.deepEqual(list(campaign(),{id:'sl',gm:true}),['a-group','b-group','ex-group','legacy-group','sl-group','sl-intern']);
});

test('the file route uses the shared list query', () => {
 const route=readFileSync(new URL('../app/api/files/route.ts',import.meta.url),'utf8');
 assert.match(route,/fileListQuery\(a,/);
 assert.doesNotMatch(route,/OR visibility=\? OR/,'the old list that showed every group file is gone');
});
