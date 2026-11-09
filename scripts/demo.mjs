/**
 * One command for a live demo: MongoDB, then the API and the site in
 * production mode (no compile-on-first-visit pauses as with `next dev`).
 *
 *   npm run demo              build both, then start
 *   npm run demo -- --no-build start the last build
 *
 * Ctrl+C stops both servers. MongoDB keeps running (docker stop conceptquery-mongo).
 */
import { spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';

const SITE = 'http://localhost:3000';
const build = !process.argv.includes('--no-build');

const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
const run = (cmd) => {
  console.log(`\n› ${cmd}`);
  if (spawnSync(cmd, { stdio: 'inherit', shell: true }).status !== 0) fail(`${cmd} failed`);
};
const portInUse = (port) =>
  new Promise((resolve) => {
    const s = connect(port, '127.0.0.1');
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });

// A server left running from an earlier session would make the new one exit with EADDRINUSE,
// and on Windows a running site also locks the library file the build regenerates.
for (const port of [3000, 4000]) {
  if (await portInUse(port)) fail(`Port ${port} is already in use. Stop the server running there first (close its terminal, or: npx kill-port ${port}).`);
}

run('docker start conceptquery-mongo');
if (build) {
  run('npm run build -w server');
  run('npm run build -w client');
}

const children = [
  spawn('npm run start -w server', { stdio: 'inherit', shell: true }),
  spawn('npm run start -w client', { stdio: 'inherit', shell: true }),
];
// With shell: true each child is a shell running npm running node; on Windows kill() stops only
// the shell, so stop the whole tree or the other server keeps holding its port.
const stopAll = () => {
  for (const c of children) {
    if (c.exitCode !== null) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
    else c.kill();
  }
};
for (const child of children) {
  child.on('exit', (code) => {
    if (code) console.error(`\n✗ a server exited with code ${code}; stopping the other one. Run npm run demo -- --no-build to start again.`);
    stopAll();
    process.exit(code ?? 0);
  });
}
process.on('SIGINT', () => (stopAll(), process.exit(0)));

// Ready when the site answers and its /api proxy reaches the API, which reaches MongoDB.
// The API is asked directly until it is up (it loads the embedding model first), so the
// site doesn't log a proxy error for every early check.
let apiUp = false;
for (let i = 0; i < 90; i++) {
  try {
    apiUp ||= (await fetch('http://localhost:4000/api/health')).ok;
    if (!apiUp) throw new Error('API not up yet');
    const health = await (await fetch(`${SITE}/api/health`)).json();
    if (health.ok) {
      console.log(`\n✓ Ready: ${SITE}   (models: ${health.llm.join(', ') || 'none, assistant answers from search only'})\n`);
      break;
    }
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 1000));
  if (i === 89) console.error(`\n✗ ${SITE}/api/health did not answer within 90 s; check the output above.`);
}
