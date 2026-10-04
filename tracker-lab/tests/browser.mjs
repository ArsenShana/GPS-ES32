import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+': '+r.status());});
try {
  await page.goto('http://localhost:4173/',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.trackerLab?.renderer&&window.trackerLab.scene.children.some(c=>c.children.some(g=>g.children.some(m=>m.geometry?.attributes?.position?.count>1000))));
  assert.equal(await page.locator('canvas').count(),1);
  await page.locator('#step-simulation').click();assert.equal(await page.locator('#received').innerText(),'1');assert.equal(await page.locator('#latitude').innerText(),'51.128207');
  await page.selectOption('#scenario','no-gps');await page.locator('#step-simulation').click();assert.equal(await page.locator('#latitude').innerText(),'Нет фикса');assert.equal(await page.evaluate(()=>window.trackerLab.simulation.points.length),1);
  await page.selectOption('#scenario','corrupt');await page.locator('#step-simulation').click();assert.equal(await page.locator('#rejected').innerText(),'1');assert.equal(await page.locator('#packet-status').innerText(),'XOR ERROR');
  await page.locator('#reset-simulation').click();await page.selectOption('#scenario','loss');for(let i=0;i<8;i++)await page.locator('#step-simulation').click();assert.equal(await page.locator('#lost').innerText(),'2');assert.equal(await page.locator('#received').innerText(),'6');
  await page.locator('[data-view=pcb]').click();await page.waitForTimeout(250);await page.screenshot({path:'test-results/pcb.png',fullPage:true});
  await page.locator('[data-view=schematic]').click();assert.equal(await page.locator('#schematic').isVisible(),true);
  await page.locator('[data-view=model]').click();await page.locator('#show-case').check();await page.locator('#transparent-case').uncheck();await page.locator('#explode').fill('65');await page.waitForTimeout(350);await page.screenshot({path:'test-results/exploded.png',fullPage:true});
  await page.locator('#show-case').uncheck();await page.locator('#explode').fill('0');await page.locator('#reset-simulation').click();await page.selectOption('#scenario','normal');await page.locator('#run-simulation').click();await page.waitForTimeout(2100);await page.locator('#run-simulation').click();assert.ok(Number(await page.locator('#received').innerText())>=3);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto('http://localhost:4173/',{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.trackerLab?.renderer);assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.screenshot({path:'test-results/mobile.png',fullPage:true});
  for(const url of ['/public/downloads/carrier.kicad_pcb','/public/downloads/enclosure-base.stl','/public/downloads/enclosure-lid.stl','/public/downloads/enclosure.step','/public/downloads/BOM.csv','/README.html']){const r=await page.request.get('http://localhost:4173'+url);assert.equal(r.status(),200,url);assert.ok((await r.body()).length>100);}
  assert.deepEqual(errors,[]);
  await writeFile('test-results/browser.json',JSON.stringify({passed:true,errors,checks:['WebGL rendering','CAD assets','four simulation scenarios','map and counters','tabs','exploded enclosure','desktop/mobile layout','all downloads']},null,2));
  console.log('Browser checks passed; screenshots in test-results/');
} finally {await browser.close();}
