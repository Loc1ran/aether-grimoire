export default async function({page}) {
  await page.getByRole('button',{name:'Editor',exact:true}).click();
  return 'Editor selected';
}
