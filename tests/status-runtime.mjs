import { cli } from './iwsdk.mjs';
console.log('XR', JSON.stringify(cli('xr', 'status')));
const books=cli('ecs','find',{withComponents:['Combat']}).result.entities;
console.log('BOOK',JSON.stringify(cli('ecs','query',{entityIndex:books[0].entityIndex})));
console.log('PANELS',JSON.stringify(cli('ecs','find',{namePattern:'Training Guide'})));
