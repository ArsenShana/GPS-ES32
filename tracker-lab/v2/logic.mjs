import {encode} from '../protocol.mjs';
export class TrackerV2 {
  constructor(){this.reset();}
  reset(){this.time=0;this.lastTx=0;this.lastMotion=0;this.lastWake=0;this.state='BOOT';this.sent=0;this.sequence=0;this.wire='';}
  tick(scenario='moving'){
    this.time+=5000;
    const motion=scenario==='moving',low=scenario==='low-battery',fix=!['no-gps','low-battery'].includes(scenario),busy=scenario==='busy';
    if(motion)this.lastMotion=this.time;
    let note='Ожидание GPS-фикса.',gnss=true,radio=false,transmitted=false;
    if(low){this.state='LOW_BAT';gnss=false;note='Низкий заряд: GNSS отключён, передача остановлена.';}
    else if(this.state==='SLEEP'&&motion){this.state='ACQUIRE';this.lastWake=this.time;note='Движение: включено питание GNSS.';}
    else if(this.state==='SLEEP'&&this.time-this.lastWake<300000){gnss=false;note='Стоянка: GNSS выключен, радио в sleep; ожидание движения.';}
    else if(!motion&&fix&&this.time-this.lastMotion>=60000&&this.state!=='SLEEP'){this.state='SLEEP';this.lastWake=this.time;gnss=false;note='60 секунд без движения: переход в сон.';}
    else{
      if(this.state==='SLEEP'){this.lastMotion=this.time;this.lastWake=this.time;}
      this.state=fix?'TRACK':'ACQUIRE';
      if(fix&&this.time-this.lastTx>=5000){
        radio=true;
        if(busy)note='AUX=LOW: передача отложена, счётчик пакетов не увеличен.';
        else{
          const a=this.time/300000*Math.PI*2;
          this.wire=encode({deviceId:2,seq:this.sequence++&65535,fix:true,lat:51.128207+.0045*Math.sin(a),lon:71.430411+.0072*Math.cos(a),altM:347,speedKmh:motion?37.7:0,sats:9,hdop:.9});
          this.sent++;this.lastTx=this.time;transmitted=true;note='Координаты переданы. После передачи радио снова уходит в sleep.';
        }
      }
    }
    return {state:this.state,gnss,radio,transmitted,note,time:this.time,wire:this.wire,sent:this.sent};
  }
}
