// Runs the browser tests one by one. Each test gets its own isolated synthetic fixture on a local port, which is stopped
// afterwards. Tests that read a generated file run the generator first. Local only: the fixtures come from
// scripts/test-local.mjs, and every test refuses anything but 127.0.0.1.
// Usage: node --experimental-strip-types scripts/run-browser-tests.mjs [testFileName ...]
// Environment: CVK_PLAYWRIGHT_MODULE (path to a playwright index.js; default: the local Codex copy),
// CVK_PLAYWRIGHT_CHANNEL (default msedge). Results: .local-work/browser-results.json
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

// row: { test, flag (scripts/test-local.mjs switch or null), port, source, prep (optional generator script) }
// "vermutet" marks a best match, not a confirmed one.
export const plan = [
  { test: 'character-management-browser.mjs', flag: '--charakter-3', port: 8846, source: 'start-charakter-3.ps1' },
  { test: 'erzaehlung-ux-browser.mjs', flag: '--zustandswerte', port: 8864, source: 'start-erzaehlung.ps1' },
  { test: 'ge-02-browser.mjs', flag: '--ge-01', port: 8898, source: 'Testkopf' },
  { test: 'header-name-browser.mjs', flag: '--command-center', port: 8879, source: 'Testkopf' },
  { test: 'hud-einklappen-browser.mjs', flag: '--zustandswerte', port: 8862, source: 'Testkopf' },
  { test: 'live-befund-browser.mjs', flag: '--material-3', port: 8893, source: 'start-material-3.ps1' },
  { test: 'live-deliveries-browser.mjs', flag: '--regie', port: 8870, source: 'Testkopf' },
  { test: 'material-3-browser.mjs', flag: '--material-3', port: 8893, source: 'start-material-3.ps1' },
  { test: 'material-packets-browser.mjs', flag: '--material-3', port: 8882, source: 'vermutet' },
  { test: 'material-tooltip-browser.mjs', flag: '--material-3', port: 8893, source: 'start-material-3.ps1' },
  { test: 'preparation-guide-browser.mjs', flag: '--spieltisch-release', port: 8820, source: 'Testkopf (Port-Liste)' },
  { test: 'regie-nachbesserung-browser.mjs', flag: '--ultio-pager', port: 8881, source: 'start-regie-nachbesserung.ps1' },
  { test: 'regie-zweitfenster-browser.mjs', flag: '--regie', port: 8870, source: 'start-regie.ps1' },
  { test: 'spielpause-browser.mjs', flag: '--zustandswerte', port: 8847, source: 'Testkopf' },
  { test: 'spielpause-picker-browser.mjs', flag: '--zustandswerte', port: 8847, source: 'Testkopf' },
  { test: 'spielpause-watch-browser.mjs', flag: '--zustandswerte', port: 8847, source: 'Testkopf' },
  { test: 'spieltisch-regie-ux-browser.mjs', flag: '--spieltisch-2', port: 8834, source: 'Testkopf (Port-Liste)' },
  { test: 'table-materials-browser.mjs', flag: '--material-3', port: 8882, source: 'vermutet' },
  { test: 'table-materials-edges-browser.mjs', flag: '--material-3', port: 8882, source: 'vermutet' },
  { test: 'ultio-pager-browser.mjs', flag: '--ultio-pager', port: 8874, source: 'start-ultio-pager.ps1' },
  { test: 'ultio-pager-fixes-browser.mjs', flag: '--ultio-pager', port: 8884, source: 'Testkopf' },
  { test: 'ultio-pager-tisch-browser.mjs', flag: '--ultio-pager', port: 8881, source: 'Testkopf' },
  { test: 'ambiente-browser.mjs', flag: '--ultio-pager', port: 8881, source: 'ambiente-integration.mjs' },
  { test: 'zustandswerte-runde-browser.mjs', flag: '--ultio-pager', port: 8881, source: 'vermutet' },
  { test: 'whiteboard-browser.mjs', flag: '--ultio-pager', port: 8897, source: 'Testkopf' },
  // Previously without a fixture; mapped by best match and checked by the next run.
  { test: 'regie-material-access-browser.mjs', flag: '--regie', port: 8901, source: 'vermutet' },
  { test: 'ultio-audio-browser.mjs', flag: '--ultio-pager', port: 8901, source: 'vermutet' },
  { test: 'regie-studio-browser.mjs', flag: '--regie', port: 8902, source: 'vermutet' },
  { test: 'live-regie-layout-browser.mjs', flag: '--regie', port: 8922, source: 'vermutet' },
  { test: 'spielpause-3d-browser.mjs', flag: null, port: null, prep: 'scripts/build-spielpause-preview.mjs', source: 'Generator' },
];

// Tests that cannot run here, with the reason. They are reported, never silently skipped.
export const unmapped = [
  { test: 'scene-whispers-browser.mjs', reason: 'liest .local-work/whispers/fixture.json; kein Skript erzeugt diese Datei' },
];

const base = (port) => `http://127.0.0.1:${port}`;
const localPlaywright = 'C:/Users/Stenz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js';

// The tests use ``const {chromium} = await import(...)``. The local copy only has it under ``default``, so a bridge module
// re-exports it. Tests that launch without a channel get Microsoft Edge: this machine has no bundled Chromium.
function bridge() {
  mkdirSync('.local-work', { recursive: true });
  const file = '.local-work/playwright-bridge.mjs';
  writeFileSync(file, 'import pw from ' + JSON.stringify(pathToFileURL(localPlaywright).href) + ';\n' +
    'const launch = (options = {}) => pw.chromium.launch({ ...options, channel: options.channel || process.env.CVK_PLAYWRIGHT_CHANNEL || "msedge" });\n' +
    'export const chromium = { launch, connect: (...a) => pw.chromium.connect(...a) };\nexport default pw;\n');
  return pathToFileURL(file).href;
}
// Playwright is not a project dependency (adding one needs the owner's approval).
const playwrightModule = process.env.CVK_PLAYWRIGHT_MODULE || (existsSync(localPlaywright) ? bridge() : 'playwright');
const channel = process.env.CVK_PLAYWRIGHT_CHANNEL || 'msedge';

// Synthetic fixture stores created by scripts/test-local.mjs. A store without its marker cannot be resumed and blocks the
// next start ("Unmarked local demo store"); such stores are rebuilt from scratch. Stores with a marker (the demo) are kept.
const fixtureStores = ['charakter-3', 'ge-01', 'material-3', 'regie', 'spieltisch-2', 'ultio-pager', 'zustandswerte', 'command-center', 'storyboard'];
function resetUnmarkedStores() {
  for (const name of fixtureStores) {
    const dir = '.local-test/' + name;
    if (existsSync(dir) && !existsSync(dir + '/synthetic-weekend.json')) rmSync(dir, { recursive: true, force: true });
  }
}

// test-local.mjs prints "Isolated application ready" only after the fixture is seeded (and the evening is started).
// Waiting for the server alone starts the tests too early, while the seed is still running.
async function ready(child, log) {
  const started = Date.now();
  while (Date.now() - started < 300000) {
    if (child.exitCode !== null) return false;
    if (log.join('').includes('Isolated application ready')) return true;
    await sleep(1000);
  }
  return false;
}

function stop(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGTERM');
}

function runTest(row, env) {
  const run = spawnSync(process.execPath, ['--experimental-strip-types', 'tests/' + row.test], { env, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  return { status: run.status === 0 ? 'pass' : run.signal ? 'timeout' : 'fail', detail: output.trim().split('\n').slice(-12).join('\n') };
}

const selected = process.argv.slice(2);
const rows = selected.length ? plan.filter(row => selected.includes(row.test)) : plan;
const results = [];

for (const row of rows) {
  const env = { ...process.env, CVK_PLAYWRIGHT_MODULE: playwrightModule, CVK_PLAYWRIGHT_CHANNEL: channel, CVK_BROWSER_CHANNEL: channel };
  if (row.port) Object.assign(env, { CVK_TEST_PORT: String(row.port), CVK_TEST_URL: base(row.port) });
  const started = Date.now();
  console.log(`\n== ${row.test}  (${row.flag ?? 'ohne Fixture'}${row.port ? ' auf ' + row.port : ''}, ${row.source})`);
  let outcome;
  if (row.prep) {
    const prep = spawnSync(process.execPath, ['--experimental-strip-types', row.prep], { env, encoding: 'utf8' });
    if (prep.status !== 0) outcome = { status: 'fixture-failed', detail: (prep.stderr || prep.stdout || '').slice(-600) };
  }
  if (!outcome && !row.flag) {
    outcome = runTest(row, env);
  } else if (!outcome) {
    resetUnmarkedStores();
    const log = [];
    const fixture = spawn(process.execPath, ['--experimental-strip-types', 'scripts/test-local.mjs', row.flag], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    fixture.stdout.on('data', chunk => log.push(String(chunk)));
    fixture.stderr.on('data', chunk => log.push(String(chunk)));
    try {
      const up = await ready(fixture, log);
      outcome = up ? runTest(row, env) : { status: 'fixture-failed', detail: log.join('').slice(-600) };
    } finally {
      stop(fixture);
      await sleep(1500);
    }
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ test: row.test, flag: row.flag, port: row.port, source: row.source, seconds, ...outcome });
  console.log(`   ${outcome.status} (${seconds} s)`);
}

mkdirSync('.local-work', { recursive: true });
const summary = { ran: results.length, pass: results.filter(r => r.status === 'pass').length, failed: results.filter(r => r.status !== 'pass'), unmapped };
writeFileSync('.local-work/browser-results.json', JSON.stringify({ summary, results }, null, 2));
console.log(`\nErgebnis: ${summary.pass} von ${summary.ran} bestanden, ${summary.failed.length} nicht bestanden, ${unmapped.length} ohne Fixture.`);
