import { cli } from './iwsdk.mjs';
import { writeFileSync } from 'node:fs';
export default async function({page}) {
  await page.getByRole('button',{name:'Editor',exact:true}).click();
  await page.waitForTimeout(600);
  const opened=cli('scene','open',{path:'public/scenes/arena.iwsdk.scene.json'});
  writeFileSync('artifacts/scene-open.json',JSON.stringify(opened,null,2));
  const results=[];
  for(const assetId of ['sword','grimoire'])for(const mode of ['material','clay']){
    const result=cli('asset','render-preview',{assetId,mode,width:640,height:480},['--output-file',`artifacts/${assetId}-${mode}.png`]);
    writeFileSync(`artifacts/${assetId}-${mode}.json`,JSON.stringify(result,null,2));
    results.push({assetId,mode,path:result.screenshotPath,keys:Object.keys(result.result??result)});
  }
  return results;
}
