import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const output = new URL('../public/textures/', import.meta.url);
await mkdir(output, { recursive: true });
const curl = '<path d="M0 150C130 130 145 30 70 20C15 12 8 70 45 80C75 87 85 55 62 48M20 140C70 100 105 105 140 120M35 125C12 88 0 45 18 0M58 103C115 90 130 57 126 24"/>';
const corners = [[42,42,0],[726,42,90],[726,982,180],[42,982,270]].map(([x,y,r])=>`<g transform="translate(${x} ${y}) rotate(${r})">${curl}</g>`).join('');
const petals = Array.from({length:8},(_,i)=>`<path transform="rotate(${i*45} 384 512)" d="M384 505C321 450 335 383 384 342C433 383 447 450 384 505Z"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
<defs><radialGradient id="leather"><stop stop-color="#28333b"/><stop offset=".75" stop-color="#17212a"/><stop offset="1" stop-color="#0c111a"/></radialGradient><linearGradient id="gold" x2="1" y2="1"><stop stop-color="#9b7842"/><stop offset=".5" stop-color="#e0c68b"/><stop offset="1" stop-color="#806035"/></linearGradient><filter id="grain"><feTurbulence baseFrequency=".68" numOctaves="3" seed="19"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".13"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs>
<rect width="768" height="1024" fill="url(#leather)"/><rect width="768" height="1024" opacity=".38" filter="url(#grain)"/>
<g fill="none" stroke="url(#gold)"><rect x="27" y="27" width="714" height="970" rx="22" stroke-width="5"/><rect x="43" y="43" width="682" height="938" rx="15" stroke-width="1.5"/><rect x="59" y="59" width="650" height="906" rx="9" opacity=".45" stroke-dasharray="3 8"/>${corners}
<g stroke-width="2.5">${petals}</g><circle cx="384" cy="512" r="146" stroke-width="1.5"/><circle cx="384" cy="512" r="157" stroke-width="1" stroke-dasharray="2 12"/>
<path d="M384 286L403 318L384 350L365 318ZM384 674L403 706L384 738L365 706Z" fill="#ae8d55" stroke-width="1"/>
<path d="M265 512Q384 426 503 512Q384 598 265 512Z" fill="#14202a" stroke-width="5"/><circle cx="384" cy="512" r="30" fill="#a28b63"/><path d="M389 487Q363 511 389 537Q349 526 362 500Z" fill="#131b25"/>
<path d="M189 772Q290 740 384 780Q478 740 579 772M209 790Q294 763 384 802Q474 763 559 790M229 810Q300 788 384 825Q468 788 539 810" stroke-width="2"/>
</g><g fill="#b39b70" font-family="serif" text-anchor="middle"><text x="384" y="229" font-size="22" letter-spacing="8">A E T H E R</text><text x="384" y="892" font-size="14" letter-spacing="6">UMBRA · VENTUS · IGNIS</text></g></svg>`;
const coverPath = fileURLToPath(new URL('codex-cover.png', output));
await sharp(Buffer.from(svg)).png().toFile(coverPath);
assert.equal((await sharp(coverPath).metadata()).width, 768);
const size = 256, pixels = Buffer.alloc(size * size * 3);
let seed = 419;
for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
  seed = (Math.imul(seed,1664525)+1013904223)>>>0;
  const grain = 125 + (seed / 4294967296-.5)*45 + Math.sin(y*1.7+x*.4)*7;
  for(let c=0;c<3;c++) pixels[(y*size+x)*3+c]=grain;
}
await sharp(pixels,{raw:{width:size,height:size,channels:3}}).png().toFile(fileURLToPath(new URL('relic-grain.png',output)));
console.log('Created original codex cover and leather grain textures.');
