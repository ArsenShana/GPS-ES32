export function checksum(body) {return [...body].reduce((c,s)=>c^s.charCodeAt(0),0).toString(16).padStart(2,'0').toUpperCase();}
export function encode(p) {
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const body=`G,${clamp(p.deviceId,0,99)},${p.seq},${p.fix?1:0},${clamp(p.lat,-90,90).toFixed(6)},${clamp(p.lon,-180,180).toFixed(6)},${clamp(p.altM,-999,9999)},${clamp(p.speedKmh,0,999.9).toFixed(1)},${clamp(p.sats,0,99)},${clamp(p.hdop,0,99.9).toFixed(1)}`;
  const line=body+'*'+checksum(body)+'\n';
  if(line.length>58)throw new Error('Пакет длиннее 58 байт');
  return line;
}
export function decode(line) {
  const m=/^(G,[^*]+)\*([\da-fA-F]{2})[\r\n]*$/.exec(line);
  if(!m||m[1].length+4>58||checksum(m[1])!==m[2].toUpperCase())return null;
  const f=m[1].split(',').slice(1);
  if(f.length!==9||f.some(x=>!x.length))return null;
  const values=f.map(Number);
  const ranges=[[0,99],[0,65535],[0,1],[-90,90],[-180,180],[-999,9999],[0,999.9],[0,99],[0,99.9]];
  if(values.some((v,i)=>!Number.isFinite(v)||v<ranges[i][0]||v>ranges[i][1]))return null;
  if([0,1,2,5,7].some(i=>!/^[-+]?\d+$/.test(f[i])))return null;
  const [deviceId,seq,fix,lat,lon,altM,speedKmh,sats,hdop]=values;
  return {deviceId,seq,fix:!!fix,lat,lon,altM,speedKmh,sats,hdop};
}
export class Simulation {
  constructor(){this.reset();}
  reset(){this.seq=0;this.sent=0;this.received=0;this.rejected=0;this.lost=0;this.points=[];this.previous=null;}
  step(mode='normal'){
    const seq=this.seq++ & 65535, a=seq/60*Math.PI*2;
    const packet={deviceId:1,seq,fix:mode!=='no-gps',lat:51.128207+.0045*Math.sin(a),lon:71.430411+.0072*Math.cos(a),altM:347,speedKmh:37.7,sats:mode==='no-gps'?0:9,hdop:mode==='no-gps'?99.9:.9};
    let wire=encode(packet);this.sent++;
    const dropped=mode==='loss'&&seq%4===3;
    if(mode==='corrupt')wire=wire.replace('G,1,','G,2,');
    const decoded=dropped?null:decode(wire);
    if(dropped)this.lost++;
    else if(!decoded)this.rejected++;
    else{
      this.received++;
      this.previous=decoded;
      if(decoded.fix){this.points.push([decoded.lat,decoded.lon]);if(this.points.length>200)this.points.shift();}
    }
    return {packet,wire,decoded,dropped};
  }
}
