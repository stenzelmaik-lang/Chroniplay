// Storyboard 2.0 (Phase 1) rollback aid. Only needed if the Worker is rolled back to a build older than Storyboard 2.0 AND
// scenes were saved with storyboard properties (`board`); older builds parse scenes strictly and would answer such scenes
// (and the scene list) with 409. Reads a JSON export (`wrangler d1 execute DB --remote --json --command "SELECT id,campaign_id,
// version,gm_body FROM entities WHERE type='SCENE' AND (json_extract(gm_body,'$.board') IS NOT NULL OR json_extract(gm_body,'$.passages') IS NOT NULL
// OR json_extract(gm_body,'$.moods') IS NOT NULL OR json_extract(gm_body,'$.context') IS NOT NULL OR json_extract(gm_body,'$.cast') IS NOT NULL
// OR json_extract(gm_body,'$.places') IS NOT NULL OR json_extract(gm_body,'$.placesOpen') IS NOT NULL OR json_extract(gm_body,'$.materialUses') IS NOT NULL
// OR json_extract(gm_body,'$.insights') IS NOT NULL OR json_extract(gm_body,'$.interactionCards') IS NOT NULL OR json_extract(gm_body,'$.events') IS NOT NULL OR json_extract(gm_body,'$.checks') IS NOT NULL)"`) and WRITES SQL ONLY.
// It never connects to a database. All values move into the private SL notes as text; nothing is lost.
// Usage: node --experimental-strip-types scripts/storyboard2-rollback-board.mjs export.json > rollback.sql
import {readFileSync} from 'node:fs';
import {sceneWithoutBoard} from '../domain/storyboard-blocks.ts';
import {sceneWithoutWorkshop} from '../domain/scene-workshop.ts';
import {sceneWithoutMaterialUses} from '../domain/material-library.ts';
import {sceneWithoutPossibilities} from '../domain/scene-possibilities.ts';
import {sceneWithoutChecks} from '../domain/scene-checks.ts';
const file=process.argv[2];if(!file){console.error('Pfad zur JSON-Ausgabe von wrangler d1 execute --json angeben.');process.exit(2);}
const parsed=JSON.parse(readFileSync(file,'utf8')),rows=(Array.isArray(parsed)?parsed.flatMap(r=>r.results||[r]):parsed.results||[]).filter(r=>r&&r.id&&r.gm_body);
const quote=v=>"'"+String(v).replace(/'/g,"''")+"'";let total=0;
console.log('-- Storyboard 2.0 rollback: board properties back to SL notes. Review before running; version-guarded.');
for(const row of rows){
 let doc;try{doc=JSON.parse(row.gm_body);}catch{console.log('-- skipped (invalid JSON): '+row.id);continue;}
 const first=sceneWithoutBoard(doc),second=sceneWithoutWorkshop(first.document),third=sceneWithoutMaterialUses(second.document),fourth=sceneWithoutPossibilities(third.document),fifth=sceneWithoutChecks(fourth.document),document=fifth.document,changed=first.changed||second.changed||third.changed||fourth.changed||fifth.changed;if(!changed)continue;total++;
 console.log(`UPDATE entities SET gm_body=${quote(JSON.stringify(document))},version=version+1 WHERE id=${quote(row.id)} AND campaign_id=${quote(row.campaign_id)} AND version=${Number(row.version)};`);
}
console.log(`-- ${total} scene(s) with storyboard properties in ${rows.length} scene row(s) examined.`);
