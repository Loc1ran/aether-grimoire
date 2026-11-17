import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const packageRoot = resolve('node_modules/@iwsdk/cli');
const manifest = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const executable = resolve(packageRoot, typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.iwsdk);
export function cli(domain, action, input, extra = []) {
  const args = [executable, domain, action];
  if (input !== undefined) args.push('--input-json', JSON.stringify(input));
  args.push(...extra);
  let raw;
  try { raw = execFileSync(process.execPath, args, { encoding: 'utf8', timeout: 65000, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (error) { throw new Error(error.stderr ? JSON.parse(error.stderr).error.message : error.message); }
  const result = JSON.parse(raw);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.data;
}
if (process.argv[2]) console.log(JSON.stringify(cli(process.argv[2], process.argv[3], process.argv[4] ? JSON.parse(process.argv[4]) : undefined), null, 2));
