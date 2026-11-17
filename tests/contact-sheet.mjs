import sharp from 'sharp';
const tiles=[];
const files=['sword-material.png','sword-clay.png','grimoire-material.png','grimoire-clay.png','final-runtime.png','hand-shield-runtime.png'];
for(let i=0;i<files.length;i++){
  const height=i<4?256:512;
  const input=await sharp(`artifacts/${files[i]}`).resize(512,height,{fit:'contain',background:'#17131e'}).toBuffer();
  tiles.push({input,left:i%2*512,top:i<4?Math.floor(i/2)*256:512});
}
await sharp({create:{width:1024,height:1024,channels:3,background:'#17131e'}}).composite(tiles).jpeg({quality:90}).toFile('artifacts/ui-runtime-review.jpg');
console.log('Saved artifacts/ui-runtime-review.jpg');
