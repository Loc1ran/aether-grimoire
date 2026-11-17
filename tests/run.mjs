import { build } from 'esbuild';
const result = await build({
  stdin: { contents: `import './tests/combat.test.ts'; import './tests/impact.test.ts'; import './tests/arena.test.ts'; import './tests/visuals.test.ts'; import './tests/signature.test.ts'; import { runInputTests } from './tests/input.test.ts'; console.log(runInputTests());`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external',
});
const code = result.outputFiles[0].text.replaceAll('"@iwsdk/core"', JSON.stringify(import.meta.resolve('@iwsdk/core')));
await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
await import('./weapon.test.mjs');
