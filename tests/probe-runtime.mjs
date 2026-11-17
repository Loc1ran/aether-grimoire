export default async function({frame,page}) {
  return {buttons:await page.locator('button').allTextContents(), frames:page.frames().map(f=>f.url()), app:await frame.evaluate(() => ({
    globals: Object.keys(window).filter(key => /world|iwsdk|xr/i.test(key)),
    canvases: [...document.querySelectorAll('canvas')].map(c => ({width:c.width,height:c.height})),
    text: document.body.innerText.slice(0,800),
  }))};
}
