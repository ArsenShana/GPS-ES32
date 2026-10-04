import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TrackerV2} from '../v2/logic.mjs';
const board=JSON.parse(readFileSync(new URL('../v2/public/board.json',import.meta.url)));
test('V2 waits for fix and radio readiness without consuming sequence numbers',()=>{
 const s=new TrackerV2();s.tick('no-gps');assert.equal(s.state,'ACQUIRE');s.tick('busy');assert.equal(s.sent,0);assert.equal(s.sequence,0);const r=s.tick('moving');assert.equal(r.transmitted,true);assert.equal(s.sent,1);assert.ok(r.wire.length>20);
});
test('V2 sleeps on parking and wakes on motion',()=>{
 const s=new TrackerV2();for(let i=0;i<12;i++)s.tick('parked');assert.equal(s.state,'SLEEP');assert.equal(s.tick('parked').gnss,false);assert.equal(s.tick('moving').state,'ACQUIRE');assert.equal(s.tick('moving').state,'TRACK');
});
test('V2 low battery suspends GNSS and transmission',()=>{
 const s=new TrackerV2();const r=s.tick('low-battery');assert.equal(r.state,'LOW_BAT');assert.equal(r.gnss,false);assert.equal(s.sent,0);
});
test('V2 placement keeps distinct-net pads separated by at least 0.15 mm',()=>{
 for(let i=0;i<board.pads.length;i++)for(const b of board.pads.slice(i+1)){
  const a=board.pads[i];if(a.layer!==b.layer||a.net===b.net||!a.net||!b.net)continue;
  const dx=Math.max(0,Math.abs(a.x-b.x)-(a.w+b.w)/2),dy=Math.max(0,Math.abs(a.y-b.y)-(a.h+b.h)/2);
  assert.ok(Math.hypot(dx,dy)>=.15-1e-6,`${a.ref}.${a.num} / ${b.ref}.${b.num}`);
 }
});
test('UART nets join MCU transmit to module receive and USB pins are assigned',()=>{
 const pin=(ref,num)=>board.pads.find(p=>p.ref===ref&&p.num===String(num)).net;
 assert.equal(pin('U1',30),pin('U2',3));assert.equal(pin('U1',31),pin('U2',2));assert.equal(pin('U1',12),pin('U3',22));assert.equal(pin('U1',13),pin('U3',23));assert.equal(pin('U1',32),'USB_DM');assert.equal(pin('U1',33),'USB_DP');
});
