import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {Simulation} from './protocol.mjs';
const $=id=>document.getElementById(id);
const design=await fetch('public/design.json').then(r=>r.json());
const pcb=await fetch('public/pcb.json').then(r=>r.json());
const host=$('three-host');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,1,.1,2000);
const home=()=>{camera.position.set(112,140,135);controls.target.set(0,8,0);controls.update();};
let renderer,controls;
try{
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor(0xffffff,0);host.appendChild(renderer.domElement);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=65;controls.maxDistance=400;controls.maxPolarAngle=Math.PI*.88;controls.autoRotateSpeed=.65;home();
}catch(error){$('render-error').hidden=false;$('model-status').textContent='WEBGL НЕДОСТУПЕН';console.error(error);}
scene.add(new THREE.HemisphereLight(0xffffff,0xa4b69a,2.6));
const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(70,180,90);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-120;key.shadow.camera.right=120;key.shadow.camera.top=120;key.shadow.camera.bottom=-120;key.shadow.normalBias=.15;scene.add(key);
const fill=new THREE.DirectionalLight(0xd1e6ed,1.8);fill.position.set(-80,50,-50);scene.add(fill);
const worldPos=(x,h,y)=>new THREE.Vector3(x-design.board.width/2,h,design.board.depth/2-y);
const material=(color,metalness=0,roughness=.7)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
const green=material('#245d48'),gold=material('#c3a356',.7,.35),black=material('#25292b'),silver=material('#b8bec1',.8,.4);
const root=new THREE.Group();scene.add(root);
function box(w,h,d,x,z,y,mat,parent=root){const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);obj.position.copy(worldPos(x,z,y));obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
function cylinder(r,h,x,z,y,mat,parent=root){const obj=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,28),mat);obj.position.copy(worldPos(x,z,y));obj.castShadow=true;parent.add(obj);return obj;}
const pcbGroup=new THREE.Group();root.add(pcbGroup);
const b=design.board,c=design.case;
const shape=new THREE.Shape();shape.moveTo(-b.width/2,-b.depth/2);shape.lineTo(b.width/2,-b.depth/2);shape.lineTo(b.width/2,b.depth/2);shape.lineTo(-b.width/2,b.depth/2);shape.closePath();
for(const [x,y] of b.holes){const hole=new THREE.Path();hole.absarc(x-b.width/2,y-b.depth/2,1.6,0,Math.PI*2,true);shape.holes.push(hole);}
const boardMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:b.thickness,bevelEnabled:false}),green);boardMesh.rotation.x=-Math.PI/2;boardMesh.position.y=c.pcbZ;boardMesh.receiveShadow=true;boardMesh.castShadow=true;pcbGroup.add(boardMesh);
const boardTop=c.pcbZ+b.thickness;
for(const pad of pcb.pads){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(pad.size/2-.14,.16,8,24),gold);ring.rotation.x=Math.PI/2;ring.position.copy(worldPos(pad.x,boardTop+.03,pad.y));pcbGroup.add(ring);
  if(pad.drill){cylinder(pad.drill/2,.12,pad.x,boardTop+.01,pad.y,black,pcbGroup);}
}
for(const trace of pcb.traces){
  const points=trace.points.map(([x,y])=>worldPos(x,boardTop+.05,y));
  for(let i=1;i<points.length;i++){
    const a=points[i-1],v=points[i].clone().sub(a),mid=a.clone().addScaledVector(v,.5);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(trace.width/2,trace.width/2,v.length(),6),trace.layer==='F.Cu'?gold:material('#49826b'));
    mesh.position.copy(mid);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());pcbGroup.add(mesh);
  }
}
function label(text,x,h,y,w=23,d=6,parent=root,color='#e9ede2'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.font='bold 42px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:texture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(worldPos(x,h,y));parent.add(mesh);return mesh;
}
label('ALANATECH R0',53,boardTop+.08,4,28,5,pcbGroup);
const modules=new THREE.Group();root.add(modules);
const moduleGroups=[],selectable=[],leds=[];
for(const [index,m] of design.modules.entries()){
  const g=new THREE.Group();modules.add(g);moduleGroups.push(g);
  const height=boardTop+4.5;
  const body=box(m.width,1.2,m.depth,m.x+m.width/2,height,m.y+m.depth/2,material(m.color),g);body.userData.module=m;selectable.push(body);
  if(m.id==='esp32'){
    box(16,2.5,24,m.x+m.width/2,height+1.8,m.y+18,silver,g);label('ESP32',m.x+m.width/2,height+3.1,m.y+18,15,4,g,'#394c41');
    box(16,1.8,7,m.x+m.width/2,height+1.7,m.y-3,black,g);
    for(let i=0;i<5;i++)box(11-i, .12,.5,m.x+m.width/2,height+2.65,m.y-5.5+i,gold,g);
    box(8,3,5,m.x+m.width/2,height+1.4,m.y+m.depth+1.8,silver,g);box(5.5,1.7,.2,m.x+m.width/2,height+1.6,m.y+m.depth+4.35,black,g);
    for(const x of [8,33.4]){box(2.5,4.5,48.26,x,boardTop+2.25,25+22.86,black,g);for(let i=0;i<19;i++)box(.65,5,.65,x,boardTop+2.5,25+i*2.54,gold,g);}
    for(const x of [m.x+4,m.x+21]){box(4,1.2,4,x,height+1.1,m.y+45,silver,g);box(2,1.5,2,x,height+2.4,m.y+45,black,g);}
    box(6,1.5,6,m.x+12.7,height+1.2,m.y+37,black,g);
  }else if(m.id==='gps'){
    box(16,3,12,m.x+12.5,height+2,m.y+12,silver,g);label('NEO-6M',m.x+12.5,height+3.6,m.y+12,15,4,g,'#425048');box(6,1.5,6,m.x+10,height+1.3,m.y+25,black,g);
    for(let i=0;i<4;i++)box(.7,4,.7,42.5+i*2.54,boardTop+2,m.y+33,gold,g);
  }else if(m.id==='radio'){
    box(18,3,28,m.x+12,height+2,m.y+21,silver,g);label('E32 · 433',m.x+12,height+3.6,m.y+21,17,4,g,'#394c41');
    for(let i=0;i<7;i++)box(.7,4,.7,74.38+i*2.54,boardTop+2,m.y+41.5,gold,g);
    const sma=new THREE.Mesh(new THREE.CylinderGeometry(3,3,11,20),gold);sma.rotation.x=Math.PI/2;sma.position.copy(worldPos(87.8,height+2,4.5));g.add(sma);
    const antenna=new THREE.Mesh(new THREE.CylinderGeometry(1.2,2,38,16),black);antenna.rotation.x=Math.PI/2;antenna.position.copy(worldPos(87.8,height+2,-19));g.add(antenna);
  }else{
    box(24,4.5,24,m.x+12.5,height+2.5,m.y+12.5,material('#d9c29e'),g);label('GNSS',m.x+12.5,height+4.8,m.y+12.5,14,4,g,'#a28c69');
    const curve=new THREE.CatmullRomCurve3([worldPos(48,height+1,41),worldPos(39,height+1,46),worldPos(44,height+1,58)]);g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.35,6,false),black));
  }
  if(m.id!=='antenna'){const led=box(1.3,.6,1.3,m.x+3,height+1,m.y+m.depth-5,material('#88ab7c'),g);leds.push(led);}
}
box(4,3,4,89,boardTop+1.5,65,silver,modules);cylinder(4,10,80,boardTop+5,66,silver,modules);cylinder(4.1,.4,80,boardTop+10,66,black,modules);
box(11,7,7,72.54,boardTop+3.5,71,material('#38725d'),modules);
for(const x of [70,75.08]){cylinder(1.8,.4,x,boardTop+7.2,71,silver,modules);box(1.3,.2,.3,x,boardTop+7.45,71,black,modules);}
box(5,2.5,3,59.27,boardTop+1.3,65,black,modules);
for(const x of [58,60.54])box(.7,5,.7,x,boardTop+2.5,65,gold,modules);
box(2,1,1.2,43,boardTop+.6,65,black,modules);
const statusLed=box(2,1,1.2,49,boardTop+.6,65,material('#82b46f'),modules);leds.push(statusLed);
const caseGroup=new THREE.Group();root.add(caseGroup);caseGroup.visible=false;
const caseMaterial=material('#dfe4d6',0,.4);caseMaterial.transparent=true;caseMaterial.opacity=.22;caseMaterial.depthWrite=false;
let caseBase,caseLid;
async function loadCase(){
  const loader=new STLLoader();
  for(const [file,isLid] of [['enclosure-base.stl',false],['enclosure-lid.stl',true]]){
    const geometry=await loader.loadAsync('public/downloads/'+file);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,caseMaterial);mesh.rotation.x=-Math.PI/2;mesh.position.set(-b.width/2,isLid?c.height:0,b.depth/2);mesh.castShadow=true;mesh.receiveShadow=true;caseGroup.add(mesh);
    if(isLid)caseLid=mesh;else caseBase=mesh;
  }
  updateExplode();
}
loadCase().catch(e=>{$('model-status').textContent='КОРПУС НЕ ЗАГРУЖЕН';console.error(e);});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(600,600),new THREE.ShadowMaterial({opacity:.1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.3;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(240,24,0xcbd5c2,0xdce4d4);grid.position.y=-.2;grid.material.transparent=true;grid.material.opacity=.3;scene.add(grid);
let view='model',lastExplode=0;
function updateExplode(){const t=Number($('explode').value)/100;$('explode-value').value=Math.round(t*100)+'%';pcbGroup.position.y=t*9;modules.position.y=t*9;moduleGroups.forEach((g,i)=>g.position.y=t*(12+i*6));if(caseLid)caseLid.position.y=c.height+t*65;
  if(controls&&view==='model'){const offset=camera.position.clone().sub(controls.target).multiplyScalar((1+.45*t)/(1+.45*lastExplode));controls.target.y=8+t*22;camera.position.copy(controls.target).add(offset);controls.update();}lastExplode=t;
}
$('explode').addEventListener('input',updateExplode);
$('show-case').addEventListener('change',()=>{caseGroup.visible=$('show-case').checked&&view==='model';$('dimensions').textContent=$('show-case').checked?'Корпус 114 × 92 × 29.4 мм':'Плата 100 × 78 мм';});
$('transparent-case').addEventListener('change',()=>{caseMaterial.opacity=$('transparent-case').checked?.22:1;caseMaterial.depthWrite=!$('transparent-case').checked;caseMaterial.needsUpdate=true;});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  view=button.dataset.view;document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b===button));
  $('schematic').hidden=view!=='schematic';host.hidden=view==='schematic';modules.visible=view==='model';caseGroup.visible=view==='model'&&$('show-case').checked;
  $('view-caption').textContent=view==='pcb'?'Дорожки и разъёмы / R0':view==='schematic'?'Схема соединений':'Плата-носитель GPS';
  if(view==='pcb'&&controls){camera.position.set(0,185,.1);controls.target.set(0,boardTop,0);controls.update();}else if(controls)home();
}));
$('reset-camera').addEventListener('click',()=>controls&&home());
$('top-camera').addEventListener('click',()=>{if(!controls)return;camera.position.set(0,185,.1);controls.target.set(0,8,0);controls.update();});
$('auto-rotate').addEventListener('click',()=>{if(!controls)return;controls.autoRotate=!controls.autoRotate;$('auto-rotate').setAttribute('aria-pressed',String(controls.autoRotate));});
let pointerStart;const raycaster=new THREE.Raycaster();
host.addEventListener('pointerdown',e=>pointerStart=[e.clientX,e.clientY]);
host.addEventListener('pointerup',e=>{
  if(!renderer||!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5||view!=='model')return;
  const rect=host.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const hit=raycaster.intersectObjects(selectable)[0];if(!hit)return;const m=hit.object.userData.module;
  $('component-name').textContent=m.name;$('component-description').textContent=m.description;$('component-number').textContent=String(design.modules.indexOf(m)+1).padStart(2,'0');
});
if(renderer){
  const resize=()=>{const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(host);resize();
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
}
for(const source of design.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.textContent=source.title+' ↗';$('source-links').appendChild(a);}
const simulation=new Simulation();let timer=null;
function updateStats(){for(const key of ['sent','received','lost','rejected'])$(key).textContent=simulation[key];}
function step(){
  const mode=$('scenario').value;const {wire,decoded,dropped,packet}=simulation.step(mode);updateStats();
  $('packet').textContent=wire.trim();$('packet-length').textContent=wire.length;
  $('packet-status').textContent=dropped?'LOST':decoded?'XOR OK':'XOR ERROR';
  $('packet-result').textContent=dropped?'Пакет потерян в радиоканале.':!decoded?'Контрольная сумма не совпала: приёмник отклонил пакет.':!decoded.fix?'Пакет принят. GPS-фикса нет: маршрут не обновлён.':'Пакет принят. Координаты добавлены в маршрут.';
  if(decoded){$('latitude').textContent=decoded.fix?decoded.lat.toFixed(6):'Нет фикса';$('longitude').textContent=decoded.fix?decoded.lon.toFixed(6):'—';$('satellites').textContent=decoded.sats;$('speed').textContent=decoded.fix?decoded.speedKmh.toFixed(1):'—';}
  const coords=simulation.points.map(([lat,lon])=>[160+(lon-71.430411)/.0072*112,70-(lat-51.128207)/.0045*48]);
  $('route-line').setAttribute('points',coords.map(p=>p.join(',')).join(' '));
  if(coords.length){const [x,y]=coords.at(-1);$('route-dot').setAttribute('cx',x);$('route-dot').setAttribute('cy',y);$('route-dot').setAttribute('visibility',decoded?.fix?'visible':'hidden');}
  $('model-status').textContent=dropped?'РАДИО: ПОТЕРЯ ПАКЕТА':!decoded?'ПАКЕТ ОТКЛОНЁН':packet.fix?'GPS → ПАКЕТ ПРИНЯТ':'GPS: НЕТ ФИКСА';
  for(const id of ['gps-node','radio-node','rx-node'])$(id).classList.add('pulse');setTimeout(()=>{for(const id of ['gps-node','radio-node','rx-node'])$(id).classList.remove('pulse');},220);
  leds.forEach(l=>{l.material.emissive.setHex(decoded?0x21914a:0xb67f28);l.material.emissiveIntensity=1;});setTimeout(()=>leds.forEach(l=>l.material.emissiveIntensity=0),230);
}
function stop(){if(timer)clearInterval(timer);timer=null;$('run-simulation').textContent='▶ Запустить';$('sim-badge').textContent='Пауза';$('sim-badge').classList.remove('running');}
$('run-simulation').addEventListener('click',()=>{if(timer){stop();return;}step();timer=setInterval(step,1000);$('run-simulation').textContent='Ⅱ Пауза';$('sim-badge').textContent='Работает';$('sim-badge').classList.add('running');});
$('step-simulation').addEventListener('click',step);
$('reset-simulation').addEventListener('click',()=>{stop();simulation.reset();updateStats();for(const id of ['latitude','longitude','satellites','speed'])$(id).textContent='—';$('route-line').setAttribute('points','');$('route-dot').setAttribute('visibility','hidden');$('packet').textContent='Ожидание передачи…';$('packet-length').textContent='0';$('packet-status').textContent='IDLE';$('packet-result').textContent='Нажмите «Запустить» или передайте один пакет.';$('sim-badge').textContent='Ожидание';$('model-status').textContent='МОДЕЛЬ ГОТОВА';});
window.trackerLab={simulation,design,pcb,renderer,scene,step};
