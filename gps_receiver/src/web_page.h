// Веб-страница приёмника. Карта Leaflet грузится из интернета (unpkg),
// таблица с данными работает и без интернета.
#pragma once
#include <pgmspace.h>

static const char WEB_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AlanaTech GPS</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
body{margin:0;font:14px system-ui,sans-serif;background:#f4f5f7;color:#222}
header{padding:10px 16px;background:#1f2937;color:#fff;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:17px;margin:0;flex:1}
.badge{padding:3px 10px;border-radius:12px;font-size:12px;background:#6b7280}
.on{background:#16a34a}.off{background:#dc2626}.warn{background:#d97706}
main{display:grid;grid-template-columns:1fr 320px;gap:12px;padding:12px}
#map{height:calc(100vh - 90px);min-height:320px;border-radius:8px;background:#ddd}
.card{background:#fff;border-radius:8px;padding:12px;box-shadow:0 1px 2px #0002}
table{width:100%;border-collapse:collapse}td{padding:5px 2px;border-bottom:1px solid #eee}
td:first-child{color:#666}td:last-child{text-align:right;font-variant-numeric:tabular-nums}
button{margin-top:10px;padding:6px 12px;border:0;border-radius:6px;background:#374151;color:#fff;cursor:pointer}
@media(max-width:720px){main{grid-template-columns:1fr}#map{height:55vh}}
</style></head><body>
<header><h1>AlanaTech GPS</h1><span id="st" class="badge">загрузка…</span><span id="fx" class="badge">—</span></header>
<main><div id="map"></div>
<div>
<div class="card"><b>Трекер</b><table id="t1"></table></div><br>
<div class="card"><b>Приёмник</b><table id="t2"></table><button onclick="rst()">Сбросить статистику</button></div>
</div></main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
let map,mk,tr,first=true;
if(window.L){map=L.map('map').setView([51.128,71.43],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
tr=L.polyline([],{color:'#2563eb'}).addTo(map);}
else document.getElementById('map').innerHTML='<p style="padding:20px">Карта недоступна (нет интернета). Данные — справа.</p>';
const rows=(id,r)=>document.getElementById(id).innerHTML=r.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('');
const j=u=>fetch(u).then(r=>r.json());
function badge(id,txt,cls){const e=document.getElementById(id);e.textContent=txt;e.className='badge '+cls}
async function tick(){
 try{
  const [d,s]=await Promise.all([j('/api/last'),j('/api/status')]);
  if(!d.has_data){badge('st','нет пакетов','off');badge('fx','—','');rows('t1',[['Статус','ожидание пакетов…']]);}
  else{
   badge('st',d.online?'в сети':'нет связи '+d.age_s+' с',d.online?'on':'off');
   badge('fx',d.fix?'GPS фикс':'нет фикса',d.fix?'on':'warn');
   rows('t1',[['ID',d.id],['Пакет №',d.seq],['Широта',d.lat.toFixed(6)],['Долгота',d.lon.toFixed(6)],
    ['Высота',d.alt+' м'],['Скорость',d.speed+' км/ч'],['Спутники',d.sats],['HDOP',d.hdop],['Получено',d.age_s+' с назад']]);
   if(map&&d.fix){const p=[d.lat,d.lon];
    if(!mk)mk=L.marker(p).addTo(map);else mk.setLatLng(p);
    if(first){map.setView(p,16);first=false}
    tr.setLatLngs(await j('/api/history'));}
  }
  const tot=s.rx_ok+s.rx_lost;
  rows('t2',[['Принято',s.rx_ok],['Потеряно',s.rx_lost+(tot?` (${(100*s.rx_lost/tot).toFixed(1)}%)`:'')],['Битых',s.rx_bad],
   ['E32',s.lora_ok?'OK':'ОШИБКА'],['Wi-Fi',s.wifi_rssi+' дБм'],['IP',s.ip],['Аптайм',s.uptime_s+' с'],['Память',s.free_heap+' Б']]);
 }catch(e){badge('st','приёмник недоступен','off')}
}
function rst(){fetch('/api/reset',{method:'POST'}).then(tick)}
tick();setInterval(tick,2000);
</script></body></html>)HTML";
