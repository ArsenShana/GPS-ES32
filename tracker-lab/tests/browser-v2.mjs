import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(r.url()+': '+r.status());});
try{
 await page.goto('http://localhost:4173/v2/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.trackerV2?.renderer&&window.trackerV2.cadReady());
 assert.equal(await page.locator('canvas').count(),1);await page.screenshot({path:'test-results/v2-desktop.png',fullPage:true});
 await page.locator('[data-focus=U2]').click();assert.match(await page.locator('#component-name').innerText(),/MAX-M10S/);await page.waitForTimeout(300);await page.screenshot({path:'test-results/v2-bottom.png',fullPage:true});await page.locator('#home').click();
 for(const scenario of ['moving','no-gps','busy','low-battery']){await page.locator('#reset-sim').click();await page.selectOption('#scenario',scenario);await page.locator('#step').click();assert.equal(await page.locator('#sent').innerText(),scenario==='moving'?'1':'0');}
 await page.locator('#reset-sim').click();await page.selectOption('#scenario','parked');for(let i=0;i<12;i++)await page.locator('#step').click();assert.equal(await page.locator('#state').innerText(),'SLEEP');await page.selectOption('#scenario','moving');await page.locator('#step').click();assert.equal(await page.locator('#state').innerText(),'ACQUIRE');await page.locator('#step').click();assert.equal(await page.locator('#state').innerText(),'TRACK');
 await page.locator('[data-view=architecture]').click();assert.equal(await page.locator('#architecture-image').isVisible(),true);await page.locator('[data-view=board]').click();await page.locator('#guides').check();await page.locator('[data-view=assembly]').click();await page.locator('#guides').uncheck();await page.locator('#case').check();await page.locator('#battery').check();await page.locator('#explode').fill('75');await page.waitForTimeout(400);await page.screenshot({path:'test-results/v2-exploded.png',fullPage:true});
 for(const file of ['AT-02-V2.kicad_pcb','AT-02-V2.kicad_sch','BOM-V2.csv','enclosure-base.stl','enclosure-lid.stl','enclosure.step']){const r=await page.request.get('http://localhost:4173/v2/public/downloads/'+file);assert.equal(r.status(),200);assert.ok((await r.body()).length>100);}
 const doc=await page.request.get('http://localhost:4173/v2/engineering.html');assert.equal(doc.status(),200);
 const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(String(e)));await mobile.goto('http://localhost:4173/v2/',{waitUntil:'networkidle'});await mobile.waitForFunction(()=>window.trackerV2?.cadReady());assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mobile.screenshot({path:'test-results/v2-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);await writeFile('test-results/browser-v2.json',JSON.stringify({passed:true,errors,checks:['WebGL and case STL','component selection','sleep/wake and TX gating','views and exploded assembly','downloads','responsive layout']},null,2));console.log('V2 browser checks passed');
}finally{await browser.close();}
