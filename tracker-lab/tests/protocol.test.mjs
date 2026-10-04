import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encode,decode,Simulation} from '../protocol.mjs';
const sample={deviceId:1,seq:1234,fix:true,lat:51.128207,lon:71.430411,altM:347,speedKmh:12.3,sats:9,hdop:.9};
test('Firmware-compatible format, checksum and coordinates',()=>{
  const line=encode(sample);assert.equal(line,'G,1,1234,1,51.128207,71.430411,347,12.3,9,0.9*50\n');assert.deepEqual(decode(line),sample);
});
test('Damaged, truncated, NaN and excess fields are rejected',()=>{
  const line=encode(sample);assert.equal(decode(line.replace('51.128207','51.128208')),null);assert.equal(decode(line.slice(0,-3)),null);assert.equal(decode(''),null);assert.equal(decode('G,*'),null);
});
test('Normal route, no fix, dropped packets, corrupt packets and reset',()=>{
  const sim=new Simulation();for(let i=0;i<10;i++)sim.step();assert.equal(sim.received,10);assert.equal(sim.points.length,10);
  for(let i=0;i<5;i++)sim.step('no-gps');assert.equal(sim.received,15);assert.equal(sim.points.length,10);
  sim.reset();for(let i=0;i<8;i++)sim.step('loss');assert.equal(sim.lost,2);assert.equal(sim.received,6);
  sim.step('corrupt');assert.equal(sim.rejected,1);assert.equal(sim.received,6);
  sim.reset();assert.equal(sim.sent,0);assert.equal(sim.points.length,0);
});
test('Rollover and bounded route history',()=>{
  const sim=new Simulation();sim.seq=65535;assert.equal(sim.step().decoded.seq,65535);assert.equal(sim.step().decoded.seq,0);for(let i=0;i<240;i++)sim.step();assert.equal(sim.points.length,200);
});
test('Worst-case packet fits one E32 subpacket',()=>{
  const line=encode({deviceId:99,seq:65535,fix:true,lat:-89.999999,lon:-179.999999,altM:-999,speedKmh:999.9,sats:99,hdop:99.9});assert.ok(line.length<=58);assert.ok(decode(line));
});
test('Carrier pin assignment matches actual firmware and official E32 order',()=>{
  const pcb=JSON.parse(readFileSync(new URL('../public/pcb.json',import.meta.url)));
  const net=(ref,pin)=>pcb.pads.find(p=>p.ref===ref&&p.number===String(pin)).net;
  for(const [ref,pin,otherRef,otherPin] of [['J3',12,'JGPS',3],['J3',11,'JGPS',2],['J2',10,'JE32',4],['J2',11,'JE32',3],['J2',9,'JE32',1],['J3',9,'JE32',2],['J3',8,'JE32',5]])assert.equal(net(ref,pin),net(otherRef,otherPin));
  assert.equal(net('JE32',6),'+5V_MAIN');assert.equal(net('JE32',7),'GND');assert.equal(net('JGPS',1),'+3V3');assert.notEqual(net('JP1',1),net('JP1',2));
});
test('1001 packets from the compiled C++ firmware codec decode and re-encode identically',()=>{
  const vectors=readFileSync(new URL('../public/downloads/firmware-vectors.txt',import.meta.url),'utf8').trim().split('\n');
  assert.equal(vectors.length,1001);
  for(const vector of vectors){const packet=decode(vector);assert.ok(packet);assert.equal(encode(packet),vector+'\n');}
});
