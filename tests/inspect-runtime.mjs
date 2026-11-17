import { cli } from './iwsdk.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('artifacts', { recursive: true });
function record(name,data){writeFileSync(`artifacts/${name}.json`,JSON.stringify(data,null,2));console.log(name,JSON.stringify({screenshotPath:data.screenshotPath,keys:Object.keys(data.result??data),valid:data.result?.valid,stats:data.result?.renderStats}));}
record('scene-open',cli('scene','open',{path:'public/scenes/arena.iwsdk.scene.json'}));
for (const assetId of ['sword','grimoire']) for (const mode of ['material', 'clay']) {
  record(`${assetId}-${mode}`,cli('asset', 'render-preview', { assetId, mode, width: 640, height: 480 }, ['--output-file', `artifacts/${assetId}-${mode}.png`]));
}
record('arena-hero',cli('scene', 'render-file', { path: 'public/scenes/arena.iwsdk.scene.json', viewId: 'hero', width: 512, height: 512 }, ['--output-file', 'artifacts/arena-hero.png']));
record('scene-state',cli('scene','state'));
console.log('UI',JSON.stringify(cli('ui','assets')));
record('panel-preview',cli('ui','render-preview',{assetId:'prompt-panel',width:800,height:600},['--output-file','artifacts/panel-preview.png']));
record('final-runtime',cli('browser','screenshot',{},['--output-file','artifacts/final-runtime.png']));
