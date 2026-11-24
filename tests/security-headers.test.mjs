import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../middleware.ts',import.meta.url),'utf8');
test('every response gets the baseline browser protections',()=>{
 for(const header of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy'])assert.match(source,new RegExp(`'${header}'`),header);
 assert.match(source,/'X-Frame-Options':'SAMEORIGIN'/,'own pages may still frame each other (table preview)');
 assert.match(source,/microphone=\(self\)/,'voice chat at the table keeps microphone access');
 assert.match(source,/if\(!response\.headers\.has\(name\)\)/,'a route that sets its own value keeps it');
});
test('the legacy workers.dev redirect stays in front of the headers',()=>{
 assert.ok(source.indexOf('NextResponse.redirect')<source.indexOf('NextResponse.next()'));
});
