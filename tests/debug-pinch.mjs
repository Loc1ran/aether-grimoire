import { cli } from './iwsdk.mjs';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
cli('xr','set-select-value',{device:'hand-right',value:1,duration:.15});await sleep(500);
console.log('HAND',JSON.stringify(cli('xr','get-hand-state',{device:'hand-right',joints:'all'}).result));
console.log('BOOK',JSON.stringify(cli('ecs','query',{entityIndex:cli('ecs','find',{withComponents:['Combat']}).result.entities[0].entityIndex}).result));
cli('xr','set-select-value',{device:'hand-right',value:0,duration:.15});
