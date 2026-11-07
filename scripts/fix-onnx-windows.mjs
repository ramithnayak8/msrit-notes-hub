/**
 * Windows only. onnxruntime-node (the local embedding model) is built against
 * Visual C++ runtime 14.40+. On a machine whose system msvcp140.dll is older,
 * it segfaults as soon as a model loads (the API dies right after "MongoDB
 * connected"). The real fix is installing the latest VC++ Redistributable;
 * this copies a current runtime that is already on the machine (Edge ships
 * one) next to the onnxruntime binding instead, which needs no admin rights.
 * Runs on `npm install`; does nothing elsewhere or when it isn't needed.
 */
import { copyFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

if (process.platform !== 'win32') process.exit(0);

const bin = join(import.meta.dirname, '..', 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6', 'win32', 'x64');
if (!existsSync(bin)) process.exit(0);

const version = (file) => {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', `(Get-Item '${file}').VersionInfo.FileVersion`], { encoding: 'utf8' });
    return out.trim().split(/[ .]/).slice(0, 2).map(Number);
  } catch {
    return [0, 0];
  }
};
const newEnough = ([major, minor]) => major > 14 || (major === 14 && minor >= 40);

if (newEnough(version(join(bin, 'msvcp140.dll')))) process.exit(0);
const system = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'msvcp140.dll');
if (newEnough(version(system))) process.exit(0);

const edgeRoots = ['Edge', 'EdgeWebView', 'EdgeCore'].map((d) => join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft', d, d === 'EdgeCore' ? '' : 'Application'));
const candidates = edgeRoots
  .filter(existsSync)
  .flatMap((root) => readdirSync(root).map((v) => join(root, v)))
  .filter((dir) => existsSync(join(dir, 'msvcp140.dll')) && newEnough(version(join(dir, 'msvcp140.dll'))));

if (!candidates.length) {
  console.warn('[fix-onnx-windows] Visual C++ runtime is older than 14.40 and no newer copy was found.');
  console.warn('  Install https://aka.ms/vs/17/release/vc_redist.x64.exe or the embedding model will crash.');
  process.exit(0);
}
const from = candidates[0];
for (const dll of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll']) {
  if (existsSync(join(from, dll))) copyFileSync(join(from, dll), join(bin, dll));
}
console.log(`[fix-onnx-windows] Old system VC++ runtime; copied a current one from ${from} next to onnxruntime.`);
