import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {headerNameModes,profileInput} from '../domain/account-access.ts';

const base={version:1,displayName:'Synthetic',avatarFileId:null,preferences:{reducedMotion:false,compactView:false}};
test('Header name preference accepts only account or character',()=>{
  assert.deepEqual([...headerNameModes],['account','character']);
  for(const mode of headerNameModes)assert.equal(profileInput.safeParse({...base,preferences:{...base.preferences,headerName:mode}}).success,true);
  assert.equal(profileInput.safeParse(base).success,true,'older profile forms without the field stay valid');
  for(const mode of ['gm','real','',null,1])assert.equal(profileInput.safeParse({...base,preferences:{...base.preferences,headerName:mode}}).success,false);
});
test('Header name stays display-only: actor identity and SL views are untouched',()=>{
  const access=readFileSync('server/access.ts','utf8'),header=readFileSync('server/header-name.ts','utf8'),shell=readFileSync('app/spielbereich/modules/shell.tsx','utf8');
  assert.match(access,/name: u\.displayName \|\| member\.name/);
  assert.doesNotMatch(access,/headerName/);
  assert.match(header,/r\.owner_id=\?/,'only own characters are considered');
  assert.match(header,/canon_status<>'GM_SECRET'/);
  assert.match(shell,/\/api\/profile\/header-name/);
  assert.doesNotMatch(readFileSync('app/spielbereich/modules/sl-workspace-shell.tsx','utf8'),/header-name/);
});
