import { cli } from './iwsdk.mjs';
import { writeFileSync } from 'node:fs';
const targets=cli('xr','list-targets',{}).result;
writeFileSync('artifacts/interaction-targets.json',JSON.stringify(targets,null,2));
console.log(JSON.stringify(targets));
const index=cli('ecs','find',{namePattern:'Training Guide'}).result.entities[0].entityIndex;
console.log('PANEL',JSON.stringify(cli('ui','inspect',{entityIndex:index,selector:'#emitter-button'}).result));
