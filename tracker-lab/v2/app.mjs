import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {TrackerV2} from './logic.mjs';
const $=id=>document.getElementById(id);
const [design,board]=await Promise.all([fetch('public/design.json').then(r=>r.json()),fetch('public/board.json').then(r=>r.json())]);
const host=$('three-host'),b=design.board,c=design.case;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,1000);
let renderer,controls;
function home(){camera.position.set(82,103,-91);controls.target.set(0,13,0);controls.update();}
try{
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0x0d151a,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;host.appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=40;controls.maxDistance=350;controls.autoRotateSpeed=.55;home();
}catch(error){$('webgl-error').hidden=false;console.error(error);}
scene.add(new THREE.HemisphereLight(0xe8fff3,0x31405b,2.8));
for(const [x,y,z,color,intensity] of [[-40,140,-45,0xffffff,4.5],[60,80,80,0x7eafff,2.4],[80,30,-65,0xffdfa9,2]]){
  const light=new THREE.DirectionalLight(color,intensity);light.position.set(x,y,z);if(y===140){light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-100;light.shadow.camera.right=100;light.shadow.camera.top=100;light.shadow.camera.bottom=-100;light.shadow.normalBias=.1;}scene.add(light);
}
const root=new THREE.Group();scene.add(root);
const pos=(x,z,y)=>new THREE.Vector3(x-b.width/2,z,b.depth/2-y);
const mat=(color,metalness=0,roughness=.6)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const mask=mat('#18272b',.1,.52),gold=mat('#c4a566',.8,.28),nickel=mat('#a2b1b2',.83,.33),chip=mat('#16252a',.12,.6),ceramic=mat('#b1a089',.15,.7);
function box(w,h,d,x,z,y,material,parent=root){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.copy(pos(x,z,y));mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function disk(r,h,x,z,y,material,parent=root){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),material);mesh.position.copy(pos(x,z,y));mesh.castShadow=true;parent.add(mesh);return mesh;}
function textLabel(text,x,z,y,w=10,d=2,parent=root,color='#d8e9dc',bottom=false){
  const cv=document.createElement('canvas');cv.width=512;cv.height=128;const ctx=cv.getContext('2d');ctx.font='42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,64);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=bottom?Math.PI/2:-Math.PI/2;mesh.position.copy(pos(x,z,y));parent.add(mesh);return mesh;
}
const pcbGroup=new THREE.Group();root.add(pcbGroup);
const shape=new THREE.Shape(),w=b.width/2,d=b.depth/2,r=b.corner;
shape.moveTo(-w+r,-d);shape.lineTo(w-r,-d);shape.quadraticCurveTo(w,-d,w,-d+r);shape.lineTo(w,d-r);shape.quadraticCurveTo(w,d,w-r,d);shape.lineTo(-w+r,d);shape.quadraticCurveTo(-w,d,-w,d-r);shape.lineTo(-w,-d+r);shape.quadraticCurveTo(-w,-d,-w+r,-d);shape.closePath();
for(const [x,y] of b.holes){const hole=new THREE.Path();hole.absarc(x-w,y-d,b.holeDiameter/2,0,Math.PI*2,true);shape.holes.push(hole);}
const pcbMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:b.thickness,bevelEnabled:false,curveSegments:18}),mask);pcbMesh.rotation.x=-Math.PI/2;pcbMesh.position.y=c.pcbZ;pcbMesh.receiveShadow=true;pcbMesh.castShadow=true;pcbGroup.add(pcbMesh);
const top=c.pcbZ+b.thickness;
// Copper lands are derived from the KiCad placement's numbered-pin manifest.
for(const p of board.pads){box(p.w,.06,p.h,p.x,p.layer==='F.Cu'?top+.04:c.pcbZ-.04,p.y,gold,pcbGroup);}
for(const [x,y] of b.holes){for(const z of [top+.06,c.pcbZ-.06]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.6,.3,8,30),gold);ring.rotation.x=Math.PI/2;ring.position.copy(pos(x,z,y));pcbGroup.add(ring);}}
textLabel('ALANATECH',34,top+.1,3.2,17,2.7,pcbGroup);textLabel('AT-02 / V2',58,top+.1,41,10,1.8,pcbGroup);textLabel('C + CMSIS',33,top+.1,30,10,1.5,pcbGroup);
textLabel('SWD / 3V3  IO  CLK  RST  GND',34,c.pcbZ-.1,11,20,1.6,pcbGroup,'#a6bdab',true);
const componentGroup=new THREE.Group();root.add(componentGroup);
const selectable=[],partGroups=new Map();
for(const part of board.components){
  const g=new THREE.Group();componentGroup.add(g);partGroups.set(part.ref,g);
  const bottom=part.layer==='B.Cu',sign=bottom?-1:1,z0=bottom?c.pcbZ:top;
  let surface=chip;
  if(['shield','radio','usb','ufl'].includes(part.type))surface=nickel;
  else if(part.type==='capacitor')surface=ceramic;
  else if(part.type==='connector')surface=mat('#e5e6d9');
  else if(part.type==='inductor')surface=mat('#465252',.18,.55);
  else if(part.type==='led')surface=mat('#7bbc90',.1,.3);
  let body;
  if(part.type==='radio'){
    body=box(part.width,.6,part.depth,part.x,z0+.35,part.y,mat('#244739'),g);
    box(14,2.2,20,part.x,z0+1.75,part.y-1.7,nickel,g);textLabel('E32 / 433',part.x,z0+2.88,part.y-2,12,2,g,'#374a45');
    box(2.7,1.1,2.7,49.7,z0+.9,30,nickel,g);disk(.7,.15,49.7,z0+1.53,30,gold,g);
    textLabel('100 mW',57,top+.1,35,10,1.4,pcbGroup);
  }else if(part.type==='usb'){
    body=box(part.width,part.height,part.depth,part.x,z0+part.height/2,part.y,nickel,g);
    box(6.8,2.1,.12,part.x,z0+1.7,part.y+part.depth/2+.03,chip,g);
    box(5.3,.7,.25,part.x,z0+1.1,part.y+part.depth/2+.11,mat('#708780'),g);
  }else if(part.type==='test'){
    body=box(part.width,.05,part.depth,part.x,z0-.06,part.y,mat('#1c2f32'),g);
  }else{
    body=box(part.width,part.height,part.depth,part.x,z0+sign*(part.height/2+.08),part.y,surface,g);
    if(['lqfp','qfn','shield','inductor'].includes(part.type)){
      const name=part.ref==='U1'?'STM32':part.ref==='U2'?'MAX-M10S':part.ref==='L1'?'2R2':part.ref;
      textLabel(name,part.x,z0+sign*(part.height+.13),part.y,part.width*.84,Math.min(1.7,part.depth*.32),g,bottom?'#40544d':'#bbcec2',bottom);
      if(part.type==='lqfp'){disk(.27,.1,part.x-part.width/2+.7,z0+part.height+.16,part.y-part.depth/2+.7,mat('#8bada0'),g);}
    }
    if(['resistor','capacitor'].includes(part.type))for(const x of [part.x-part.width*.38,part.x+part.width*.38])box(.35,part.height+.04,part.depth+.04,x,z0+sign*(part.height/2+.09),part.y,nickel,g);
    if(part.type==='button'){box(1.5,.55,1.5,part.x,z0+part.height+.25,part.y,mat('#91a59c'),g);}
  }
  body.material=body.material.clone();body.userData.part=part;selectable.push(body);
  if(part.type!=='resistor'&&part.type!=='capacitor')textLabel(part.ref,part.x,z0+sign*.09,part.y+part.depth/2+.9,Math.min(4,part.width+2),1.2,pcbGroup,'#7d9c8e',bottom);
}
// Antenna geometry is a reserved assembly envelope; its exact MPN is pending.
const patchPart=design.components.find(p=>p.ref==='ANT1'),patchGroup=new THREE.Group();root.add(patchGroup);
const patchBody=box(18,3.7,18,14,top+2.2,13,mat('#d8c39d',.12,.55),patchGroup);patchBody.userData.part=patchPart;selectable.push(patchBody);
box(15.8,.15,15.8,14,top+4.15,13,mat('#e3d5b4',.25,.4),patchGroup);disk(.75,.15,14,top+4.32,13,mat('#b5a36b',.7,.25),patchGroup);textLabel('GNSS',14,top+4.38,17.5,9,1.6,patchGroup,'#9a875e');
const guidesGroup=new THREE.Group();root.add(guidesGroup);guidesGroup.visible=false;
for(const guide of board.guides){
  const [a,bp]=guide.points;const points=[pos(a[0],top+.4,a[1]),pos((a[0]+bp[0])/2,top+3,(a[1]+bp[1])/2),pos(bp[0],top+.4,bp[1])];
  const curve=new THREE.CatmullRomCurve3(points);const geom=new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));const color=guide.net.startsWith('GNSS')?0x62cbae:guide.net.startsWith('RADIO')?0xcbb47c:0x7fa8dc;
  guidesGroup.add(new THREE.Line(geom,new THREE.LineBasicMaterial({color,transparent:true,opacity:.52})));
}
const zonesGroup=new THREE.Group();root.add(zonesGroup);
for(const zone of design.zones){
  const y=top+.18;const points=[[zone.x,zone.y],[zone.x+zone.width,zone.y],[zone.x+zone.width,zone.y+zone.depth],[zone.x,zone.y+zone.depth],[zone.x,zone.y]].map(([x,d])=>pos(x,y,d));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:zone.color,dashSize:1,gapSize:.7,transparent:true,opacity:.28}));line.computeLineDistances();zonesGroup.add(line);
}
const batteryGroup=new THREE.Group();root.add(batteryGroup);batteryGroup.visible=false;
box(50,6,30,34,c.floor+3,22,mat('#b7c1c2',.75,.4),batteryGroup);box(48,.15,28,34,c.floor+6.1,22,mat('#74888a',.3,.6),batteryGroup);textLabel('LiPo 1S / 3.7 V',34,c.floor+6.25,22,30,5,batteryGroup,'#e1e9da');
const caseGroup=new THREE.Group();root.add(caseGroup);caseGroup.visible=false;let caseBase,caseLid;
const caseMat=mat('#a4b5ad',.1,.45);caseMat.transparent=true;caseMat.opacity=.3;caseMat.depthWrite=false;
const lidMat=mat('#afbdb4',.1,.45);lidMat.transparent=true;lidMat.opacity=.65;
let cadReady=false;
async function loadCAD(){
  const loader=new STLLoader();const [base,lid]=await Promise.all([loader.loadAsync('public/downloads/enclosure-base.stl'),loader.loadAsync('public/downloads/enclosure-lid.stl')]);
  for(const [geom,isLid] of [[base,false],[lid,true]]){geom.computeVertexNormals();const mesh=new THREE.Mesh(geom,isLid?lidMat:caseMat);mesh.rotation.x=-Math.PI/2;mesh.position.set(-b.width/2,isLid?c.height:0,b.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;caseGroup.add(mesh);if(isLid)caseLid=mesh;else caseBase=mesh;}
  cadReady=true;explode(false);
}
loadCAD().catch(e=>{console.error(e);$('model-state').textContent='КОРПУС НЕ ЗАГРУЖЕН';});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.ShadowMaterial({opacity:.25}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.position.y=-.3;scene.add(floor);
const grid=new THREE.GridHelper(160,32,0x3d5850,0x31473f);grid.material.transparent=true;grid.material.opacity=.22;grid.position.y=-.2;scene.add(grid);
let view='assembly',lastExplode=0;
function explode(fit=true){
  const t=Number($('explode').value)/100;$('explode-value').value=Math.round(t*100)+'%';pcbGroup.position.y=t*10;componentGroup.position.y=t*10;guidesGroup.position.y=t*10;zonesGroup.position.y=t*10;patchGroup.position.y=t*30;
  for(const [ref,g] of partGroups){const part=board.components.find(c=>c.ref===ref);g.position.y=part.layer==='B.Cu'?-t*8:t*(part.type==='radio'?14:3);}
  if(caseLid)caseLid.position.y=c.height+t*40;
  if(fit&&controls){const offset=camera.position.clone().sub(controls.target).multiplyScalar((1+.45*t)/(1+.45*lastExplode));controls.target.y=13+t*12;camera.position.copy(controls.target).add(offset);controls.update();}lastExplode=t;
}
$('explode').addEventListener('input',()=>explode());
$('zones').addEventListener('change',()=>zonesGroup.visible=$('zones').checked);
$('guides').addEventListener('change',()=>guidesGroup.visible=$('guides').checked);
$('patch').addEventListener('change',()=>patchGroup.visible=$('patch').checked&&view==='assembly');
$('battery').addEventListener('change',()=>batteryGroup.visible=$('battery').checked&&view==='assembly');
$('case').addEventListener('change',()=>{caseGroup.visible=$('case').checked&&view==='assembly';$('size-label').textContent=$('case').checked?'Корпус 78.8 × 54.8 × 25.4 мм':'Плата 68 × 44 × 1.2 мм';});
function setView(next){view=next;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));$('architecture-image').hidden=next!=='architecture';host.hidden=next==='architecture';componentGroup.visible=next==='assembly';patchGroup.visible=next==='assembly'&&$('patch').checked;caseGroup.visible=next==='assembly'&&$('case').checked;batteryGroup.visible=next==='assembly'&&$('battery').checked;$('view-name').textContent=next==='board'?'PCB / площадки и назначение цепей':next==='architecture'?'STM32 / GNSS / LoRa / питание':'Собственная плата AT-02';if(controls){home();if(next==='board'){camera.position.set(0,126,.1);controls.target.set(0,top,0);controls.update();}}}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
$('home').addEventListener('click',()=>controls&&home());
$('top').addEventListener('click',()=>{if(!controls)return;camera.position.set(0,126,.1);controls.target.set(0,13,0);controls.update();});
$('bottom').addEventListener('click',()=>{if(!controls)return;$('patch').checked=false;patchGroup.visible=false;camera.position.set(50,-95,-70);controls.target.set(0,c.pcbZ,0);controls.update();});
$('rotate').addEventListener('click',()=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;$('rotate').setAttribute('aria-pressed',String(controls.autoRotate));});
function select(part){
  const full=design.components.find(p=>p.ref===part.ref)||part;
  $('component-ref').textContent=full.ref+' / '+(full.layer==='B.Cu'?'НИЖНЯЯ СТОРОНА':'ВЕРХНЯЯ СТОРОНА');$('component-name').textContent=full.name;$('component-description').textContent=full.description;$('component-package').textContent=full.width+' × '+full.depth+' мм';
  for(const obj of selectable){obj.material.emissive?.setHex(obj.userData.part.ref===part.ref?0x155d44:0x000000);if(obj.material.emissive)obj.material.emissiveIntensity=.25;}
}
document.querySelectorAll('[data-focus]').forEach(button=>button.addEventListener('click',()=>{const part=board.components.find(c=>c.ref===button.dataset.focus);select(part);if(controls){if(view!=='assembly')setView('assembly');if(part.layer==='B.Cu')camera.position.set(50,-95,-70);else camera.position.set(75,100,-82);controls.target.set(part.x-b.width/2,part.layer==='B.Cu'?c.pcbZ:top,b.depth/2-part.y);controls.update();}}));
let down;const ray=new THREE.Raycaster();host.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);host.addEventListener('pointerup',e=>{if(!controls||view!=='assembly'||!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=host.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=ray.intersectObjects(selectable).filter(hit=>hit.object.visible&&hit.object.parent.visible);if(hits.length)select(hits[0].object.userData.part);});
if(renderer){const resize=()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});}
for(const source of design.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.title+' ↗';$('sources').appendChild(a);}
const sim=new TrackerV2();let timer=null;
function step(){
  const r=sim.tick($('scenario').value);$('state').textContent=r.state;$('sent').textContent=r.sent;$('gnss-power').textContent=r.gnss?'ВКЛ.':'ВЫКЛ.';$('radio-power').textContent=r.radio?(r.transmitted?'TX → SLEEP':'AUX LOW'):'SLEEP';$('model-state').textContent=r.state==='SLEEP'?'СТОЯНКА / СОН':r.state==='LOW_BAT'?'НИЗКИЙ ЗАРЯД':r.state==='ACQUIRE'?'ОЖИДАНИЕ GNSS':'GNSS → STM32 → LORA';$('packet').textContent=r.transmitted?r.wire.trim():r.state==='LOW_BAT'?'VBAT < 3.3 V / LOW_BAT':r.state==='SLEEP'?'GNSS OFF / E32 SLEEP / MCU STOP':r.state==='ACQUIRE'?'GNSS ON / FIX PENDING':'TX SKIPPED / RADIO BUSY';$('sim-result').textContent=r.note;
  if(r.transmitted){const led=partGroups.get('D1')?.children[0];if(led?.material.emissive){led.material.emissive.setHex(0x54c887);led.material.emissiveIntensity=1;setTimeout(()=>led.material.emissiveIntensity=0,220);}}
}
function stop(){if(timer)clearInterval(timer);timer=null;$('run').textContent='▶ Запустить';$('sim-label').textContent='Пауза';}
$('run').addEventListener('click',()=>{if(timer){stop();return;}step();timer=setInterval(step,900);$('run').textContent='Ⅱ Пауза';$('sim-label').textContent='Работает';});
$('step').addEventListener('click',step);
$('reset-sim').addEventListener('click',()=>{stop();sim.reset();$('state').textContent='BOOT';$('sent').textContent='0';$('gnss-power').textContent='—';$('radio-power').textContent='—';$('packet').textContent='Ожидание первого события…';$('sim-result').textContent='1 шаг симуляции = 5 секунд.';$('sim-label').textContent='Ожидание';$('model-state').textContent='МОДЕЛЬ ГОТОВА';});
window.trackerV2={design,board,sim,renderer,scene,select,cadReady:()=>cadReady};
